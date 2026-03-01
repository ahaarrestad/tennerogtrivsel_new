# TODO – Tenner og Trivsel

> Denne filen holdes oppdatert underveis. Kryss av oppgaver med `[x]` når de er ferdige.

### Arbeidsflyt
- **Før vi starter på en oppgave:** Lag alltid en plan først. Still avklarende spørsmål hvis noe er uklart.
- Planen skrives som notater under oppgaven før implementering begynner.
- Flytt oppgaven til «Pågående» når planen er godkjent og arbeidet starter.
- **Lever i små, iterative forbedringer** — minst én commit per oppgave. Store oppgaver brytes ned i deloppgaver som hver committes for seg.
- **Planer lagres under `/docs`** og oppgaven skal alltid ha en lenke til planen: `([plan](docs/plan-navn.md))`.
- Flytt oppgaven til «Fullført» når den er ferdig.
- **Arkivering:** Når en oppgave er fullført, flytt oppgaven fra TODO.md til [TODO-archive.md](TODO-archive.md) og planfilen fra `docs/` til `docs/archive/`.

## Pågående

*(Ingen oppgaver pågår)*

## Backlog

- [ ] **AI-drevet PR-review med Gemini Code Assist** ([plan](docs/plan-gemini-pr-reviewer.md))
  - Installer Gemini Code Assist (gratis GitHub App) fra Marketplace
  - Fjern auto-approve i `auto-pr.yml`, behold auto-merge
  - Valgfritt: branch protection med required approval

- [ ] **CloudFront produksjon — komplett oppsett med alle domener** ([plan](docs/plan-cloudfront-prod-komplett.md))
...
- [ ] **E2E-test: intermittent timeout-feil på GitHub Actions**
  - En eller flere E2E-tester feiler av og til med timeout i CI — finn årsak og fiks

- [ ] **Dev-Test-Prod miljø oppsett** ([plan](docs/plan-dev-test-prod.md))
    - Deployment-kontroll: push til main → test, manuell dispatch → prod, Google Drive-oppdatering → prod
    - Legg til `workflow_dispatch` input i deploy.yml for å velge miljø (test/prod/both)
    - `repository_dispatch` alltid til prod, push til main alltid til test
    - Samme Google Sheet/Drive for alle miljøer — ingen dataduplisering

## Fullført

Se [TODO-archive.md](TODO-archive.md) for alle fullførte oppgaver.

