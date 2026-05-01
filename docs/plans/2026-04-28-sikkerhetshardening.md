# Sikkerhetshardening — supply-chain og defense-in-depth

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redusere angrepsflate på supply-chain (npm-pakker, GitHub Actions, Dependabot-flyt) og lukke defense-in-depth-hull i produksjon (CSP, headers, token-håndtering, XSS via CMS).

**Architecture:** Tre lag — (1) verifiseringslaget før kode kjører i build/CI (lockfile, SHA-pinning, allowlists), (2) blast-radius-laget som begrenser hva en kompromittert avhengighet kan oppnå (CSP i CloudFront, Permissions-Policy, sandbox), og (3) klient-lag-fixer (XSS-luke, token-storage).

**Tech Stack:** GitHub Actions, Dependabot, Astro 5, AWS CloudFront, npm.

---

## Funn fra audit (2026-04-28)

| # | Alvorlighet | Funn | Fil/Sted |
|---|-------------|------|----------|
| F1 | Kritisk | Dependabot auto-merge kjører på fersk minor/patch uten cooldown → silent supply-chain-angrep (typosquat, kompromittert publisher) når prod-build før community oppdager det | `.github/workflows/dependabot-auto-merge.yml`, `.github/dependabot.yml` |
| F2 | Kritisk | CSP eksisterer kun i `middleware.ts` (SSR/dev). S3+CloudFront-prod har ingen CSP | `src/middleware.ts`, mangler CloudFront Response Headers Policy |
| F3 | Høy | `formatInfoText` er XSS-vektor — `set:html` på CMS-styrt streng uten escaping av rest-innhold | `src/scripts/textFormatter.js:25-37`, `src/components/Kontakt.astro:104` |
| F4 | Høy | GitHub Actions pinnet til major-tag (`@v6`), ikke commit-SHA — action-publisher-kompromittering når CI-secrets | alle `.github/workflows/*.yml` |
| F5 | Høy | `MY_GITHUB_PAT` med `contents: write` brukt i auto-merge — postinstall-script i merget pakke kan eksfiltrere | `dependabot-auto-merge.yml`, `auto-pr.yml` |
| F6 | Høy | Admin OAuth-token i `localStorage` — XSS = full Drive/Sheets takeover | `src/scripts/admin-auth.js:96-103` |
| F7 | Medium | `'unsafe-inline'` i `script-src` og `style-src` (selv om CSP bare er i dev) | `src/middleware.ts:6,8` |
| F8 | Medium | Mangler `Permissions-Policy`, `Strict-Transport-Security`, `Cross-Origin-*`-headers | `src/middleware.ts` + CloudFront |
| F9 | Medium | Ingen lockfile-integritet eller SBOM i CI | `.github/workflows/deploy.yml` |
| F10 | Medium | `PUBLIC_GOOGLE_API_KEY` eksponert i klient — uvisst om HTTP-referrer-restricted i Google Cloud Console | `src/pages/admin/index.astro` |
| F11 | Lav | `repository_dispatch` hopper over unit-tester før build/deploy | `.github/workflows/deploy.yml:71-114` |
| F12 | Lav | Mange `innerHTML = `-template-strings i admin uten DOMPurify (input er statisk, men skjør ved fremtidig refactor) | `src/scripts/admin-dashboard.js`, `admin-module-*.js` — addresseres i Task 11 |

**Bestått:**
- `npm ci` brukt overalt (lockfile-respekterende)
- `assertSafePath` beskytter mot path traversal i sync-data
- `escapeDriveQuery` beskytter Drive-query mot injection
- DOMPurify brukt på prisliste/tannleger/bilder/dashboard-render
- Lambda: timing-safe origin-verify, rate-limit, honeypot, validering
- CodeQL aktivert
- Service-account scopes er readonly
- `valueRenderOption: 'UNFORMATTED_VALUE'`
- npm audit: 0 sårbarheter

---

## Filer som endres

| Fil | Rolle |
|-----|-------|
| `.github/workflows/dependabot-auto-merge.yml` | Auto-merge for version-updates (allerede cooldown-filtrert), manuell review for security-updates |
| `.github/workflows/deploy.yml` | SHA-pin actions; legg til `npm audit signatures`; kjør tester før dispatch-build |
| `.github/workflows/codeql.yml` | SHA-pin actions |
| `.github/workflows/auto-pr.yml` | SHA-pin actions |
| `.github/dependabot.yml` | Aktivere `cooldown` (7 dager default), splitte version-updates / security-updates i egne grupper, legge til `github-actions`-ecosystem |
| `src/scripts/textFormatter.js` | HTML-escape input før regex-erstatning i `formatInfoText` |
| `src/scripts/__tests__/textFormatter.test.js` | XSS-tester for `formatInfoText` |
| `src/middleware.ts` | Stram CSP, fjern unødvendige CDN-er, legg til Permissions-Policy + COOP/COEP |
| `terraform/cloudfront/` eller manuell CloudFront Response Headers Policy | Speil produksjons-CSP og security-headers |
| `src/scripts/admin-auth.js` | Vurder migrering fra localStorage til sessionStorage-only + httpOnly er ikke mulig fra browser, men kan begrense lifetime |
| `package.json` | Legg til `audit` og `audit:signatures` script |
| `docs/architecture/sikkerhet.md` | Oppdater med supply-chain-kontroller |

