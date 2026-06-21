# Arkitektur: Sikkerhet

## DOMPurify og innerHTML

All HTML som settes via `innerHTML` og som inneholder bruker- eller CMS-generert innhold, SKAL saniteres med DOMPurify. **DOMPurify fjerner alle inline event-handlere** (f.eks. `onclick="..."`). Event-lyttere MÅ derfor alltid knyttes programmatisk etter at `innerHTML` er satt — aldri som attributter i template-strenger.

```js
// Feil – onclick strippes av DOMPurify og har ingen effekt:
inner.innerHTML = DOMPurify.sanitize(`<div onclick="doSomething()">...</div>`);

// Riktig – knytt lyttere programmatisk etterpå:
inner.innerHTML = DOMPurify.sanitize(html);
inner.querySelectorAll('.my-btn').forEach(btn => {
    btn.addEventListener('click', () => doSomething());
});
```

I node-miljø (Vitest) finnes ingen DOM, så DOMPurify må mockes i testfiler:
```js
vi.mock('dompurify', () => ({ default: { sanitize: vi.fn(html => html) } }));
```

## Sikkerhetsheadere — sannhetskilde og deployment

**Sannhetskilde:** `src/utils/security-headers.ts` eksporterer `CSP`-strengen og `SECURITY_HEADERS`-objektet med alle navn/verdier.

**Hvor headerne settes:**

| Miljø | Mekanisme | Henter fra |
|-------|-----------|------------|
| Lokal dev (`npm run dev`) | Astro middleware (`src/middleware.ts`) | `SECURITY_HEADERS` |
| `astro preview` (CI E2E) | Ingen — Astro statisk-modus kjører ikke middleware i preview | — |
| Test (`test2.aarrestad.com`) | CloudFront Response Headers Policy | Manuelt kopiert fra `SECURITY_HEADERS` |
| Prod (`tennerogtrivsel.no`) | CloudFront Response Headers Policy | Automatisk oppdatert via CI (update-cloudfront-csp.mjs) |

CSP inkluderer `blob:` i `connect-src` for å støtte thumbnail-forhåndsvisning (blob-URLer fra `getDriveImageBlob()`) i admin-panelet.

### Konfigurering av CloudFront Response Headers Policy

Følg denne prosedyren ved første oppsett, og hver gang `SECURITY_HEADERS` endres i koden.

**Forutsetninger:**
- AWS Console-tilgang til CloudFront-distribusjonene
- Innholdet i `src/utils/security-headers.ts` for å lime inn verdier

**Steg 1 — Opprett policy:**

1. AWS Console → **CloudFront → Policies → Response headers policies → Create response headers policy**
2. Navn: `tot-security-headers` (eller annet beskrivende)
3. **Custom headers** — Legg til alle disse:

   | Header name | Value | Override |
   |-------------|-------|----------|
   | `Content-Security-Policy` | (lim inn `CSP`-konstant fra `security-headers.ts`, alt på én linje, semikolon-separert) | ✅ Yes |
   | `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | ✅ Yes |
   | `X-Content-Type-Options` | `nosniff` | ✅ Yes |
   | `X-Frame-Options` | `DENY` | ✅ Yes |
   | `Referrer-Policy` | `strict-origin-when-cross-origin` | ✅ Yes |
   | `Cross-Origin-Opener-Policy` | `same-origin-allow-popups` | ✅ Yes |
   | `Cross-Origin-Resource-Policy` | `same-origin` | ✅ Yes |
   | `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), interest-cohort=()` | ✅ Yes |

   **NB:** Selv om AWS har egne felter under "Security headers" for HSTS, X-Content-Type-Options, X-Frame-Options og Referrer-Policy, anbefales det å bruke **Custom headers** for alle for å holde CSP-strengen og resten i samme tabell — enklere å vedlikeholde.

4. Lagre policy.

**Steg 2 — Knytt policy til TEST-distribusjonen først:**

1. CloudFront → **Distributions → (test2.aarrestad.com-distribusjonen) → Behaviors**
2. Velg behavior med Path Pattern `*` (default) → **Edit**
3. Under **Response headers policy** velg `tot-security-headers`
4. Save changes
5. Vent 5–15 min på CloudFront-deploy (status: «Deploying» → «Enabled»)

**Steg 3 — Verifiser test:**

```bash
curl -I https://test2.aarrestad.com/
```

Forventet utdrag:

```
HTTP/2 200
content-security-policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com ...
strict-transport-security: max-age=63072000; includeSubDomains; preload
x-content-type-options: nosniff
x-frame-options: DENY
referrer-policy: strict-origin-when-cross-origin
cross-origin-opener-policy: same-origin-allow-popups
cross-origin-resource-policy: same-origin
permissions-policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
```

I nettleser (DevTools-konsoll åpen):
- `https://test2.aarrestad.com/` — laster, ingen røde CSP-violations
- `https://test2.aarrestad.com/kontakt` — kart vises, kontaktskjema fungerer
- `https://test2.aarrestad.com/admin` — Google OAuth-popup åpnes og fullfører login

