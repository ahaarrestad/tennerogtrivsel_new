# GEO del 1: strukturerte data, endringsdatoer og llms-tekst

**Dato:** 2026-10-22
**Oppgave:** «AI-søk (GEO): styrk strukturerte data, FAQ og autoritet» i `TODO.md`, del 1 av 3.
FAQ (del 2) og fagartikler (del 3) er egne backlog-oppgaver.

## Mål

AI-søk (ChatGPT, Perplexity, Google AI Overviews) og vanlige søkemotorer skal kunne lese
klinikkens identitet, tannleger, tjenester og kontaktvei maskinelt og entydig. De skal også se
hvor ferskt innholdet er. Alt skal oppdatere seg selv fra Drive/Sheets, uten manuelt vedlikehold.

## Beslutninger fra diskusjonen

- **Ingen priser i schema.** Klinikken vil ikke ha prisene eksponert i søk. `/prisliste/` har
  allerede `noindex` og står utenfor sitemap (commit 37a6755), og slik blir det. Derfor gir vi
  `/prisliste/` verken side-schema eller sitemap-`lastmod` (det har ingen effekt på en
  noindex-side). Ingen `priceRange`, `OfferCatalog` eller `makesOffer`.
- **Prisene i llms-full.txt beholdes, men dateres og lenkes.** Brukeren: «Viktig å ha dato på
  prisene og linke til siste oppdaterte side». En AI som siterer en pris skal kunne si hvor
  gammel den er og hvor den gjeldende står.
- **«Ring oss», ikke nettbestilling.** Klinikken vil snakke med pasienten for å finne riktig time
  og behandling. Vi bruker `contactPoint` med telefon og ingen `ReserveAction`. llms-tekstene får
  en egen linje om dette.
- **Google Business Profile finnes:** `https://maps.google.com/?cid=1532811702748545219`. Tallet
  er desimalformen av Maps-feature-ID-en `0x463a35157f1edc7b:0x1545a41f59e380c3`, og URL-en
  svarer med en redirect til profilen. Den brukes i `sameAs` og `hasMap`.
- **Endringsdato bare der den er ekte.** Tjenestene ligger som .md-filer i Drive og har en ekte
  `modifiedTime` per fil. Innstillinger, tannleger og galleri ligger i ett felles regneark.
  Dets `modifiedTime` endres når en hvilken som helst fane endres, så det sier ingenting om den
  enkelte siden. Disse sidene får ingen dato.
- **Bare gyldige schema.org-egenskaper.** `MedicalProcedure` har verken `provider` eller
  `dateModified`, og `availableService` er ikke definert på `Dentist`. Tjenestesidene beskrives
  derfor som `MedicalWebPage` med prosedyren i `about`. Klinikken får typen
  `["Dentist", "MedicalClinic"]`, slik at `availableService` blir gyldig.

## Endringer

### 1. Klinikk-schema på alle sider (`buildSchema.ts`)

- `@type`: `["Dentist", "MedicalClinic"]`. `availableService` er definert på `MedicalClinic`.
  Begge typene er undertyper av `MedicalBusiness`/`LocalBusiness`, så Google leser den fortsatt
  som en lokal virksomhet.
- `name`: delen av `siteTitle` før `|`, trimmet («Tenner og Trivsel»). I dag kommer hele
  `siteTitle` med, inkludert «| Din Tannlege i Stavanger». Uten `|` brukes hele strengen.
- `@id`: `<siteUrl>#klinikk`, en stabil identitet som de andre schema-objektene peker til.
  Utelates når `siteUrl` er tom, slik `url` gjør i dag.
- `sameAs`: `["https://maps.google.com/?cid=1532811702748545219"]`, som en konstant i koden.
  Det er én verdi, den endres sjelden, og den hører ikke hjemme i admin.
- `hasMap`: samme Google Business Profile-URL i stedet for dagens koordinatsøk.
- `contactPoint`: `{ @type: ContactPoint, telephone: phone1, contactType: "reservations",
  availableLanguage: ["nb"], hoursAvailable: <samme spesifikasjoner som openingHoursSpecification> }`.
  Utelates når `phone1` er tom. `contactType` er fri tekst. «reservations» sier hva telefonen
  brukes til.
