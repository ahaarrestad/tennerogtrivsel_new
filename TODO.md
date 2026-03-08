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

- [ ] **Print-knapp: legg til admin-sjekk**
    - `?print=1` URL-parameter trigger `window.print()` for alle besøkende
    - Bør kun trigge for innloggede admins
    - Kilde: Gemini Code Assist, PR #144/#145

- [ ] **Ustabil sortering i prisliste**
    - Elementer med samme `order`-verdi kan endre rekkefølge mellom builds
    - Legg til tie-breaker (f.eks. original array-indeks)
    - Kilde: Gemini Code Assist, PR #148

- [ ] **Tomme catch-blokker i prisliste/admin**
    - Stille `catch`-blokker i kategorilasting skjuler feil
    - Legg til minimum `console.error` for feillogging
    - Kilde: Gemini Code Assist, PR #144/#149

- [ ] **loadAllServices mangler withRetry**
    - `loadAllServices` i `admin-module-tjenester.js` dupliserer logikk uten retry-mekanisme
    - Bør bruke `withRetry` som resten av admin-modulene
    - Kilde: Gemini Code Assist, PR #135


## Fullført

Se [TODO-archive.md](TODO-archive.md) for alle fullførte oppgaver.

