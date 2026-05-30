# Plan: SEO meta descriptions — auto-generering ved bygg

**Dato:** 2026-05-30
**Oppgave:** Forbedre meta descriptions for alle offentlige, indekserte sider til 130–160 tegn, generert automatisk fra eksisterende innhold ved bygg.

---

## Mål

- Alle offentlige, indekserte sider har meta descriptions på 130–160 tegn
- Beskrivelsene genereres automatisk fra data som allerede finnes ved byggetidspunktet — ingen manuelle tekststrenger
- Ingen nye admin-felter, ingen ny manuell vedlikeholdsflyt
- Bing Webmaster Tools-advarsler forsvinner

## Avgrensninger

- Kun `<meta name="description">` (og tilhørende OG/Twitter via Layout) — ikke title-tags, ikke schema.org
- **Ekskluderte sider (noindex eller ingen SEO-verdi):**
  - `/admin` — noindex
  - `/404` — noindex
  - `/prisliste` — **noindex={true}**, søkemotorer bruker ikke description-taggen; siden er ekskludert fra scope
- `personvern.astro` er eneste unntak fra auto-gen: settings-feltene som finnes på siden (adresse, telefon) gir ikke meningsfull SEO-tekst for en personvernsside. Hardkodet forbedret tekst er riktig.
- De eksisterende `*Beskrivelse`-feltene i settings (`tjenesterBeskrivelse`, `galleriBeskrivelse`, `kontaktBeskrivelse`, `tannlegerBeskrivelse`) **fjernes fra `getSettings.ts`-defaultene** og brukes ikke lenger som `description`-props til Layout. Feltene beholdes i `innstillinger.json` og admin-UI inntil admin-grensesnittet eventuelt ryddes opp separat.

---

## Hjelpefunksjoner: `src/scripts/metaDescription.ts`

```typescript
export function stripMarkdown(text: string): string
```