---

## Task 1: Cooldown-basert auto-merge (F1) — KRITISK

**Strategi (besluttet 2026-05-02):** Vi unngår silent supply-chain-angrep ved å ligge ~1 uke bak nye versjoner via Dependabot `cooldown`, ikke ved å allowliste pakker manuelt. Når en versjon har ligget åpent i 7 dager har community/socket.dev typisk fanget kompromitterte publisher-kontoer, typosquats og malicious postinstall-scripts. Auto-merge er da trygt selv for runtime-deps.

**Cooldown gjelder kun version-updates** — Dependabot security-advisories (kjente CVE-er via GHSA) sender PR umiddelbart, og disse krever manuell review uansett. Det gir to klare flyter:

| Flyt | Cooldown | Auto-merge | Manuell review |
|------|----------|------------|----------------|
| `version-updates` (patch/minor) | 7 dager (3 for patch, 30 for major) | Ja, automatisk | Nei |
| `version-updates` (major) | 30 dager | Nei | Ja, flagges |
| `security-updates` (CVE) | Ingen | Nei | Ja, flagges |

Dette erstatter den tidligere planen om å splitte runtime/dev og whiteliste pakker per type — den var mer kompleks uten å være tryggere.

- [x] **Steg 1.1: Aktiver cooldown og splitt grupper på `applies-to` i `.github/dependabot.yml`**

  Erstatt dagens `groups: dependencies: patterns: ["*"]` med cooldown + to grupper per ecosystem (én for version-updates, én for security):

  ```yaml
  version: 2
  updates:
    - package-ecosystem: npm
      directory: /
      schedule: { interval: weekly }
      open-pull-requests-limit: 10
      rebase-strategy: auto
      cooldown:
        default-days: 7
        semver-major-days: 30
        semver-minor-days: 7
        semver-patch-days: 3
      groups:
        version-updates:
          applies-to: version-updates
          patterns: ["*"]
        security-updates:
          applies-to: security-updates
          patterns: ["*"]

    - package-ecosystem: npm
      directory: /lambda/kontakt-form-handler
      schedule: { interval: weekly }
      open-pull-requests-limit: 5
      rebase-strategy: auto
      cooldown:
        default-days: 7
        semver-major-days: 30
        semver-minor-days: 7
        semver-patch-days: 3
      groups:
        lambda-version-updates:
          applies-to: version-updates
          patterns: ["*"]
        lambda-security-updates:
          applies-to: security-updates
          patterns: ["*"]
  ```

  GitHub Actions-ecosystem legges til som eget block i Task 2 (med samme cooldown).

  Schedule endres fra `daily` til `weekly`: med cooldown filtreres uansett alt yngre enn 7 dager bort, og weekly gir ryddigere PR-flyt.

