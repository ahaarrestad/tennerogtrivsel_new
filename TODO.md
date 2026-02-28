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

- [ ] **CloudFront produksjon — komplett oppsett med alle domener** ([plan](docs/plan-cloudfront-prod-komplett.md))
  - Fase 1: CloudFront for www.tennerogtrivsel.no — ~~distribusjon, OAC, DNS~~ ✓, sikkerhetsheadere gjenstår
  - Fase 2: Cache-Control headere, smart invalidering, deploy-workflow
  - Fase 3: Multi-domene (.no/.com/.net) — ACM-sertifikat bestilt, venter på issued
  - Fase 4: Verifisering av alt
  - **Status:** Nytt ACM-sertifikat bestilt, venter på godkjenning. Alt kjøres gjennom CloudFront i prod.

- [ ] **GitHub Copilot som PR-reviewer** ([plan](docs/plan-copilot-pr-reviewer.md))
  - Sett opp Copilot code review på pull requests
  - Copilot må godkjenne (eller komme med forbedringer) før PR kan merges
  - Legg til som required status check / required reviewer i branch protection rules

- [ ] **Slettede galleri-bilder og tannleger fjernes ikke fra Google Drive** ([plan](docs/plan-drive-sletting-galleri.md))
  - Galleri: `deleteGalleriBilde()` sletter kun Sheet-rad — Drive-filen blir liggende
  - Tannleger: `deleteTannlege()` har identisk bug — profilbilde slettes ikke fra Drive
  - Orphan-deteksjon: vis advarsel om filer i Drive som ikke finnes i Sheet
  - **Fix:** Hent bilde-filnavn *før* sletting, finn Drive-fil-ID, kall `deleteFile()`, deretter slett Sheet-rad

- [ ] **Dev-Test-Prod miljø oppsett** ([plan](docs/plan-dev-test-prod.md))
    - Deployment-kontroll: push til main → test, manuell dispatch → prod, Google Drive-oppdatering → prod
    - Legg til `workflow_dispatch` input i deploy.yml for å velge miljø (test/prod/both)
    - `repository_dispatch` alltid til prod, push til main alltid til test
    - Samme Google Sheet/Drive for alle miljøer — ingen dataduplisering

## Fullført

Se [TODO-archive.md](TODO-archive.md) for alle fullførte oppgaver.

