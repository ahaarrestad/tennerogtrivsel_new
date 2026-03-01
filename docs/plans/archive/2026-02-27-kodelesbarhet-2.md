# Plan: Kodelesbarhet — ny gjennomgang og forenkling

> **Status: FULLFØRT** — 6 steg fullført

## Kontekst

Kodebasen gjennomgikk en stor refaktorering (6 steg, [forrige plan](plan-kodelesbarhet.md)) som reduserte `admin/index.astro` fra 1797→231 linjer og konsoliderte bilde-parsing, CRUD-operasjoner, event-binding og HTML-templates. Denne oppgaven vurderer **hva som gjenstår** og gjør målrettede forbedringer.

### Nåværende tilstand (4716 linjer i admin-scripts)

| Fil | Linjer | Rolle |
|-----|--------|-------|
| `admin-client.js` | 997 | Google API: auth + Drive + Sheets |
| `admin-dashboard.js` | 805 | Modullastere, SVG-ikoner, templates |
| `sync-data.js` | 537 | Byggetids-synkronisering |
| `admin-module-bilder.js` | 498 | Galleri-editor |
| `admin-module-tannleger.js` | 387 | Tannlege-editor |
| `admin-dialog.js` | 260 | Toast/confirm/banner |
| `admin-module-meldinger.js` | 258 | Melding-editor |
| `admin-module-tjenester.js` | 218 | Tjeneste-editor |
| `admin-editor-helpers.js` | 218 | Felles editor-hjelpefunksjoner |
| `admin-module-settings.js` | 173 | Innstillinger-editor |
| `admin-init.js` | 150 | Modulinitialisering |
| `admin-api-retry.js` | 116 | Retry/backoff-logikk |
| `admin-gallery.js` | 99 | Bildevelger-modal |

### Identifiserte problemer

1. **Slider-template duplisert 2×** — Identiske 3-slider-blokker (scale/posX/posY) i `bilder.js` (linje 102–137) og `tannleger.js` (linje 102–141). Eneste forskjell: ID-prefix (`galleri-edit-` vs `edit-t-`) og verdi-prefix (`galleri-val-` vs `val-`). ~36 linjer copy-paste.

2. **Auto-save debounce duplisert 4×** — Identisk `clearTimeout`/`setTimeout(1500)`-mønster i alle 4 editor-moduler med module-level `*SaveTimeout`-variabel. Hver modul har `showSaveBar('saving')`→delay→`saveFn()`→`showSaveBar('saved')`→`hideSaveBar(5000)`.

3. **Bilde-preview-oppslag duplisert 2×** — Resolver bildenavn til blob-URL via `findFileByName()` → `getDriveImageBlob()`. `bilder.js` (linje 59–68) er enkel; `tannleger.js` (linje 49–68) har ekstra logikk for Drive-ID-deteksjon (streng >20 tegn uten punktum) og lokal fallback-sti.

4. **Bildevelger-modal duplisert 2×** — Nær-identisk åpne-modal → `loadGallery(folderId, callback)` → sett input-verdi → vis preview → dispatch event → lukk modal. `bilder.js` (linje 270–289) og `tannleger.js` (linje 196–221). Begge har også `setupUploadHandler()` med samme callback-mønster.

5. **Lagreverifisering duplisert 2×** — Identisk mønster: lagre → re-fetch alle rader → finn rad → sammenlign nøkkelfelt → mismatch → `showSaveBar('error')` + reload. `bilder.js` (linje 341–356) og `tannleger.js` (linje 307–322).

6. **`admin-client.js` er monolittisk (997 linjer)** — Blander auth (token, GIS, login/logout), Drive-operasjoner (fil-CRUD, bilder) og Sheets-operasjoner (innstillinger, tannleger, galleri). Tre distinkte ansvarsområder i én fil.

### Hva som IKKE trenger endring

