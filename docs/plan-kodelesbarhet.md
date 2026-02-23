# Plan: Kodelesbarhet — gå gjennom og forenkle koden

## Bakgrunn

Kodebasen har vokst organisk og har flere områder med duplisert logikk, store monolittiske filer og inkonsistent feilhåndtering. Denne oppgaven fokuserer på å gjøre koden enklere å lese og vedlikeholde — uten å endre funksjonalitet.

## Analyse — størrelse og kompleksitet

| Fil | Linjer | Hovedproblem |
|-----|--------|--------------|
| `src/pages/admin/index.astro` | 1797 | Monolittisk — ~1400 linjer inline JS med 94 funksjoner |
| `src/scripts/admin-client.js` | 1006 | Duplisert CRUD for tannleger/galleri (~80% likt) |
| `src/scripts/admin-dashboard.js` | 696 | 4 nær-identiske modullastere + gjentatt event-binding |
| `src/scripts/sync-data.js` | 567 | Duplisert bildeparsing + inkonsistent innrykk |

### Gjennomgående problemer

1. **Toggle-kode duplisert** — `setToggleState()`, `renderToggleHtml()` og toggle-event-binding gjentas i 4+ moduler
2. **Event-binding-mønster gjentas** — samme ~10-linjers blokk (edit/delete/toggle/card-klikk) i alle modulloaders
3. **Bilde-konfig-parsing duplisert** — scale/posX/posY-parsing med validering finnes i sync-data.js (2×) og admin-client.js (2×)
4. **HTML-generering uten gjenbruk** — 30-80-linjers template-strenger i admin-dashboard.js uten felles hjelpefunksjoner

## Steg

Hvert steg er én commit. Ingen funksjonalitet endres — kun strukturforbedringer.

---

### Steg 1: Ekstraher duplisert bildeparsing til felles hjelpefunksjon

**Filer:** `src/scripts/sync-data.js`, `src/scripts/admin-client.js`

- Lag `parseImageConfig(row, indices)` som returnerer `{scale, posX, posY}` med validering og defaults
- Bruk den i sync-data.js (tannleger + galleri) og admin-client.js (tannleger + galleri)
- Fjerner 4× duplisert parsing med `parseFloat` + `isNaN` + bounds-sjekk

**Risiko:** Lav — ren ekstraksjon av identisk logikk
**Test:** Eksisterende tester dekker allerede denne logikken

---

### Steg 2: Konsolider CRUD-operasjoner i admin-client.js

**Fil:** `src/scripts/admin-client.js`

- Ekstraher felles `getSheetRows(sheetName, range, schema)` for å fjerne duplisering mellom `getTannlegerRaw()` og `getGalleriRaw()`
- Ekstraher felles `deleteSheetRow(sheetName, rowIndex)` for å fjerne duplisering mellom `deleteTannlegeRowPermanently()` og `deleteGalleriRowPermanently()`
- Ekstraher felles `updateSheetRow(sheetName, range, values)` for lignende oppdateringsoperasjoner
- Behold eksisterende funksjoner som tynne wrappers for bakoverkompatibilitet

**Risiko:** Middels — mange tester avhenger av disse funksjonene
**Test:** Kjør eksisterende testsuite, legg til tester for hjelpefunksjonene

---

### Steg 3: Felles event-binding for admin-modullastere

**Filer:** `src/scripts/admin-dashboard.js`, `src/pages/admin/index.astro`

- Ekstraher `bindModuleEvents(container, { onEdit, onDelete, onToggle, onReorder })` til en hjelpefunksjon
- Erstatt 4× gjentatt event-binding-blokk i alle modullastere
- Inkluder DOMPurify-kompatibel re-binding av onclick-handlere

**Risiko:** Lav — ren ekstraksjon, enkelt å verifisere
**Test:** Eksisterende E2E-tester verifiserer funksjonalitet

---

### Steg 4: Konsolider HTML-templates i admin-dashboard.js

**Fil:** `src/scripts/admin-dashboard.js`

- Ekstraher felles template-hjelpefunksjoner:
  - `renderListCard(title, subtitle, badges, thumbnailConfig)` — felles kort-template
  - `renderStatusBadge(isActive)` — aktiv/inaktiv-badge
  - `renderReorderButtons(index, total)` — opp/ned-knapper
- Forenkle de 4 modullasterne (`loadMeldingerModule`, `loadTjenesterModule`, `loadTannlegerModule`, `loadGalleriListeModule`) til å bruke disse

**Risiko:** Middels — templates er subtilt forskjellige, må bevare alle varianter
**Test:** Visuell verifisering + eksisterende E2E

---

### Steg 5: Rydd innrykk og forenkling i sync-data.js

**Fil:** `src/scripts/sync-data.js`

- Fiks inkonsistent innrykk (linje 112-196)
- Ekstraher `downloadImageIfNeeded(metadata, localPath)` fra gjentatt download-logikk
- Forenkle `syncForsideBilde()` fallback-logikk til en dedikert `getForsideBildeConfig()`

**Risiko:** Lav — formatering + ren ekstraksjon
**Test:** Eksisterende tester

---

### Steg 6: Ekstraher inline-script fra admin/index.astro

**Filer:** `src/pages/admin/index.astro` → nye modulfiler

- Flytt den ~1400-linjers `<script>`-blokken til separate filer:
  - `src/scripts/admin-module-settings.js` — innstillinger-modul
  - `src/scripts/admin-module-tjenester.js` — tjenester CRUD + editor
  - `src/scripts/admin-module-meldinger.js` — meldinger CRUD + editor
  - `src/scripts/admin-module-tannleger.js` — tannleger CRUD + editor
  - `src/scripts/admin-module-bilder.js` — galleri/bilder-editor
  - `src/scripts/admin-init.js` — initialisering og moduldispatcher
- Admin-siden importerer modulene og beholder kun HTML/CSS
- Gjenbruk hjelpefunksjonene fra steg 1-4

**Risiko:** Høy — største refaktoreringen, mange avhengigheter
**Test:** Full testsuite + manuell verifisering av admin-panelet
**Avhenger av:** Steg 1-5 (bygger på ekstraherte hjelpefunksjoner)

---

## Rekkefølge og avhengigheter

```
Steg 1 (bildeparsing)     ──┐
Steg 2 (CRUD-konsolidering) │──→ Steg 6 (ekstraher inline-script)
Steg 3 (event-binding)      │
Steg 4 (HTML-templates)   ──┘
Steg 5 (sync-data rydding) ──┘
```

Steg 1-5 er uavhengige og kan gjøres i vilkårlig rekkefølge. Steg 6 bør gjøres sist da den bygger på alle foregående forbedringer.

## Ikke i scope

- **Funksjonelle endringer** — dette er kun refaktorering
- **Admin-panel UX/design** — dekkes av egen oppgave i backlog
- **Ny arkitektur** — vi moderniserer ikke til framework/klassebasert, kun forenkling
- **Astro-komponenter** — disse er allerede rimelig rene etter UX-redesignet
