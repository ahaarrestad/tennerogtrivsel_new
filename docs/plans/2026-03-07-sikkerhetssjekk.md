# Plan: Grundig sikkerhetssjekk av prosjektet

**Dato:** 2026-03-07
**Revidert:** 2026-03-08
**Status:** Ikke startet

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
- [ ] Verifiser at `enforceAccessControl()` i `admin-dashboard.js` dekker alle moduler (inkl. nyere moduler som prisliste)
- [ ] Verifiser at admin-siden ikke lekker data uten autentisering

### A03 — Injection (Drive API query)
- [ ] Kartlegg alle steder der verdier interpoleres i Drive API `q`-strenger
- [ ] Vurder risiko: verdiene kommer fra Google Drive-metadata (folder-IDer, filnavn), ikke direkte brukerinput — men spesialtegn i filnavn kan brekke query-syntaks

### A05 — Security Misconfiguration
- [ ] Sjekk at feilmeldinger ikke eksponerer sensitiv informasjon (stack traces, API-nøkler)

### A07 — Authentication
- [ ] Sjekk silent login-flyten for race conditions (flere samtidige kall)

### A08 — Software & Data Integrity
- [ ] Verifiser at `sync-data.js` validerer/saniterer nedlastet innhold fra Drive/Sheets
- [ ] Sjekk CDN-versjoner er oppdaterte (EasyMDE 2.20.0, Flatpickr 4.6.13, Font Awesome 4.7.0)

### A10 — SSRF
- [ ] Verifiser at tile-proxy (CloudFront Function + Vite dev proxy) kun aksepterer forventede URL-mønstre

## Fase 2: Fiks

Kjent funn som trenger fiks:

- [ ] **Escape spesialtegn i Drive API query-strenger** (`admin-drive.js` linje 9, `sync-data.js` linje 133)
  - Escape enkle anførselstegn og backslash i `name`-parameter før interpolasjon
  - Drive API bruker `\`-escaping: `'` → `\'`
- [ ] Andre funn fra fase 1

Hver fiks committes separat med beskrivende commit-melding.

## Fase 3: Dokumentasjon

- [ ] Oppdater `docs/architecture/sikkerhet.md` med nye funn og aksepterte risikoer

## Utenfor scope

- Penetrasjonstesting mot kjørende miljø
- CloudFront/S3-konfigurasjon (dekkes av egen backlog-oppgave)
- Implementere audit-logging (allerede akseptert risiko M6)
- CSP i produksjon (middleware kjører kun i dev/SSR — prod trenger CloudFront Response Headers Policy, dekkes av CloudFront-oppgave)
