# Plan: kort nettleser-cache for `/tiles/*`

*Skrevet 2026-09-25. Spec: [`docs/designs/2026-09-25-tiles-nettleser-cache.md`](../designs/2026-09-25-tiles-nettleser-cache.md)*

## Mål og avgrensninger

Ny CloudFront Function `tiles-browser-cache` (viewer-response) på `/tiles/*` som setter
`Cache-Control: public, max-age=86400` på `200`/`304`. Ikke med: endring av CloudFront-TTL,
cache-/origin-request-policy, security-headers eller `v`-parameteren (se spec).

## Steg

### Kode (worktree, via PR)

1. **`scripts/cloudfront-tiles-browser-cache.js`** — ny funksjon, samme form som
   `cloudfront-admin-noindex.js` (`cloudfront-js-2.0`, `module.exports` bak `typeof module`-vakt).
   Setter `response.headers['cache-control']` når `response.statusCode` er `200` eller `304`;
   ellers urørt. Konstanten `BROWSER_CACHE_CONTROL = 'public, max-age=86400'` med kommentar
   om hvorfor.
2. **`scripts/__tests__/cloudfront-tiles-browser-cache.test.mjs`** — `it.each` over statuskoder:
   `200` og `304` overstyres (også når CARTOs `public,max-age=15552000` finnes fra før); `400`,
   `403`, `404`, `500`, `502` urørt (både med og uten eksisterende header); `206`, `301`, `302`
   urørt; andre headere bevares.
3. **`scripts/setup-cloudfront-functions.mjs`** — legg funksjonen til i `FUNCTIONS`.
   `injectCartoKey` returnerer kode uten placeholder urørt, så ingen annen endring trengs.
4. **Dokumentasjon:**
   - `docs/architecture/aws-infrastruktur.md` — funksjonstabellen, behaviors-tabellen (`/tiles/*`
     får `tiles-browser-cache` (viewer-resp)), oppsettssteg 8 for `/tiles/*`, script-tabellen
     (liste over funksjoner), og runbooken for vannmerke: nettleser-levetiden er nå ett døgn.
   - `docs/architecture/sikkerhet.md` — Leaflet-punktet: nettleseren holder tiles i ett døgn;
     `v` trengs fortsatt for umiddelbar effekt.
   - `.github/workflows/deploy.yml` — kommentaren ved tiles-invalideringen («180 dagers
     max-age») justeres.

### AWS (manuelt, etter at PR-en er merget og deployet)

5. **Verifiser at funksjonen er publisert** (`aws cloudfront describe-function --name
   tiles-browser-cache --stage LIVE`). Valgfritt før tilknytning:
   `aws cloudfront test-function` med et `200`- og et `404`-event.
6. **Test-distribusjonen (`E2WXX7ZUR5NNP3`) først:** knytt `tiles-browser-cache` som
   *viewer response* på `/tiles/*`. Vent til status «Deployed».
7. **Verifiser test** (`test2.aarrestad.com`):
   - `curl -sI …/tiles/17/67625/38817.png?v=2` → `cache-control: public, max-age=86400` og
     `x-cache: Hit`. Edge-TTL upåvirket: velg en tile med `age` > 86400 (i prod har denne
     ~870 000) — at den fortsatt er `Hit`, viser at edge ikke bruker nettleser-verdien
   - `If-None-Match` med etag → `304` med `max-age=86400`
   - `content-security-policy` m.fl. security-headere fortsatt til stede
   - Kartet vises på `/kontakt`
8. **Prod (`E9Z51DQB2K1G4`):** gjenta 6–7 mot `www.tennerogtrivsel.no`.

Tilknytning kan gjøres i Console eller med `aws cloudfront update-distribution` — begge er
utadrettede endringer og gjøres kun etter eksplisitt godkjenning.

## Testbehov / definition of done

- Enhetstestene i steg 2 består; `cloudfront-tiles-browser-cache.js` ≥ 80 % branch coverage.
- Hele kvalitetsporten (`/commit`) grønn.
- Steg 7 og 8 verifisert med curl-utdrag.
- Arkitekturdokumentasjonen beskriver faktisk oppsett.

## Risiko og usikkerheter

- **Rekkefølge:** funksjonen må være publisert (deploy via `deploy.yml`) før den kan knyttes til
  en behavior. Knyttes den ikke til, har koden ingen effekt — ufarlig, men tiltaket er da ikke
  i drift; derfor er steg 6–8 en del av DoD.
- **Samspill med response headers policy:** `tot-security-headers` setter ikke `Cache-Control`,
  så det er ingen konflikt uansett rekkefølge mellom policy og funksjon. Verifiseres i steg 7.
- **Allerede cachede tiles:** tiles som nettlesere hentet før tiltaket (inkl. de rene `?v=2`-tilene
  fra i dag) beholder 180 dager. Ufarlig — de er rene — men tiltaket virker først for tiles hentet
  etterpå. Ved neste hendelse innen de 180 dagene må `v` fortsatt bumpes. Å bumpe `v` i
  *denne* PR-en ville ikke hjulpet: PR-en deployes før funksjonen knyttes til (steg 6–8), så
  nettleserne ville fått 180 dager på den nye URL-en også. Ønskes alle over på ett døgn med én
  gang, må det være en egen liten PR etter steg 8 — ikke nødvendig, siden dagens tiles er rene.
- **Flere forespørsler til CloudFront:** faste besøkende revaliderer daglig i stedet for halvårlig.
  Svarene er `304` fra edge; ingen ekstra trafikk til CARTO.
