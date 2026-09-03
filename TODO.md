# TODO – Tenner og Trivsel

> Denne filen holdes oppdatert underveis. Kryss av oppgaver med `[x]` når de er ferdige.

### Arbeidsflyt
- **Før vi starter på en oppgave:** Lag alltid en plan først. Still avklarende spørsmål hvis noe er uklart.
- Planen skrives som notater under oppgaven før implementering begynner.
- Flytt oppgaven til «Pågående» når planen er godkjent og arbeidet starter.
- **Lever i små, iterative forbedringer** — minst én commit per oppgave. Store oppgaver brytes ned i deloppgaver som hver committes for seg. **Alt skal gå via PR** (`git review`).
- **Spec/design-docs** lagres i `docs/designs/YYYY-MM-DD-<topic>.md`. **Planer** lagres i `docs/plans/YYYY-MM-DD-<topic>.md`. Hver oppgave skal alltid ha **både** spec og plan, og begge reviewes før arbeidet starter. (For veldig små, trivielle oppgaver kan spec og plan slås sammen til noen linjer i én planfil — bruk hodet.)
- Flytt oppgaven til «Fullført» når den er ferdig.
- **Arkivering:** Når en oppgave er fullført, flytt oppgaven fra TODO.md til [TODO-archive.md](TODO-archive.md), planfilen til `docs/plans/archive/` og eventuelle design-docs til `docs/designs/archive/`.
- **Forkasting:** Når en oppgave bevisst droppes, flytt den fra TODO.md til [TODO-abandoned.md](TODO-abandoned.md) (merk `[~]`, dato + begrunnelse). La plan-/spec-filene ligge der de er.

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

- [ ] **IPv6-støtte — mulighetsstudie** ([notat](docs/designs/2026-07-18-ipv6-mulighetsstudie.md))
  - Utredningen er skrevet 2026-07-18. Konklusjon: ja, det er mulig — test-miljøet kjører allerede IPv6
  - Prod-distribusjonen har `IsIPV6Enabled: false` i strid med sin egen oppsettsplan; test har `true`. `www` får IPv6 ved å flippe bryteren (gratis, reversibelt)
  - **Tre** apex-domener (`.no`, `.com`, `.net`) har samme hardkodede A-poster og krever ALIAS/ANAME hver — **åpent punkt:** støtter hyp.net det?
  - Merk: apex redirecter kun til `www` (301), så IPv6 der gir en IPv6-tilgjengelig redirect, ikke IPv6-levering av siden
  - Route 53 avvist: hosted zone koster ~0,50 USD/mnd, og kravet var gratis
  - Ingen hast — verdien er læring og ryddighet, ikke brukergevinst

- [ ] **HTTP/3 (QUIC) på CloudFront** — *ingen plan ennå*
  - Prod-distribusjonen `E9Z51DQB2K1G4` kjører `HttpVersion: http2` — HTTP/3 er ikke aktivert
  - Tiltak: endre til `http2and3`. Ingen ekstra kostnad, bakoverkompatibelt (klienter uten HTTP/3-støtte faller tilbake til HTTP/2)
  - Nytte: raskere oppkobling (én rundtur), ingen head-of-line blocking ved pakketap, overlever nettverksbytte wifi↔mobil — treffer mobilbrukere på ujevnt nett
  - Vurdert som større praktisk gevinst enn IPv6 for denne siden, og enklere (rører ikke DNS)
  - Sjekk om test-distribusjonen `E2WXX7ZUR5NNP3` skal endres tilsvarende
  - Beslektet med IPv6-oppgaven (nabo i samme CloudFront-config), men teknisk urelatert

- [ ] **Dev-Test-Prod miljø oppsett** ([plan](docs/plans/2026-02-27-dev-test-prod.md))
    - Deployment-kontroll: push til main → test, manuell dispatch → prod, Google Drive-oppdatering → prod
    - Legg til `workflow_dispatch` input i deploy.yml for å velge miljø (test/prod/both)
    - `repository_dispatch` alltid til prod, push til main alltid til test
    - Samme Google Sheet/Drive for alle miljøer — ingen dataduplisering
    - Opprett GitHub Environment (f.eks. `production`) med protection rules for deploy-jobben — begrenser hvem/hva som kan trigge deploy og sikrer at secrets kun er tilgjengelige i riktig miljø

- [ ] **CI: tidlig lockfile-gate for Dependabot-PR-er** — *ingen plan ennå*
  - Dependabot-lockfiler blir aldri `npm ci`-validert før PR-en åpnes. Er lockfilen ugyldig, ryker `unit-tests`, `lint`, `type-check` og `e2e-tests` samtidig på samme steg — fire røde jobber som skjuler at årsaken er én
  - Konkret tilfelle: PR #444 (2026-08-22). `satteri@0.10.4` deklarerte ni plattformbinærer som `optionalDependencies`, men to av dem ble aldri publisert på den versjonen. `npm install` hopper stille over optional deps som ikke lar seg resolve, mens `npm ci` validerer hele settet og feiler
  - Mulig tiltak: en rask `lockfile-check`-jobb som kun kjører `npm ci --ignore-scripts`, og som de øvrige jobbene `needs:`-avhenger av — gir én rød jobb med tydelig årsak i stedet for fire
  - Alternativt/i tillegg: la jobben tolke `Missing: X from lock file` og kommentere diagnosen på PR-en, og/eller dokumentere feilmønsteret i `docs/guides/`
  - Vurder kostnad/nytte i planfasen: en ekstra jobb koster litt ekstra kjøretid per PR, men de fire jobbene kjører allerede `npm ci` hver for seg

## Fullført

Se [TODO-archive.md](TODO-archive.md) for alle fullførte oppgaver.

