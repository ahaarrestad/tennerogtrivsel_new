# Spec: kort nettleser-cache for `/tiles/*`

*Skrevet 2026-09-25*

## Problem og mål

CARTO sender `Cache-Control: public,max-age=15552000` (180 dager) på hver tile, og
CloudFront-proxyen videresender headeren uendret til nettleseren. Da CARTO leverte vannmerkede
tiles (august–september 2026), ble de derfor liggende i besøkendes nettlesere i et halvt år —
CloudFront-invalidering hjalp ikke, og vi måtte cache-buste URL-en
([Cache-bust kart-tiles](../plans/archive/2026-09-25-cache-bust-kart-tiles.md)).

**Mål:** begrens hvor lenge en tile kan ligge i nettleseren, slik at en fremtidig dårlig tile
(vannmerke, feil kartdata) forsvinner av seg selv innen kort tid etter at edge er rettet — uten
at CloudFront-cachen mot CARTO blir kortere.

## Krav og akseptansekriterier

1. Svar på `/tiles/*` med status `200` eller `304` har `Cache-Control: public, max-age=86400`
   mot nettleseren, i både test- og prod-distribusjonen.
2. CloudFronts egen cache-levetid er uendret — den styres fortsatt av CARTOs `max-age`
   (verifiseres med at `Age` fortsetter å vokse forbi 86400 og at `X-Cache: Hit` består).
3. Feilsvar (4xx/5xx) får ikke overstyrt `Cache-Control`.
4. Security-headerne på `/tiles/*` er uendret — `tot-security-headers` er fortsatt policyen,
   og ingen kopi av den opprettes.
5. Funksjonskoden deployes automatisk av `setup-cloudfront-functions.mjs` som i dag.
6. Enhetstester dekker handleren (≥ 80 % branch coverage per fil).

## Avgrensninger (non-goals)

- Ingen endring av CloudFront-TTL mot CARTO, cache-policy eller origin request policy.
- Ingen automatisk tilknytning av funksjonen til behaviors i kode — det gjøres manuelt én gang,
  som for de øvrige funksjonene (repoet har ingen IaC for distribusjonene).
- Ingen deteksjon av vannmerkede tiles.
- `v`-parameteren i `mapInit.ts` beholdes; den trengs fortsatt for å tvinge ny henting
  *umiddelbart* i stedet for innen ett døgn.

## Designvalg

### Viewer-response-funksjon, ikke egen response headers policy

En behavior kan bare ha én response headers policy. Å overstyre `Cache-Control` via policy krever
derfor en kopi av `tot-security-headers` for `/tiles/*` — og den kopien ville ikke blitt oppdatert
av CSP-synken i CI (`update-cloudfront-csp.mjs` kjenner bare `CLOUDFRONT_CSP_POLICY_ID`), så
CSP/HSTS på tiles ville driftet stille.

En CloudFront Function på viewer-response setter headeren uten å røre security-headerne. Mønsteret
finnes allerede (`tot-admin-noindex` på default-behavioren), funksjonskoden deployes av eksisterende
script, og den er enhetstestbar. Viewer-response kjører *etter* edge-cachen, så CloudFronts TTL er
upåvirket.

Kostnad: én ekstra funksjonsinvokasjon per tile-forespørsel som når CloudFront — neglisjerbart
(CloudFront Functions koster $0,10 per million).

### Også `304`, ikke bare `200`

Når nettleseren revaliderer en utløpt tile, svarer CloudFront `304` med cache-objektets headere —
inkludert CARTOs 180-dagers `max-age`. Overstyres ikke `304`, får nettleseren en ny 180-dagers
friskhet ved første revalidering, og tiltaket er virkningsløst for faste besøkende.
Verifisert 2026-09-25: `If-None-Match` mot prod ga `304`, `X-Cache: Hit` og
`cache-control: public,max-age=15552000`.

### Ikke feilsvar

Feilsvar kan i dag ha `no-cache`/kort levetid fra CARTO eller CloudFront. Å gi dem ett døgn ville
gjort en forbigående feil *mer* varig i nettleseren.

### Ett døgn

Avveiing mellom hvor fort en dårlig tile forsvinner og hvor ofte faste besøkende revaliderer.
Revalidering er billig (`304` fra edge, ingen trafikk til CARTO), og kartet ligger bare på
kontaktsiden. Ett døgn er samme størrelsesorden som HTML-en (`max-age=3600,
stale-while-revalidate=86400`).
