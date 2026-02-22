# TODO – Tenner og Trivsel

> Denne filen holdes oppdatert underveis. Kryss av oppgaver med `[x]` når de er ferdige.

### Arbeidsflyt
- **Før vi starter på en oppgave:** Lag alltid en plan først. Still avklarende spørsmål hvis noe er uklart.
- Planen skrives som notater under oppgaven før implementering begynner.
- Flytt oppgaven til «Pågående» når planen er godkjent og arbeidet starter.
- **Lever i små, iterative forbedringer** — minst én commit per oppgave. Store oppgaver brytes ned i deloppgaver som hver committes for seg.
- **Planer lagres under `/docs`** i prosjektet, både når de er utarbeidet og etter eventuelle revisjoner.
- Flytt oppgaven til «Fullført» når den er ferdig.

## Pågående

## Backlog

- [ ] **Sjekk utsnitt/visning av hovedbilde og bildegalleri**
  - Hovedbildet (forsidebildet) ser ut til å ha et annet utsnitt enn det som vises i bildegalleri-admin
  - Undersøk hvordan skala/posisjon (Scale, PosX, PosY) anvendes på forsiden vs. admin-preview
  - Gå gjennom resten av bildegalleriet for å se om tilsvarende avvik finnes
  - Sørg for at admin-preview gjenspeiler det faktiske utsnittet på nettsiden

- [ ] **Optimalisere bygg, tester og deploy for raskere feedback-loop**
  - Kartlegge nåværende tidsbruk for unit-tester, E2E-tester, bygg og deploy
  - Identifisere flaskehalser og muligheter for parallellisering/caching
  - Vurdere tiltak i CI/CD-pipeline (GitHub Actions) og lokalt utviklingsmiljø
  - 
- [ ] **Refaktorere inline-klasser til global.css**
  - Gå gjennom HTML-templates og identifisere gjentatte Tailwind-klassekombinasjoner
  - Flytte gjenbrukbare mønstre til `global.css` som egne klasser/variabler
  - Være forsiktig — verifisere visuelt at ingenting går i stykker underveis
  - Kjøre E2E-tester etter hver større endring for å fange regresjoner

- [ ] **UX/design-gjennomgang av den offentlige nettsiden**
  - Bruk et team med Senior UX-designer, UX-designer og Senior Utvikler til å lage planen
  - Skriv et design-dokument (f.eks. `docs/design-guide.md`) som beskriver prinsipper for layout, typografi, farger, spacing og responsivt design
  - Link design-dokumentet fra `CLAUDE.md` slik at det alltid følges ved fremtidige endringer
  - Lag deretter en konkret plan for å oppdatere layout/UX basert på best practice og målene i dokumentet
  - Vurder: lesbarhet, visuelt hierarki, tilgjengelighet (a11y), mobil-først, konsistens mellom seksjoner

- [ ] **Grundig sikkerhetssjekk av hele prosjektet**
  - Det er gjort en sikkerhetsgjennomgang tidligere, men mye kode er endret siden da
  - Bruk et team med sikkerhetsekspert, arkitekt og senior utvikler til å legge planen
  - Dekke hele stacken: frontend, admin-panel, API-endepunkter, CSP, autentisering, dataflyt

## Fullført

- [x] **Thumbnails på tannleger-listen i admin**
  - Thumbnail-bilder ved siden av hver tannlege i admin-panelet
  - Responsiv layout med flex-container (identisk mønster som galleri)
  - Asynkron lasting via `findFileByName` + `getDriveImageBlob`