- **Fiks:** `availableService` tar i dag med inaktive tjenester (`active: false`). De vises ikke
  på siden og skal ut av schemaet (Googles regel: schema skal beskrive synlig innhold).

### 2. Side-spesifikt schema

`Layout.astro` får en valgfri prop `pageSchema?: object[]`. Hvert objekt blir et eget
`<script type="application/ld+json">` etter klinikk-scriptet. Klinikk-scriptet beholdes som
første script, og forsiden får bare det ene (`tests/seo.spec.ts` bruker en streng locator der).

- **`/tannleger/`**: én `Person` per tannlege med `name`, `jobTitle` (= `title`),
  `description` (bare når den ikke er tom) og `worksFor: { @id: <klinikk-id> }`. Bilde tas ikke
  med: bildene er optimalisert av Astro og har ingen stabil URL.
- **`/tjenester/<slug>/`**: én `MedicalWebPage` med `url` (canonical), `name` (tittel),
  `description` (ingress), `publisher: { @id: <klinikk-id> }`, `about: { @type:
  MedicalProcedure, name }` og `dateModified` når datoen finnes.

Byggerne (`buildPersonSchema`, `buildTjenesteSideSchema`) legges i `buildSchema.ts` som rene
funksjoner som kan testes uten Astro.

**Escaping:** Fritekst fra admin (tannlegebeskrivelse, ingress) havner nå i JSON-LD.
`SchemaOrg.astro` erstatter `<` med `<` i JSON-strengen, slik at en `</script>` i teksten
ikke kan bryte ut av taggen.

### 3. Endringsdato fra Drive (`sync-data.js` → `_endret.json`)

- `syncMarkdownCollection` ber om `modifiedTime` i `files.list`. Etter nedlasting skriver den
  `<dest>/_endret.json` med `{ "<filnavn>.md": "<modifiedTime ISO>" }` for alle .md-filer i
  mappa, også de som ble hoppet over fordi md5 var lik. Fila skrives på nytt ved hver sync, så
  slettede filer forsvinner.
- Er Drive-mappa tom, returnerer funksjonen før skrivingen (som i dag), og en gammel
  `_endret.json` kan bli liggende. Det er ufarlig: oppslag skjer bare for .md-filer som finnes.
- Glob-loaderen leser bare `**/[^_]*.{md,mdoc}`, så `_endret.json` blir ikke en tjeneste
  (verifisert empirisk). `src/content/tjenester/` er gitignorert, så fila committes ikke.
- Gjelder også meldinger (samme funksjon). Det er ufarlig, men den brukes ikke der.
- Ny modul `src/scripts/tjeneste-endret.ts` (ren Node, ingen Astro-avhengighet). Den bruker
  `slugify` fra `slugify.ts`, samme som tjenestesidene. `textFormatter.js` har en annen
  `slugify` (ø → oe) som ville gitt feil URL.
  - `lesEndret(dir)` → objekt filnavn → ISO-streng. Manglende mappe, manglende fil, ugyldig
    JSON eller ikke-objekt gir `{}`. Ugyldige datoer filtreres bort.
  - `tjenesteLastmod(dir)` → `Map<url-sti, ISO>` for sitemap: `/tjenester/<slug>/` per aktiv
    tjeneste og `/tjenester/` = nyeste dato. Leser `_endret.json` først og returnerer tom map
    uten å lese mappa når den mangler. Kaster aldri: alt er pakket i `try/catch`. Funksjonen
    kjøres fra `astro.config.mjs` (også ved vitest-oppstart), og en feil i sitemapens
    `serialize` fjerner hele sitemapen stille.
  - Tittel og `active` leses fra frontmatter-blokken med samme enkle `key: value`-format som
    admin skriver (`stringifyMarkdown`): verdier trimmes (også `\r`), og enkle og doble
    anførselstegn strippes. Gir en uvanlig tittel en annen slug enn Astros YAML-parser, mangler
    `lastmod` bare for den siden. Siden blir ikke feil.

