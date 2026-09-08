# Spec: CARTO API-nøkkel for basemap-tiles

*Skrevet 2026-09-08*

## Problem og mål

Kartet på kontaktsiden viser tiles stemplet med et diagonalt vannmerke «API KEY REQUIRED /
carto.com/basemaps/apikey». CARTO innførte nøkkelkrav for `basemaps.cartocdn.com` i slutten av
august 2026.

Degraderingen er **stille**: endepunktet svarer fortsatt `200 OK` med gyldig `image/png` i normal
størrelse. Verifisert 2026-09-08 både direkte mot CARTO og gjennom vår `/tiles/*`-proxy. Ingenting
i pipelinen — HTTP-sjekker, enhetstester, E2E — kan skille en vannmerket tile fra en frisk.

**Mål:** kartet viser rene tiles igjen, med nøkkelen håndtert som en hemmelighet.

## Krav og akseptansekriterier

1. Tiles hentet gjennom `/tiles/{z}/{x}/{y}.png` i produksjon er uten vannmerke.
2. Nøkkelen finnes **ikke** i git — verken i kildekode, tester, konfigurasjon eller
   dokumentasjon.
3. Nøkkelen eksponeres **ikke** i klient-JS. Nettleseren skal fortsatt kun se same-origin-URL-en
   `/tiles/...`; `key`-parameteren settes først på CloudFront-siden.
4. Kartet fortsetter å gå gjennom same-origin-proxyen. Besøkendes IP-adresser når ikke CARTO.
5. CSP er uendret — tiles er fortsatt `'self'`.
6. OpenStreetMap- og CARTO-attribusjon forblir synlig i kartet (vilkårskrav).
7. Lokal utvikling (`npm run dev`) viser rene tiles for utviklere som har nøkkelen i `.env`, og
   feiler ikke hardt for dem som ikke har den.
8. Deploy uten konfigurert nøkkel skal **feile høylytt**, ikke stille deploye en funksjon som
   sender en tom `key`-parameter.

## Avgrensninger (non-goals)

- **Deteksjon av stille degradering er ikke med.** Egen backlog-oppgave etter brukerens
  beslutning 2026-09-08. Denne oppgaven gjør kartet friskt igjen; den lukker ikke hullet som
  gjorde at ingen oppdaget feilen.
- **Ingen migrering til vektor-tiles.** Se «Kjent risiko» — dette er et større veivalg som
  fortjener egen utredning.
- **Ingen leverandørbytte** (Protomaps/selvhost, andre nøkkelfrie kilder). Vurdert og valgt bort
  i denne omgang.
- **Ingen endring av kartets utseende, zoom, markør eller touch-oppførsel.**
- Origin-ID-en `tile.openstreetmap.org osm-tiles` er misvisende (peker på
  `basemaps.cartocdn.com`), men endres ikke her — omdøping av en origin-ID krever at alle
  cache-behaviors som refererer den oppdateres samtidig, og gevinsten er kosmetisk.

## Designvalg

### Nøkkelen lagres i GitHub Secrets og injiseres ved deploy

`CARTO_API_KEY` legges som repository secret og sendes som miljøvariabel til steget «Deploy
CloudFront Functions» i `deploy.yml`. `setup-cloudfront-functions.mjs` bytter ut en placeholder i
funksjonskoden rett før opplasting til AWS.

*Begrunnelse:* følger et mønster som allerede finnes i repoet — `update-cloudfront-csp.mjs` får
`CLOUDFRONT_POLICY_ID` på nøyaktig samme måte. Kildefilen i git beholder placeholderen, så
kravet om at nøkkelen ikke ligger i git er strukturelt oppfylt, ikke avhengig av disiplin.

*Vurdert alternativ:* CloudFront KeyValueStore. Lar nøkkelen roteres uten å redeploye funksjonen,
men gjør handleren asynkron, krever en ny AWS-ressurs å opprette og knytte, og introduserer en
feilsti (KVS utilgjengelig) som må håndteres i en funksjon som i dag er seks linjer. Overdimensjonert
for én konstant verdi som roteres sjelden. Valgt bort.

### Nøkkelen settes som query-parameter i CloudFront-funksjonen

CARTO tar nøkkelen som `?key=` på tile-URL-en. Funksjonen `strip-tiles-prefix` skriver allerede om
`/tiles/*` → `/rastertiles/voyager/*` på viewer-request; den utvides til å sette `key` i samme
operasjon.

*Begrunnelse:* funksjonen er allerede det eneste stedet der en `/tiles`-forespørsel formes.
Nøkkelen legges på etter at nettleseren har sendt sin forespørsel, så klienten ser den aldri.

### CloudFront må forwarde `key` til origin

Cache-behavior `/tiles/*` bruker i dag `Managed-CachingOptimized`, som har
`QueryStringBehavior: none`. Query-parametere sendes derfor **ikke** videre til origin — en `key`
satt av funksjonen ville blitt strippet.

Løsning: en egen origin request policy som forwarder kun query-parameteren `key`, knyttet til
`/tiles/*`-behavioren. Cache-policyen står urørt, så `key` holdes utenfor cache-nøkkelen og vi
beholder ett cachet objekt per tile framfor ett per nøkkelverdi.

## Akseptert risiko

### CARTOs vilkår punkt 9.c.iii forbyr server-side proxy

Vilkårene lister «proxying or caching the content on the server side» som uakseptabel bruk, i en
generell liste over elleve urelaterte forbud (videresalg, skadevare, eksportkontroll m.m.).
Klausulen står på egne bein og er ikke bare en presisering av videresalgsforbudet i 9.c.i.
Punkt 9.c.xi forbyr i tillegg aktivitet i strid med «the spirit or intent» av vilkårene.

Vår `/tiles/*`-proxy med 24 timers CloudFront-cache er dekket av ordlyden.

**Beslutning (bruker, 2026-09-08):** vi går videre med proxy-løsningen. Vurderingen er at
intensjonen bak forbudet er å hindre videresalg og videredistribusjon, noe vi ikke driver med —
alle kall stammer fra vår egen side, og vi tilbyr ikke tiles til tredjeparter.

**Restrisiko:** CARTO forbeholder seg retten til å «suspend, rate-limit, or terminate ... at any
time, in its sole discretion and for any or no reason, without prior notice». Et vilkårsbrudd gir
dem et rent grunnlag for å gjøre det, og vi har i dag ingen overvåking som ville fanget det opp —
samme feilmodus som denne oppgaven rydder opp i. Dette er hovedargumentet for å prioritere
deteksjonsoppgaven kort tid etter denne.

### Raster-tiles er under avvikling

CARTOs egen FAQ sier raster-basemaps «are being retired», at de «are considering stopping data
updates to the raster basemaps», og anbefaler migrering til vektor «regardless of the watermark».
De skriver også at nøkkelkravet kan bli utvidet til vektor.

Fiksen er altså holdbar, men har begrenset levetid — kartdataene kan bli frosset uten varsel.
Foreslått oppfølging: egen backlog-oppgave for veivalget vektor vs. selvhost (Protomaps PMTiles),
som også ville fjernet vilkårsproblemet over.

## Åpne spørsmål

Ingen som blokkerer planlegging. Den ene tekniske usikkerheten — om en origin request policy
faktisk forwarder query-parameteren *slik funksjonen satte den*, framfor slik nettleseren sendte
den — er en verifiseringsoppgave i planen, ikke et designvalg.