- [x] **Steg 1.2: Forenkle auto-merge: skill version-updates fra security-updates**

  I `.github/workflows/dependabot-auto-merge.yml`. `dependabot/fetch-metadata` eksponerer `alert-state`-output: tom streng for ordinære version-updates, satt (f.eks. `OPEN`) for security-advisory-PR-er. Det gir en ren split:

  ```yaml
  - name: Approve and Enable Auto-Merge
    if: >-
      steps.metadata.outputs.update-type != 'version-update:semver-major'
      && steps.metadata.outputs.alert-state == ''
    run: |
      gh pr review --approve "$PR_URL"
      gh pr merge --auto --rebase "$PR_URL"
    env:
      PR_URL: ${{ github.event.pull_request.html_url }}
      GITHUB_TOKEN: ${{ secrets.MY_GITHUB_PAT }}

  - name: Flag major updates for manual review
    if: steps.metadata.outputs.update-type == 'version-update:semver-major'
    run: |
      gh pr edit "$PR_URL" --add-assignee ahaarrestad || true
      gh pr edit "$PR_URL" --add-reviewer ahaarrestad || true
      gh pr comment "$PR_URL" --body "@ahaarrestad Auto-merge hoppet over — major-oppdatering (\`${DEPS}\`). Krever manuell review."
    env:
      PR_URL: ${{ github.event.pull_request.html_url }}
      DEPS: ${{ steps.metadata.outputs.dependency-names }}
      GITHUB_TOKEN: ${{ secrets.MY_GITHUB_PAT }}

  - name: Flag security updates for manual review
    if: steps.metadata.outputs.alert-state != ''
    run: |
      gh pr edit "$PR_URL" --add-assignee ahaarrestad || true
      gh pr edit "$PR_URL" --add-reviewer ahaarrestad || true
      gh pr comment "$PR_URL" --body "@ahaarrestad Security-advisory (\`${DEPS}\`, alert: ${ALERT}). Cooldown er omgått for CVE-fix — krever manuell review før merge."
    env:
      PR_URL: ${{ github.event.pull_request.html_url }}
      DEPS: ${{ steps.metadata.outputs.dependency-names }}
      ALERT: ${{ steps.metadata.outputs.alert-state }}
      GITHUB_TOKEN: ${{ secrets.MY_GITHUB_PAT }}
  ```

  Notér: `gh pr merge --auto` fyrer først når alle required checks (unit-/E2E-tester, `npm audit signatures` fra Task 4) er grønne. Cooldown er ikke en erstatning for disse — det er et supplement: cooldown beskytter mot ukjente angrep i pakkene, mens audit signatures + tester beskytter mot kjente (signaturbrudd, regresjoner). Dokumenter required checks i `docs/architecture/sikkerhet.md`.

- [x] **Steg 1.3: Verifiser med en test-PR**

  Lag en throwaway-PR som bumper en runtime-dep til en ≥7 dager gammel versjon manuelt, og bekreft at auto-merge-jobben kjører `gh pr review --approve`. For security-flyten: hvis det ikke finnes en åpen GHSA mot prosjektet akkurat nå, verifiser logikken ved å midlertidig hardkode `alert-state=OPEN` i et lokalt workflow-run, eller stol på at koden er triviell nok (én if-setning) og dokumenter testen som "venter på neste reelle GHSA".

- [x] **Steg 1.4: Dokumenter cooldown-rasjonale i `docs/architecture/sikkerhet.md`**

  Kort seksjon: hvorfor 7/3/30 dager, hvordan cooldown og security-flow samspiller, og at trade-off'en er bevisst (~80–90 % av npm-angrep fanges innen en uke; sjeldne lange-løp-angrep som event-stream er en akseptert restrisiko).

---

## Task 2: SHA-pin GitHub Actions (F4)

Pin alle eksterne actions til full commit-SHA med kommentar på versjon. Dependabot støtter SHA-pinning for actions hvis du legger til `package-ecosystem: github-actions` (sjekk om dette mangler).

- [ ] **Steg 2.1: Generer SHA-tabell**

  For hver action i bruk (`actions/checkout@v6`, `actions/setup-node@v6`, `actions/upload-artifact@v7`, `actions/download-artifact@v8`, `aws-actions/configure-aws-credentials@v6`, `dependabot/fetch-metadata@v2`, `github/codeql-action/init@v3`, `github/codeql-action/analyze@v3`), kjør:
  ```bash
  gh api repos/<owner>/<repo>/git/ref/tags/<tag> --jq .object.sha
  ```
  Lag en lookup-tabell.

- [ ] **Steg 2.2: Erstatt alle `@vN` med `@<sha>  # vN.M.K` og rydd opp inkonsistens**

  Format:
  ```yaml
  - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11  # v4.1.1
  ```

  Samtidig: `actions/checkout` er i dag `@v4` i `auto-pr.yml` og `codeql.yml`, men `@v6` i `deploy.yml`. Bring alle til samme major (siste stabile) før SHA-pinning, slik at Dependabot ikke gir tre parallelle bumps senere.

- [ ] **Steg 2.3: Legg til Dependabot for github-actions med cooldown**

  I `.github/dependabot.yml`:
  ```yaml
  - package-ecosystem: github-actions
    directory: /
    schedule: { interval: weekly }
    cooldown:
      default-days: 7
      semver-major-days: 30
      semver-minor-days: 7
      semver-patch-days: 3
    groups:
      actions-version-updates:
        applies-to: version-updates
        patterns: ["*"]
      actions-security-updates:
        applies-to: security-updates
        patterns: ["*"]
  ```
  Disse PR-ene oppdaterer SHA + kommentar. Auto-merge-workflow fra Task 1.2 dekker også github-actions-PR-er (samme `alert-state`/`update-type`-logikk gjelder).

---

## Task 3: Begrens `MY_GITHUB_PAT` blast-radius (F5)

