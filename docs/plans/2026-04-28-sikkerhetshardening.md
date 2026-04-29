# Sikkerhetshardening — supply-chain og defense-in-depth

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redusere angrepsflate på supply-chain (npm-pakker, GitHub Actions, Dependabot-flyt) og lukke defense-in-depth-hull i produksjon (CSP, headers, token-håndtering, XSS via CMS).

**Architecture:** Tre lag — (1) verifiseringslaget før kode kjører i build/CI (lockfile, SHA-pinning, allowlists), (2) blast-radius-laget som begrenser hva en kompromittert avhengighet kan oppnå (CSP i CloudFront, Permissions-Policy, sandbox), og (3) klient-lag-fixer (XSS-luke, token-storage).

**Tech Stack:** GitHub Actions, Dependabot, Astro 5, AWS CloudFront, npm.

---

## Funn fra audit (2026-04-28)

| # | Alvorlighet | Funn | Fil/Sted |
|---|-------------|------|----------|
| F1 | Kritisk | Dependabot auto-merge kjører på minor/patch uten human review → kompromittert dep kan nå prod-build | `.github/workflows/dependabot-auto-merge.yml` |
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
| `.github/workflows/dependabot-auto-merge.yml` | Begrens auto-merge til devDeps og security-updates; manuell review for runtime-deps |
| `.github/workflows/deploy.yml` | SHA-pin actions; legg til `npm audit signatures`; kjør tester før dispatch-build |
| `.github/workflows/codeql.yml` | SHA-pin actions |
| `.github/workflows/auto-pr.yml` | SHA-pin actions |
| `.github/dependabot.yml` | Skill ut dev/runtime-grupper; aktivere security-only group |
| `src/scripts/textFormatter.js` | HTML-escape input før regex-erstatning i `formatInfoText` |
| `src/scripts/__tests__/textFormatter.test.js` | XSS-tester for `formatInfoText` |
| `src/middleware.ts` | Stram CSP, fjern unødvendige CDN-er, legg til Permissions-Policy + COOP/COEP |
| `terraform/cloudfront/` eller manuell CloudFront Response Headers Policy | Speil produksjons-CSP og security-headers |
| `src/scripts/admin-auth.js` | Vurder migrering fra localStorage til sessionStorage-only + httpOnly er ikke mulig fra browser, men kan begrense lifetime |
| `package.json` | Legg til `audit` og `audit:signatures` script |
| `docs/architecture/sikkerhet.md` | Oppdater med supply-chain-kontroller |

---

## Task 1: Stram dependabot auto-merge (F1) — KRITISK

Stopp at runtime-dependencies auto-merges uten review. Begrens auto-merge til:
- devDependencies (test/build-tooling)
- security-updates (Dependabot security alert)
- patch-versjon for tooling som ikke kjører i prod-bundle

Runtime-dependencies (`marked`, `dompurify`, `easymde`, `flatpickr`, `leaflet`, `astro`, `@googleapis/*`, `google-auth-library`, `tailwindcss`, `sharp`) krever manuell review uansett bump-type.

- [ ] **Steg 1.1: Skill dependabot-grupper i `.github/dependabot.yml`**

  Erstatt nåværende `groups: dependencies: patterns: ["*"]` med separate update-blokker for ordinær versjonsbump (gruppert per type) og security-updates (eget top-level block siden `applies-to` historisk ikke har vært stabilt inne i groups):

  ```yaml
  updates:
    - package-ecosystem: npm
      directory: /
      schedule: { interval: weekly }
      groups:
        runtime-dependencies:
          dependency-type: production
          patterns: ["*"]
        dev-dependencies:
          dependency-type: development
          patterns: ["*"]
    - package-ecosystem: npm
      directory: /
      schedule: { interval: daily }
      open-pull-requests-limit: 10
      labels: ["security"]
      # Egen kjøring som kun åpner PR for security-advisories — Dependabot prioriterer disse
      # (security-updates kommer uansett, dette gir tydelig label/scheduling).
  ```

  Notér: hvis du senere vil bruke `applies-to: security-updates` som group-property og det er stabilt i Dependabot ved implementeringstidspunkt, kan dette forenkles til ett `updates`-block med tre groups.

