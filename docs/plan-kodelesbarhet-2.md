# Plan: Kodelesbarhet — ny gjennomgang og forenkling

## Kontekst

Kodebasen gjennomgikk en stor refaktorering (6 steg, [forrige plan](plan-kodelesbarhet.md)) som reduserte `admin/index.astro` fra 1797→231 linjer og konsoliderte bilde-parsing, CRUD-operasjoner, event-binding og HTML-templates. Denne oppgaven vurderer **hva som gjenstår** og gjør målrettede forbedringer.

### Nåværende tilstand (5100 linjer totalt i src/scripts/)

| Fil | Linjer | Rolle |
|-----|--------|-------|
| `admin-client.js` | 987 | Google API: auth + Drive + Sheets |
| `admin-dashboard.js` | 805 | Modullastere, SVG-ikoner, templates |
| `sync-data.js` | 537 | Byggetids-synkronisering |
| `admin-module-bilder.js` | 498 | Galleri-editor |
| `admin-module-tannleger.js` | 377 | Tannlege-editor |
| `admin-dialog.js` | 260 | Toast/confirm/banner |
| `admin-module-meldinger.js` | 252 | Melding-editor |
| `admin-module-tjenester.js` | 213 | Tjeneste-editor |
| `admin-editor-helpers.js` | 191 | Felles editor-hjelpefunksjoner |
| Øvrige 11 filer | ≤165 | Små, fokuserte moduler |

### Identifiserte problemer

1. **Slider-template duplisert 2×** — Identiske 3-slider-blokker (scale/posX/posY) i `bilder.js` (linje 101–137) og `tannleger.js` (linje 102–141) — 40 linjer copy-paste.

2. **Auto-save debounce duplisert 4×** — Identisk `clearTimeout`/`setTimeout(1500)`-mønster i alle 4 editor-moduler med module-level `*SaveTimeout`-variabel.

3. **Bilde-preview-oppslag duplisert 2×** — `findFileByName()` → `getDriveImageBlob()` → blob-URL med fallback finnes i både `tannleger.js` (linje 49–68) og `bilder.js` (linje 59–68).

4. **`admin-client.js` er monolittisk (987 linjer)** — Blander auth (token, GIS, login/logout), Drive-operasjoner (fil-CRUD, bilder) og Sheets-operasjoner (innstillinger, tannleger, galleri). Tre distinkte ansvarsområder i én fil.

5. **SVG-ikoner i `admin-dashboard.js`** — 7 ikonkonstanter (totalt ~20 linjer) i toppen av filen blander presentasjon med logikk.

### Hva som IKKE trenger endring

- **Navngivning (norsk/engelsk-miks)** — Etablert konvensjon, konsistent innenfor domener. Endring gir risiko uten verdi.
- **Kontakt-komponenten** — 4 Card-instanser er lesbare som de er; data-drevet map ville redusere lesbarheten.
- **sync-data.js** — Allerede ryddet i forrige runde (steg 5). 537 linjer er akseptabelt for byggetids-logikk.
- **Ikke-admin scripts** — `messageClient.js`, `layout-helper.js`, `mobile-menu.js`, `pwa-prompt.js` er alle korte og fokuserte.

---

## Steg

Hvert steg er én commit. Ingen funksjonalitet endres — kun strukturforbedringer.

### Steg 1: Ekstraher slider-template til felles funksjon

**Filer:** `src/scripts/admin-editor-helpers.js`, `src/scripts/admin-module-bilder.js`, `src/scripts/admin-module-tannleger.js`

- Ny funksjon `renderImageCropSliders(prefix)` i `admin-editor-helpers.js`
- Genererer HTML for 3 sliders (scale 1.0–3.0, posX 0–100, posY 0–100) med step-buttons
- `prefix` brukes som ID-prefix (f.eks. `"galleri-edit"` → `galleri-edit-scale`, `galleri-edit-x`, `galleri-edit-y`)
- Erstatter ~40 identiske linjer i bilder.js og tannleger.js
- Oppdater eksisterende tester

### Steg 2: Ekstraher auto-save hjelpefunksjon

**Filer:** `src/scripts/admin-editor-helpers.js`, alle 4 `admin-module-*.js`-filer

