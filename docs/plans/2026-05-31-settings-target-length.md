# Plan: Target-lengde på innstillinger med live teller

**Dato:** 2026-05-31
**Oppgave:** Target-lengde på innstillinger med live teller

## Mål

Gjøre det mulig å sette en anbefalt mållengde på utvalgte innstillinger (f.eks. meta descriptions). Mållengden lagres i Google Sheets og vises i admin-UI som en live tegneller med visuell indikator mens brukeren skriver.

## Avgrensninger

- Kun admin-UI påvirkes — bygge-pipeline og offentlig side er uendret
  - `sync-data.js` leser kun `Innstillinger!A:B` og ignorerer kolonne E fullstendig — ingen endring nødvendig
- Kun `targetLength` i Sheets — ingen ny sheet-fane, ingen ny API
- Kun visuell indikator, ikke hard validering (kan fortsatt lagre hva som helst)
- Reload kreves for å se endringer i kolonne E gjort direkte i Sheets — ingen polling/re-fetch

## Arkitektur

### Sheets-struktur

Innstillinger-arket bruker nå kolonnene A–D:

| Kolonne | Innhold |
|---------|---------|
| A | Teknisk ID |
| B | Verdi |
| C | Beskrivelse (label i admin) |
| D | Rekkefølge |
| **E** | **Target-lengde (ny) — f.eks. `130-160` eller `160`** |

Kolonne E er en streng:
- Tom, `undefined`, eller `0` (tallverdien) = ingen indikator vises
- `"160"` = maks 160 tegn (viser kun øvre grense)
- `"130-160"` = ideelt område 130–160 tegn

**Parsing-regler:** Formatet er `"min-max"` der min og max er positive heltall og min < max. Ikke-positive verdier og ugyldige formater (`"-10-160"`, `"130-"`, `"0"`) gir `null` — en max på 0 ville markert hvert tegn som «for langt» og er meningsløst. `UNFORMATTED_VALUE` fra Sheets returnerer tallet `0` (ikke strengen `"0"`) hvis cellen inneholder 0 — normaliseres til `''` i `admin-sheets.js` før den når parseren.

### Fargestyring

| Tilstand | Farge | Betingelse |
|----------|-------|-----------|
| For kort | Gul | Under min (hvis satt) |
| Innenfor | Grønn | Mellom min og max |
| For lang | Rød | Over max |
| Nøytral | Grå | Ingen target satt, eller kun max satt og under max |

**Fargetokens:** Det finnes ingen semantiske admin-tokens for grønn/gul/rød i designsystemet. Legg til nye CSS-variabler i `src/styles/global.css` (`@theme`-blokken) og tilhørende utility-klasser — f.eks. `--color-admin-ok`, `--color-admin-warn`, `--color-admin-error` — som brukes i UI-en. Aldri hardkodede hex-verdier eller rå Tailwind-fargeklasser. Bruk samme hex-verdier som de eksisterende `--color-success`, `--color-warning` og `--color-error`-tokenene i `global.css`.

### Virtuelle innstillinger (HARD_DEFAULTS)

Settings som ikke er i Sheets synkroniseres inn som virtuelle entries i admin. Disse vil aldri ha `targetLength` fra kolonne E. Render-koden må behandle `setting.targetLength === undefined` identisk med tom streng — ingen teller vises.

### `updateSettingByKey` og nye rader

Når en ny virtuell innstilling skrives til Sheets av admin, appender `updateSettingByKey` kun kolonnene A–D (fire verdier). Kolonne E forblir tom. Dette er forventet oppførsel — `targetLength` settes alltid manuelt av admin direkte i Sheets.

## Implementasjonssteg

### Steg 0: Fargetokens i `global.css`

**Fil:** `src/styles/global.css`

Legg til i `@theme`-blokken (samme verdier som eksisterende semantiske tokens):
```css
--color-admin-ok: #15803d;    /* = --color-success — innenfor target */
--color-admin-warn: #b45309;  /* = --color-warning — under min */
--color-admin-error: #b91c1c; /* = --color-error — over max */
```

