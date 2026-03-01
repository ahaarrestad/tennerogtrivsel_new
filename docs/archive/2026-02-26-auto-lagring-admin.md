# Plan: Auto-lagring i admin (Meldinger og Tjenester)

**Status: Fullført**

## Kontekst

Tre av fem admin-moduler har allerede auto-lagring:
- **Innstillinger** — blur-trigget (per felt)
- **Tannleger** — debounce 1500ms med save bar
- **Bilder/Galleri** — debounce 1500ms med save bar

**Meldinger** og **Tjenester** brukte manuell "Lagre"-knapp. Begge bruker EasyMDE (markdown-editor) og lagrer til Google Drive-filer via `saveFile()`/`createFile()`. Denne oppgaven gjorde lagremønsteret konsistent.

## Tilnærming

Brukte **debounced auto-save med save bar** (samme mønster som tannleger/bilder). Blur-trigget lagring passer dårlig for markdown-editorer der brukeren klikker på toolbar-knapper (som trigger blur uten at de er ferdige).

### Ny vs. eksisterende

- **Eksisterende (redigering):** Auto-save med 1500ms debounce. "Lagre"-knapp fjernet, save bar viser status. "Tilbake til listen"-knapp.
- **Ny (opprettelse):** "Opprett"-knapp beholdt. Etter opprettelse lastes listen på nytt.

## Gjennomførte steg

### Steg 1: Refaktorert `initMarkdownEditor` / `initEditors` ✅
**Fil:** `src/scripts/admin-editor-helpers.js`

- `initMarkdownEditor()` — fjernet `onSave`-parameter og knapp-binding, returnerer bare `easyMDE`
- `initEditors(onDateChange)` — fjernet `onSave`-parameter og knapp-binding, returnerer `{ easyMDE, flatpickrInstances }`

### Steg 2: Tjenester — auto-save i editor ✅
**Fil:** `src/scripts/admin-module-tjenester.js`

- Importert `showSaveBar`, `hideSaveBar`, `formatTimestamp`
- Modul-level `tjenesteSaveTimeout` for debounce
- `triggerAutoSave()` for eksisterende: `showSaveBar('changed')` → 1500ms debounce → `doSave()`
- Lytter på `input` (#edit-title, #edit-ingress), EasyMDE `codemirror.on('change')`, toggle-klikk
- Eksisterende: kun "Tilbake til listen"-knapp (ingen save-knapp)
- Nye: "Opprett tjeneste"-knapp med `onclick` → `doSave()` → `reloadTjenester()`

### Steg 3: Meldinger — auto-save i editor ✅
**Fil:** `src/scripts/admin-module-meldinger.js`

- Importert `showSaveBar`, `hideSaveBar`, `formatTimestamp`
- Modul-level `meldingSaveTimeout` for debounce
- `areDatesValid()` — sjekker at endDate >= startDate
- `triggerAutoSave()` sjekker `areDatesValid()` før save — ugyldig dato blokkerer auto-save
- Lytter på `input` (#edit-title), EasyMDE `codemirror.on('change')`, dato-endring via `change`-event
- Eksisterende: kun "Tilbake til listen"-knapp
- Nye: "Opprett melding"-knapp, dato-validering deaktiverer knappen ved ugyldig dato

### Steg 4: Tester ✅
**Filer:**
- `src/scripts/__tests__/admin-editor-helpers.test.js` — oppdatert for nye signaturer (38 tester)
- `src/scripts/__tests__/admin-module-tjenester.test.js` — 32 tester (auto-save, debounce, toggle, ny/eksisterende, feilhåndtering)
- `src/scripts/__tests__/admin-module-meldinger.test.js` — 29 tester (auto-save, debounce, dato-guard, ny/eksisterende, feilhåndtering)

## Berørte filer

| Fil | Endring |
|-----|---------|
| `src/scripts/admin-editor-helpers.js` | Fjernet knapp-binding fra `initMarkdownEditor` og `initEditors` |
| `src/scripts/admin-module-tjenester.js` | Auto-save med debounce, ny/eksisterende-differensiering |
| `src/scripts/admin-module-meldinger.js` | Auto-save med debounce, dato-validering blokkerer auto-save |
| `src/scripts/__tests__/admin-editor-helpers.test.js` | Oppdatert for nye signaturer |
| `src/scripts/__tests__/admin-module-tjenester.test.js` | Nye auto-save-tester |
| `src/scripts/__tests__/admin-module-meldinger.test.js` | Nye auto-save-tester + dato-guard |

## Verifisering

1. ✅ `npx vitest run` — 803 tester bestått (28 filer)
2. ✅ Branch coverage: editor-helpers 86%, tjenester 85%, meldinger 90% (alle ≥80%)
3. ✅ `npm run build` — bygget lykkes