> **Status (2026-05-02):** Utsatt. Implementeres etter Task 1, 2, 4 er landet.

`MY_GITHUB_PAT` brukes både i auto-merge og auto-pr. Tokenet har bredere rettigheter enn `GITHUB_TOKEN`. Hvis en npm-pakke med postinstall-script smugles inn via auto-merge (cooldown fra Task 1 reduserer denne risikoen, men eliminerer den ikke), kan den lese `process.env.GITHUB_TOKEN` (samme env block) og pushe direkte til main.

**Hvorfor PAT i utgangspunktet:** `GITHUB_TOKEN` har en innebygd anti-loop-sikring — PR-er merget av `GITHUB_TOKEN` trigger ikke etterfølgende workflows på `push: main`. Auto-deploy ville da ikke kjøre etter Dependabot-merge, og bumps ville ligge umergeret-til-prod til neste manuelle push. Vi vil beholde auto-deploy, så vi trenger en token som *ikke* har den begrensningen — enten en PAT eller en GitHub App-installation token.

- [ ] **Steg 3.1: Migrer til fine-grained PAT (anbefalt) eller GitHub App**

  **Primær anbefaling — fine-grained PAT:**

  Lag en fine-grained PAT på `github.com/settings/personal-access-tokens` med kun:
  - Repository access: bare dette repoet
  - `Contents: read/write`
  - `Pull requests: write`
  - Ingen `workflows`, `packages`, `secrets`, `actions`, `administration`

  Erstatt `MY_GITHUB_PAT`-secret med ny token. ~15 min jobb, ROI godt for ett repo med én maintainer.

  **Alternativ — GitHub App** (mer riktig arkitektur, mer setup):

  Bruk **`actions/create-github-app-token`** (offisiell, ikke det deprecaterte `tibdex/github-app-token`). Krever:
  - Opprett en GitHub App for kontoen/orgen med `Contents: read/write` og `Pull requests: write`
  - Installer på dette repoet
  - Lagre App ID og private key som secrets (`APP_ID`, `APP_PRIVATE_KEY`)
  - Bytt ut PAT-bruk med:
    ```yaml
    - uses: actions/create-github-app-token@<sha>  # v1.x
      id: app-token
      with:
        app-id: ${{ secrets.APP_ID }}
        private-key: ${{ secrets.APP_PRIVATE_KEY }}
    - run: gh pr merge --auto --rebase "$PR_URL"
      env:
        GITHUB_TOKEN: ${{ steps.app-token.outputs.token }}
    ```
  - Token er kortlevet (~1 time), ingen rotering nødvendig.

- [ ] **Steg 3.2: Sett expiry på max 90 dager (kun for PAT-alternativet)**

  Notér i `docs/architecture/sikkerhet.md` når token skal rulleres. Sett opp en `/schedule`-routine som varsler 14 dager før expiry. (App-alternativet trenger kun rotering av private key, og GitHub varsler automatisk før key-expiry.)

- [ ] **Steg 3.3: Fjern PAT fra alle steg som ikke trenger den**

  Verifiser at `auto-pr.yml`-stegene som bare leser, bruker `GITHUB_TOKEN` (default), ikke PAT. Dette gjelder uavhengig av PAT vs App-valg.

---

## Task 4: Aktiver `npm audit signatures` og `--ignore-scripts` der mulig (F1, F9)

Supply-chain-angrep utnytter ofte postinstall-scripts. npm støtter signaturverifisering siden npm 9 (`npm audit signatures`).

Steg-rekkefølge (besluttet 2026-05-02): mekanisk først (4.1, 4.2), audit-gate testes parallelt (4.3), `--ignore-scripts` sist fordi det krever empirisk verifisering (4.4).

- [ ] **Steg 4.1: Legg til script i `package.json`**

  ```json
  "scripts": {
    "audit:sigs": "npm audit signatures"
  }
  ```

- [ ] **Steg 4.2: Kjør i CI før build**

  I `deploy.yml`, etter `npm ci` i `e2e-tests` og `build`-job:
  ```yaml
  - name: Verify npm package signatures
    run: npm audit signatures
  ```

- [ ] **Steg 4.3: Aktiver `npm audit --audit-level=critical` som CI-gate**

  Som ny step i deploy.yml: `npm audit --audit-level=critical`. Fail-fast på nye kritiske sårbarheter.

  Hvorfor `critical` (ikke `high`): `high`-CVE-er i transitive dev-deps er hyppige og blokkerer ofte uten reell prod-impact (typisk dev-only ReDoS, prototype pollution i utility-libs som ikke brukes i hot path). `critical` fanger faktisk-kritiske svake punkter uten å gjøre CI flaky. Kombinert med `npm audit signatures` (4.2) og cooldown (Task 1) er dette tilstrekkelig.