### Steg 1: `admin-sheets.js` — les kolonne E

**Fil:** `src/scripts/admin-sheets.js`

- Utvid range fra `Innstillinger!A:D` til `Innstillinger!A:E`
- Les `row[4]` som `targetLength` i `getSettingsWithNotes`
- Normaliser: `undefined`, `0` (tall), eller tom streng → `''`
- Returner `targetLength: ''` som default for alle rader

### Steg 2: `admin-module-settings.js` — render live teller

**Fil:** `src/scripts/admin-module-settings.js`

- Ekstraher `parseTargetLength(str)` → `{ min: number|null, max: number|null } | null`
  - Returner `null` for tom/ugyldig input
  - Håndter `"160"` → `{ min: null, max: 160 }` og `"130-160"` → `{ min: 130, max: 160 }`
- Legg til tegneller-element under feltet (både `<textarea>` og `<input>`) når target er satt
- Koble `input`-event til å oppdatere telleren og fargeklassen
- Telleren injiseres i **begge** grener av `isLong`-ternæren (både `<textarea>` og `<input>`) — `targetLength` og `isLong` er uavhengige
- I reorder-modus vises verken felt eller teller — telleren rendres ikke i denne grenen

Eksempel på HTML-struktur (der `${i}` er indeksen fra render-løkken):
```html
<div class="flex justify-end mt-1 text-xs" id="counter-${i}">
  <span id="counter-text-${i}" class="text-admin-muted-light">0 / 160</span>
</div>
```

### Steg 3: Tester

**Fil:** `src/scripts/__tests__/admin-sheets.test.js`
- Test at `targetLength` leses korrekt fra kolonne E (streng)
- Test at tom kolonne E gir `''`
- Test at `undefined` kolonne E (eldre rader) gir `''`
- Test at numerisk `0` i kolonne E normaliseres til `''`

**Fil:** `src/scripts/__tests__/admin-module-settings.test.js`
- Test `parseTargetLength("130-160")` → `{ min: 130, max: 160 }`
- Test `parseTargetLength("160")` → `{ min: null, max: 160 }`
- Test `parseTargetLength("")` → `null`
- Test `parseTargetLength("0")` → `null`
- Test `parseTargetLength("-10-160")` → `null` (ugyldig negativt min)
- Test `parseTargetLength("130-")` → `null` (gyldig min, manglende max)
- Test at fargeklasse settes korrekt for ulike lengder (under min → gul, mellom → grønn, over max → rød)
- Test at teller rendres for `<textarea>` (isLong-grenen) med `targetLength` satt
- Test at teller rendres for `<input>` (ikke-isLong-grenen) med `targetLength` satt
- Test at teller **ikke** rendres i reorder-modus
- Test at virtuelle settings (ingen `targetLength`) ikke viser teller
- Test at `counter-${i}`-elementet er plassert etter (ikke før) feltelementet i DOM-en

## Definition of Done

- [ ] `getSettingsWithNotes` returnerer `targetLength` for innstillinger med kolonne E satt
- [ ] Admin-UI viser live tegneller på felter med target-lengde (både input og textarea)
- [ ] Farge endres korrekt (grå → gul → grønn → rød) etter tegntall
- [ ] Eldre innstillinger og virtuelle settings uten kolonne E fungerer uendret
- [ ] Teller vises ikke i reorder-modus
- [ ] Branch coverage ≥ 80% på berørte filer
- [ ] Manuelt testet i admin med en ekte innstilling i Sheets

## Kjente risiki

- **Sheets-kompatibilitet:** Eksisterende rader som slutter i kolonne D: `row[4]` er `undefined` — håndteres eksplisitt med normalisering til `''`.
- **Fargetokens:** Manglende admin-tokens for ok/warn/error må legges til i `global.css` i Steg 0 — ellers vil implementer ty til hardkodede farger i strid med CLAUDE.md.
- **CSP-hashes:** Dersom ny inline JS introduseres i admin (usannsynlig), må `generate-csp-hashes` kjøres på nytt.
