# Plan: Forbedre Innstillinger i admin-panelet

## Kontekst

Admin-panelet sin Innstillinger-side har to svakheter:
1. **Manglende nøkler:** Kun innstillinger som allerede finnes i Google Sheets vises. Nye nøkler i `HARD_DEFAULTS` (f.eks. `galleriTekst`) er usynlige i admin til de manuelt legges til i arket.
2. **Hardkodede seksjonsoverskrifter:** Overskriftene i komponentene (`Kontakt oss`, `Klinikken vår`, etc.) og navbaren er hardkodet — de kan ikke endres fra admin.

Brukeren ønsker at alt dette styres fra Innstillinger, og at navbar-menyen bruker de dynamiske titlene (uten å endre lenker/ankre).

### Etiketter (labels)

Etiketter styres fra Google Sheets kolonne C (beskrivelse). Hvis beskrivelse mangler, vises nøkkelnavnet (`setting.id`) som label. Dette er dagens oppførsel og er god nok — brukeren oppdaterer arket selv etter behov. Ingen `SETTINGS_LABELS`-map i koden.

## Filer som endres

| Fil | Endring |
|-----|---------|
| `src/scripts/getSettings.ts` | 4 nye tittel-nøkler i HARD_DEFAULTS |
| `src/scripts/admin-dashboard.js` | `mergeSettingsWithDefaults()`, endret `saveSingleSetting()` |
| `src/pages/admin/index.astro` | Serialiser HARD_DEFAULTS via data-attributt, bruk merge i `loadSettingsModule()` |
| `src/components/Kontakt.astro` | `{settings.kontaktTittel}` i stedet for hardkodet h2 |
| `src/components/Galleri.astro` | `{settings.galleriTittel}` i stedet for hardkodet h2 |
| `src/components/Tjenester.astro` | `{settings.tjenesterTittel}` i stedet for hardkodet h2 |
| `src/components/Tannleger.astro` | `{settings.tannlegerTittel}` i stedet for hardkodet h2 |
| `src/layouts/Layout.astro` | Send `settings` som prop til Navbar |
| `src/components/Navbar.astro` | Ta inn `settings` prop, bruk dynamiske titler med fallback |
| `src/scripts/__tests__/admin-dashboard.test.js` | Tester for nye funksjoner og virtual-row-logikk |
| `src/scripts/__tests__/getSettings.test.ts` | Test at nye tittel-nøkler finnes |
| `tests/sitemap-pages.spec.ts` | Oppdater E2E-test for dynamisk navlenke |

## Implementasjonsrekkefølge

### Steg 1: Nye tittel-nøkler i HARD_DEFAULTS

**Fil:** `src/scripts/getSettings.ts`

Legg til 4 nye nøkler i `HARD_DEFAULTS` (etter `galleriTekst` på linje 28):

```ts
kontaktTittel: "Kontakt oss",
galleriTittel: "Klinikken vår",
tjenesterTittel: "Våre Tjenester",
tannlegerTittel: "Våre Tannleger",
```

Default-verdiene matcher nøyaktig dagens hardkodede h2-tekster — null atferdsendring.

### Steg 2: mergeSettingsWithDefaults() (admin-dashboard.js)

**Ny eksportert funksjon `mergeSettingsWithDefaults(sheetSettings, defaults)`:**
- Tar inn innstillinger fra arket + defaults-objekt (sendt fra Astro-side)
- Returnerer komplett liste der manglende nøkler legges til med `isVirtual: true` og `value: defaults[key]`
- `defaults`-parameteren unngår duplisering — `HARD_DEFAULTS` finnes kun i `getSettings.ts`

Label-logikk forblir uendret: `setting.description || setting.id` (eksisterende kode). Google Sheets kolonne C styrer etikettene — ingen hardkodet label-map i koden.

### Steg 3: Send HARD_DEFAULTS til klient via data-attributt

**Fil:** `src/pages/admin/index.astro`

Frontmatter (linje 2-9) — legg til import:
```ts
import { HARD_DEFAULTS } from '../../scripts/getSettings';
```

HTML config-div (linje 210-215) — legg til:
```html
data-defaults={JSON.stringify(HARD_DEFAULTS)}
```

Client script (linje 239-243) — parse:
```js
const HARD_DEFAULTS_DATA = JSON.parse(configEl?.dataset.defaults || '{}');
```

Dette bruker det eksisterende `admin-config`-mønsteret og unngår duplisering av default-verdier.

### Steg 4: Revidert loadSettingsModule() (admin/index.astro)

I `loadSettingsModule()` (linje 245-285):

1. Etter `getSettingsWithNotes()` → kall `mergeSettingsWithDefaults(settings, HARD_DEFAULTS_DATA)`
2. Bruk `allSettings` i stedet for `settings` gjennom hele funksjonen
3. Label-logikken (`setting.description || setting.id`) forblir som i dag

