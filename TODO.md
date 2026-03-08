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

(Ingen oppgaver pågår)

## Backlog

- [ ] **CloudFront produksjon — komplett oppsett med alle domener** ([plan](docs/plans/2026-02-28-cloudfront-prod-komplett.md))

- [ ] **Dev-Test-Prod miljø oppsett** ([plan](docs/plans/2026-02-27-dev-test-prod.md))
    - Deployment-kontroll: push til main → test, manuell dispatch → prod, Google Drive-oppdatering → prod
    - Legg til `workflow_dispatch` input i deploy.yml for å velge miljø (test/prod/both)
    - `repository_dispatch` alltid til prod, push til main alltid til test
    - Samme Google Sheet/Drive for alle miljøer — ingen dataduplisering

- [ ] **Grundig sikkerhetssjekk av prosjektet** ([plan](docs/plans/2026-03-07-sikkerhetssjekk.md))
    - Gjennomgå hele prosjektet for sikkerhetssårbarheter
    - Dekk OWASP Top 10, XSS, injection, CSP, autentisering, eksponerte hemmeligheter, og usikker datahåndtering

- [ ] **Forbedre sortering i prisliste-admin**
    - Forvirrende med to forskjellige sorterings-knapper helt ved siden av hverandre
    - Sjekk hvordan sortering er gjort på andre admin-sider og gjør det enklere/mer konsistent
    - Mål: brukeren skal intuitivt forstå sorteringsmekanismen

## Fullført

Se [TODO-archive.md](TODO-archive.md) for alle fullførte oppgaver.

