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

- [ ] **Refaktorere inline-klasser til global.css**
  - [ ] Steg 1: Ny hjelpefunksjon `sectionVariant.ts` + unit-test
  - [ ] Steg 2: Nye CSS-klasser `.image-frame` og `.card-grid` i global.css
  - [ ] Steg 3: Ny komponent `SectionHeader.astro`
  - [ ] Steg 4: Oppdater seksjonskomponenter (Galleri, Kontakt, Tjenester, Tannleger)
  - [ ] Steg 5: Anvend `.image-frame` i Forside.astro og Card.astro

## Backlog

- [ ] **UX/design-gjennomgang av den offentlige nettsiden**
  - Bruk et team med Senior UX-designer, UX-designer og Senior Utvikler til å lage planen
  - Skriv et design-dokument (f.eks. `docs/design-guide.md`) som beskriver prinsipper for layout, typografi, farger, spacing og responsivt design
  - Link design-dokumentet fra `CLAUDE.md` slik at det alltid følges ved fremtidige endringer
  - Lag deretter en konkret plan for å oppdatere layout/UX basert på best practice og målene i dokumentet
  - Husk å inkludere alle sidene, også 404-siden og alt som ligger i sitemap siden dette er det som blir vist til brukerne
  - Ønsker gjennomført design på alle sider. Vurder fonter opp mot det som er i logoen.
  - Vurder: lesbarhet, visuelt hierarki, tilgjengelighet (a11y), mobil-først, konsistens mellom seksjoner

- [ ] **Grundig sikkerhetssjekk av hele prosjektet**
  - Det er gjort en sikkerhetsgjennomgang tidligere, men mye kode er endret siden da
  - Bruk et team med sikkerhetsekspert, arkitekt og senior utvikler til å legge planen
  - Dekke hele stacken: frontend, admin-panel, API-endepunkter, CSP, autentisering, dataflyt

## Fullført

- [x] **Vurdere "Start behandling"-knappene på admin-kortene**
  - Fjernet redundante knapper, erstattet med chevron-pil (›) for navigasjonsindikator
  - Forbedret a11y: role="link", tabindex, aria-label, keyboard-støtte (Enter/Space)
  - Forenklet JS fra dobbel event-håndtering til én klikk-handler per kort
  - focus-visible-styling for tastaturnavigasjon

- [x] **Rask aktiv/inaktiv-toggle på galleri-oversikten**
  - Klikkbar status-pill i galleri-listen — toggle uten å åpne editoren
  - Optimistisk UI-oppdatering med rollback ved feil
  - Responsivt design (fungerer på mobil og desktop)

- [x] **Gjennomgå testdekning mot faktisk kode**
  - Analysert coverage-rapport og identifisert udekte grener med Python-parsing av v8 coverage JSON
  - sync-data.js: 85% → 97% branch coverage (11 nye tester for edge cases og feilhåndtering)
  - admin-client.js: 88% → 96% branch coverage (12 nye tester for fallback-verdier, undefined-håndtering, feilscenarier)
  - Alle filer over 80% branch coverage-kravet

- [x] **Utrede backend-alternativer for mer «live» oppdatering**
  - Konklusjon: Beholdt Google Sheets — admin er allerede live nok, nettsiden kan henge litt etter
  - Implementert stille verifisering etter lagring (re-fetch fra Sheets + sammenligning)
  - Tidspunkt i lagremeldinger ("✅ 22. feb kl. 14:32") og "Sist hentet"-tid i modul-header
  - Mismatch → automatisk reload av modulen
  - Implementert for alle tre moduler: innstillinger, galleri og tannleger

- [x] **Sikre at Dependabot-PRer ikke merges ved feilet bygg**
  - Auto-merge begrenset til minor/patch (major krever manuell gjennomgang)
  - Ruleset oppdatert: required status check endret fra «build-and-deploy» til «build»
  - `build`-jobben har `needs: [unit-tests, e2e-tests]` — feilet test → build skipped → merge blokkert

- [x] **Optimalisere bygg, tester og deploy for raskere feedback-loop**
  - Slått sammen ci.yml og deploy.yml til én workflow med parallelle jobber (unit-tests + e2e-tests parallelt → build → deploy)
  - Ekskludert csp-check.spec.ts fra CI via testIgnore (manuell test)
  - Økt Playwright-workers fra 1 til 2 i CI
  - Nytt `dev:nosync`-script; E2E i CI bruker dette + eksplisitt sync-steg
  - npm audit flyttet inn i unit-tests-jobben

- [x] **Tydeliggjøre i admin at endringer ikke vises umiddelbart**
  - Info-tekst på dashboard-header om at endringer publiseres automatisk
  - Lagremeldinger (tannleger + galleri) viser undertekst om publiseringstid
  - Innstillinger-checkmark har tooltip om publiseringstid

- [x] **Forbedre UX for zoom/posisjon-kontroller i admin**
  - +/- knapper for finjustering (zoom ±0.1, posisjon ±1%)
  - `touch-action: pan-y` på slidere + `wheel`-event blokkering for å hindre utilsiktet scrolling

- [x] **Gjennomgang av innstillinger og opplesing**
  - Zoom/utsnitt: unifisert scale-range 1.0–3.0, verifisert hel dataflyt fra Sheets → admin → sync → frontend
  - Alle 24 innstillingsnøkler gjennomgått: konsistente mellom HARD_DEFAULTS, Google Sheets, admin og komponenter
  - Fikset locale-bug: `valueRenderOption: 'UNFORMATTED_VALUE'` på alle Sheets API-kall som leser desimaltall
  - Ingen inkonsekvenser funnet i property-navn, standardverdier eller fallback-logikk

- [x] **Thumbnails på tannleger-listen i admin**
  - Thumbnail-bilder ved siden av hver tannlege i admin-panelet
  - Responsiv layout med flex-container (identisk mønster som galleri)
  - Asynkron lasting via `findFileByName` + `getDriveImageBlob`

- [x] **Sjekk utsnitt/visning av hovedbilde og bildegalleri**
  - Admin-thumbnails bruker nå riktig utsnitt (scale, posX, posY) fra data
  - Forsidebilde-thumbnail har aspect-[16/10], galleri aspect-[4/3], tannleger kvadratisk
  - Forside.astro leser utsnitt fra galleri-arket (ikke Innstillinger) — én autoritativ kilde
  - syncGalleri() inkluderer forsidebilde i galleri.json med type-felt