**Steg 4 — Hvis test OK, knytt samme policy til PROD-distribusjonen:**

Gjenta Steg 2 for prod-distribusjonen (den med `CLOUDFRONT_DISTRIBUTION_ID_PROD`). Verifiser med `curl -I https://tennerogtrivsel.no/`.

**Steg 5 — Hvis noe knekker (test eller prod):**

Rollback tar sekunder:
1. CloudFront → Distributions → (relevant distribusjon) → Behaviors → Edit `*`
2. Sett **Response headers policy** til `None` (eller en tidligere AWS-managed policy)
3. Save changes
4. Etter 1–2 min er CSP-headeren borte og siden fungerer som før

Identifiser feilen (typisk: en CDN-host som mangler i `script-src` eller `style-src`), oppdater `SECURITY_HEADERS` i koden, deploy, gjenta Steg 1–4.

### Hvorfor ikke IaC?

Repoet har ingen Terraform/CDK i dag. Innføring for ett enkelt CloudFront-objekt gir liten gevinst. Konfigurasjonen er gjenopprettelig manuelt via prosedyren over — alle verdier finnes i `src/utils/security-headers.ts` slik at policy-en kan rekonstrueres.

### Automatisk CSP-oppdatering i CI

Hele CSP-strengen i CloudFront-policyen erstattes automatisk ved hver deploy:

1. `scripts/generate-csp-hashes.mjs` skanner `dist/**/*.html` for inline `<script>`-blokker
2. Beregner SHA256-hashes og skriver til `src/generated/csp-hashes.json`
3. `scripts/update-cloudfront-csp.mjs` henter gjeldende policy, bygger ny CSP via `buildCspString` og oppdaterer

**Forutsetninger:**
- GitHub secret `CLOUDFRONT_CSP_POLICY_ID` — ID-en til Response Headers Policy (ikke distribusjons-ID).
  Finn den i AWS Console → CloudFront → Policies → Response headers policies → klikk policy → kopier ID fra URL.
- Deploy-jobbens IAM-rolle må ha:
  - `cloudfront:GetResponseHeadersPolicy`
  - `cloudfront:UpdateResponseHeadersPolicy`

**Lokal oppdatering (etter Astro-oppgradering eller endring av inline-skript):**
```bash
npm run build:ci && npm run generate-csp-hashes
# Commit src/generated/csp-hashes.json
```

### Dev/preview-merknad

`astro preview` kjører ikke middleware (statisk eksport). E2E-tester via Playwright (`npm run preview`) ser derfor ikke security-headerne. Dekning er istedet:
- Unit-tester på `src/middleware.ts` verifiserer at riktige verdier settes
- `tests/csp-check.spec.ts` (kun manuell `npx playwright test csp-check --project=chromium` i dev-modus) fanger CSP-violations i konsoll
- Curl-verifisering mot test/prod-distribusjon er den ekte E2E-sjekken

## CloudFront tile-proxy (GDPR)

