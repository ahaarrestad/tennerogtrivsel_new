# Spec: deteksjon av stille degradering (kart-tiles og innhold)

## Problem

Siden kan bli ødelagt uten at noe svarer annet enn `200 OK`:

- **Kart-tiles.** CARTO-vannmerket («API KEY REQUIRED») sto på kontaktsiden i ukjent tid
  (rettet 2026-09-08). Endepunktet svarte `200` med gyldig `image/png` i normal størrelse — kun
  pikslene var feil. Målt 2026-10-15: uten nøkkel svarer CARTO nå med et rent erstatningsbilde,
  2049 byte, byte-identisk for alle koordinater (etag `wm-…`). Feilmodusen har altså allerede
  endret form én gang.
- **CloudFront skjuler det.** CARTO sender `max-age=15552000`, så edge-cachen holder en tile i
  inntil **180 dager** (`docs/architecture/sikkerhet.md`, «tiles-browser-cache» gir bare
  *nettleseren* ett døgn). En tile som er hentet før en degradering, ser frisk ut lenge etter —
  mens tiles ingen har bedt om ennå, kommer ut ødelagt for besøkende.
- **Innhold fra Drive/Sheets.** Mister tjenestekontoen tilgang, kaster API-kallet og bygget feiler
  (`sync-data.js` → `process.exit(1)`) — det er ikke stille. Det stille tilfellet er at kilden blir
  *tom*: en tømt Drive-mappe gir bare advarselen `Empty Collection` (tjenester, meldinger), og
  Sheets-rader som deaktiveres eller slettes gir tom JSON uten advarsel (tannleger, galleri,
  prisliste). Bygget deployer da en side uten innholdet. Et bilde som ikke lastes ned, gir
  «Bilde mangler» på tannlegekortet. Uptime-sjekken ser i dag på status, `<title>`, headere,
  redirecter og TLS — ikke innhold.

Kartet er den eneste tredjeparten offentlige besøkende henter fra under kjøring (CSP: alt
Google-relatert gjelder admin; bilder og innhold synkes inn ved bygg). Generaliseringen fra
TODO-oppgaven er derfor innholdet fra Drive/Sheets, ikke flere runtime-tredjeparter.

**Mål:** brukeren får en issue — uten å følge med selv — når prod svarer, men viser feil eller
tomt innhold. Innen timer, ikke ukjent tid. Ingen fasit som må vedlikeholdes.

## Krav og akseptansekriterier

Sjekkene kjøres mot prod (`https://www.tennerogtrivsel.no`) som en del av den timevise
`uptime-check.yml`. Funn havner i samme `uptime`-issue (dedup, auto-lukking).

### Kart-tiles

To tiles hentes gjennom proxyen (`/tiles/{z}/{x}/{y}.png?v=2`):

- **Fast tile:** klinikken på z17 (`17/67625/38817`, zoomnivået kartet åpner på). Viser hva
  besøkende får, men er nesten alltid cachet.
- **Fersk tile:** tilfeldig valgt per kjøring blant z17-tilene i Stavanger/Sandnes
  (x 67567–67647, y 38787–38893, ~8 700 tiles). Hver kjøring cacher sin tile i 180 dager, så
  andelen cachede tiles vokser til ca. 8–40 % (4–24 kjøringer i døgnet, pluss det besøkende panorerer
  til). De fleste kjøringer får likevel en ucachet tile rett fra CARTO med vår nøkkel; resten blir
  «ikke avgjort».

| # | Feiler når | Fanger |
|---|---|---|
| T1 | En av tilene ikke er `200`, ikke `image/png`, ikke har PNG-signatur eller ikke er 256×256 | Proxy-/CloudFront-feil, feilsider |
| T3 | Den ferske tilen er byte-identisk med samme tile hentet direkte fra CARTO **uten** nøkkel | Nøkkelen virker ikke — både i erstatningsbilde- og vannmerke-varianten, siden referansen er det CARTO leverer nøkkelløst akkurat nå |

T3 krever at den ferske tilen faktisk kom fra origin: svarer CloudFront med `x-cache: Hit`, er
sammenligningen uten verdi og hoppes over («ikke avgjort»). Det samme når CARTO ikke kan nås
direkte. Begge deler skrives til jobbsammendraget (`$GITHUB_STEP_SUMMARY`), aldri som funn.

(T2 fra første utkast — «to faste tiles er like» — er fjernet: faste tiles er cachet og ulike per
definisjon, så sjekken kunne aldri slå ut.)

### Innhold

