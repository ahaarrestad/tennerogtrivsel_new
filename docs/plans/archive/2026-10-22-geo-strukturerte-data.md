# Plan: GEO del 1 — strukturerte data, endringsdatoer og llms-tekst

**Spec:** [docs/designs/archive/2026-10-22-geo-strukturerte-data.md](../../designs/archive/2026-10-22-geo-strukturerte-data.md)
**Kjøring:** inline i én worktree. Node: `/home/asbjorn/.nvm/versions/node/v24.21.0/bin` (standard-node feiler engine-strict).

Hver oppgave skriver testene først, deretter koden, og kjører så `npx vitest run <testfil>`.
Til slutt kjøres hele `/quality-gate`. Datoer i tester holdes unna månedsskifter, fordi
formateringen avhenger av tidssone.

Planen er blind-reviewet (faktasjekk, empirisk kjøring i et eget worktree, kald design-review),
og funnene er innarbeidet. Følgende er verifisert empirisk:
- TS-import i `astro.config.mjs` virker.
- `serialize` setter `lastmod`.
- `_endret.json` ignoreres av loaderen.
- `entry.filePath` er relativ.
- `fs`/`process.cwd()` virker i prerendrede sider.
- To ld+json-scripts bryter ingen tester.

## Oppgave 0: Worktree

1. Synk main (`git fetch origin`, `git pull --ff-only`), flytt oppgaven til Pågående i TODO.md, `EnterWorktree`.
2. `npm ci`, `bash scripts/setup-worktree.sh`. `setup-worktree.sh` kopierer ikke `src/content/tjenester/`. Kjør derfor `npm run seed:fixtures` hvis mappa er tom, før build.

## Oppgave 1: Klinikk-schema (`src/scripts/buildSchema.ts`)

Tester i `src/scripts/__tests__/buildSchema.test.ts`:
- `@type` er `['Dentist', 'MedicalClinic']`. Oppdater den eksisterende toppnivåtesten.
- `name` er delen før `|`, trimmet: `'Tenner og Trivsel | Din Tannlege i Stavanger'` → `'Tenner og Trivsel'`. Uten `|` gir den hele strengen.
- `klinikkId('https://www.tennerogtrivsel.no/')` og `klinikkId('https://www.tennerogtrivsel.no')` gir begge `https://www.tennerogtrivsel.no/#klinikk`. `klinikkId('')` gir `''`. `new URL` kaster ved tom base, så den trenger en guard **før** kallet. `@id` er satt eller utelatt i samsvar med dette.
- `sameAs` er `['https://maps.google.com/?cid=1532811702748545219']`, og `hasMap` er samme URL. Oppdater eventuell eksisterende `hasMap`-test.
- `contactPoint` har `@type: 'ContactPoint'`, `telephone`, `contactType: 'reservations'`, `availableLanguage: ['nb']` og `hoursAvailable` lik `openingHoursSpecification`. Den utelates når `phone1` er tom.
- `availableService` utelater `active: false`, og hele feltet utelates når alle er inaktive.

Kode: eksportér `klinikkId`, utvid typene (`'@type': string[]`, `'@id'?`, `sameAs`, `contactPoint?`), og la `services`-typen få `active?: boolean`.

## Oppgave 2: Endringsdato fra Drive

### 2a. `sync-data.js`

Tester i `src/scripts/__tests__/sync-data.test.js` (`describe('syncMarkdownCollection')`). `fs.writeFileSync` er allerede mocket.
- `files.list` kalles med `fields` som inneholder `modifiedTime`.
- `fs.writeFileSync` kalles med `<dest>/_endret.json` og et JSON-objekt filnavn → modifiedTime. Det gjelder både filer som lastes ned og filer som hoppes over (uendret md5).
- Filer uten `modifiedTime` utelates.
- Tom mappe gir ingen `_endret.json`-skriving.

Kode: sett `fields: 'files(id, name, md5Checksum, modifiedTime)'`, og skriv `_endret.json` etter `Promise.all`.

### 2b. `src/scripts/tjeneste-endret.ts`