Karttiles serveres via CloudFront-proxy (`/tiles/*`) for å eliminere IP-lekkasje til tredjepart. Besøkende kontakter kun eget domene.

**Tile-kilde:** CartoDB Voyager (`basemaps.cartocdn.com/rastertiles/voyager/`). Tidligere ble `tile.openstreetmap.org` brukt, men OSM blokkerer CDN-proxying (krever unik User-Agent og Referer-header, se [OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/)).

**Arkitektur:**
- **Prod:** CloudFront behavior `/tiles/*` → origin `basemaps.cartocdn.com` med CloudFront Function som omskriver `/tiles/{z}/{x}/{y}.png` til `/rastertiles/voyager/{z}/{x}/{y}.png`
- **Dev:** Vite dev server proxy i `astro.config.mjs` gjør det samme lokalt
- **Leaflet:** Tile URL er `/tiles/{z}/{x}/{y}.png` (relativ path, fungerer i begge miljøer)

**CloudFront-gotchas:**
- `Host` er reservert header — kan ikke settes som custom origin header. CloudFront sender automatisk origin-domenet som Host så lenge Origin Request Policy ikke videresender Host fra viewer.
- CloudFront videresender hele URL-pathen til origin. CloudFront Function må omskrive `/tiles`-prefix til `/rastertiles/voyager`.

**CSP:** `tile.openstreetmap.org` er fjernet fra `img-src` og `connect-src` — tiles lastes nå fra `'self'`. Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`) er også fjernet — fontene er self-hosted.

## CSP-verifisering

`tests/csp-check.spec.ts` verifiserer CSP-brudd på tvers av nøkkelsider. Kjør ved endringer i `src/middleware.ts` (se `/security-audit`-skill).

## Tilgangskontroll (admin)

Admin-panelet bruker Google Drive-deling som tilgangsmodell. Brukeren autentiserer seg via Google OAuth, og `enforceAccessControl()` i `admin-dashboard.js` sjekker hvilke Google Drive-ressurser (mapper/sheets) brukeren har tilgang til.

**Modul-ressurs-mapping:**

| Modul | Krever tilgang til | Logikk |
|-------|-------------------|--------|
| Innstillinger | `SHEET_ID` | Enkel sjekk |
| Tjenester | `TJENESTER_FOLDER` | Enkel sjekk |
| Meldinger | `MELDINGER_FOLDER` | Enkel sjekk |
| Tannleger | `TANNLEGER_FOLDER` + `SHEET_ID` | Begge må være tilgjengelige |
| Bilder | `SHEET_ID` + `BILDER_FOLDER` | Begge må være tilgjengelige (fallback til kun `SHEET_ID` hvis `BILDER_FOLDER` ikke er konfigurert) |

- Kort vises (`display: flex`) eller skjules (`display: none`) basert på tilgangssjekk
- Hvis brukeren ikke har tilgang til noen ressurser, logges de ut og sendes til `/?access_denied=true`
- Tom config (ingen ressurs-IDer) utløser **ikke** utlogging — `ids.length === 0` håndteres separat
- Selve tilgangskontrollen skjer via Google Drive API (`gapi.client.drive.files.get`) — 403 = ingen tilgang

**Nøkkelfiler:** `admin-dashboard.js` (`enforceAccessControl`), `admin-client.js` (`checkAccess`, `checkMultipleAccess`), `admin-init.js` (`handleAuth`)

## HTML-escaping og programmatisk verdi-setting

Admin-editor-moduler bruker to teknikker for å hindre HTML-injeksjon fra Sheets/Drive-data:

1. **Programmatisk verdi-setting** for skjemaelementer (input, textarea): Render tomt skjema, sett verdier med `.value = data` etter innerHTML. Dette unngår HTML-parsing helt.
2. **`escapeHtml()`** for preview-tekst (h3, p, span): Escaper `<`, `>`, `"` og `&`.

```js
// Mønster for editor-skjemaer:
inner.innerHTML = `<input id="edit-name" value="">`;
document.getElementById('edit-name').value = data.name; // Sikkert

// Mønster for preview/lister:
`<h3>${escapeHtml(data.name)}</h3>`
```

