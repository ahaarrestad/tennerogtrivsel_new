# Plan: Grundig sikkerhetssjekk av prosjektet

**Dato:** 2026-03-07
**Revidert:** 2026-03-08
**Status:** Fullført

## Mål

Systematisk gjennomgang av hele kodebasen mot OWASP Top 10. Fikse det som kan fikses, dokumentere resten som aksepterte risikoer.

## Leveranse

- Fikse funn som kan løses uten store arkitekturendringer
- Oppdatere `docs/architecture/sikkerhet.md` med nye funn og aksepterte risikoer
- Hver fiks committes separat

## Allerede verifisert (2026-03-08)

Følgende ble sjekket under planrevisjon og er OK:

- **npm audit:** 0 sårbarheter
- **Hardkodede hemmeligheter:** Ingen funnet — alle sensitive verdier via env-variabler
- **.env i .gitignore:** Bekreftet (`.env` og `.env.production`)
- **DOMPurify:** Brukes konsekvent for all dynamisk `innerHTML` (dashboard, editor-helpers, bilder, prisliste, tannleger, meldinger)
- **escapeHtml():** Brukes i preview-kontekster
- **`.value =`:** Brukes for skjemafelt-verdier (ikke innerHTML)
- **robots.txt:** Blokkerer `/admin` og `/admin/*`
- **Token-håndtering:** 60s expiry-buffer, revokering ved logout, rydding av storage
- **SRI:** Alle CDN-avhengigheter har integrity-hasher og pinnede versjoner
- **Service account-nøkkel:** Kun brukt server-side i `sync-data.js`
- **Token-logging:** Ingen tokens logges; debug-log bak `import.meta.env.DEV`-guard
- **repository_dispatch:** Allerede dokumentert som akseptert risiko (L6)
- **Audit-logging:** Allerede dokumentert som akseptert risiko (M6)

## Fase 1: Gjenstående manuell gjennomgang

### A01 — Broken Access Control
- [x] Verifiser at `enforceAccessControl()` i `admin-dashboard.js` dekker alle moduler (inkl. nyere moduler som prisliste)
  - Alle 6 moduler dekket. `BILDER_FOLDER` manglet i kallet fra `admin-init.js` → fikset.
- [x] Verifiser at admin-siden ikke lekker data uten autentisering
  - Ingen datalekasje: moduler henter data kun etter autentisering og tilgangskontroll.

### A03 — Injection (Drive API query)
- [x] Kartlegg alle steder der verdier interpoleres i Drive API `q`-strenger
  - 5 interpolasjonspunkter funnet (3 i admin-drive.js, 2 i sync-data.js)
- [x] Vurder risiko: verdiene kommer fra Google Drive-metadata (folder-IDer, filnavn), ikke direkte brukerinput — men spesialtegn i filnavn kan brekke query-syntaks
  - Risiko: middels-høy. Filnavn fra Drive kan inneholde enkle anførselstegn.

### A05 — Security Misconfiguration
- [x] Sjekk at feilmeldinger ikke eksponerer sensitiv informasjon (stack traces, API-nøkler)
  - API-feilmeldinger eksponeres til admin-brukere, men admin er OAuth-beskyttet. Akseptert risiko (L7).

### A07 — Authentication
- [x] Sjekk silent login-flyten for race conditions (flere samtidige kall)
  - Race condition funnet: ingen debounce på `silentLogin()`. → Fikset med `_silentLoginPending`-flagg.

### A08 — Software & Data Integrity
- [x] Verifiser at `sync-data.js` validerer/saniterer nedlastet innhold fra Drive/Sheets
  - Path traversal-sårbarhet funnet: filnavn fra Drive brukes direkte i `path.join()`. → Fikset med `assertSafePath()`.
  - MD5-sjekksumvalidering allerede på plass for filer.
- [x] Sjekk CDN-versjoner er oppdaterte (EasyMDE 2.20.0, Flatpickr 4.6.13, Font Awesome 4.7.0)
  - Alle har SRI-hasher og pinnede versjoner. OK.

### A10 — SSRF
- [x] Verifiser at tile-proxy (CloudFront Function + Vite dev proxy) kun aksepterer forventede URL-mønstre
  - Vite dev proxy er hardkodet til `basemaps.cartocdn.com` med statisk rewrite. Akseptert risiko (L8).

## Fase 2: Fiks

- [x] **Escape spesialtegn i Drive API query-strenger** (`admin-drive.js`, `sync-data.js`)
  - `escapeDriveQuery()` lagt til begge filer, escaper `\` og `'`
- [x] **Send BILDER_FOLDER til enforceAccessControl** (`admin-init.js`)
- [x] **Debounce silentLogin** (`admin-auth.js`)
  - `_silentLoginPending`-flagg med event-basert reset og 15s fallback-timeout
- [x] **Path traversal-beskyttelse** (`sync-data.js`)
  - `assertSafePath()` validerer alle filstier fra Drive/Sheets

## Fase 3: Dokumentasjon

- [x] Oppdater `docs/architecture/sikkerhet.md` med nye funn og aksepterte risikoer

## Utenfor scope

- Penetrasjonstesting mot kjørende miljø
- CloudFront/S3-konfigurasjon (dekkes av egen backlog-oppgave)
- Implementere audit-logging (allerede akseptert risiko M6)
- CSP i produksjon (middleware kjører kun i dev/SSR — prod trenger CloudFront Response Headers Policy, dekkes av CloudFront-oppgave)
