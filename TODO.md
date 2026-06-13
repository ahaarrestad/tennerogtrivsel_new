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
  - Task 1, 2, 4–9, 11, 12 er fullført. Gjenstående tasks:
  - **Task 3:** Begrens `MY_GITHUB_PAT` blast-radius — migrer til fine-grained PAT eller GitHub App *(utsatt)*
  - ~~**Task 10:**~~ Løst ved beslutning — `repository_dispatch` bygger kun kode på `main` som allerede har passert tester. Deps endres aldri der.

## Backlog

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

- [ ] **GDPR: Angi rettslig grunnlag for Google OAuth i personvern** — *ingen plan ennå*
  - Admin-panelet bruker Google OAuth; personvernet forklarer hva som lagres, men GDPR art. 6-grunnlag er ikke nevnt
  - Tiltak: legg til «berettiget interesse» eller «nødvendig for å oppfylle avtale» som grunnlag i personvern-avsnittet om admin-panelet
  - Alvorlighetsnivå: Lav

- [ ] **Admin: styr mobil-visning av seksjoner og menylenker** — *ingen plan ennå*
  - Fra admin-panelet skal man kunne velge om en seksjon vises på framsiden på mobil, og om tilhørende menylenke skal gå til ankerpunkt på framsiden (`/#seksjon`) eller til en separat side (`/seksjon/`)
  - Gjelder seksjonene Galleri, Tjenester og Tannleger — Forside og Kontakt er alltid synlige
  - Innstillingene lagres i Google Sheets og leses via `getSiteSettings()` på byggetid
  - Avhengig av at «Mobil: framsiden og meny ikke i sync»-oppgaven er løst først (hardkodet fix som baseline)

- [ ] **GDPR: Bekreft og dokumenter databehandleravtale med AWS SES** — *ingen plan ennå*
  - Personvernet nevner AWS SES som databehandler, men bekrefter ikke at DPA er inngått
  - AWS tilbyr standard Data Processing Addendum — verifiser at dette er akseptert for kontoen
  - Tiltak: dokumenter DPA-status i internkontrollmappen (relevant når kontaktskjema aktiveres)
  - Alvorlighetsnivå: Lav

- [ ] **Fikse flaky tester (timing/mock-lekkasje)** — *ingen plan ennå* — iterasjon 2 etter Drive-uavhengighet
  - Rene ikke-data flaky-fikser, tas etter at fixture-infrastrukturen er på plass
  - `galleri-lightbox.spec.ts`: `waitForLoadState('networkidle')` → `page.route` (PR #372-review)
  - Vurder global `clearMocks`/`restoreMocks` i `vitest.config.ts` mot mock-lekkasje (PR #371-review)
  - Orphaned accessibility-fix i worktree `fix/e2e-stabile-tester` (fjern unødvendig `setViewportSize`, Mobile Safari color-contrast) — merge eller forkast
  - Mål: null flaky tester i CI

- [ ] **Vurder drift i `csp-hashes.json`** — *ingen plan ennå*
  - `src/generated/csp-hashes.json` (committet på main) matcher ikke det `npm run generate-csp-hashes` produserer — én inline-script-hash avviker, uavhengig av kodeendringer
  - Reproduserbart: regenerering på ren `origin/main` gir samme avvik. Avklar om committet fil er utdatert, eller om genereringen er ikke-deterministisk/miljøavhengig
  - Konsekvens hvis utdatert: CSP kan blokkere et inline-script i prod. Sjekk hvilket script hashen tilhører og hvor genereringen kjøres i deploy-pipelinen
  - Funnet under galleri-bildeprosessering-oppgaven (2026-06-07)

- [ ] **Norsk rettskriving i dokumentasjon** — *ingen plan ennå*
  - Småfiks fra PR-review (#367/#368), rent kosmetisk/konsistens
  - `docs/architecture/sikkerhet.md`: «scanner» → «skanner» (linje 122, 298), «på root» → «i rotmappen» (297), «begge package-lock.json» → «…-filene» (298), «Nivå-forskjell» → «Nivåforskjell» og «Scheduled-workflow» → bestemt form (300)
  - `TODO-archive.md`: «eget job» → «egen jobb», «scanner» → «skanner» (linje 17)

- [ ] **Dev-Test-Prod miljø oppsett** ([plan](docs/plans/2026-02-27-dev-test-prod.md))
    - Deployment-kontroll: push til main → test, manuell dispatch → prod, Google Drive-oppdatering → prod
    - Legg til `workflow_dispatch` input i deploy.yml for å velge miljø (test/prod/both)
    - `repository_dispatch` alltid til prod, push til main alltid til test
    - Samme Google Sheet/Drive for alle miljøer — ingen dataduplisering
    - Opprett GitHub Environment (f.eks. `production`) med protection rules for deploy-jobben — begrenser hvem/hva som kan trigge deploy og sikrer at secrets kun er tilgjengelige i riktig miljø


## Fullført

Se [TODO-archive.md](TODO-archive.md) for alle fullførte oppgaver.

