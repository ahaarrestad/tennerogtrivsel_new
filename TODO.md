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

- [ ] **Kontaktskjema** ([spec](docs/superpowers/specs/2026-03-28-kontaktskjema-design.md))
  - Modal fra kontaktsiden med feltene: tema, navn, telefon, e-post og melding
  - Tema-liste, modal-tittel og -tekst administreres via Google Sheet + admin-blokk
  - Mottaker-e-post i Sheets, aldri eksponert i frontend — Lambda-miljøvariabel oppdateres ved bygg
  - AWS Lambda + SES for utsending, honeypot + rate limiting (DynamoDB) mot spam
  - Sentrert modal (desktop) / bunnark (mobil), personvernerklæringen oppdateres
  - **Manuelt AWS-oppsett gjenstår** (se nedenfor) — må gjøres før feature kan merges og testes

## Backlog
- [ ] **Price admin siden har dårlig layout på mobil**
  - Når skjermen blir smal på admin siden havner tekstene oppå hverandre. Bør fikse på laoyout slik at dette ikke skjer.

- [ ] **«Bygg nå»-knapp i admin** ([plan](docs/superpowers/plans/2026-03-21-bygg-na-knapp.md)) ([spec](docs/superpowers/specs/2026-03-21-bygg-na-knapp-design.md))
  - Lambda Function URL-proxy som verifiserer Google OAuth-token og kaller GitHub `repository_dispatch`
  - Knapp i admin-dashboard med spinner, statusmelding og siste vellykkede bygg-tidspunkt

- [ ] **CloudFront produksjon — komplett oppsett med alle domener** ([plan](docs/plans/2026-02-28-cloudfront-prod-komplett.md))

- [ ] **llms.txt — AI-lesbar nettstedsbeskrivelse**
    - Generer `/llms.txt` (kortfattet indeks) og `/llms-full.txt` (komplett innhold) automatisk ved bygg
    - Astro-endepunkter som henter fra innstillinger.json, prisliste.json, tjenester og tannleger.json
    - Samme mønster som eksisterende robots.txt.ts

- [ ] **«Husk meg» på admin-siden fungerer dårlig**
    - Innlogging huskes ikke som forventet — undersøk og fiks

- [ ] **AWS-oppsett for kontaktskjema (manuelt — gjøres av deg)**
    - [ ] **Lambda:** Opprett funksjon `kontakt-form-handler`, Node.js 22, reserved concurrency 5
        - Første gangs opplasting av kode (kun nødvendig én gang — deretter håndteres dette automatisk av CI/CD):
          `cd lambda/kontakt-form-handler && npm install --omit=dev && zip -r function.zip index.mjs node_modules/ && aws lambda update-function-code --function-name kontakt-form-handler --zip-file fileb://function.zip`
        - Aktiver Function URL (Auth type: NONE) — kopier URL til bruk i CloudFront
    - [ ] **IAM:** Gi Lambda-rollen tillatelse til `dynamodb:GetItem` + `dynamodb:PutItem` på `kontakt-rate-limit`-tabellen, og `ses:SendEmail`
    - [ ] **DynamoDB:** Opprett tabell `kontakt-rate-limit`, partition key `ip` (String), TTL-attributt `ttl`, kapasitet On-demand
    - [ ] **SES:** Verifiser domene `tennerogtrivsel.no` (DKIM-poster i DNS). Hvis kontoen er i sandbox: verifiser mottaker-e-post og søk om å gå ut av sandbox
    - [ ] **CloudFront:** Legg til ny origin (Lambda Function URL), cache behaviour for `POST /api/kontakt` (CachingDisabled, AllViewerExceptHostHeader), og custom header `X-Origin-Verify: <secret>` på origin
    - [ ] **GitHub Secrets:** Legg til `LAMBDA_KONTAKT_ARN` (ARN til funksjonen) og `ORIGIN_VERIFY_SECRET` (tilfeldig streng, `openssl rand -hex 32`)
    - [ ] **Google Sheet:** Legg til fane `KontaktSkjema` med nøkler `aktiv`, `tittel`, `tekst`, `kontaktEpost` og minst én `tema`-rad
    - [ ] **Valgfritt:** Opprett AWS Budget-varsel ved $1/mnd

- [ ] **Dev-Test-Prod miljø oppsett** ([plan](docs/plans/2026-02-27-dev-test-prod.md))
    - Deployment-kontroll: push til main → test, manuell dispatch → prod, Google Drive-oppdatering → prod
    - Legg til `workflow_dispatch` input i deploy.yml for å velge miljø (test/prod/both)
    - `repository_dispatch` alltid til prod, push til main alltid til test
    - Samme Google Sheet/Drive for alle miljøer — ingen dataduplisering
    - Opprett GitHub Environment (f.eks. `production`) med protection rules for deploy-jobben — begrenser hvem/hva som kan trigge deploy og sikrer at secrets kun er tilgjengelige i riktig miljø


## Fullført

Se [TODO-archive.md](TODO-archive.md) for alle fullførte oppgaver.

