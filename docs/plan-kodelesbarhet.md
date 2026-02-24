# Plan: Kodelesbarhet — gå gjennom og forenkle koden

> Revidert 2026-02-24 med fersk kodeanalyse.

## Bakgrunn

Kodebasen har vokst organisk og har flere områder med duplisert logikk, store monolittiske filer og inkonsistent formatering. Denne oppgaven fokuserer på å gjøre koden enklere å lese og vedlikeholde — uten å endre funksjonalitet.

## Analyse — størrelse og kompleksitet

| Fil | Linjer | Hovedproblem |
|-----|--------|--------------|
| `src/pages/admin/index.astro` | 1797 | Monolittisk — ~1570 linjer inline JS med 21+ funksjoner |
| `src/scripts/admin-client.js` | 1033 | Duplisert CRUD for tannleger/galleri (~80% likt, 8 funksjoner) |
| `src/scripts/admin-dashboard.js` | 706 | 4 nær-identiske modullastere + gjentatt event-binding |
| `src/scripts/sync-data.js` | 567 | Duplisert bildeparsing (3×) + innrykk-korrupsjon + duplisert download-logikk (4×) |

### Gjennomgående problemer

1. **Bilde-konfig-parsing duplisert 5×** — scale/posX/posY med `parseFloat`+`isNaN`+bounds-sjekk i sync-data.js (3×) og admin-client.js (2×)
2. **Event-binding-mønster gjentas 4×** — edit/delete/toggle/stopPropagation/card-klikk i alle modullastere (admin-dashboard.js)
3. **Thumbnail-lasting duplisert 2×** — identisk async `findFileByName()`+`getDriveImageBlob()`-loop i tannleger- og galleri-modul
4. **HTML-generering uten gjenbruk** — 30-80-linjers template-strenger i admin-dashboard.js uten felles hjelpefunksjoner
5. **CRUD-par duplisert** — `getTannlegerRaw()`≈`getGalleriRaw()`, `deleteTannlegeRowPermanently()`≈`deleteGalleriRowPermanently()` (~90% identisk)
6. **Editor-mønstre duplisert 3×** — `editTjeneste`, `editMelding`, `editTannlege` i index.astro følger identisk struktur

## Steg

Hvert steg er én commit. Ingen funksjonalitet endres — kun strukturforbedringer.

---

### ~~Steg 1: Ekstraher duplisert bildeparsing til felles hjelpefunksjon~~ ✅

**Filer:** `src/scripts/image-config.js` (ny), `src/scripts/sync-data.js`, `src/scripts/admin-client.js`

- `parseImageConfig(scaleVal, posXVal, posYVal)` med full validering (scale 1–3, pos 0–100) og defaults
- Erstatter 5× duplisert parsing i sync-data.js (3×) og admin-client.js (2×)
- 13 nye tester, 100% branch coverage på ny fil, 502 tester totalt bestått

---

### ~~Steg 2: Konsolider CRUD-operasjoner i admin-client.js~~ ✅

**Fil:** `src/scripts/admin-client.js`

- `deleteSheetRow(spreadsheetId, sheetName, rowIndex)` — felles slette-logikk
- `updateSheetRow(spreadsheetId, sheetName, rowIndex, endCol, values, label)` — felles oppdatering
- Eksisterende funksjoner beholdt som tynne wrappers (bakoverkompatibilitet)
- 133 eksisterende tester bestått, 94.76% branch coverage

---

### ~~Steg 3: Felles event-binding og thumbnail-lasting for admin-modullastere~~ ✅

**Fil:** `src/scripts/admin-dashboard.js`

- `bindCardClickDelegation(container, editBtnSelector)` — erstatter 4× duplisert stopPropagation + kort→edit-delegering
- `loadThumbnails(container, items, parentFolderId)` — erstatter 2× identisk async thumbnail-lasting
- Edit/delete/toggle-bindinger beholdt som de er (ulike signaturer, ikke verdt å generalisere)
- 107 tester bestått, 85.64% branch coverage

---

### ~~Steg 4: Konsolider HTML-templates i admin-dashboard.js~~ ✅

**Fil:** `src/scripts/admin-dashboard.js`

- 7 SVG-ikonkonstanter (`ICON_EDIT`, `ICON_DELETE`, `ICON_UP`, `ICON_DOWN`, `ICON_PERSON`, `ICON_IMAGE`, `ICON_CALENDAR`) erstatter dupliserte inline-SVGer
- `renderToggleSwitch(dataAttr, dataValue, isActive)` — felles toggle-template
- `renderActionButtons(editClass, deleteClass, dataAttrs)` — felles edit/delete-knapper
- Forenklet alle 4 modullastere (meldinger, tjenester, tannleger, galleri)
- 107 tester bestått, 85.36% branch coverage

---

### Steg 5: Rydd sync-data.js — innrykk, download-logikk og forenkling

**Fil:** `src/scripts/sync-data.js`

- Fiks innrykk-korrupsjon i syncTannleger (linje 150-162, ~40+ spaces innrykk)
- Ekstraher `downloadImageIfNeeded(metadata, localPath)` fra gjentatt download-logikk (4× `shouldDownload()`+`downloadFile()`-mønster)
- Forenkle `syncForsideBilde()` fallback-logikk til en dedikert `getForsideBildeConfig()`

**Risiko:** Lav — formatering + ren ekstraksjon
**Test:** Eksisterende tester

---

### Steg 6: Ekstraher inline-script fra admin/index.astro

**Filer:** `src/pages/admin/index.astro` → nye modulfiler

- Flytt den ~1570-linjers `<script>`-blokken (linje 227-1797) til separate filer:
  - `src/scripts/admin-module-settings.js` — `loadSettingsModule()` + reorder-logikk
  - `src/scripts/admin-module-tjenester.js` — `editTjeneste`, `deleteTjeneste`, reload
  - `src/scripts/admin-module-meldinger.js` — `editMelding`, `deleteMelding`, reload
  - `src/scripts/admin-module-tannleger.js` — `editTannlege`, `deleteTannlege`, reload
  - `src/scripts/admin-module-bilder.js` — `loadBilderModule()` (479 linjer alene)
  - `src/scripts/admin-init.js` — `openModule()`, `closeModule()`, `handleAuth()`, initialisering
- Felles hjelpefunksjoner (`setToggleState`, `renderToggleHtml`, `attachToggleClick`, `showDeletionToast`) flyttes til delt modul
- Admin-siden importerer modulene og beholder kun HTML/CSS
- Gjenbruk hjelpefunksjonene fra steg 1-4

**Risiko:** Høy — største refaktoreringen, mange avhengigheter
**Test:** Full testsuite + manuell verifisering av admin-panelet
**Avhenger av:** Steg 1-5 (bygger på ekstraherte hjelpefunksjoner)

---

## Rekkefølge og avhengigheter

```
Steg 1 (bildeparsing)      ──┐
Steg 2 (CRUD-konsolidering)  │
Steg 3 (event-binding)       ├──→ Steg 6 (ekstraher inline-script)
Steg 4 (HTML-templates)      │
Steg 5 (sync-data rydding) ──┘
```

Steg 1-5 er uavhengige og kan gjøres i vilkårlig rekkefølge. Steg 6 bør gjøres sist da den bygger på alle foregående forbedringer.

## Ikke i scope

- **Funksjonelle endringer** — dette er kun refaktorering
- **Ny arkitektur** — vi moderniserer ikke til framework/klassebasert, kun forenkling
- **Astro-komponenter** — disse er allerede rene etter UX-redesignet
