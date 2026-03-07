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

- [ ] **Redesign tannleger-seksjonen**
    - Forsiden: én klikkbar boks med fellesbilde (placeholder) → lenke til `/tannleger`
    - **Synlig på mobil** (fjern `hidden md:block`-wrapper)
    - /tannleger: `rounded-xl`-bilder i grid (3 desktop, 2 mobil) med `imageConfig`-crop
    - Native `<details>`/`<summary>` accordion for beskrivelse, `btn-secondary`-styling
    - Oppdater design-guide: 5.3, 5.7 (ny accordion-spec), 6, 8.1

- [ ] **Redesign tjenester-seksjonen**
    - `priority`-felt som **frontmatter i markdown** (ikke Sheets — tjenester er Drive-basert)
    - Vis 6 første basert på priority, `btn-secondary` "Se mer"-knapp viser resten
    - Oppdater `config.ts` schema + admin-modul for priority-felt

- [ ] **Prisliste — ny side og admin-modul**
    - Nytt Google Sheets-ark: `Prisliste` (Kategori, Behandling, Pris)
    - `valueRenderOption: 'UNFORMATTED_VALUE'` for Pris-kolonnen
    - Ny side `/prisliste` — kort-liste layout (ikke tabell), `variant="white"`
    - Auto-save admin-modul, `escapeHtml()`/programmatisk `.value`-setting
    - Navbar-lenke etter Tjenester: `…Tjenester → Prisliste → Tannleger`
    - Footer-lenke i kolonne 2
    - Ny arkitekturdok: `docs/architecture/prisliste.md`

- [ ] **Footer-justeringer**
    - Fjern `sentralbordTekst` fra footer
    - Legg til prisliste-lenke i kolonne 2 (venter på oppgave 4: Prisliste)

- [ ] **CloudFront produksjon — komplett oppsett med alle domener** ([plan](docs/plans/2026-02-28-cloudfront-prod-komplett.md))

- [ ] **Dev-Test-Prod miljø oppsett** ([plan](docs/plans/2026-02-27-dev-test-prod.md))
    - Deployment-kontroll: push til main → test, manuell dispatch → prod, Google Drive-oppdatering → prod
    - Legg til `workflow_dispatch` input i deploy.yml for å velge miljø (test/prod/both)
    - `repository_dispatch` alltid til prod, push til main alltid til test
    - Samme Google Sheet/Drive for alle miljøer — ingen dataduplisering

## Fullført

Se [TODO-archive.md](TODO-archive.md) for alle fullførte oppgaver.

