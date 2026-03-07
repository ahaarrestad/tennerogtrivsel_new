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

- [ ] **Fiks prisliste-admin (flere problemer)** ([plan](docs/plans/2026-03-07-fiks-prisliste-admin.md))
    - Kategori-dropdown er dårlig (native datalist) — erstatt med skikkelig komponent (custom dropdown med søk/opprett ny)
    - Mangler "Gå tilbake til liste"-knapp i redigeringsvisningen
    - Ny prisrad: autosave trigger for tidlig → kastes tilbake til oversikten før brukeren er ferdig med å fylle inn
    - Vis «sist oppdatert» (kun måned og år) basert på siste gang en pris ble endret

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

- [ ] **Admin-panel: Kompakt logg-ut-knapp med tooltip**
    - Endre logg-ut-knappen fra å vise fullt navn til kun fornavn + ikon
    - Mouse-over tooltip skal vise «Logg ut [hele navnet]»

- [ ] **Prisliste-admin: «+»-knapp per kategori for raskere opprettelse av ny rad**
    - Legg til en «+»-knapp på kategori-tittelen i prislisteoversikten
    - Klikk auto-fyller kategori og setter fokus i behandlings-feltet
    - Slipper å velge kategori manuelt — raskere flyt for brukeren

## Fullført

Se [TODO-archive.md](TODO-archive.md) for alle fullførte oppgaver.