- **Navngivning (norsk/engelsk-miks)** — Etablert konvensjon, konsistent innenfor domener.
- **sync-data.js** — Allerede ryddet i forrige runde. 537 linjer er akseptabelt for byggetids-logikk.
- **Ikke-admin scripts** — `messageClient.js`, `layout-helper.js`, `mobile-menu.js`, `pwa-prompt.js` er alle korte og fokuserte.
- **SVG-ikoner i `admin-dashboard.js`** — 7 konstanter (~20 linjer) i toppen av filen. Å flytte strengkonstanter til en egen fil gir minimal lesbarhetsforbedring og skaper en ny fil for lite innhold. Droppet.

---

## Steg

Hvert steg er én commit. Ingen funksjonalitet endres — kun strukturforbedringer.

### Steg 1: Ekstraher slider-template til felles funksjon

**Filer:** `admin-editor-helpers.js`, `admin-module-bilder.js`, `admin-module-tannleger.js`

- Ny funksjon `renderImageCropSliders({ prefix, valPrefix, scale, posX, posY })` i `admin-editor-helpers.js`
- `prefix` = ID-prefix for inputs (f.eks. `"galleri-edit"` → `galleri-edit-scale`)
- `valPrefix` = ID-prefix for verdi-labels (f.eks. `"galleri-val"` → `galleri-val-scale`)
- `scale`/`posX`/`posY` = initielle verdier (defaulter til `1`/`50`/`50`)
- Genererer HTML for 3 sliders med step-buttons (`slider-step-btn`)
- Erstatter ~36 identiske linjer i bilder.js og tannleger.js
- Tester: ny test for `renderImageCropSliders()`, oppdater eksisterende

### Steg 2: Ekstraher auto-save hjelpefunksjon

**Filer:** `admin-editor-helpers.js`, alle 4 `admin-module-*.js`-filer

- Ny funksjon `createAutoSaver(saveFn, delay = 1500)` i `admin-editor-helpers.js`
- Returnerer `{ trigger(), cancel() }`
  - `trigger()` kaller `showSaveBar('saving', '💾 Lagrer…')`, debouncer med `clearTimeout`/`setTimeout`
  - Etter `saveFn()`: `showSaveBar('saved', ...)` + `hideSaveBar(5000)`
  - Ved feil: `showSaveBar('error', '❌ Feil ved lagring!')`
- Erstatter 4× duplisert mønster og fjerner `galleriSaveTimeout`, `tannlegeSaveTimeout`, `meldingSaveTimeout`, `tjenesteSaveTimeout`
- Tester: ny test for `createAutoSaver()`, oppdater eksisterende

### Steg 3: Ekstraher bilde-preview-oppslag

**Filer:** `admin-editor-helpers.js`, `admin-module-bilder.js`, `admin-module-tannleger.js`

- Ny funksjon `resolveImagePreview(imageName, folderId, options?)` i `admin-editor-helpers.js`
  - `options.localFallbackDir` — valgfri lokal fallback-sti (f.eks. `/src/assets/tannleger/`)
- Logikk: sjekk om `imageName` er Drive-ID (>20 tegn, ingen punktum) → bruk direkte; ellers `findFileByName()` → `getDriveImageBlob()` → blob-URL
- Returnerer `{ src: string|'', imageId: string|null }`
- Fallback til `localFallbackDir + imageName` hvis Drive-oppslag feiler
- Erstatter ~20 linjer i bilder.js (enkel variant) og tannleger.js (utvidet variant)
- Tester: ny test for `resolveImagePreview()`, oppdater eksisterende

### Steg 4: Ekstraher bildevelger-modal-oppsett

**Filer:** `admin-editor-helpers.js`, `admin-module-bilder.js`, `admin-module-tannleger.js`

- Ny funksjon `setupImagePicker({ btnId, modalId, inputEl, previewImgEl, placeholderEl, folderId })` i `admin-editor-helpers.js`
  - Åpner modal, kaller `loadGallery(folderId, callback)`
  - Callback setter input-verdi, laster preview via `getDriveImageBlob()`, dispatcher `input`-event, lukker modal
- Ny funksjon `setupImageUpload({ folderId, inputEl, previewImgEl, placeholderEl })` som wrapper `setupUploadHandler()`
- Erstatter ~25 nær-identiske linjer i bilder.js og tannleger.js
- Tester: ny test for `setupImagePicker()`, oppdater eksisterende

