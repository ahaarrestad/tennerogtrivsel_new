# Plan: Grundig sikkerhetssjekk av prosjektet

**Dato:** 2026-03-07
**Status:** Ikke startet

## Mål

Systematisk gjennomgang av hele kodebasen mot OWASP Top 10, kombinert med automatiserte verktøy. Verifisere eksisterende sikkerhetstiltak og finne nye hull. Fikse det som kan fikses, dokumentere resten som aksepterte risikoer.

## Leveranse

- Fikse funn som kan løses uten store arkitekturendringer
- Oppdatere `docs/architecture/sikkerhet.md` med nye funn og aksepterte risikoer
- Hver fiks committes separat

## Fase 1: Automatisert skanning

- [ ] Kjør `npm audit` og vurder funn
- [ ] Kjør eksisterende CSP-tester (`tests/csp-check.spec.ts`)
- [ ] Søk etter hardkodede hemmeligheter/credentials i kodebasen (API-nøkler, tokens, passord)

## Fase 2: Manuell gjennomgang (OWASP Top 10)

### A01 — Broken Access Control
- [ ] Verifiser at `enforceAccessControl()` i `admin-dashboard.js` dekker alle moduler
- [ ] Sjekk at alle admin API-kall krever gyldig OAuth-token
- [ ] Verifiser at admin-siden ikke lekker data uten autentisering

### A03 — Injection
- [ ] Verifiser at DOMPurify brukes konsekvent ved all `innerHTML`-bruk med dynamisk innhold
- [ ] Sjekk Drive API query-interpolasjon for spesialtegn-håndtering (`admin-drive.js`, `sync-data.js`)
- [ ] Verifiser at `escapeHtml()` brukes i alle preview-kontekster
- [ ] Sjekk at `.value =` brukes (ikke innerHTML) for alle skjemafelt-verdier

### A05 — Security Misconfiguration
- [ ] Verifiser CSP-headere i middleware dekker alle nødvendige direktiver
- [ ] Sjekk at `.env`-filer ikke er committet til repo
- [ ] Verifiser at `robots.txt` og `noindex` er satt for admin-sider
- [ ] Sjekk at feilmeldinger ikke eksponerer sensitiv informasjon

### A06 — Vulnerable & Outdated Components
- [ ] Analyser `npm audit`-resultater
- [ ] Verifiser at alle CDN-avhengigheter har SRI-hasher
- [ ] Sjekk at CDN-versjoner er oppdaterte (EasyMDE, Flatpickr, Font Awesome)

### A07 — Identification & Authentication Failures
- [ ] Verifiser token-expiry-logikk i `admin-auth.js` (60s buffer)
- [ ] Sjekk at token revokeres ved logout
- [ ] Verifiser at expired tokens i localStorage/sessionStorage ryddes opp
- [ ] Sjekk silent login-flyten for race conditions

### A02 — Cryptographic Failures
- [ ] Verifiser at tokens ikke logges eller eksponeres i feilmeldinger
- [ ] Sjekk at service account-nøkkel kun brukes server-side (sync-data.js)

### A04 — Insecure Design
- [ ] Gjennomgå dataflyt fra Google Drive/Sheets → build → S3 → bruker
- [ ] Verifiser at ingen sensitiv data lekker i statisk output

### A08 — Software & Data Integrity Failures
- [ ] Verifiser SRI på alle CDN-ressurser
- [ ] Sjekk `repository_dispatch`-flyt — kan kompromittert Drive-innhold utnyttes?
- [ ] Verifiser at `sync-data.js` validerer nedlastet innhold

### A09 — Security Logging & Monitoring Failures
- [ ] Dokumenter manglende audit-logging som akseptert risiko (eller opprett egen oppgave)
- [ ] Sjekk at feilhåndtering ikke svelger sikkerhetskritiske feil stille

### A10 — Server-Side Request Forgery (SSRF)
- [ ] Verifiser at tile-proxy kun aksepterer forventede URL-mønstre
- [ ] Sjekk at Drive API-kall ikke kan manipuleres til å nå uventede endepunkter

## Fase 3: Fiks

Fikse funn fra fase 1 og 2. Kjente kandidater basert på kartlegging:

- [ ] Escape spesialtegn i Drive API query-strenger (`admin-drive.js`, `sync-data.js`)
- [ ] Eventuelle npm-sårbarheter
- [ ] Andre funn fra gjennomgangen

Hver fiks committes separat med beskrivende commit-melding.

## Fase 4: Dokumentasjon

- [ ] Oppdater `docs/architecture/sikkerhet.md` med nye funn og aksepterte risikoer
- [ ] Oppdater tabellen over aksepterte risikoer

## Utenfor scope

- Penetrasjonstesting mot kjørende miljø
- CloudFront/S3-konfigurasjon (dekkes av egen backlog-oppgave)
- Implementere audit-logging (kan bli egen oppgave)
- Nye sikkerhetstester (kan bli egen oppgave)