Fjerner i denne rekkefølgen:
1. HTML-kommentarer med StackEdit-metadata: `<!--stackedit_data:[\s\S]*?-->`
2. Heading-prefiks: `^#{1,6}\s+` (per linje)
3. Bold og italic: `\*\*`, `\*`, `__`, `_`
4. Lenker: `\[([^\]]+)\]\([^)]+\)` → beholder lenketeksten
5. Kode-blokker (backtick): `` ` ``
6. Ekstra linjeskift og whitespace → normalisér til enkelt mellomrom

```typescript
export function truncateDescription(text: string, maxLen = 155): string
```

- Kapper ved `maxLen` tegn på siste ordgrense innenfor grensen
- Legger til `…` om teksten er lengre enn `maxLen`
- Returnerer alltid `string` — aldri `undefined`

Begge eksporteres fra én fil. Kodes TDD (tester skrives først).

---

## Per-side spesifikasjon

### `/` — index.astro

**Nåværende:** Ingen `description`-prop → fallback til `settings.siteDescription` (117 tegn)
**Data som MÅ legges til:** `getSiteSettings()` + `getCollection('tjenester')` (ingen av dem hentes direkte i dag)

**Strategi:**
```
prefix = "Tannklinikk i Stavanger på Kilden Helse. Vi tilbyr: "
suffix = " og mer."
// Sorter aktive tjenester på priority. Join titler med ", " til prefix+titler+suffix ≤ 155 tegn.
// Bruk truncateDescription på prefix+titler, legg til suffix om det er plass.
```

Eksempel med korrekt sortert data: *"Tannklinikk i Stavanger på Kilden Helse. Vi tilbyr: Akuttbehandling, Rotbehandling, Fyllingsterapi, Bleking, Proteser og mer."* (~138 tegn)

**Endringer:** Legg til `getSiteSettings()` og `getCollection('tjenester')` i frontmatter. Bygg description. Send som prop til `<Layout>`. Merk: Layout kaller `getSiteSettings()` internt også — dette er greit, Astro cacher async-resultater ved statisk bygg.

---

### `/tjenester` — tjenester.astro

**Nåværende:** `settings.tjenesterBeskrivelse` (67 tegn)
**Data som MÅ legges til:** `getCollection('tjenester')` (finnes ikke i denne siden i dag)

**Strategi:**
```
prefix = "Tannhelsetjenester hos Tenner og Trivsel i Stavanger: "
suffix = " og mer."
// Sorter aktive tjenester på priority. Join titler til prefix+titler+suffix ≤ 155 tegn.
```

Eksempel: *"Tannhelsetjenester hos Tenner og Trivsel i Stavanger: Akuttbehandling, Rotbehandling, Fyllingsterapi, Bleking, Proteser og mer."* (~133 tegn)

Merk: `<TjenesteSide>`-komponenten kaller også `getCollection('tjenester')` internt — duplikat-fetch caches av Astro.

**Endringer:** Legg til `getCollection('tjenester')` i frontmatter. Bygg description. Send til Layout.

---

### `/tjenester/[id]` — tjenester/[id].astro

**Nåværende:** `entry.data.ingress` (~85 tegn — Bing klager)
**Data tilgjengelig:** `entry.data.ingress` + `entry.body` (rå markdown string, tilgjengelig i Astro 5 content collections)

**Strategi:**
```typescript
const description = truncateDescription(
  `${entry.data.ingress} ${stripMarkdown(entry.body ?? '')}`,
  155
);
```

`stripMarkdown` fjerner StackEdit-kommentarer, headings, bold/italic og lenkesyntaks. Resultatet er ren løpende tekst fra ingress + body.

**Endringer:** Importer `stripMarkdown` og `truncateDescription` fra `metaDescription.ts`. Beregn description. Send til Layout.

---

### `/tannleger` — tannleger.astro

**Nåværende:** `settings.tannlegerBeskrivelse` (89 tegn)
**Data tilgjengelig:** `sorterteTannleger` (allerede hentet via `getCollection('tannleger')`) — 8 tannleger

**Strategi:**
```typescript
const count = sorterteTannleger.length;
const first3 = sorterteTannleger.slice(0, 3).map(t => t.data.name).join(', ');
const description = `Møt våre ${count} tannleger hos Tenner og Trivsel i Stavanger: ${first3} m.fl. Moderne tannklinikk i Kilden Helse.`;
```

Eksempel: *"Møt våre 8 tannleger hos Tenner og Trivsel i Stavanger: Dyveke Knudsen, Gro Knudsen, Ida Kristine Gøransson m.fl. Moderne tannklinikk i Kilden Helse."* (~150 tegn)

**Endringer:** Bygg description fra `sorterteTannleger`. Send til Layout. Fjern `settings.tannlegerBeskrivelse`-prop.

---

### `/galleri` — galleri.astro

**Nåværende:** `settings.galleriBeskrivelse` (91 tegn)
**Data tilgjengelig:** `galleri` (allerede hentet), `hasGalleryImages` bool

**Strategi:**
```typescript
const bildeAntall = galleri.filter(item => (item.data.type ?? 'galleri') === 'galleri').length;
const description = bildeAntall > 0
  ? `Se ${bildeAntall} bilder fra Tenner og Trivsel tannklinikk i Stavanger — moderne lokaler, hyggelig miljø og dyktige tannleger i Kilden Helse.`
  : `Se bilder fra Tenner og Trivsel tannklinikk i Stavanger — moderne lokaler, hyggelig miljø og dyktige tannleger i Kilden Helse.`;