**Berørte filer:** `admin-module-tannleger.js`, `admin-module-meldinger.js`, `admin-module-tjenester.js`, `admin-module-settings.js`, `admin-gallery.js`

**Referanse-implementasjon:** `admin-module-bilder.js` — bruker DOMPurify.sanitize() + programmatisk verdi-setting.

## Filopplastings-validering

`uploadImage()` i `admin-client.js` validerer:
- **MIME-type**: Kun `image/jpeg`, `image/png`, `image/webp` aksepteres
- **Filstørrelse**: Maks 10 MB

Kaller (`admin-gallery.js`) har allerede try/catch med `showToast` — feilmeldinger propagerer.

## Subresource Integrity (SRI)

EasyMDE, Flatpickr og Font Awesome er bundlet via npm og Vite — ingen CDN-`<script>`- eller `<link>`-tagger i `admin/index.astro`. SRI-beskyttelse for disse pakkene ivaretas av npm-registryets pakke-integritet (lockfile + `npm audit signatures` i CI) fremfor browser-SRI.

## Supply-chain kontroller

### Dependabot cooldown og auto-merge-policy

Auto-merge av Dependabot-PR-er fungerer trygt kun fordi vi har en **cooldown**-periode som filtrerer ut versjoner som er for nye til at community har oppdaget kompromittering.

**Cooldown-innstillinger (`.github/dependabot.yml`):**

| Type | Cooldown |
|------|----------|
| Patch-oppdateringer | 3 dager |
| Minor-oppdateringer | 7 dager |
| Major-oppdateringer | 30 dager |

**Rasjonale for 7/3/30 dager:** Undersøkelser av supply-chain-angrep (typosquats, kompromitterte publisher-kontoer, malicious postinstall-scripts) viser at ~80–90 % fanges innen én uke av community-rapportering, socket.dev-skanning og npm-audit. 3 dager for patch er tilstrekkelig da patch-versjoner sjelden inneholder breaking changes og risikoen for silent injeksjon er lavest. 30 dager for major gir tilstrekkelig tid til community-verifisering og vi krever uansett manuell review for major-bumps. Sjeldne lange-løp-angrep (som event-stream i 2018, aktiv i ~2 måneder) er en akseptert restrisiko — de kan ikke stoppes med cooldown alene.

**To flyter — én per PR-type:**

| Flyt | Cooldown | Auto-merge | Manuell review |
|------|----------|------------|----------------|
| `version-updates` (patch/minor) | 3–7 dager | Ja, etter alle CI-sjekker er grønne | Nei |
| `version-updates` (major) | 30 dager | Nei | Ja — flagges med assignee/reviewer |
| `security-updates` (CVE via GHSA) | Ingen | Nei | Ja — flagges med assignee/reviewer |

**Cooldown er et supplement, ikke en erstatning.** CI-sjekker (`npm audit signatures`, unit-/E2E-tester, `npm audit --audit-level=critical`) skal passere før auto-merge fyrer. Cooldown beskytter mot ukjente angrep i nye versjoner; audit-sjekker og tester beskytter mot kjente (signaturbrudd, regresjoner).

**Security-advisory-splitting i `dependabot-auto-merge.yml`:** `dependabot/fetch-metadata` eksponerer `alert-state`-output — tom streng for ordinære version-updates, satt (f.eks. `OPEN`) for GHSA-advisory-PR-er. Auto-merge kjøres kun når `alert-state == ''` og `update-type != 'version-update:semver-major'`. Security-PR-er går alltid til manuell review.

### SHA-pinning av GitHub Actions

Alle eksterne actions i `.github/workflows/` er pinnet til full commit-SHA med versjonskомmentar:

```yaml
- uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd  # v6.0.2
```

**Hvorfor SHA og ikke tag:** En tag (`@v4`) kan flyttes av action-eieren til en annen commit uten varsel. En kompromittert publisher kan dermed injisere ondsinnet kode i CI-pipelinen — og hente ut alle hemmeligheter i `env`-blokken — uten at noe i repoet endres. SHA er immutabel.