- [ ] **Steg 1.2: Endre auto-merge til kun dev og security**

  I `.github/workflows/dependabot-auto-merge.yml`, bytt vilkår fra `update-type != version-update:semver-major` til en eksplisitt allowlist basert på `dependabot/fetch-metadata`-outputs (kun `dependency-type` og `update-type` — disse er stabile):

  ```yaml
  if: >-
    steps.metadata.outputs.update-type != 'version-update:semver-major'
    && (
      steps.metadata.outputs.dependency-type == 'direct:development'
      || steps.metadata.outputs.dependency-type == 'indirect'
    )
  ```

  For runtime-PRer (`dependency-type == 'direct:production'`): legg til et eget step som kommenterer på PR-en med varsel om at manuell review kreves og assigner reviewer (`gh pr edit --add-reviewer`).

- [ ] **Steg 1.3: Verifiser med en test-PR**

  Lag en throwaway-PR som bumper en runtime-dep manuelt, og en som bumper en dev-dep. Bekreft at runtime krever review og dev auto-merger.

---

## Task 2: SHA-pin GitHub Actions (F4)

Pin alle eksterne actions til full commit-SHA med kommentar på versjon. Dependabot støtter SHA-pinning for actions hvis du legger til `package-ecosystem: github-actions` (sjekk om dette mangler).

- [ ] **Steg 2.1: Generer SHA-tabell**

  For hver action i bruk (`actions/checkout@v6`, `actions/setup-node@v6`, `actions/upload-artifact@v7`, `actions/download-artifact@v8`, `aws-actions/configure-aws-credentials@v6`, `dependabot/fetch-metadata@v2`, `github/codeql-action/init@v3`, `github/codeql-action/analyze@v3`), kjør:
  ```bash
  gh api repos/<owner>/<repo>/git/ref/tags/<tag> --jq .object.sha
  ```
  Lag en lookup-tabell.

- [ ] **Steg 2.2: Erstatt alle `@vN` med `@<sha>  # vN.M.K`**

  Format:
  ```yaml
  - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11  # v4.1.1
  ```

- [ ] **Steg 2.3: Legg til Dependabot for github-actions**

  I `.github/dependabot.yml`:
  ```yaml
  - package-ecosystem: github-actions
    directory: /
    schedule: { interval: weekly }
  ```
  Disse PR-ene oppdaterer SHA + kommentar; auto-merge kan tillates på samme måte som dev-deps.

---

## Task 3: Begrens `MY_GITHUB_PAT` blast-radius (F5)

`MY_GITHUB_PAT` brukes både i auto-merge og auto-pr. Dette tokenet har bredere rettigheter enn `GITHUB_TOKEN`. Hvis en npm-pakke med postinstall-script smugles inn via auto-merge, kan den lese `process.env.GITHUB_TOKEN` (samme env block) og pushe direkte til main.

- [ ] **Steg 3.1: Migrer til en GitHub App eller fine-grained PAT**

  Lag en fine-grained PAT med kun:
  - `Contents: read/write` på dette repoet
  - `Pull requests: write`
  - Ingen `workflows`, `packages`, `secrets`, `actions`

  Eller (bedre) lag en GitHub App for organisasjonen og bruk `tibdex/github-app-token` til å hente kortlevet token.

- [ ] **Steg 3.2: Sett expiry på max 90 dager**

  Notér i `docs/architecture/sikkerhet.md` når den skal rulleres. Vurder å sette opp et superpowers/schedule-routine for rotering.

- [ ] **Steg 3.3: Fjern PAT fra alle steg som ikke trenger den**

  Verifiser at `auto-pr.yml`-stegene som bare leser, bruker `GITHUB_TOKEN` (default), ikke PAT.

---

## Task 4: Aktiver `npm audit signatures` og `--ignore-scripts` der mulig (F1, F9)

Supply-chain-angrep utnytter ofte postinstall-scripts. npm støtter signaturverifisering siden npm 9 (`npm audit signatures`).

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

- [ ] **Steg 4.3: Vurder `--ignore-scripts` i prod-builds**

  Hvis ingen prod-deps trenger postinstall (test med `npm ci --ignore-scripts && npm run build:ci`), legg til som default. Sharp og noen native-modules bruker postinstall — verifiser kompatibilitet før påslag.

- [ ] **Steg 4.4: Aktiver `npm audit --audit-level=high` som CI-gate**

  Som ny step i deploy.yml: `npm audit --audit-level=high`. Fail-fast på nye sårbarheter.

---

## Task 5: Flytt CSP og security-headers til CloudFront (F2, F8) — KRITISK

`middleware.ts` kjører ikke på S3-statisk. Produksjon må ha en CloudFront **Response Headers Policy** med samme (eller strammere) policy. Dette er det viktigste blast-radius-tiltaket: hvis en kompromittert build-dep injiserer skript, stopper CSP `connect-src` exfiltrering til angriperens domene.

