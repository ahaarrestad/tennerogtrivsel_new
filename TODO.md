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

### Brukertesting-forbedringer ([design](docs/plans/2026-03-07-brukertesting-forbedringer-design.md))

- [ ] **Fjern sticky card-stabling på mobil**
    - Fjern `position: sticky` fra `.stack-card` på mobil i `global.css`
    - Kort vises som vanlig scrollbar liste, desktop-grid uendret

- [ ] **Redesign tannleger-seksjonen**
    - Forsiden: én klikkbar boks med fellesbilde (placeholder) → lenke til `/tannleger`
    - /tannleger: små bilder i grid (3 per rad desktop, 2 mobil), navn + tittel
    - Klikk på tannlege utvider beskrivelse (accordion)

- [ ] **Redesign tjenester-seksjonen**
    - Vis 6 første tjenester basert på prioritet (nytt felt i Google Sheets)
    - "Klikk her for å se mer av våre tjenester"-knapp viser resten
    - Legg til `priority`-felt i sync-data og content collection

- [ ] **Prisliste — ny side og admin-modul**
    - Nytt Google Sheets-ark: `Prisliste` (Kategori, Behandling, Pris)
    - Ny side `/prisliste` med kategorisert tabell
    - Ny admin-modul for CRUD av prisliste
    - Lenke i navbar og footer

- [ ] **Footer-justeringer**
    - Fjern `sentralbordTekst` fra footer
    - Legg til prisliste-lenke

- [ ] **CloudFront produksjon — komplett oppsett med alle domener** ([plan](docs/plans/2026-02-28-cloudfront-prod-komplett.md))

- [ ] **Dev-Test-Prod miljø oppsett** ([plan](docs/plans/2026-02-27-dev-test-prod.md))
    - Deployment-kontroll: push til main → test, manuell dispatch → prod, Google Drive-oppdatering → prod
    - Legg til `workflow_dispatch` input i deploy.yml for å velge miljø (test/prod/both)
    - `repository_dispatch` alltid til prod, push til main alltid til test
    - Samme Google Sheet/Drive for alle miljøer — ingen dataduplisering

## Fullført

Se [TODO-archive.md](TODO-archive.md) for alle fullførte oppgaver.

