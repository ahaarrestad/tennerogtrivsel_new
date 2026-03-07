# Plan: Sortering av tjenester på admin-siden

## Mål
Legg til opp/ned-piler i tjeneste-listen på admin-siden for å styre rekkefølge. Fjern priority-input fra redigeringsskjemaet. Sørg for konsistent sortering (priority → alfabetisk) i admin og på frontend.

## Steg

### 1. `admin-dashboard.js` — `loadTjenesterModule` (linje 448–510)

**Sortering:** Bytt linje 468 fra alfabetisk til priority-basert:
```js
services.sort((a, b) => ((a.priority ?? 99) - (b.priority ?? 99)) || (a.title || '').localeCompare(b.title || '', 'nb'));
```

**Piler:** Legg til opp/ned-knapper i tjeneste-kortene (linje 474–484). Bruk samme mønster som galleri (linje 694–697):
- `reorder-tjeneste-btn` klasse
- `data-id="${s.driveId}"` og `data-dir="-1|1"`
- Første element: opp-pil `invisible`. Siste element: ned-pil `invisible`.
- Plassér pilene mellom toggle og action-buttons

**Event-binding:** Legg til click-handler for `.reorder-tjeneste-btn` som kaller `onReorder(driveId, direction)`.

**Signatur:** Utvid funksjonen med `onReorder`-parameter:
```js
export async function loadTjenesterModule(folderId, onEdit, onDelete, onToggleActive, onReorder)
```

### 2. `admin-module-tjenester.js` — ny `reorderTjeneste()`

Ny eksportert funksjon som:
1. Mottar `services`-array, `driveId`, og `direction` (-1/+1)
2. Finner current og neighbor i sortert liste
3. Swap priority-verdier. Hvis like → tildel sekvensielle verdier
4. Oppdaterer frontmatter for begge filer via `getFileContent` → `parseMarkdown` → oppdater priority → `stringifyMarkdown` → `saveFile`
5. Kaller `reloadTjenester()` for å refreshe listen

### 3. `admin-module-tjenester.js` — `editTjeneste()` (linje 73–76, 91, 111, 143)

Fjern:
- Priority label+input fra HTML (linje 73–76)
- `document.getElementById('edit-priority').value = ...` (linje 91)
- `priority: parseInt(...)` fra `buildTjenestePayload` — behold eksisterende priority fra `data.priority` (linje 111)
- Event-listener for priority-input (linje 143)

Viktig: `buildTjenestePayload` skal fortsatt inkludere `priority: data.priority ?? 99` i frontmatter, men hente verdien fra det opprinnelige objektet — ikke fra et input-felt.

### 4. `admin-module-tjenester.js` — `reloadTjenester()` (linje 203–207)

Oppdater kallet til å sende med `reorderTjeneste`-callback:
```js
loadTjenesterModule(TJENESTER_FOLDER, editTjeneste, deleteTjeneste, toggleTjenesteActive, handleReorder);
```

### 5. Verifisering

- `Tjenester.astro` linje 15 bruker allerede `(a.data.priority ?? 99) - (b.data.priority ?? 99) || a.data.title.localeCompare(b.data.title, 'nb')` — ingen endring nødvendig, men verifisér at det er identisk logikk
- Eksisterende tester for `admin-dashboard` og `admin-module-tjenester` — oppdater/utvid
- 80% branch coverage-krav per fil

## Filer som endres
- `src/scripts/admin-dashboard.js` — sortering + piler i loadTjenesterModule
- `src/scripts/admin-module-tjenester.js` — reorderTjeneste(), fjern priority fra editor, oppdater reloadTjenester
- `src/scripts/__tests__/admin-dashboard.test.js` — test ny signatur
- `src/scripts/__tests__/admin-module-tjenester.test.js` — test reorder + fjernet priority-input