Tester i `src/scripts/__tests__/tjeneste-endret.test.ts`, med ekte filer i en `fs.mkdtempSync`-katalog:
- **`lesEndret`:**
  - Manglende mappe, manglende fil, ugyldig JSON og ikke-objekt gir alle `{}`.
  - En ugyldig dato eller en verdi som ikke er en streng filtreres bort.
- **`tjenesteLastmod`:**
  - Oppsettet er to aktive .md (`title: Tjeneste En`, `title: Rotfylling på barn`) og én med `active: false`.
  - Resultatet er `/tjenester/tjeneste-en/`, `/tjenester/rotfylling-pa-barn/` og `/tjenester/` = nyeste. Den inaktive er ikke med.
  - En fil uten dato utelates uten å stoppe de andre.
  - Uten `_endret.json` blir map tom, og mappa leses ikke. Manglende mappe gir tom map og ingen exception.
- **Frontmatter:**
  - `title: "Med anførsel"` og `title: 'Enkel'` strippes.
  - CRLF-linjeslutt gir samme slug.
  - Bare frontmatter-blokken leses: en `title:`-linje i bodyen ignoreres.

Kode: `fs.readFileSync` med `try/catch`, `Date.parse` for gyldighet, og frontmatter-regex `/^---\r?\n([\s\S]*?)\r?\n---/`. `tjenesteLastmod` er pakket i en ytre `try/catch` som gir tom map.

## Oppgave 3: Side-schema (`buildSchema.ts`, `SchemaOrg.astro`, `Layout.astro`, sider)

Tester i `buildSchema.test.ts`:
- `buildPersonSchema(tannlege, siteUrl)` gir `{ '@context', '@type': 'Person', name, jobTitle, worksFor: { '@id' } }`. `description` er med bare når den ikke er tom. Uten siteUrl utelates `worksFor`.
- `buildTjenesteSideSchema({ title, ingress }, url, siteUrl, dateModified?)` gir `{ '@context', '@type': 'MedicalWebPage', url, name, description, publisher: { '@id' }, about: { '@type': 'MedicalProcedure', name } }`. `dateModified` er med bare når den er gitt, og `publisher` bare når siteUrl er satt.
- `serializeJsonLd({ a: '</script><b>' })` inneholder ikke `<`, og `JSON.parse` av resultatet gir originalen tilbake.

Kode:
- `serializeJsonLd(obj)` = `JSON.stringify(obj).replace(/</g, '\\u003c')` i `buildSchema.ts`. `SchemaOrg.astro` bruker den.
- `Layout.astro`: ny prop `pageSchema?: object[]` (default `[]`). Etter `<SchemaOrg schema={schema} />` legges `{pageSchema.map(s => <SchemaOrg schema={s} />)}`. Layout sender bare aktive tjenester videre til `buildSchema` (filtreringen i oppgave 1 dekker det uansett).
- `tannleger.astro`: `pageSchema={sorterteTannleger.map(t => buildPersonSchema(t.data, site))}`.
- `tjenester/[id].astro`: `dateModified = lesEndret(join(process.cwd(), 'src/content/tjenester'))[basename(entry.filePath ?? '')]` og `pageSchema={[buildTjenesteSideSchema(entry.data, canonical, site, dateModified)]}`. Her er `canonical = new URL(Astro.url.pathname, Astro.site).href` og `site = Astro.site?.toString() ?? ''`.

E2E i `tests/seo.spec.ts`:
- Forsidetesten forventer `@type` som array som inneholder `'Dentist'`, og nøyaktig ett `ld+json`-script på forsiden (`toHaveCount(1)`).
- `/tannleger/` har (via `.all()`) et script med `@type: 'Person'` og `worksFor['@id']` som slutter på `#klinikk`.
- `/tjenester/tjeneste-en/` har et script med `@type: 'MedicalWebPage'`, `about.name: 'Tjeneste En'` og `publisher['@id']` som slutter på `#klinikk`.

## Oppgave 4: Sitemap-`lastmod` (`astro.config.mjs`)