- [ ] **Steg 4.4: Vurder `--ignore-scripts` i prod-builds**

  Hvis ingen prod-deps trenger postinstall (test med `npm ci --ignore-scripts && npm run build:ci`), legg til som default. Sharp og noen native-modules bruker postinstall — verifiser kompatibilitet før påslag. Nyere sharp har bundled libvips, så det burde virke; bekreft empirisk før vi gjør det til CI-default.

---

## Task 5: Flytt CSP og security-headers til CloudFront (F2) — KRITISK

`middleware.ts` kjører ikke på S3-statisk. Produksjon må ha en CloudFront **Response Headers Policy** med samme policy. Dette er det viktigste blast-radius-tiltaket: hvis en kompromittert build-dep injiserer skript, stopper CSP `connect-src` exfiltrering til angriperens domene.

**Forenklet tilnærming (besluttet 2026-04-29):**

Vi splitter Task 5 og Task 8. Mål for **denne** task-en er å få CSP **i det hele tatt** til prod, ikke å stramme den. Speil eksisterende middleware-CSP og legg til security-headere som mangler. Innstramming (fjerne `unsafe-inline`, hash-liste, fjerne ubrukte CDN-er) skjer i Task 8 etter at vi har bekreftet at speilingen virker i prod.

Konkrete forenklinger:
- **Behold `'unsafe-inline'` i script-src og style-src** midlertidig — Task 8 strammer
- **Behold dagens CDN-allowlists** — Task 8 reviderer (admin laster faktisk EasyMDE/Flatpickr/Font Awesome fra cdn.jsdelivr.net + cdnjs.cloudflare.com med SRI, så de er **ikke** alle ubrukte)
- **Drop `report-uri`** — krever Lambda-mottaker, blir egen task
- **Manuell AWS Console-konfig**, ikke IaC — repoet har ingen Terraform/CDK i dag, og innføring av IaC er stort arbeid med liten gevinst for ett enkelt CloudFront-objekt. Konfigurasjonen dokumenteres detaljert i `docs/architecture/sikkerhet.md` slik at den er gjenopprettelig manuelt.

**Test-først-strategi (besluttet 2026-04-30):** Vi knytter CSP-policyen til **test-distribusjonen** (`test2.aarrestad.com`) før prod, så vi kan verifisere at admin/OAuth/CDN-er fungerer. Testen-bucketen er tom i dag, så vi reaktiverer test-deploy-stegene i `deploy.yml` (kommentert ut tidligere) som del av denne PR-en. Push til main vil deretter deploye til både test og prod, men CSP-policyen kontrolleres separat per distribusjon i CloudFront.

- [x] **Steg 5.1: Lag delt CSP/headers-konstant**

  Opprett `src/utils/security-headers.ts` med:
  - `CSP`-streng (eksakt kopi av dagens middleware-CSP, ingen endringer i source-listene)
  - `SECURITY_HEADERS`-objekt med alle navn/verdier som skal settes både av middleware og CloudFront

  Modulen er sannhetskilden. `middleware.ts` importerer fra den. CloudFront-konfig dokumenteres i `sikkerhet.md` med samme verdier — copy/paste-vennlig.

- [x] **Steg 5.2: Oppdater `src/middleware.ts` til å bruke delt konstant**

  Fjern hardkodede strenger i middleware. Importer fra `security-headers.ts`. Legg til de nye headerne (HSTS, Permissions-Policy, COOP, CORP) som i dag mangler både i dev og prod.

  Resultat: dev-server og prod skal serve identiske headere når CloudFront-policyen er aktivert. Eksisterende `src/__tests__/middleware.test.ts` utvides med assertions for de nye headerne.

- [x] **Steg 5.3: Drop Playwright E2E-test for headers**

  Begrunnelse: Astro 5 i statisk modus kjører **ikke** middleware i `astro preview` (CI bruker preview, ikke dev). Test ville feilaktig vist headers lokalt (dev-modus) men ikke matche CI/prod-virkeligheten. Dekning er istedet:
  - Unit-tester på `middleware.ts` verifiserer at riktige header-verdier settes (Steg 5.2)
  - Curl mot test- og prod-distribusjonen (Steg 5.5) er den ekte E2E-verifiseringen