| # | Feiler når |
|---|---|
| C1 | Forsiden har ingen lenke på formen `/tjenester/<slug>/` (ikke-tom slug) |
| C2 | `/tannleger/` har ingen `<img src="/_astro/…">` utenom logoen (`tt-logo`) |
| C3 | `/galleri/` har ingen `<img src="/_astro/…">` utenom logoen |
| C4 | `/tannleger/` inneholder «Bilde mangler» |
| C5 | Første tannlegebilde fra C2 svarer ikke `200` med `image/*` |
| C6 | Første tjenesteside fra C1 svarer ikke `200` |
| C7 | `/prisliste/` inneholder «Prislisten er tom» |

Tersklene er «minst én» / «ingen tomt-tekst», ikke antall: å fjerne én tjeneste er en
redigering, ikke en feil.

(Koordinatsjekken fra første utkast er fjernet: `getSettings.ts` har hardkodede
standardkoordinater, så tomt innhold gir aldri `0`.)

### Robusthet

- Hver henting har 15 s timeout og prøves inntil 3 ganger med 2 s pause ved nettverksfeil,
  timeout, `5xx` og `429`. Andre statuser prøves ikke på nytt.
- En henting som feiler etter siste forsøk, blir et **funn** («X svarer ikke …»), og sjekker som
  avhenger av den hoppes over. Scriptet krasjer ikke fordi prod er nede.
- Feiler forsidesjekken i uptime-workflowen allerede, kjøres ikke innholdsscriptet — det ville bare
  gitt flere linjer om samme brudd.
- Funn skrives til stdout (én linje per funn); all annen logging til stderr.
- Verdier hentet fra prod som havner i et funn, kortes til 80 tegn og renses for `@` og backticks,
  så en kompromittert side ikke kan legge mentions eller markdown i issuen.
- Krasjer scriptet likevel (en bug), legges en linje om det i issuen, issue-stegene kjører som
  vanlig, og jobben gjøres rød til slutt — rødt betyr fortsatt «workflowen er ødelagt».
- T3-funnet forklarer seg selv og lenker til runbooken i `sikkerhet.md`.

### Akseptanse

- Kjørt lokalt mot prod: ingen funn, exit 0.
- Kjørt mot en lokal testserver som leverer CARTOs nøkkelløse erstatningsbilde på `/tiles/*`:
  T3-funn.
- Kjørt mot en lokal testserver som svarer `503` på `/tannleger/`: funn, ikke krasj.
- Tester dekker hver regel, ≥ 80 % branch coverage.

## Avgrensninger (non-goals)

- **Ikke** stoppe bygg/deploy ved tomt innhold i `sync-data.js` — brukeren valgte varsling
  2026-10-15. Kan bli egen oppgave.
- **Ikke** pikselanalyse, OCR eller visuell regresjon mot lagrede bilder.
- **Ikke** endre cache-policyen for `/tiles/*` eller bruke CARTO-nøkkelen i workflowen.
- **Ikke** oppdage at en *allerede cachet* tile er dårlig. Den ferske tilen avslører at kilden er
  dårlig; dårlige cachede tiles ryddes med runbooken (invalider + bump `v`).
- **Ikke** sjekke kontaktskjemaet (`/api/kontakt`). Det er ikke i bruk ennå; tas når det aktiveres.
- **Ikke** endre issue-oppførselen (gjenåpning ved flapping, kommentar ved nye funn mens en issue
  er åpen). Eksisterende oppførsel beholdes.
- **Ikke** sjekke admin, meldinger/banner eller Google-tjenester.

## Designvalg

- **Node-script (`scripts/check-prod-content.mjs`) framfor bash.** Reglene er logikk
  (byte-sammenligning, PNG-header, HTML-uttrekk, retry) som skal testes med 80 % branch coverage,
  som øvrige `scripts/*.mjs`. Ingen avhengigheter: innebygd `fetch` og `Buffer`.
- **I `uptime-check.yml`, ikke egen workflow.** Gjenbruker issue-dedup og auto-lukking, og
  `/helsesjekk` leser allerede `uptime`-etiketten. Timevis koster ~10 forespørsler og én
  nøkkel-forespørsel mot CARTO.
- **Fersk, tilfeldig tile framfor faste tiles** for nøkkelsjekken — eneste måte å se forbi
  180-dagers edge-cachen uten å endre cache-policyen.
- **Byte-likhet med fersk nøkkelløs referanse, ikke størrelse eller fasit.** Kalibrerer seg selv
  når CARTO bygger nye kartdata eller endrer erstatningsbildet.
- **Robust mot Protomaps-planen.** Selvhostes tilene, faller T3 bort; T1 og innholdssjekkene står.
