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

## Backlog
- [ ] **Sikkerhetshardening — supply-chain & defense-in-depth** ([plan](docs/plans/2026-04-28-sikkerhetshardening.md))
  - Audit 2026-04-28 fant 2 kritiske, 4 høye og 4 medium funn. Bruker er mest bekymret for supply-chain.
  - Kritisk: Dependabot auto-merge for runtime-deps (F1), CSP mangler i CloudFront-prod (F2)
  - Høy: XSS via `formatInfoText` (F3), GitHub Actions ikke SHA-pinnet (F4), bredt PAT-scope (F5), admin-token i localStorage (F6)
  - Medium: `unsafe-inline` i CSP (F7), mangler Permissions-Policy/HSTS (F8), ingen `npm audit signatures` (F9), `PUBLIC_GOOGLE_API_KEY` ikke verifisert restricted (F10)

- [ ] **«Bygg nå»-knapp i admin** ([plan](docs/superpowers/plans/2026-03-21-bygg-na-knapp.md)) ([spec](docs/superpowers/specs/2026-03-21-bygg-na-knapp-design.md))
  - Lambda Function URL-proxy som verifiserer Google OAuth-token og kaller GitHub `repository_dispatch`
  - Knapp i admin-dashboard med spinner, statusmelding og siste vellykkede bygg-tidspunkt


- [ ] **Dev-Test-Prod miljø oppsett** ([plan](docs/plans/2026-02-27-dev-test-prod.md))
    - Deployment-kontroll: push til main → test, manuell dispatch → prod, Google Drive-oppdatering → prod
    - Legg til `workflow_dispatch` input i deploy.yml for å velge miljø (test/prod/both)
    - `repository_dispatch` alltid til prod, push til main alltid til test
    - Samme Google Sheet/Drive for alle miljøer — ingen dataduplisering
    - Opprett GitHub Environment (f.eks. `production`) med protection rules for deploy-jobben — begrenser hvem/hva som kan trigge deploy og sikrer at secrets kun er tilgjengelige i riktig miljø


## Fullført

Se [TODO-archive.md](TODO-archive.md) for alle fullførte oppgaver.