- Ny funksjon `createAutoSaver(saveFn, delay = 1500)` i `admin-editor-helpers.js`
- Returnerer `{ trigger(), cancel() }` — `trigger()` viser save-bar og debouncer kall til `saveFn`
- Erstatter 4× duplisert `clearTimeout`/`setTimeout`-mønster og fjerner 4 module-level `*SaveTimeout`-variabler
- Oppdater eksisterende tester

### Steg 3: Ekstraher bilde-preview-oppslag

**Filer:** `src/scripts/admin-editor-helpers.js`, `src/scripts/admin-module-bilder.js`, `src/scripts/admin-module-tannleger.js`

- Ny funksjon `resolveImagePreview(imageName, folderId, fallbackPath?)` i `admin-editor-helpers.js`
- Prøver `findFileByName()` → `getDriveImageBlob()`, returnerer `{ src, imageId }` eller fallback
- Erstatter ~15 dupliserte linjer i bilder og tannleger
- Oppdater eksisterende tester

### Steg 4: Splitt admin-client.js i 3 moduler

**Filer:** `src/scripts/admin-client.js` → `admin-auth.js` + `admin-drive.js` + `admin-sheets.js` (+ re-export wrapper)

- `admin-auth.js` (~150 linjer): `initGapi`, `initGis`, `login`, `silentLogin`, `logout`, `tryRestoreSession`, `getStoredUser`, `setRememberMe`, `checkAccess`, `checkMultipleAccess`
- `admin-drive.js` (~250 linjer): `findFileByName`, `listFiles`, `getFileContent`, `saveFile`, `createFile`, `deleteFile`, `uploadImage`, `listImages`, `getDriveImageBlob`, `parseMarkdown`, `stringifyMarkdown`
- `admin-sheets.js` (~500 linjer): `getSettingsWithNotes`, `updateSettingByKey`, `updateSettings`, `getSheetParentFolder`, `updateSheetRow`, `deleteSheetRow`, `getTannlegerRaw`, `updateTannlegeRow`, `addTannlegeRow`, `getGalleriRaw`, `updateGalleriRow`, `addGalleriRow`, etc.
- `admin-client.js` beholdes som re-export-fasade: `export * from './admin-auth.js'; export * from './admin-drive.js'; export * from './admin-sheets.js';`
- **Ingen import-endringer nødvendig** i andre filer — de importerer fortsatt fra `admin-client.js`
- Oppdater test-mocks som mocker `admin-client.js`

### Steg 5: Ekstraher SVG-ikoner til egen fil

**Filer:** `src/scripts/admin-icons.js` (ny), `src/scripts/admin-dashboard.js`

- Flytt 7 SVG-ikonkonstanter (`ICON_EDIT`, `ICON_DELETE`, `ICON_UP`, `ICON_DOWN`, `ICON_PERSON`, `ICON_IMAGE`, `ICON_CALENDAR`) til `admin-icons.js`
- Import i `admin-dashboard.js`
- Ingen test-endringer nødvendig (ikonene er bare strenger)

---

## Rekkefølge og avhengigheter

```
Steg 1 (slider-template)       ──┐
Steg 2 (auto-save)              │  Uavhengige
Steg 3 (bilde-preview)          │
Steg 5 (SVG-ikoner)           ──┘
                                 │
Steg 4 (splitt admin-client) ────┘  Kan gjøres når som helst, men størst og mest selvstendig
```

Steg 1–3 og 5 er uavhengige og kan gjøres i vilkårlig rekkefølge. Steg 4 er selvstendig men størst.

## Forventet resultat

| Metrikk | Før | Etter |
|---------|-----|-------|
| `admin-client.js` | 987 linjer | ~10 (re-export fasade) |
| `admin-dashboard.js` | 805 linjer | ~785 (−20, ikoner ut) |
| `admin-module-bilder.js` | 498 linjer | ~455 (−43, templates+auto-save+preview) |
| `admin-module-tannleger.js` | 377 linjer | ~335 (−42, templates+auto-save+preview) |
| Dupliserte slider-linjer | ~80 (2×40) | 0 (1 felles funksjon) |
| Dupliserte auto-save-mønster | 4 | 0 |
| Nye filer | 0 | 3 (admin-auth, admin-drive, admin-sheets) |

## Verifisering

Etter hvert steg:
1. `npm test` — alle enhetstester består
2. `npx vitest --coverage` — ≥80% branch coverage per berørt fil
3. `npm run build` — build OK
4. Manuell sjekk: admin-panelet fungerer som før (alle moduler)