- [x] **Steg 5.4: Reaktiver test-deploy i `deploy.yml`**

  Test-bucketen `s3://test2.aarrestad.com-se` er tom i dag (auto-deploy ble kommentert ut). Un-comment:
  - `Deploy to S3 TEST-SE` (linje 134–147)
  - `Invalidate CloudFront cache TEST` (linje 164–168)

  Etter merge vil push til main deploye til både test og prod. Det er greit for vårt formål — CSP-rollout kontrolleres per CloudFront-distribusjon, ikke per S3-deploy.

  Krever GitHub-secret: `CLOUDFRONT_DISTRIBUTION_ID_TEST` (sjekk at den finnes; hvis ikke, workflow feiler synlig).

- [x] **Steg 5.5: Dokumenter AWS Console-prosedyre i `sikkerhet.md`**

  Skriv steg-for-steg for begge distribusjonene:

  1. AWS Console → CloudFront → Policies → Response headers → Create
  2. Konfigurer Custom headers og Custom CSP med eksakte verdier (lim inn fra `src/utils/security-headers.ts`)
  3. **Test først:** Distribution `test2.aarrestad.com` → Behaviors → Edit `*` → velg ny Response headers policy
  4. Vent på CloudFront-deploy (typisk 5–15 min)
  5. Verifiser test:
     - `curl -I https://test2.aarrestad.com/` viser alle headere
     - Last sider i nettleser, sjekk console for CSP-violations
     - `https://test2.aarrestad.com/admin` — Google OAuth-popup fungerer
  6. **Hvis test OK:** gjenta steg 3–5 for prod-distribusjonen (`tennerogtrivsel.no`)
  7. **Hvis test feiler:** rull tilbake — fjern policy fra test-behavior. Fix CSP, prøv igjen.

  Inkluder eksempel-curl-output og rollback-instruks i dokumentet.

- [x] **Steg 5.6: Manuell verifisering i prod**

  Etter at policy er konfigurert på prod:
  - `curl -I https://tennerogtrivsel.no/` viser alle headere
  - Forsiden, `/kontakt`, `/admin` lastes uten console-CSP-feil
  - Google OAuth-login i admin fungerer
  - Hvis noe knekker: rull tilbake via AWS Console (samme prosedyre som i 5.5)

---

## Task 6: Fix XSS i `formatInfoText` (F3) — HØY

CMS-redigerer (eller en angriper med Sheets-skrivetilgang) kan injisere HTML i `phone1`-feltet, som rendres med `set:html`. Funksjonen må HTML-escape input før den gjør regex-erstatning.

- [ ] **Steg 6.1: Skriv test først (TDD)**

  I `src/scripts/__tests__/textFormatter.test.js`:
  ```js
  it('escaper HTML i input før regex-erstatning', () => {
    expect(formatInfoText('<script>alert(1)</script>'))
      .toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(formatInfoText('"><img src=x onerror=alert(1)>'))
      .toBe('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');
  });
  it('beholder telefon/email-formatering etter escape', () => {
    expect(formatInfoText('Ring 22 33 44 55 eller post@example.com'))
      .toContain('<a href="tel:22334455"');
    expect(formatInfoText('Ring 22 33 44 55 eller post@example.com'))
      .toContain('<a href="mailto:post@example.com"');
  });
  ```

- [ ] **Steg 6.2: Implementer escaping**

  Legg til en helper `escapeHtml` (eller bruk eksisterende fra admin-modulen — flytt til `textFormatter.js`):
  ```js
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  ```
  Endre `formatInfoText` til å starte med `let formattedText = escapeHtml(rawText);` før regex-erstatningene.

- [ ] **Steg 6.3: Verifiser at telefon/email-mønstre fortsatt matcher etter escape**

  E-post-tegn (`@`, `.`, alfanum, `_`, `+`, `-`) escapes ikke. Telefonmønster bruker bare siffer og mellomrom — også uberørt. Tester fra 6.1 dekker dette.

- [ ] **Steg 6.4: Sjekk om andre `set:html`-bruk har lignende sårbarhet**

  `grep -rn "set:html" --include="*.astro"` → `SchemaOrg.astro` bruker `JSON.stringify(schema)` som er trygg. `Kontakt.astro:104` er den eneste eksponerte. Verifiser at andre felter (`adresse1`, `adresse2`) ikke senere flyttes til `set:html`.

---

## Task 7: Reduser admin-token blast-radius (F6)

Vi kan ikke flytte token til httpOnly cookie (admin er klient-side SPA mot Google). Men vi kan begrense XSS-blast-radius:

