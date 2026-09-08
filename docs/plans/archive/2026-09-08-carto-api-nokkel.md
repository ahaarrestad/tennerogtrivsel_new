# Plan: CARTO API-nøkkel for basemap-tiles

*Skrevet 2026-09-08. Spec: [`docs/designs/archive/2026-09-08-carto-api-nokkel.md`](../../designs/archive/2026-09-08-carto-api-nokkel.md)*

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

## Mål

Rene tiles i produksjon, med nøkkelen i GitHub Secrets og aldri i git eller klient-JS.

## Avgrensning

Ikke med: deteksjon/overvåking (egen oppgave), vektor-migrering, leverandørbytte, endring av
kartets utseende, omdøping av origin-ID.

## Forutsetning

Nøkkel hentet fra [carto.com/basemaps/apikey](https://carto.com/basemaps/apikey/) og lagt inn som
repository secret `CARTO_API_KEY`. Brukeren gjør dette; nøkkelen deles ikke i chat eller i filer.

Domener som registreres på nøkkelen: `www.tennerogtrivsel.no`, `test2.aarrestad.com`,
`localhost`. Flere trengs ikke: CloudFront-funksjonen normaliserer `Host` til ett av disse to
domenene, så verken apex-/`.com`-/`.net`-aliasene eller `test3.aarrestad.com` når CARTO som
egen `Referer`-verdi.

**Merk rekkefølgen:** secreten må være på plass *før* PR-en merges. Deploy-scriptet feiler
høylytt uten den (akseptansekriterium 8), så en merge før det stopper hele deployen.

## Steg

### 1. CloudFront-funksjonen setter `key`

**Fil:** `scripts/cloudfront-strip-tiles-prefix.js`

Utvid handleren til å sette query-parameteren i tillegg til path-omskrivingen. Placeholderen
`__CARTO_API_KEY__` står i git og byttes ut ved deploy.

Detaljer som må håndteres:
- CloudFront Functions bruker `request.querystring` som et objekt (`{ key: { value: '...' } }`)
  i cloudfront-js-2.0, ikke en streng. Verifiser formatet mot AWS-dokumentasjonen før
  implementasjon.
- Pass-through-oppførselen for stier uten `/tiles`-prefiks skal være uendret — ingen `key` settes
  der.

### 2. Deploy-scriptet injiserer nøkkelen

**Fil:** `scripts/setup-cloudfront-functions.mjs`

- Les `process.env.CARTO_API_KEY`.
- Bytt ut `__CARTO_API_KEY__` i funksjonskoden i minnet før opplasting (filen på disk røres ikke).
- **Feil høylytt** hvis variabelen mangler *og* koden inneholder placeholderen — deploy skal
  stoppe, ikke laste opp en funksjon som sender tom `key`. Dette er akseptansekriterium 8.
- Substitusjonen gjelder kun funksjoner som faktisk inneholder placeholderen, slik at de to andre
  funksjonene i `FUNCTIONS`-lista er upåvirket.

### 3. Workflow sender secreten

**Fil:** `.github/workflows/deploy.yml`

Legg `env: CARTO_API_KEY: ${{ secrets.CARTO_API_KEY }}` på steget «Deploy CloudFront Functions»
(linje ~315). Samme mønster som `CLOUDFRONT_POLICY_ID` på steget rett over.

Per CLAUDE.md skal nye miljøvariabler alltid sjekkes mot `.github/workflows/` — dette steget *er*
den sjekken, og deploy.yml er eneste workflow som kjører scriptet.

### 4. CloudFront forwarder `key` til origin

**Manuelt/CLI mot AWS — ikke i repoet.** Uten dette steget har de tre foregående ingen effekt.

- Opprett en origin request policy som forwarder query-parameteren `key` **og** headeren `referer`
  (ingen cookies). `referer` er nødvendig for at CARTOs domenerestriksjon på nøkkelen skal virke —
  CloudFront videresender ingen `Referer` uten at policyen sier det, heller ikke en funksjonen
  selv har satt. **Verdien settes av CloudFront-funksjonen til en konstant, normalisert fra
  `Host`** — ikke av klienten, og ikke til rå `Host`, som er klientvalgbar blant distribusjonens
  seks aliaser. Slik kan ingen hotlinke tile-URL-en fra et fremmed domene, eller via et
  uregistrert alias, og få et vannmerket svar cachet for alle.
- Knytt den til cache-behavior `/tiles/*` på prod-distribusjonen `E9Z51DQB2K1G4`.
- La cache-policyen `Managed-CachingOptimized` stå — `key` skal ikke inn i cache-nøkkelen.
- Vurder om test-distribusjonen `E2WXX7ZUR5NNP3` har samme behavior og trenger samme endring.

Endringen dokumenteres etterpå, jf. prosjektets praksis for manuelle CloudFront-endringer.

### 5. Lokal utvikling

**Fil:** `astro.config.mjs`

Vite-proxyen for `/tiles` rewriter i dag til `/rastertiles/voyager`. Legg på `?key=` fra
`process.env.CARTO_API_KEY` (lest fra `.env`, som er gitignorert).

Uten nøkkel lokalt: proxyen skal fortsatt fungere, men tiles vises med vannmerke. Det er en
akseptabel utvikleropplevelse og oppfyller akseptansekriterium 7 — ingen hard feil.

### 6. Dokumentasjon

**Fil:** `docs/architecture/sikkerhet.md`

Kartet og tile-proxyen er allerede beskrevet der. Legg til:
- at `/tiles/*` nå krever `CARTO_API_KEY`, hvor den bor, og hvordan den injiseres
- den aksepterte risikoen rundt vilkårspunkt 9.c.iii, med begrunnelsen fra spec-en
- oppføring i «Akseptert risiko»-tabellen nederst i dokumentet

## Testbehov

`scripts/` er kjerne-logikk og omfattes av kravet om 80 % branch coverage per fil.

**`scripts/__tests__/cloudfront-strip-tiles-prefix.test.mjs`** — utvid eksisterende suite:
- `/tiles/...` gir omskrevet URI **og** `key` satt fra placeholderen
- stier uten `/tiles`-prefiks er uendret og får ingen `key`
- eksisterende pass-through-caser fortsetter å passere

**`setup-cloudfront-functions.mjs`** — ny test for substitusjonslogikken:
- placeholder byttes ut når `CARTO_API_KEY` er satt
- kaster når placeholder finnes men variabelen mangler
- funksjonskode uten placeholder er upåvirket

Substitusjonen bør derfor ligge i en eksportert, ren funksjon framfor inline i deploy-løkka, slik
at den kan testes uten å røre AWS.

## Definition of done

1. `npm test` grønn, ≥ 80 % branch coverage på begge berørte `scripts/`-filer.
2. Ingen forekomst av selve nøkkelen i `git grep` — kun placeholderen.
3. Etter deploy: en tile hentet fra `https://tennerogtrivsel.no/tiles/17/67623/38802.png` er uten
   vannmerke. Verifiseres ved å se på bildet, ikke bare HTTP-status — det var nettopp
   status-blindheten som skjulte feilen.
4. Kartet på kontaktsiden ser riktig ut i nettleseren, og nettverksfanen viser ingen `key` i
   URL-ene klienten ber om.
5. `docs/architecture/sikkerhet.md` oppdatert.

## Kjente risiki og usikkerheter

**Forwarder origin request policy den funksjonsmodifiserte query-strengen?** Hovedusikkerheten.
Viewer-request-funksjoner kjører før cache-oppslag og origin-forespørsel, så den modifiserte
forespørselen *skal* være den som flyter videre — men dette må verifiseres empirisk mot en ekte
tile etter deploy, ikke antas. Fallback hvis det ikke virker: origin request policy som forwarder
alle query-parametere, deretter Lambda@Edge på origin-request som siste utvei.

**Rekkefølge ved deploy.** Steg 4 (CloudFront-konfig) og steg 1–3 (funksjonskoden) må begge være
på plass før tiles blir rene. Funksjonen kan trygt deployes først — en `key` som blir strippet gir
nøyaktig dagens oppførsel, altså ingen regresjon underveis.

**Cache-forsinkelse.** `/tiles/*` har 24 timers TTL. Allerede cachede vannmerkede tiles blir
liggende til de utløper. En invalidering av `/tiles/*` må sannsynligvis kjøres for å se effekt
umiddelbart.

**Nøkkelen er synlig for alle med AWS-tilgang**, siden den ligger i den deployede funksjonskoden.
Akseptabelt: samme tillitsnivå som AWS-kontoen selv, og nøkkelen er gratis og lett å rotere.
