# TODO – Tenner og Trivsel

> Denne filen holdes oppdatert underveis. Kryss av oppgaver med `[x]` når de er ferdige.

### Arbeidsflyt
- **Før vi starter på en oppgave:** Lag alltid en plan først. Still avklarende spørsmål hvis noe er uklart.
- Planen skrives som notater under oppgaven før implementering begynner.
- Flytt oppgaven til «Pågående» når planen er godkjent og arbeidet starter.
- **Lever i små, iterative forbedringer** — minst én commit per oppgave. Store oppgaver brytes ned i deloppgaver som hver committes for seg. **Alt skal gå via PR** (`git review`).
- **Planer** lagres i `docs/plans/YYYY-MM-DD-<topic>.md`. **Design-docs** lagres i `docs/designs/YYYY-MM-DD-<topic>.md`. Oppgaven skal alltid ha lenke til plan (og design om relevant).
- Flytt oppgaven til «Fullført» når den er ferdig.
- **Arkivering:** Når en oppgave er fullført, flytt oppgaven fra TODO.md til [TODO-archive.md](TODO-archive.md), planfilen til `docs/plans/archive/` og eventuelle design-docs til `docs/designs/archive/`.

## Pågående

- [ ] **Sikkerhetshardening — supply-chain & defense-in-depth** ([plan](docs/plans/2026-04-28-sikkerhetshardening.md))
  - Audit 2026-04-28 fant 2 kritiske, 4 høye og 4 medium funn. Bruker er mest bekymret for supply-chain.
  - Kritisk: Dependabot auto-merge for runtime-deps (F1), CSP mangler i CloudFront-prod (F2)
  - Høy: XSS via `formatInfoText` (F3), GitHub Actions ikke SHA-pinnet (F4), bredt PAT-scope (F5), admin-token i localStorage (F6)
  - Medium: `unsafe-inline` i CSP (F7), mangler Permissions-Policy/HSTS (F8), ingen `npm audit signatures` (F9), `PUBLIC_GOOGLE_API_KEY` ikke verifisert restricted (F10)
  - ~~Task 5 (F2, F8): CSP og security-headers til CloudFront — ferdig 2026-05-01~~
  - ~~Task 1 (F1): Dependabot cooldown 3/7/30 dager og security-advisory splitt i auto-merge — ferdig 2026-05-02~~
  - ~~Task 6 (F3): XSS-fix i formatInfoText — ferdig 2026-05-02~~
  - ~~Task 4 (F9): npm audit signatures + critical-gate + --ignore-scripts i CI — ferdig 2026-05-03~~
  - ~~Task 8 steg 8.1–8.2 (F7): ubrukte CDN-er fjernet fra CSP — ferdig 2026-05-03~~
  - ~~Task 8 steg 8.3 (F7): `unsafe-inline` erstattet med SHA256-hashes i script-src — ferdig 2026-05-03~~
  - ~~Task 7 (F6): admin-token til sessionStorage, rememberMe-flagg, X-Robots-Tag noindex — ferdig 2026-05-06~~
  - Neste: Task 2 (F4): SHA-pin GitHub Actions ([plan](docs/plans/2026-05-06-sha-pin-github-actions.md))

## Backlog
- [ ] **Fiks `unsafe-inline` fallback i setup-response-headers-policy.mjs** — *ingen plan ennå*
  - PR #298 review-funn: dersom `scriptHashes` er tom faller scriptet tilbake til `'unsafe-inline'` og kan rulle ut en svakere CSP til prod ved en feil
  - Siden `unsafe-inline` allerede er fjernet fra prosjektet, bør scriptet heller feile hardt med forklarende feilmelding
  - Berører `scripts/setup-response-headers-policy.mjs` (linje 22)