### 4. Sitemap-`lastmod` (`astro.config.mjs`)

`sitemap({ filter, serialize })`: `serialize` slår opp `new URL(item.url).pathname` i
`tjenesteLastmod('src/content/tjenester')` og setter `item.lastmod` ved treff. Andre sider endres
ikke. Fixture-bygg (CI uten Drive) har ingen `_endret.json` og gir sitemap uten `lastmod`, slik
som i dag. Brukeren ba eksplisitt om `lastmod` fra Drive.

### 5. llms.txt og llms-full.txt (`generate-llms.js`)

- Header (begge): ny linje etter Telefon:
  «Timebestilling: ring oss på <phone1>. Vi har ikke nettbestilling, fordi vi vil snakke med deg
  for å finne riktig time og behandling.» Utelates uten `phone1`.
- Prisseksjonen i llms-full, rett under `## Prisliste`:
  - «Sist oppdatert: <måned år>». Datoen er toppnivåfeltet `sistOppdatert` i `prisliste.json`,
    som sync allerede regner ut som nyeste dato blant radene. Den formateres med
    `toLocaleDateString('nb-NO', { month: 'long', year: 'numeric', timeZone: 'Europe/Oslo' })`.
    Linja utelates når datoen mangler eller er ugyldig.
  - «Prisene er veiledende og kan variere etter behandlingens omfang.»
  - «Gjeldende priser: <site>/prisliste/»
- Footer-lenkene blir absolutte (`https://www.tennerogtrivsel.no/...`) med avsluttende `/`.
  En AI som leser fila utenfor nettstedet kan da følge dem. Base-URL sendes inn fra rutene
  (`site` i `APIRoute`-konteksten) i stedet for å hardkodes i generatoren.
- llms.txt: prislistelenken får datoen: «- [Prisliste](…/prisliste/): sist oppdatert <måned år>».
- `prisliste.astro` får samme `timeZone: 'Europe/Oslo'`, slik at siden og llms viser samme måned.

## Ikke med

- FAQPage (del 2), fagartikler (del 3), `priceRange`/`OfferCatalog`, `ReserveAction`, bilde og
  `@id` på `Person`, `employee` på klinikken, `dateModified` på sider som bygges fra det felles
  regnearket.
- Gulesider viser gammel adresse (Armauer Hansens vei 11). Det må klinikken rette, så det blir en
  egen backlog-notis.

## Testing

- Unit (Vitest): `buildSchema` (type-array, name-splitting, @id, sameAs, hasMap, contactPoint,
  filter på inaktive), `buildPersonSchema`, `buildTjenesteSideSchema`, escaping i SchemaOrg
  (via en ren hjelper `serializeJsonLd`), `tjeneste-endret.ts` (manglende mappe/fil, ugyldig
  JSON, ugyldig dato, inaktiv tjeneste, slug-oppslag, anførselstegn og CRLF, max for
  `/tjenester/`), `syncMarkdownCollection` (`modifiedTime` i fields, `_endret.json` skrevet også
  for uendrede filer), `generate-llms` (bestillingslinje, prisdato/veiledende/lenke, absolutte
  lenker, utelatelse uten data).
- E2E: `seo.spec.ts` sjekker forsiden med type-arrayen, `Person` på `/tannleger/` og
  `MedicalWebPage` på en tjenesteside. Den sjekker også at forsiden har nøyaktig ett
  `ld+json`-script. Fixture-tjenester har ingen `_endret.json`, så `dateModified` testes ikke i
  E2E.
- Etter deploy til test: valider `/`, `/tannleger/` og én tjenesteside i Schema Markup Validator
  (validator.schema.org). Google Rich Results Test støtter bare klinikken (LocalBusiness), ikke
  Person eller MedicalWebPage, så den brukes bare på `/`. Kontroller sitemapen i et ekte bygg
  for `lastmod` på tjenestesidene.