- [ ] **Steg 7.1: Fjern `localStorage`-mode (kun sessionStorage), men behold rememberMe-flagget**

  Trade-off: hvis brukeren lukker hele nettleseren (alle faner) går sessionStorage tapt og brukeren må re-logge inn. Det er bevisst — vi aksepterer en ekstra Google-popup ved cold start mot redusert XSS-blast-radius (1t window → live-tab window).

  Implementasjon:
  - `setRememberMe(true)` lagres i `localStorage` (kun et boolsk flagg, ikke token), slik at vi husker preferansen mellom browser-restarts
  - Selve OAuth-tokenet flyttes fra `localStorage` til `sessionStorage`
  - Ved page-load: hvis `rememberMe`-flagget er satt og sessionStorage er tom, kjører vi `silentLogin()` — GIS gjør en skjult iframe-flyt mot `accounts.google.com` med `prompt: 'none'`, som returnerer et nytt token uten popup når brukeren fortsatt har gyldig Google-sesjon (vår SPA leser **ikke** Google sin session-cookie selv — den er HttpOnly og scoped til Google-domenet). Dette gir samme UX som dagens «husk meg» i de aller fleste tilfeller (bruker er innlogget i Google), men uten å lagre et token vi selv kan miste til XSS.
  - Hvis silent-login feiler (bruker har logget ut av Google) → vis login-knapp som i dag

  Fordel: et stjålet sessionStorage-token dør når fanen lukkes; et stjålet localStorage-token lever til expiry (1t). Et stjålet `rememberMe`-flagg er verdiløst.

- [ ] **Steg 7.2: Kortere effektiv expiry**

  Reduser intern `expiry`-grense fra 60s før Google-expiry til 5min før, slik at silent-refresh skjer oftere → kortere vindu hvor et stjålet token er gyldig.

- [ ] **Steg 7.3: Add `X-Robots-Tag: noindex` på `/admin/*`**

  Sett i CloudFront eller Astro-frontmatter. Allerede `noindex` i `<meta>`, men header er stødigere.

---

## Task 8: Stram middleware-CSP og fjern unødvendige CDN-er (F7)

Mange CDN-er er allowlistet i middleware (`cdn.jsdelivr.net`, `unpkg.com`, `cdnjs.cloudflare.com`) men brukes ikke i bygget output (alt bundles av Vite). Hver allowlist er en angrepsmulighet.

- [ ] **Steg 8.1: Audit faktisk bruk av eksterne CDN-er**

  `grep -rn "cdn\.jsdelivr\|unpkg\|cdnjs" src/` — finn faktisk bruk. Mest sannsynlig kun fra gamle iterasjoner.

- [ ] **Steg 8.2: Fjern ubrukte CDN-er fra CSP**

  Behold kun det som faktisk lastes fra ekstern origin (Google APIs, Drive thumbnails).

- [ ] **Steg 8.3: Erstatt `'unsafe-inline'` script-src med build-time hashes**

  **Default for prod (statisk eksport på S3+CloudFront): bruk `'sha256-...'`-hashes, ikke nonces.** Astro middleware kjører ikke for prerendrede HTML-filer servert av CloudFront — per-request nonce-injeksjon krever Lambda@Edge eller Origin Response-funksjoner som rewriter både CSP-headeren og inline `<script nonce="...">`-attributter. Det er stort infra-arbeid for liten gevinst i et statisk site, fordi inline-scripts som Astro emitterer er stabile på tvers av builds.

  Konkret:
  - Etter `astro build`: kjør et lite post-build-script som leser `dist/**/*.html`, finner alle inline `<script>`-tags, beregner `sha256` av innholdet, samler unique-listen
  - Genererer `'sha256-<base64>'`-tokens som inkluderes i `script-src` i CloudFront Response Headers Policy (Steg 5.2)
  - Hash-listen sjekkes inn i repo (eller genereres som en del av deploy-pipelinen) slik at CSP-strengen er deterministisk og diff-bar

  Nonce-alternativet beholdes kun for SSR-modus (lokal `astro dev`/`preview` via middleware) og for å dokumentere at hvis prosjektet senere bytter til SSR/Lambda@Edge, er overgangen rett frem.

  **Ikke bruk `'strict-dynamic'` her uansett:** når `'strict-dynamic'` er aktivt blir host-allowlists i `script-src` (inkl. `accounts.google.com`, `apis.google.com`) ignorert — kun nonces og hashes teller. Google Identity Services laster inn child-scripts via egne mekanismer, og selv om GIS sin parent-script er hash/nonce-merket vil child-loading ofte feile under en streng `strict-dynamic`-policy. Hold deg til hashes/nonces + eksplisitte host-allowlists.

---

## Task 9: Verifiser `PUBLIC_GOOGLE_API_KEY`-restriksjoner (F10)

- [ ] **Steg 9.1: Sjekk Google Cloud Console**

  Verifiser at `PUBLIC_GOOGLE_API_KEY`:
  - Er **HTTP referrer-restricted** til `https://tennerogtrivsel.no/*` og evt. test-domene
  - Har **API restrictions** til kun de Google APIs den trenger (Drive thumbnails?)
  - Har quota-begrensning satt

