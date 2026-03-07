# Kompakte action-knapper i admin — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Erstatt teksttunge "Legg til"-knapper i admin top-right med kompakte "+"-ikonknapper.

**Architecture:** Definer en ICON_ADD SVG-konstant i admin-dashboard.js (eksportert). Erstatt alle 5 tekstknapper med ikonknapper som bruker btn-primary-stil i kompakt 44x44px form med title og aria-label.

**Tech Stack:** Vanilla JS, SVG, Tailwind CSS

---

### Task 1: Legg til ICON_ADD-konstant i admin-dashboard.js

**Files:**
- Modify: `src/scripts/admin-dashboard.js:14-21` (SVG-ikoner-seksjonen)

**Step 1: Legg til ICON_ADD etter ICON_CALENDAR (linje 21)**

Legg til denne linjen etter `const ICON_CALENDAR = ...;` (linje 21):

```javascript
const ICON_ADD = '<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
```

Merk: width/height=20 (litt stoerre enn rad-ikonene paa 16) for aa synes godt i kompakt knapp.

**Step 2: Eksporter ICON_ADD**

Finn eksisterende eksporter i filen og legg til ICON_ADD. Soek etter `export {` eller sjekk om konstantene allerede eksporteres inline. Hvis de ikke eksporteres, legg til en named export for ICON_ADD slik at admin-module-bilder.js og admin-module-prisliste.js kan importere den.

**Step 3: Commit**

```
feat(admin): legg til ICON_ADD SVG-konstant
```

---

### Task 2: Erstatt Meldinger-knappen

**Files:**
- Modify: `src/scripts/admin-dashboard.js:331`

**Step 1: Erstatt knappen**

Endre linje 331 fra:
```javascript
actions.innerHTML = `<button id="btn-new-melding" class="btn-primary text-xs py-2 px-4 shadow-md">➕ Heng opp nytt oppslag</button>`;
```

Til:
```javascript
actions.innerHTML = `<button id="btn-new-melding" class="btn-primary p-2.5 shadow-md rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center" title="Heng opp nytt oppslag" aria-label="Heng opp nytt oppslag">${ICON_ADD}</button>`;
```

**Step 2: Verifiser visuelt** — Start dev-server, gaa til admin, aapne Meldinger-modulen, sjekk at knappen vises som en kompakt "+"-ikon med hvit farge paa brand-bakgrunn.

---

### Task 3: Erstatt Tjenester-knappen

**Files:**
- Modify: `src/scripts/admin-dashboard.js:453`

**Step 1: Erstatt knappen**

Endre linje 453 fra:
```javascript
actions.innerHTML = `<button id="btn-new-tjeneste" class="btn-primary text-xs py-2 px-4 shadow-md">➕ Legg til behandling</button>`;
```

Til:
```javascript
actions.innerHTML = `<button id="btn-new-tjeneste" class="btn-primary p-2.5 shadow-md rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center" title="Legg til behandling" aria-label="Legg til behandling">${ICON_ADD}</button>`;
```

---

### Task 4: Erstatt Tannleger-knappen

**Files:**
- Modify: `src/scripts/admin-dashboard.js:535`

**Step 1: Erstatt knappen**

Endre linje 535 fra:
```javascript
actions.innerHTML = `<button id="btn-new-tannlege" class="btn-primary text-xs py-2 px-4 shadow-md">➕ Legg til team-medlem</button>`;
```

Til:
```javascript
actions.innerHTML = `<button id="btn-new-tannlege" class="btn-primary p-2.5 shadow-md rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center" title="Legg til team-medlem" aria-label="Legg til team-medlem">${ICON_ADD}</button>`;
```

**Step 2: Commit tasks 2-4**

```
feat(admin): erstatt tekstknapper med ikonknapper i meldinger, tjenester, tannleger
```

---

### Task 5: Erstatt Bilder-knappen

**Files:**
- Modify: `src/scripts/admin-module-bilder.js:1,24`

**Step 1: Importer ICON_ADD**

Legg til import oeverst i filen. Finn eksisterende import fra admin-dashboard.js (linje 9):
```javascript
import { loadGalleriListeModule, reorderGalleriItem, formatTimestamp } from './admin-dashboard.js';
```

Legg til `ICON_ADD` i denne importen:
```javascript
import { loadGalleriListeModule, reorderGalleriItem, formatTimestamp, ICON_ADD } from './admin-dashboard.js';
```

**Step 2: Erstatt knappen**

Endre linje 24 fra:
```javascript
actions.innerHTML = `<button id="btn-new-galleribilde" class="btn-primary text-xs py-2 px-4 shadow-md">➕ Legg til bilde</button>`;
```

Til:
```javascript
actions.innerHTML = `<button id="btn-new-galleribilde" class="btn-primary p-2.5 shadow-md rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center" title="Legg til bilde" aria-label="Legg til bilde">${ICON_ADD}</button>`;
```

**Step 3: Commit**

```
feat(admin): erstatt tekstknapp med ikonknapp i bilder-modul
```

---

### Task 6: Erstatt Prisliste-knappen

**Files:**
- Modify: `src/scripts/admin-module-prisliste.js:238`

**Step 1: Importer ICON_ADD**

Finn eksisterende imports fra admin-dashboard.js i prisliste-modulen og legg til ICON_ADD.

**Step 2: Erstatt knappen**

Endre linje 238 — den lange `actions.innerHTML`-linjen. Erstatt "Legg til prisrad"-knappen med ikonknapp, behold print-knappen som den er:

```javascript
actions.innerHTML = `<div class="flex items-center gap-2"><button id="btn-new-pris" class="btn-primary p-2.5 shadow-md rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center" title="Legg til prisrad" aria-label="Legg til prisrad">${ICON_ADD}</button><button id="btn-print-prisliste" class="btn-secondary text-xs py-2 px-4 shadow-md flex items-center justify-center" title="Skriv ut prisliste"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg></button></div>`;
```

**Step 3: Vurder aa ogsaa gjore print-knappen kompakt** — Print-knappen er allerede en ikonknapp med btn-secondary. Gjor den ogsaa 44x44 for konsistens:

```javascript
actions.innerHTML = `<div class="flex items-center gap-2"><button id="btn-new-pris" class="btn-primary p-2.5 shadow-md rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center" title="Legg til prisrad" aria-label="Legg til prisrad">${ICON_ADD}</button><button id="btn-print-prisliste" class="btn-secondary p-2.5 shadow-md rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center" title="Skriv ut prisliste" aria-label="Skriv ut prisliste"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg></button></div>`;
```

**Step 4: Commit**

```
feat(admin): erstatt tekstknapp med ikonknapp i prisliste-modul
```

---

### Task 7: Visuell verifisering

**Step 1:** Start dev-server med `npm run dev`
**Step 2:** Gaa til admin-panelet og sjekk hver modul:
- [ ] Meldinger: "+" ikonknapp, hover viser "Heng opp nytt oppslag"
- [ ] Tjenester: "+" ikonknapp, hover viser "Legg til behandling"
- [ ] Tannleger: "+" ikonknapp, hover viser "Legg til team-medlem"
- [ ] Bilder: "+" ikonknapp, hover viser "Legg til bilde"
- [ ] Prisliste: "+" og printer-ikonknapper side om side
- [ ] Alle knapper har brand-farge bakgrunn med hvitt ikon
- [ ] Knappene fungerer (klikk aapner opprettelse)

**Step 3: Final commit**

```
feat(admin): kompakte ikonknapper for alle modul-actions
```
