# Plan: cache-bust kart-tiles

*Skrevet 2026-09-25. Liten oppgave — spec og plan er slått sammen (§0 i todo-skillen).*

## Problem

Noen besøkende ser fortsatt «API KEY REQUIRED»-vannmerket på kartet, selv om CARTO-nøkkelen
ble innført 2026-09-08 ([spec](../../designs/archive/2026-09-08-carto-api-nokkel.md)).

CloudFront er friskt: tilene rundt klinikken (z17) hentet gjennom `/tiles/` er rene
(verifisert visuelt 2026-09-25). Problemet ligger i **nettleserens cache**. CARTO sender
`Cache-Control: public,max-age=15552000` (180 dager), og proxyen videresender headeren til
nettleseren. Besøkende fra perioden med vannmerke (slutten av august → ca. 2026-09-08) har
vannmerkede tiles lokalt til ca. mars 2027. CloudFront-invalidering når ikke nettleserne.

## Løsning

Endre tile-URL-en i Leaflet til `/tiles/{z}/{x}/{y}.png?v=2`. Ny URL → nettleseren har ingen
cache-oppføring → henter på nytt.

- **CloudFront:** `Managed-CachingOptimized` har `QueryStringBehavior: none`, så `v` inngår ikke
  i cache-nøkkelen — samme rene objekt treffes. Verifisert 2026-09-25: `?v=2` ga
  `X-Cache: Hit from cloudfront` og byte-identisk tile (md5) med URL-en uten parameter.
- **Origin:** `carto-tiles-key-forward` forwarder kun `key`, så `v` når aldri CARTO i prod.
- **Lokal dev:** Vite-proxyen håndterer allerede eksisterende query (`&key=`); `v` sendes til
  CARTO lokalt, som er ufarlig.

## Akseptansekriterier

1. Leaflet laster tiles fra `/tiles/{z}/{x}/{y}.png?v=2`.
2. Enhetstesten for tile-laget verifiserer den nye URL-en.
3. Arkitekturdokumentasjonen (`sikkerhet.md`) beskriver URL-en og hvorfor `v` finnes, slik at
   parameteren kan bumpes neste gang.

## Avgrensninger

- Ingen endring i CloudFront, funksjoner eller policyer.
- Overstyring av `Cache-Control` mot nettleser (for å krympe fremtidige vinduer) er egen
  backlog-oppgave.

## Steg

1. `src/scripts/mapInit.ts` — ny URL + kort kommentar om hvorfor.
2. `src/scripts/__tests__/mapInit.test.ts` — oppdater forventet URL.
3. `docs/architecture/sikkerhet.md` — oppdater Leaflet-linjen.
4. Kvalitetsport (tester + coverage for `mapInit.ts`).

## Risiko

- URL-en ligger i et hashet `/_astro/*.js`-bundle (`immutable`), men endret innhold gir nytt
  filnavn. HTML-en som peker på det serveres med `max-age=3600, stale-while-revalidate=86400`,
  så nettlesere plukker opp ny URL innen timer til et døgn etter deploy.
- Den gamle, vannmerkede cachen blir liggende ubrukt i nettleserne til den utløper — ufarlig.