- [ ] **Steg 9.2: Dokumenter i `docs/architecture/sikkerhet.md`**

---

## Task 10: Kjør tester før `repository_dispatch`-builds (F11)

Drive-oppdateringer trigger en build som hopper over unit/E2E. Hvis en kompromittert dep snek seg inn mellom siste push og denne triggeren, deployer vi rett til prod.

- [ ] **Steg 10.1: Endre `deploy.yml` til alltid å kreve `unit-tests` og `e2e-tests`**

  Fjern `repository_dispatch`-spesialcasingen i `build`-jobben. Også for Drive-driftet bygg skal tester kjøre.

---

## Task 11: Audit `innerHTML`-template-strings i admin (F12)

50+ steder i admin-modulene gjør `element.innerHTML = \`...\`` med template-strings. De fleste er statiske ikoner og labels — men hvis noen senere interpolerer en variabel uten DOMPurify, blir det XSS uten at noen merker det. Risikoen er lav i dag, men verdien er at vi gjør det vanskelig å gjøre feil senere.

- [ ] **Steg 11.1: Klassifiser hver `innerHTML =`-bruk**

  Kjør `grep -rn "innerHTML\s*=" src/scripts/ | grep -v __tests__`. For hver treff, marker:
  - **Statisk** (kun konstante template-litteraler, ingen `${...}` med eksterne data) → OK
  - **Trygg interpolasjon** (kun escaped strings, eller verdier fra et type-konstrent enum) → OK m/kommentar
  - **Sanitert** (allerede DOMPurify) → OK
  - **Risiko** (interpolerer variabel uten DOMPurify/escapeHtml) → fix

- [ ] **Steg 11.2: Wrap risikable steder med DOMPurify eller escapeHtml**

  For hvert risikabelt treff: enten `DOMPurify.sanitize(...)` på hele HTML-strengen, eller `escapeHtml(verdi)` på hver interpolasjon. Foretrekk `escapeHtml` for enkle tilfeller (bedre ytelse, færre avhengigheter).

- [ ] **Steg 11.3: Lag en lint-regel som flagger `innerHTML =` uten sanitering**

  Velg ESLint (ikke CodeQL) — vi vil ha rask lokal feedback i editor og pre-commit, ikke bare i CI.

  Bruk `eslint-plugin-security` (`detect-non-literal-html`-regelen som baseline) supplert med en liten egendefinert regel: warn ved `AssignmentExpression` der `left` er `MemberExpression` med property `innerHTML` og `right` er en `TemplateLiteral` med `${...}`-uttrykk, med mindre uttrykket er wrappet i `DOMPurify.sanitize(`, `escapeHtml(`, eller linja har `// safe: <reason>`-kommentar.

  Kjør i CI som blokkerende step. CodeQL beholdes for bredere semantisk analyse — vi dupliserer ikke regelen der.

- [ ] **Steg 11.4: Oppdater `docs/guides/test-guide.md` eller en ny `docs/guides/security-guide.md`**

  Dokumenter regelen: `innerHTML` med interpolasjon krever sanitering eller eksplisitt `// safe:`-kommentar.

---

## Task 12: Oppdater dokumentasjon

- [ ] **Steg 12.1: Oppdater `docs/architecture/sikkerhet.md`**

  Legg til seksjoner om:
  - Supply-chain kontroller (auto-merge-policy, SHA-pinning, audit signatures)
  - CloudFront Response Headers Policy (lenke til konfig)
  - Token-lifecycle og storage-rasjonale
  - PAT-rotering

- [ ] **Steg 12.2: Lag `docs/runbooks/supply-chain-incident.md`**

  Hva gjør vi hvis en npm-pakke i produksjon viser seg å være kompromittert? Steg: rull tilbake S3, identifiser pakke fra lockfile, bytt all secrets, varsle.

---

## Rekkefølge og avhengigheter

1. **Task 1** (cooldown + auto-merge) — gjør først, stopper bløding
2. **Task 6** (XSS-fix) — lite arbeid, høy verdi
3. **Task 5** (CSP i CloudFront) — størst blast-radius-reduksjon
4. **Task 4** (audit signatures + critical-gate) — quick win i CI
5. **Task 2** (SHA-pin actions) — mekanisk men viktig
6. **Task 3** (PAT) — **utsatt**, tas etter at Task 1+2+4 er landet
7. **Task 7, 8, 9, 10, 11, 12** — i parallell etter hovedløpet

Hver task lander som egen PR via `git review`. Estimat: ~1 dags fokusert arbeid for Task 1+4+6, halv dag per for resten av Kritisk/Høy.