Ny import fra admin-dashboard.js: `mergeSettingsWithDefaults`

### Steg 5: Revidert saveSingleSetting() (admin-dashboard.js)

Nåværende `saveSingleSetting()` kaller `updateSettings()` som batch-skriver kolonne B basert på array-indeks. Virtuelle rader (fra defaults, ikke i arket) har ingen rad-mapping.

**Ny logikk:**
```
if (setting.isVirtual):
  → bruk updateSettingByKey(sheetId, setting.id, newValue) (appender ny rad)
  → sett setting.isVirtual = false
else:
  → filtrer ut virtuelle rader fra listen
  → kall updateSettings() kun med ark-baserte rader
```

Ny import i admin-dashboard.js: `updateSettingByKey` fra admin-client.js

### Steg 6: Dynamiske overskrifter i komponenter

Alle 4 komponenter har allerede `const settings = await getSiteSettings()` i frontmatter. Endringen er minimal:

| Komponent | Fra | Til |
|-----------|-----|-----|
| `Kontakt.astro:40` | `<h2 ...>Kontakt oss</h2>` | `<h2 ...>{settings.kontaktTittel}</h2>` |
| `Galleri.astro:22` | `<h2 ...>Klinikken vår</h2>` | `<h2 ...>{settings.galleriTittel}</h2>` |
| `Tjenester.astro:24` | `<h2 ...>Våre Tjenester</h2>` | `<h2 ...>{settings.tjenesterTittel}</h2>` |
| `Tannleger.astro:24` | `<h2 ...>Våre Tannleger</h2>` | `<h2 ...>{settings.tannlegerTittel}</h2>` |

Bakoverkompatibilitet: `getSiteSettings()` returnerer `HARD_DEFAULTS`-verdier for manglende nøkler → identisk output som i dag.

### Steg 7: Dynamisk Navbar

**`src/layouts/Layout.astro` linje 49:** Endre `<Navbar/>` → `<Navbar settings={settings} />`
(`settings` finnes allerede på linje 13)

**`src/components/Navbar.astro`:** Ta inn prop og bruk i navLinks:
```astro
---
interface Props { settings?: Record<string, string>; }
const { settings = {} } = Astro.props;

const navLinks = [
    { name: 'Forside', href: '/', mobileHref: '/' },
    { name: settings.kontaktTittel || 'Kontakt', href: '/#kontakt', mobileHref: '/#kontakt' },
    { name: settings.galleriTittel || 'Klinikken vår', href: '/#galleri', mobileHref: '/#galleri' },
    { name: settings.tjenesterTittel || 'Tjenester', href: '/#tjenester', mobileHref: '/tjenester' },
    { name: settings.tannlegerTittel || 'Om oss', href: '/#tannleger', mobileHref: '/tannleger' },
];
---
```

Lenker (`href`, `mobileHref`) er uendret. Kun visningsteksten er dynamisk.

### Steg 8: Tester

**`admin-dashboard.test.js`** — nye test-suiter:
- `mergeSettingsWithDefaults`: tom sheet → alle defaults med isVirtual, eksisterende nøkler dupliseres ikke
- `saveSingleSetting` med `isVirtual`: kaller `updateSettingByKey`, markerer som ikke-virtuell etter lagring
- `saveSingleSetting` med mix av virtuelle/sheet-rader: filtrerer riktig før `updateSettings()`

**`getSettings.test.ts`** — ny test:
- Verifiser at `HARD_DEFAULTS` inneholder de 4 nye tittel-nøklene

**`tests/sitemap-pages.spec.ts`** — oppdater:
- Navlenke-testen sjekker "Klinikken vår" i menyen (dette bør allerede fungere med dynamisk tittel siden default matcher)

## Bakoverkompatibilitet

- `getSiteSettings()` returnerer HARD_DEFAULTS for manglende nøkler → komponenter viser samme tekst som i dag
- Navbar har `|| 'Klinikken vår'` etc. fallbacks → fungerer uten settings-prop
- `saveSingleSetting()` med `isVirtual` rader bruker `updateSettingByKey()` som appender → eksisterende ark-rader påvirkes ikke
- `mergeSettingsWithDefaults()` endrer ikke eksisterende raders verdier eller rekkefølge

## Verifisering

1. `npm test` — alle tester grønne, 80%+ branch coverage per endret fil
2. `npm run build` — bygget OK
3. `npm run test:e2e` — alle E2E-tester grønne
4. Manuell test: åpne admin Innstillinger, se at alle nøkler vises (nøkkelnavn som label for de uten beskrivelse), rediger en manglende nøkkel → den lagres til arket
5. Endre en seksjonstittel i admin → rebuild → verifiser at h2 og navbar oppdateres