- [ ] **Legg til forklarende feilmelding ved manglende csp-hashes.json** — *ingen plan ennå*
  - PR #298 review-funn: `scripts/setup-response-headers-policy.mjs` krasjer med generisk Node.js-feil dersom `src/generated/csp-hashes.json` mangler (f.eks. ved nyoppsett før første bygg)
  - Fix: eksplisitt sjekk med melding om at `npm run build` må kjøres først
  - Berører `scripts/setup-response-headers-policy.mjs` (linje 18)

- [ ] **Gjør setup-response-headers-policy.mjs genuint idempotent** — *ingen plan ennå*
  - PR #298 review-funn: `docs/architecture/aws-infrastruktur.md` (linje 245) sier scriptet oppretter *og oppdaterer* policy, men koden returnerer bare eksisterende ID uten å verifisere innholdet
  - Fix: sammenlign eksisterende konfigurasjon (f.eks. CSP-streng) med ønsket tilstand og oppdater ved avvik — slik `setup-s3.mjs` gjør
  - Berører `scripts/setup-response-headers-policy.mjs` (linje 147)

- [ ] **Helhetlig sikkerhetsgjennomgang** ([plan](docs/plans/2026-05-14-helhetlig-sikkerhetsgjennomgang.md))
  - Streng gjennomgang av hele prosjektet: kode, infrastruktur, deploy-pipeline og tredjepartsintegrasjoner
  - Dekker: GitHub (secrets, Actions, permissions), AWS (IAM, S3, Lambda, CloudFront, DynamoDB, SES), Google (OAuth, Sheets/Drive API-nøkler, scopes), og hvordan alt er skrudd sammen
  - Vurder angrepsflater, least-privilege, secret rotation, logging/audit trail og potensielle svakheter i hele kjeden
  - Diskuter funn med bruker etter hvert domene — ingen tiltak uten godkjenning

- [ ] **«Bygg nå»-knapp i admin** ([plan](docs/superpowers/plans/2026-03-21-bygg-na-knapp.md)) ([spec](docs/superpowers/specs/2026-03-21-bygg-na-knapp-design.md))
  - Lambda Function URL-proxy som verifiserer Google OAuth-token og kaller GitHub `repository_dispatch`
  - Knapp i admin-dashboard med spinner, statusmelding og siste vellykkede bygg-tidspunkt

- [ ] **Audit trail for admin-panelet** ([plan](docs/superpowers/plans/2026-05-14-endringslogg-admin.md)) ([spec](docs/superpowers/specs/2026-05-14-endringslogg-admin-design.md))
  - Logg hvem som gjør hvilke endringer når (oppretter, redigerer, sletter innhold)
  - Eget Google Sheets-regneark for loggen, synlig som fane i admin-UI
  - Relevant for sporbarhet og feilsøking

- [ ] **i18n — mulighetsstudie** — *ingen plan ennå*
  - Er det mulig og gjennomførbart å legge til flerspråklig støtte på siden?
  - Kartlegg hva Astro 5 tilbyr av i18n-støtte, hva som må oversettes (innhold vs. UI-tekster), og konsekvenser for CMS-flyten (Google Sheets/Drive)
  - Vurder kostnad/nytte: er det faktisk et behov, og er det verdt arbeidsmengden?
  - Avslutt med en anbefaling: gjør det / gjør det ikke / gjør det men bare X

- [ ] **Dev-Test-Prod miljø oppsett** ([plan](docs/plans/2026-02-27-dev-test-prod.md))
    - Deployment-kontroll: push til main → test, manuell dispatch → prod, Google Drive-oppdatering → prod
    - Legg til `workflow_dispatch` input i deploy.yml for å velge miljø (test/prod/both)
    - `repository_dispatch` alltid til prod, push til main alltid til test
    - Samme Google Sheet/Drive for alle miljøer — ingen dataduplisering
    - Opprett GitHub Environment (f.eks. `production`) med protection rules for deploy-jobben — begrenser hvem/hva som kan trigge deploy og sikrer at secrets kun er tilgjengelige i riktig miljø


## Fullført

Se [TODO-archive.md](TODO-archive.md) for alle fullførte oppgaver.

