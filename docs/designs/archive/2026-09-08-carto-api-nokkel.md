# Spec: CARTO API-nøkkel for basemap-tiles

*Skrevet 2026-09-08*

> **Rettelse lagt til 2026-09-08 (etter arkivering).** Dokumentet er bevart som
> historisk referat og er *ikke* omskrevet, men to påstander i det er senere vist å
> være feil, og de gjentas ikke i gjeldende dokumentasjon:
> 1. **«Besøkendes IP-adresser når ikke CARTO» stemmer ikke.** Mot et custom origin
>    legger CloudFront selv på `X-Forwarded-For` med viewer-IP-en, og det kan ikke slås
>    av med en origin request policy. Proxyen er en dataminimering, ikke en eliminering.
> 2. **Cache-levetiden er 180 dager, ikke 24 t.** CARTO sender
>    `Cache-Control: public,max-age=15552000`, som slår cache-policyens `DefaultTTL`.
>
> Gjeldende beskrivelse: [`docs/architecture/sikkerhet.md`](../../architecture/sikkerhet.md)
> og `src/pages/personvern.astro`.

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

Løsning: en egen origin request policy knyttet til `/tiles/*`-behavioren, som forwarder
query-parameteren `key` og headeren `referer`. Cache-policyen står urørt, så ingen av delene
havner i cache-nøkkelen — vi beholder ett cachet objekt per tile framfor ett per nøkkelverdi.

`referer` må med fordi CARTO håndhever nøkkelens domenerestriksjon på den headeren, og
CloudFront videresender ingen `Referer` til origin uten at policyen sier det — heller ikke en
som funksjonen selv har satt.

**Verdien settes av funksjonen, ikke av klienten.** Dette er et sikkerhetskrav, ikke en
bekvemmelighet: cache-nøkkelen for `/tiles/*` er kun pathen, så videresendte vi klientens egen
`Referer`, ville den vært den eneste variable inputen som når origin — og samtidig usynlig for
cachen. Hvem som helst kunne hotlinket `https://www.tennerogtrivsel.no/tiles/…` fra et fremmed
domene, fått et vannmerket `200 OK` fra CARTO, og fått det cachet i 24 t for alle ekte
besøkende. Funksjonen setter derfor `request.headers.referer` selv, til en konstant utledet av
`Host` — men *ikke* til `Host` som sådan; se «Host normaliseres» under.

Sidegevinst: klientens `Referer` er full side-URL (same-origin + `Referrer-Policy:
strict-origin-when-cross-origin`). Å overskrive den hindrer at hver besøkendes side-URL lekker
til CARTO — som er hele poenget med å proxye i utgangspunktet.

**Host normaliseres — rå Host er ikke trygg.** CloudFront validerer `Host` mot distribusjonens
aliaser, men prod har seks (`tennerogtrivsel.no/.net/.com` med og uten `www`) pluss
`d19b7g2frcrx6i.cloudfront.net`, og bare det kanoniske domenet registreres på nøkkelen.
Argumentet om at «apex-domenene redirecter 301 til `www…no`, så kartet lastes aldri derfra»
holder **ikke** for `/tiles/*`: 301-en kommer fra `sitemap_redirect`, som er knyttet til
default-behavioren, mens `/tiles/*` har `strip-tiles-prefix` — og CloudFront tillater kun én
viewer-request-funksjon per behavior. Verifisert: `https://tennerogtrivsel.com/tiles/…` gir
`200` med tile, ikke redirect. Funksjonen mapper derfor `Host` til én av to konstanter
(`aarrestad.com` i Host → testdomenet, ellers prod-domenet), slik at verdien er deterministisk
og immun mot at nye aliaser legges til senere.

Domenene som skal registreres på nøkkelen: `www.tennerogtrivsel.no`, `test2.aarrestad.com` og
`localhost` (lokal utvikling). `test3.aarrestad.com` trenger ikke registreres — funksjonen
normaliserer den til `test2.aarrestad.com`.

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

## Verifisert underveis (2026-09-08)

- **Nøkkelen virker.** Samme tile hentet direkte fra CARTO med og uten `?key=` gir ulikt innhold;
  visuell inspeksjon bekrefter vannmerke uten nøkkel og ren tile med.
- **Origin request policy forwarder query-parameteren.** Etter at
  `carto-tiles-key-forward` ble knyttet til `/tiles/*`, ga en cache-MISS gjennom
  `https://www.tennerogtrivsel.no/tiles/...?key=...` en ren tile. Planens hovedusikkerhet er
  dermed avkreftet for klient-satt `key`; at en *funksjonssatt* `key` oppfører seg likt gjenstår
  å bekrefte etter deploy.
- **Nøkkelen aksepteres uten `Referer`.** `curl` sender ingen referrer og fikk likevel ren tile.
- **Nøkkelen er per i dag ikke domenerestriktert.** Samme tile med gyldig nøkkel ga byte-identisk
  svar (md5) med `Referer: https://ondsinnet-side.example/` som med vårt eget domene, mens samme
  tile uten nøkkel ga vannmerke. Hotlink-forgiftningen beskrevet over er altså ikke utnyttbar i
  dag — men ville blitt det i samme øyeblikk domenerestriksjonen ble slått på, hvis ikke
  funksjonen satte `Referer` selv.
- **Nøkkelen lekker ikke til klienten.** `dist/` etter `npm run build:ci` inneholder verken
  nøkkelen, placeholderen eller variabelnavnet.