```js
import path from 'node:path';
import { tjenesteLastmod } from './src/scripts/tjeneste-endret.ts';
const tjenesteDatoer = tjenesteLastmod(path.join(process.cwd(), 'src/content/tjenester'));
// ...
sitemap({
    filter: (page) => ...uendret...,
    serialize(item) {
        const dato = tjenesteDatoer.get(new URL(item.url).pathname);
        if (dato) item.lastmod = dato;
        return item;
    },
}),
```

Verifisering:
1. Kjør `npm run build:ci` med fixtures. `dist/sitemap-index.xml` og `dist/sitemap-0.xml` skal finnes, uten `lastmod`.
2. Lag en midlertidig `src/content/tjenester/_endret.json` med `tjeneste-en.md` og bygg på nytt. Sjekk `<lastmod>` på `/tjenester/tjeneste-en/` og `/tjenester/`. Slett fila etterpå.

## Oppgave 5: llms-tekst (`generate-llms.js` + rutene + prisliste-tidssone)

Tester i `src/scripts/__tests__/generate-llms.test.js`:
- **Timebestilling:** begge filene har «Timebestilling: ring oss på 51 52 96 18. Vi har ikke nettbestilling, fordi vi vil snakke med deg for å finne riktig time og behandling.» Linja utelates uten `phone1`.
- **Prisseksjonen i full:**
  - Med `prisliste.sistOppdatert: '2026-01-15T00:00:00.000Z'` og `siteUrl` inneholder den «Sist oppdatert: januar 2026», «Prisene er veiledende og kan variere etter behandlingens omfang.» og «Gjeldende priser: https://www.tennerogtrivsel.no/prisliste/».
  - Datolinja utelates uten dato og ved ugyldig dato. Sjekk at «Invalid Date» aldri vises.
- **Footer-lenker:** med `siteUrl: 'https://www.tennerogtrivsel.no/'` blir de absolutte (`https://www.tennerogtrivsel.no/tjenester/` osv.). Uten `siteUrl` blir de relative med `/` til slutt. Oppdater de eksisterende lenketestene.
- **Prislisteoppføring i `generateLlmsTxt`:** med `prislisteDato` blir den «- [Prisliste](…/prisliste/): sist oppdatert januar 2026». Uten dato vises den uten suffiks.

Kode:
- `generateLlmsTxt({ ..., siteUrl = '', prislisteDato = '' })` og `generateLlmsFullTxt({ ..., siteUrl = '' })`, der `prisliste.sistOppdatert` leses.
- `formatMaaned(iso)` bruker `toLocaleDateString('nb-NO', { month: 'long', year: 'numeric', timeZone: 'Europe/Oslo' })` og gir `''` når `isNaN(d.getTime())`.
- I `llms.txt.ts` og `llms-full.txt.ts` endres `GET` til `async ({ site }) =>`, med `siteUrl: site?.toString() ?? ''` og prisdato fra `prislisteData.sistOppdatert` (toppnivå). `llms.txt.ts` importerer `prisliste.json`.
- `prisliste.astro`: legg til `timeZone: 'Europe/Oslo'` i den eksisterende formateringen.
- Oppdater JSDoc-typedefs.

## Oppgave 6: Backlog og dokumentasjon

- I TODO.md Backlog legges to oppgaver til:
  - «AI-søk del 2: FAQ»: Claude lager et utkast fra eksisterende innhold, og klinikken godkjenner det. FAQ-en skal kunne redigeres i admin, ha med «Kan jeg bestille time på nett?» og ikke inneholde priser. Gulesider-adressen legges som underpunkt.
  - «AI-søk del 3: fagartikler»: en innholdsbeslutning for klinikken.
- `docs/architecture/sikkerhet.md` får en linje om JSON-LD-escapingen. Arkitekturdokumentene nevner ellers ikke schema eller llms.

## Oppgave 7: Kvalitetsport, review, test-deploy

1. `/commit` uten push, deretter `review-loop`.
2. Arkiver (Fase 5), `/commit`, spør om push.
3. Etter merge og deploy validerer jeg `/`, `/tannleger/` og én tjenesteside i validator.schema.org, og `/` i Rich Results Test. Det gjøres med et Playwright-script mot verktøyene, eller manuelt hvis de blokkerer. Jeg henter også prod-`sitemap-0.xml` og bekrefter `lastmod` på tjenestesidene.