**Dependabot holder SHA-pinnene oppdatert** via `package-ecosystem: github-actions` i `.github/dependabot.yml`. Dependabot oppretter PR med ny SHA + kommentar når en nyere versjon av en action er tilgjengelig. Samme cooldown-regler som for npm gjelder.

### npm-pakkesignatur-verifisering og audit-gate

To separate CI-sjekker i `deploy.yml` (kjøres i `e2e-tests`-, `build`- og `update-lambda`-jobbene):

```yaml
- name: Verify npm package signatures
  run: npm audit signatures

- name: Check for critical vulnerabilities
  run: npm audit --audit-level=critical
```

**`npm audit signatures`** verifiserer at alle installerte pakker er signert av npm-registryet med nøkkelen som matcher publisert metadata. Dette fanger pakkeforfalskning der innholdet er byttet ut uten å oppdatere registrert signatur.

**`npm audit --audit-level=critical`** feiler bygget ved kjente kritiske CVE-er i avhengighetstreet. Nivået er satt til `critical` (ikke `high`) for å unngå at hyppige `high`-CVE-er i dev-only transitive deps gjør CI flaky uten reell prod-impact.

### PAT-rotering (`MY_GITHUB_PAT`)

`MY_GITHUB_PAT` brukes i `dependabot-auto-merge.yml` og `auto-pr.yml` for å trigge workflows etter Dependabot-merge (standard `GITHUB_TOKEN` har en anti-loop-sikring som blokkerer dette).

**Gjeldende token-scope:** `Contents: read/write`, `Pull requests: write` — begrenset til dette repoet.

**Roteringsrutine:**
1. Gå til `github.com/settings/personal-access-tokens` → finn token → generer ny
2. Oppdater GitHub-secret `MY_GITHUB_PAT` i repoets Settings → Secrets and variables → Actions
3. Verifiser at neste Dependabot-PR auto-merges korrekt

Token bør roteres minst én gang i året, eller umiddelbart ved mistanke om lekkasje (se runbook `docs/runbooks/supply-chain-incident.md`).

### Kontinuerlig varsling — scheduled audit

Dependabot og CI-audit ved push dekker bare kjente CVE-er og nye avhengighetsversjoner. **Gapet:** en ny CVE for en pakke som allerede er installert oppdages ikke før neste push.

**Oppsettet (`scheduled-audit.yml`):**

| Komponent | Hva det gjør |
|-----------|--------------|
| `npm-audit` (jobb) | Kjører `npm audit --audit-level=high` i rotmappen og `lambda/kontakt-form-handler` ukentlig mandag 06:00 UTC. Feiler ved high/critical → GitHub sender e-post. |
| `osv-scan` (jobb) | Kjører Google OSV Scanner via reusable workflow, skanner begge `package-lock.json`-filene rekursivt, laster opp SARIF til GitHub Security-fanen. |

**Nivåforskjell:** `--audit-level=high` her vs. `--audit-level=critical` i `deploy.yml`. Scheduled-workflowen er et tidlig varslingssystem; deploy.yml er den harde CI-gaten. Juster ned til `--audit-level=critical` ved for mye støy fra dev-avhengigheter.

**Dependabot alerts og automated security fixes:** Verifisert aktivert via `gh api` (HTTP 204 og `{"enabled":true,"paused":false}`). Disse supplerer scheduled-audit ved å åpne PR-er automatisk ved kjente CVE-er i avhengigheter.

**OSV Scanner vs. npm audit:** OSV-databasen er bredere enn npm Advisory Database — fanger sårbarheter som ennå ikke er meldt inn til npm-registryet. SARIF-resultater er synlige i GitHub Security-fanen.

**Kjent begrensning:** GitHub deaktiverer scheduled workflows etter 60 dager uten repo-aktivitet. For en statisk side som kan gå måneder uten push betyr dette at varslingen stilner uten varsel. Reaktiveres manuelt i Actions-fanen. Akseptert risiko gitt prosjektets størrelse.