```

Merk: Med nåværende innhold (`galleri.json` har kun én `forsidebilde`-type, ingen `galleri`-type) er `bildeAntall = 0` og else-grenen aktiveres. Else-grenen gir en gyldig description på ~121 tegn. Når galleri-bilder legges til, aktiveres if-grenen automatisk.

**Endringer:** Beregn antall bilder. Bygg description. Send til Layout. Fjern `settings.galleriBeskrivelse`-prop.

---

### `/kontakt` — kontakt.astro

**Nåværende:** `settings.kontaktBeskrivelse` (93 tegn)
**Data tilgjengelig:** `settings` (allerede hentet) — inkl. `adresse1`, `adresse2`, `businessHours1`, `businessHours2`, `businessHours3`, `phone1`

**Strategi:**
```typescript
const description = truncateDescription(
  `Tenner og Trivsel tannklinikk, ${settings.adresse1}, ${settings.adresse2}. ` +
  `${settings.businessHours1}, ${settings.businessHours2}, ${settings.businessHours3}. ` +
  `Ring oss på ${settings.phone1}.`,
  155
);
```

Eksempel med gjeldende data: *"Tenner og Trivsel tannklinikk, Gartnerveien 15, 4016 Stavanger. Mandag: 08:00 - 15:30, Tirsdag: 07:30 - 20:00, Onsdag: 08:00 - 20:00. Ring oss på [tlf]."* (~150 tegn)

`truncateDescription` sikrer at resultatet ikke overskrider 155 tegn om settings-verdiene er ekstra lange.

**Endringer:** Bygg description fra settings-felter. Send til Layout. Fjern `settings.kontaktBeskrivelse`-prop.

---

### `/personvern` — personvern.astro

**Nåværende:** Hardkodet `"Personvernerklæring for nettsiden til Tenner og Trivsel"` (56 tegn)
**Unntak fra auto-gen:** Siden henter `getSiteSettings()` (adresse, telefon), men disse feltene gir ikke meningsfull SEO-tekst for en personvernerklæring. Hardkodet forbedret tekst er riktig tilnærming.

**Ny tekst (hardkodet):**
```
"Personvernerklæring for tennerogtrivsel.no — les om hvilke data vi samler inn, hvorfor, og dine rettigheter som bruker."
```
(~119 tegn)

---

## Filer som endres

| Fil | Endring |
|-----|---------|
| `src/scripts/metaDescription.ts` | Ny fil — `stripMarkdown` + `truncateDescription` |
| `src/pages/index.astro` | Legg til `getSiteSettings()` + `getCollection('tjenester')`, bygg description |
| `src/pages/tjenester.astro` | Legg til `getCollection('tjenester')`, bygg description |
| `src/pages/tjenester/[id].astro` | Kombiner ingress + stripMarkdown(body), trunkér |
| `src/pages/tannleger.astro` | Bygg description fra count + 3 første navn |
| `src/pages/galleri.astro` | Bygg description med bildeantall |
| `src/pages/kontakt.astro` | Bygg description fra adresse + åpningstider + telefon |
| `src/pages/personvern.astro` | Forbedret hardkodet tekst |
| `src/scripts/getSettings.ts` | Fjern `*Beskrivelse`-defaultene |

**Ikke i scope:** `prisliste.astro` (noindex), `admin/index.astro` (noindex), `404.astro` (noindex)

---

## Testbehov

Tester skrives **før** implementering (TDD) for `metaDescription.ts`:

| Test | Hva som testes |
|------|----------------|
| `stripMarkdown` | StackEdit-kommentarer fjernes |
| `stripMarkdown` | Headings (`#`, `##`, `###`) fjernes |
| `stripMarkdown` | Bold (`**text**`) og italic (`*text*`, `_text_`) fjernes |
| `stripMarkdown` | Lenker `[tekst](url)` → `tekst` |
| `stripMarkdown` | Ekstra whitespace normaliseres |
| `stripMarkdown` | Tom streng returnerer tom streng |
| `truncateDescription` | Tekst kortere enn maxLen returneres uendret |
| `truncateDescription` | Tekst på eksakt maxLen returneres uendret |
| `truncateDescription` | Lang tekst kappes på ordgrense med `…` |
| `truncateDescription` | Kutter ikke midt i et ord |
| `truncateDescription` | Tom streng returnerer tom streng |

Coverage-krav: >80% branch coverage for `metaDescription.ts`

**Bygg-verifisering:**
```bash
npm run build
find dist -name '*.html' -exec grep -o 'name="description" content="[^"]*"' {} \; \
  | awk -F'"' '{print length($4), $4}' | sort -n
```

## Definition of done

- [ ] `metaDescription.ts` har tester og >80% branch coverage
- [ ] `npm run build` kjører uten feil
- [ ] Bygg-grep viser descriptions på 119–155 tegn for alle indekserte sider
- [ ] `settings.*Beskrivelse`-feltene er fjernet som props i sidene

## Kjente risiki og beslutninger

| Risiko | Beslutning |
|--------|------------|
| `entry.body` kan mangle for tjenester uten body-tekst | `entry.body ?? ''` brukes — ingress alene er akseptabelt |
| Tjeneste-navnelisten på `/` og `/tjenester` kan overstige 155 tegn | Håndteres av prefix+suffix-logikken: join titler til grensen er nådd |
| Tannlege-navn kan endre seg, gjøre beskrivelsen for lang | Alltid kun 3 navn + count — length er deterministisk og kort |
| `getSettings.ts` double-fetch i `index.astro` vs. Layout | Astro cacher async-kall ved statisk bygg — ingen ytelsesproblem |
| `prisliste.astro` har `noindex={true}` | Siden er ekskludert fra scope — ingen SEO-gevinst mulig |