- [ ] **Steg 5.1: Definer prod-CSP**

  Strammere enn middleware:
  - Fjern `'unsafe-inline'` fra `script-src` (Astro produserer hashed scripts; bruk `'self' 'wasm-unsafe-eval'` om nødvendig)
  - Behold `'unsafe-inline'` i `style-src` kun fordi Tailwind v4 inliner kritisk CSS
  - Begrens `connect-src` til kun Google API-endepunkter brukt på admin-siden
  - `frame-ancestors 'none'`
  - `report-uri` til en endpoint vi kan logge brudd på (eller en Lambda)

- [ ] **Steg 5.2: Opprett Response Headers Policy i CloudFront**

  Via AWS Console eller IaC. Inkluder:
  - `Content-Security-Policy` (verdi fra 5.1)
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`
  - `Cross-Origin-Opener-Policy: same-origin-allow-popups` (admin trenger Google popup)
  - `Cross-Origin-Resource-Policy: same-origin`

- [ ] **Steg 5.3: Knytt policy til distribusjonen**

  Behavior `*` får policyen. Verifiser med `curl -I https://tennerogtrivsel.no/`.

- [ ] **Steg 5.4: Speil i `middleware.ts`**

  Hold dev-CSP synkronisert med prod for å fange opp brudd lokalt før deploy. Lag en CSP-streng-konstant som genereres fra én kilde (f.eks. en JS-fil) og brukes både i middleware og som input til Terraform/manuell CloudFront-config.

- [ ] **Steg 5.5: E2E-test som verifiserer headers i prod-build**

  Konkret implementasjon (velg én — første er enklest):

  **Alt A — Astro middleware-sjekk i preview:** Behold `middleware.ts` aktiv i `astro preview` (samme prosess som E2E-tester allerede bruker, jf. b54f156), og legg til en Playwright-test som henter `/` og asserter at `Content-Security-Policy`-headeren matcher prod-strengen og at sidene laster uten konsoll-`SecurityPolicyViolation`-events. Krever at middleware er sannhetskilden — flyttes ved Steg 5.4 til en delt konstant.

  **Alt B — Eksplisitt proxy:** Kjør Playwright med `webServer: { command: 'node tools/preview-with-headers.mjs' }` der scriptet er en liten Express/Node http-proxy som videresender til `astro preview` og injiserer prod-CSP/headers fra samme delte konstant. Mer arbeid, men nærmere prod-virkelighet.

  Velg A med mindre middleware ikke kan brukes som sannhetskilde.

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
  - Ved page-load: hvis `rememberMe`-flagget er satt og sessionStorage er tom, kjører vi `silentLogin()` — som benytter Google sin egen httpOnly session-cookie via GIS uten popup når brukeren fortsatt har gyldig Google-sesjon. Dette gir samme UX som dagens «husk meg» i de aller fleste tilfeller (bruker er innlogget i Google), men uten å lagre token vi selv kan miste til XSS.
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

- [ ] **Steg 8.3: Erstatt `'unsafe-inline'` script-src med nonce**

  Astro 5 støtter `nonce`-injeksjon for inline-script-tags. Generer en nonce per request i middleware og injiser i CSP samt på alle inline `<script>`-tags som Astro genererer.

  **Ikke bruk `'strict-dynamic'` her:** når `'strict-dynamic'` er aktivt blir host-allowlists i `script-src` (inkl. `accounts.google.com`, `apis.google.com`) ignorert — kun nonces og hashes teller. Google Identity Services laster inn child-scripts via egne mekanismer, og selv om GIS sin parent-script er nonce-merket vil child-loading ofte feile under en streng `strict-dynamic`-policy. Test dette grundig i en preview-deploy før du vurderer å skru på `strict-dynamic`. For prod: hold deg til nonce + eksplisitte host-allowlists.

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

1. **Task 1** (auto-merge) — gjør først, stopper bløding
2. **Task 6** (XSS-fix) — lite arbeid, høy verdi
3. **Task 5** (CSP i CloudFront) — størst blast-radius-reduksjon
4. **Task 4** (audit signatures) — quick win i CI
5. **Task 2** (SHA-pin actions) — mekanisk men viktig
6. **Task 3** (PAT) — krever litt admin-arbeid utenfor repo
7. **Task 7, 8, 9, 10, 11, 12** — i parallell etter hovedløpet

Hver task lander som egen PR via `git review`. Estimat: ~1 dags fokusert arbeid for Task 1+4+6, halv dag per for resten av Kritisk/Høy.