## Drive API query-escaping

Alle Drive API `q`-strenger der verdier interpoleres bruker `escapeDriveQuery()` som escaper backslash og enkle anførselstegn. Dette beskytter mot query-injeksjon fra spesialtegn i filnavn eller mappe-IDer.

**Berørte filer:** `admin-drive.js` (klient-side), `sync-data.js` (server-side build-script)

## Path traversal-beskyttelse

`sync-data.js` bruker `assertSafePath()` for å validere at filstier fra Google Drive/Sheets holder seg innenfor forventet basemappe. Dette beskytter mot path traversal-angrep der et filnavn som `../../etc/passwd` kunne skrive til uforventede steder.

**Berørte funksjoner:** `syncTannleger`, `syncMarkdownCollection`, `syncGalleri`

## Silent login debounce

`silentLogin()` i `admin-auth.js` har en debounce-mekanisme som forhindrer samtidige token-forespørsler. Flagget `_silentLoginPending` settes til `true` ved kall og resettes ved `admin-auth-refreshed`/`admin-auth-failed`-events, eller via en 15-sekunders fallback-timeout.

## X-Robots-Tag: noindex på /admin

Admin-siden hindres fra indeksering på tre nivåer:
1. `<meta name="robots" content="noindex, nofollow">` i HTML (dekker alle crawlere)
2. `robots.txt Disallow: /admin` (advisory)
3. `X-Robots-Tag: noindex` HTTP-header satt av:
   - **Dev:** Astro middleware (`src/middleware.ts`) på paths som starter med `/admin`
   - **Prod:** CloudFront Function `tot-admin-noindex` (viewer-response trigger) koblet til default behavior

CloudFront Function deployes ved hvert CI-bygg via `scripts/setup-cloudfront-functions.mjs` (idempotent). Koden ligger i `scripts/cloudfront-admin-noindex.js`.

## OAuth-token storage og rememberMe-logikk

OAuth-access-token lagres alltid i `sessionStorage` — aldri i `localStorage`. Token lever kun så lenge fanen er åpen.

`localStorage` bruker kun ett nøkkel: `admin_remember_me = '1'` (boolsk flagg). Flagget settes ved innlogging med "Husk meg" avkrysset, og fjernes ved utlogging eller når "Husk meg" er unchecked.

**Cold start-logikk i `admin-init.js`:**
- Finnes `admin_remember_me`-flagget og `sessionStorage`-token mangler → kjør `silentLogin()` (usynlig GIS-flyt med `prompt: 'none'`)
- Lykkes silent login → innlogget uten popup
- Feiler silent login (Google-sesjon utløpt) → vis login-skjerm

**Expiry-margin:** `getStoredUser()` og `tryRestoreSession()` regner token som utløpt 5 min *før* Google-expiry (`Date.now() < expiry - 300000`). Dette reduserer vinduet for et stjålet token.

## PUBLIC_GOOGLE_API_KEY — klient-side API-nøkkel

`PUBLIC_GOOGLE_API_KEY` initialiserer Google API Client Library (gapi) i admin-panelet (`admin-auth.js:43`). Nøkkelen eksponeres i klient-side JavaScript (Astro `PUBLIC_`-prefix) og brukes til å laste **Drive v3** og **Sheets v4**.

**Gjeldende konfigurasjon (satt via gcloud 2026-05-31):**

Referrer-restriksjoner — 11 mønstre, prod bruker wildcards for subdomener:
```
https://*.tennerogtrivsel.no/*
https://tennerogtrivsel.no/*
https://*.tennerogtrivsel.net/*
https://tennerogtrivsel.net/*
https://*.tennerogtrivsel.com/*
https://tennerogtrivsel.com/*
https://test2.aarrestad.com/*
http://test2.aarrestad.com/*
https://test3.aarrestad.com/*
http://test3.aarrestad.com/*
http://localhost:4321/*
```

API-restriksjoner:
- `sheets.googleapis.com`
- `drive.googleapis.com`