### Steg 5: Ekstraher lagreverifisering

**Filer:** `admin-editor-helpers.js`, `admin-module-bilder.js`, `admin-module-tannleger.js`

- Ny funksjon `verifySave({ fetchFn, rowIndex, compareField, expectedValue, timestampElId, reloadFn })` i `admin-editor-helpers.js`
  - Kaller `fetchFn()`, finner rad med `rowIndex`
  - Oppdaterer "Sist hentet"-timestamp i `timestampElId`
  - Sjekker `compareField` mot `expectedValue`
  - Ved mismatch: logger advarsel, viser feilmelding, kaller `reloadFn()`
  - Returnerer `{ verified: boolean, timestamp: Date }`
- Erstatter ~16 identiske linjer i bilder.js og tannleger.js
- Tester: ny test for `verifySave()`, oppdater eksisterende

### Steg 6: Splitt admin-client.js i 3 moduler

**Filer:** `admin-client.js` → `admin-auth.js` + `admin-drive.js` + `admin-sheets.js` (+ re-export fasade)

- `admin-auth.js` (~150 linjer): `initGapi`, `initGis`, `login`, `silentLogin`, `logout`, `tryRestoreSession`, `getStoredUser`, `setRememberMe`, `checkAccess`, `checkMultipleAccess`
- `admin-drive.js` (~250 linjer): `findFileByName`, `listFiles`, `getFileContent`, `saveFile`, `createFile`, `deleteFile`, `uploadImage`, `listImages`, `getDriveImageBlob`, `parseMarkdown`, `stringifyMarkdown`
- `admin-sheets.js` (~550 linjer): `getSettingsWithNotes`, `updateSettingByKey`, `updateSettings`, `getSheetParentFolder`, `updateSheetRow`, `deleteSheetRow`, `getTannlegerRaw`, `updateTannlegeRow`, `addTannlegeRow`, `getGalleriRaw`, `updateGalleriRow`, `addGalleriRow`, etc.
- `admin-client.js` beholdes som re-export-fasade: `export * from './admin-auth.js'; export * from './admin-drive.js'; export * from './admin-sheets.js';`
- **Ingen import-endringer nødvendig** i andre filer — de importerer fortsatt fra `admin-client.js`
- Oppdater test-mocks som mocker `admin-client.js`

---

## Rekkefølge og avhengigheter

```
Steg 1 (slider-template)         ──┐
Steg 2 (auto-save)                │
Steg 3 (bilde-preview)            │  Uavhengige — legger alle til i editor-helpers.js
Steg 4 (bildevelger-modal)        │
Steg 5 (lagreverifisering)      ──┘
                                   │
Steg 6 (splitt admin-client) ─────┘  Selvstendig, kan gjøres når som helst
```

Steg 1–5 endrer i `admin-editor-helpers.js` og bør gjøres sekvensielt for å unngå merge-konflikter. Steg 6 er helt selvstendig.

## Forventet resultat

| Metrikk | Før | Etter |
|---------|-----|-------|
| `admin-client.js` | 997 linjer | ~10 (re-export fasade) |
| `admin-module-bilder.js` | 498 linjer | ~415 (−83) |
| `admin-module-tannleger.js` | 387 linjer | ~305 (−82) |
| Dupliserte slider-linjer | ~72 (2×36) | 0 (1 felles funksjon) |
| Dupliserte auto-save-mønster | 4 | 0 |
| Dupliserte preview-oppslag | 2 | 0 |
| Dupliserte modal-oppsett | 2 | 0 |
| Dupliserte verifikasjoner | 2 | 0 |
| Nye filer | 0 | 3 (admin-auth, admin-drive, admin-sheets) |

## Verifisering

Etter hvert steg:
1. `npm test` — alle enhetstester består
2. `npx vitest --coverage` — ≥80% branch coverage per berørt fil
3. `npm run build` — build OK
4. Manuell sjekk: admin-panelet fungerer som før (alle moduler)
