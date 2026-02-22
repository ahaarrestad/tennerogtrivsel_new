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

- [ ] **Gjennomgang av innstillinger og opplesing**
  - Sjekk at alle innstillinger bruker de rette property-navnene konsistent (Sheets, getSettings, admin, komponenter)
  - Verifiser at HARD_DEFAULTS har fornuftige standardverdier for alle nøkler
  - Sjekk at opplesing fra Google Sheets og fallback-logikk er konsistent på tvers av kodebasen
  - [x] Zoom/utsnitt: unifisert scale-range 1.0–3.0, verifisert hel dataflyt fra Sheets → admin → sync → frontend
  - [ ] Gjenstår: gjennomgå øvrige innstillinger (telefon, adresse, titler, tekster, etc.)

## Backlog

- [ ] **Forbedre UX for zoom/posisjon-kontroller i admin**
  - Legge til +/- knapper (tap) for zoom, h-pos og v-pos så man kan justere i små steg
  - Hindre utilsiktet endring ved scrolling på mobil (range-slidere fanger scroll-events)
  - Vurdere `touch-action: none` eller lignende for å skille scroll fra slider-interaksjon

- [ ] **Optimalisere bygg, tester og deploy for raskere feedback-loop**
  - Kartlegge nåværende tidsbruk for unit-tester, E2E-tester, bygg og deploy
  - Identifisere flaskehalser og muligheter for parallellisering/caching
  - Vurdere tiltak i CI/CD-pipeline (GitHub Actions) og lokalt utviklingsmiljø
  
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

- [x] **Sjekk utsnitt/visning av hovedbilde og bildegalleri**
  - Admin-thumbnails bruker nå riktig utsnitt (scale, posX, posY) fra data
  - Forsidebilde-thumbnail har aspect-[16/10], galleri aspect-[4/3], tannleger kvadratisk
  - Forside.astro leser utsnitt fra galleri-arket (ikke Innstillinger) — én autoritativ kilde
  - syncGalleri() inkluderer forsidebilde i galleri.json med type-felt