**Kvotegrenser:** Settes per API under **Google Cloud Console → API-er og tjenester → Kvote og systemgrenser**, ikke per nøkkel. Google-defaults er tilstrekkelige for nåværende admin-bruksvolum (akseptert risiko — se tabellen under).

**Oppdatere restriksjoner (ved nye domener o.l.):**

```bash
# Finn nøkkelens ressursnavn:
KEY=$(gcloud api-keys list --project=tennerogtrivsel --format='value(name)')
# Alternativt: finn i Google Cloud Console → API-er og tjenester → Legitimasjon

gcloud api-keys update "$KEY" \
  --project=tennerogtrivsel \
  --allowed-referrers="<kommaseparert liste — se over for gjeldende>" \
  --api-target=service=sheets.googleapis.com \
  --api-target=service=drive.googleapis.com
```

**Verifisering** (erstatt `<NØKKEL>` med faktisk nøkkelverdi fra Google Cloud Console):

```bash
# Uten gyldig referrer skal svaret være 403:
curl "https://www.googleapis.com/drive/v3/files?key=<NØKKEL>" \
  -H "Referer: https://evil.com/"
# Forventet: {"error": {"code": 403, "message": "Requests from referer 'https://evil.com/' are blocked."}}
```

**Hvorfor API-restriksjoner er viktig selv med referrer-sjekk:** En angriper kan forfalske `Referer`-header fra serversiden. API-restriksjoner begrenser hvilke Google-tjenester nøkkelen gir tilgang til — en lekket nøkkel kan da ikke brukes mot andre Google APIs.

## Akseptert risiko

| Funn | Begrunnelse |
|------|-------------|
| `unsafe-inline` i CSP (M4) | Nødvendig for Google OAuth og Tailwind v4. Mitigert av script-src whitelist og DOMPurify. |
| Token i sessionStorage (M5) | Ingen HTTPOnly-alternativ for klient-side OAuth. Token er nå i sessionStorage (dør med fanen) — `localStorage` beholder kun et boolsk `admin_remember_me`-flagg som er verdiløst for angriper. Mitigert av token-expiry (5 min margin) og CSP. |
| Ingen audit-logging (M6) | Krever ekstra infrastruktur. Kan vurderes som egen oppgave. |
| `repository_dispatch` uten tester (L6) | Akseptert avveining — koden er allerede testet på main, risiko begrenset til kompromittert Drive-innhold. |
| Admin-side offentlig (L5) | Alle data/funksjonalitet krever gyldig OAuth-token. `noindex` + `robots.txt Disallow` hindrer indeksering. |
| API-feilmeldinger til bruker (L7) | Admin er OAuth-beskyttet — kun autoriserte brukere ser feilmeldinger. Google API-detaljer i feilmeldinger gir ikke angrepsoverflate. |
| Vite dev proxy uten path-validering (L8) | Kun aktiv i dev, hardkodet til `basemaps.cartocdn.com`. Ingen brukerdata interpoleres i URL. |
| COOP-advarsler fra GIS (L9) | `Cross-Origin-Opener-Policy: same-origin-allow-popups` genererer konsolladvarsler fra GIS sin `m_migration_mod` — "would block the window.opener call". OAuth-funksjonalitet er upåvirket. GIS har interne fallback-mekanismer som håndterer dette. Akseptert. |

## Web Storage og modul-tilstand i tester

- Når kode under test bruker Web Storage, SKAL **begge** `localStorage.clear()` og
  `sessionStorage.clear()` kalles i `beforeEach` – ikke bare én av dem.
- `admin-auth.js` har modul-nivå-variabelen `_rememberMe` som **ikke** nullstilles av `vi.clearAllMocks()`. Tester som er sensitive for denne tilstanden MÅ eksplisitt kalle `setRememberMe(false)` i `beforeEach`.
- Nøkkelnavnet for "husk meg"-flagget er `admin_remember_me` i `localStorage` (ikke `admin_google_token` som tidligere). Token lagres utelukkende i `sessionStorage`.
