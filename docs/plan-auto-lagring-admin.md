# Plan: Auto-lagring i admin (Meldinger og Tjenester)

## Kontekst

Tre av fem admin-moduler har allerede auto-lagring:
- **Innstillinger** — blur-trigget (per felt)
- **Tannleger** — debounce 1500ms med save bar
- **Bilder/Galleri** — debounce 1500ms med save bar

**Meldinger** og **Tjenester** bruker fortsatt manuell "Lagre"-knapp. Begge bruker EasyMDE (markdown-editor) og lagrer til Google Drive-filer via `saveFile()`/`createFile()`. Denne oppgaven gjør lagremønsteret konsistent.

## Tilnærming

Bruk **debounced auto-save med save bar** (samme mønster som tannleger/bilder). Blur-trigget lagring passer dårlig for markdown-editorer der brukeren klikker på toolbar-knapper (som trigger blur uten at de er ferdige).

### Ny vs. eksisterende

- **Eksisterende (redigering):** Auto-save med 1500ms debounce. Fjern "Lagre"-knappen, vis save bar.
- **Ny (opprettelse):** Behold en "Opprett"-knapp. Etter opprettelse lastes editoren på nytt med den nye `id`-en, og auto-save tar over.

## Steg

### Steg 1: Tjenester — auto-save i editor
**Fil:** `src/scripts/admin-module-tjenester.js`

- Lytt på `input`-events på `#edit-title`, `#edit-ingress`
- Lytt på EasyMDE `change`-event (via `easyMDE.codemirror.on('change', ...)`)
- Lytt på toggle-klikk (`attachToggleClick` sin `onChange`-callback)
- Ved endring: `showSaveBar('changed', '⏳ Endringer oppdaget...')`, start 1500ms debounce
- Ved save: `showSaveBar('saving', '💾 Lagrer...')` → `saveFile()` → `showSaveBar('saved', '✅ Lagret [tid]')` → `hideSaveBar(5000)`
- Fjern "Lagre tjeneste"-knappen og "Avbryt"-lenken for eksisterende. Erstatt med kun "Tilbake til listen"-knapp.
- For nye tjenester (`!id`): behold "Opprett tjeneste"-knapp → `createFile()` → last editoren på nytt med ny id

### Steg 2: Meldinger — auto-save i editor
**Fil:** `src/scripts/admin-module-meldinger.js`

- Lytt på `input`-events på `#edit-title`
- Lytt på flatpickr `onChange` (allerede koblet opp, legge til auto-save-trigger)
- Lytt på EasyMDE `change`-event
- Behold dato-validering: **ikke auto-lagre** hvis `endDate < startDate` (vis `date-error`, men ikke save bar)
- Samme save bar-mønster som tjenester
- Fjern "Lagre melding"-knappen for eksisterende. Behold "Opprett melding"-knapp for nye.

### Steg 3: Flytt `initMarkdownEditor` / `initEditors` til å returnere EasyMDE-instansen uten å binde save-knapp
**Fil:** `src/scripts/admin-editor-helpers.js`

- `initMarkdownEditor()` binder i dag save-knappen direkte (`btn-save-tjeneste`). Refaktorer til å returnere `easyMDE` uten å binde knapp — la modulen håndtere det.
- `initEditors()` binder `btn-save-melding` — samme refaktor.
- Alternativt: lag ny `initMarkdownEditorOnly()` som kun setter opp EasyMDE + flatpickr uten knapp-binding, så de gamle funksjonene kan beholdes for bakoverkompatibilitet hvis noe bruker dem.

### Steg 4: Tester
- Oppdater eksisterende tester i `tests/unit/admin-module-tjenester.test.js` og `tests/unit/admin-module-meldinger.test.js`
- Test at auto-save trigges ved input/change på alle felter
- Test at debounce fungerer (clearTimeout + setTimeout)
- Test at save bar vises med riktig tilstand
- Test at dato-validering forhindrer auto-save i meldinger
- Test at nye items fortsatt bruker "Opprett"-knapp
- Krav: ≥80% branch coverage per fil

## Berørte filer

| Fil | Endring |
|-----|---------|
| `src/scripts/admin-module-tjenester.js` | Auto-save-logikk, fjern manuell knapp |
| `src/scripts/admin-module-meldinger.js` | Auto-save-logikk, fjern manuell knapp |
| `src/scripts/admin-editor-helpers.js` | Refaktorer editor-init (unngå knapp-binding) |
| `tests/unit/admin-module-tjenester.test.js` | Oppdater/legg til tester |
| `tests/unit/admin-module-meldinger.test.js` | Oppdater/legg til tester |

## Verifisering

1. `npx vitest run` — alle enhetstester passerer
2. `npx vitest run --coverage` — ≥80% branch coverage for berørte filer
3. `npm run build` — bygget lykkes
4. Manuell test i admin: åpne en eksisterende tjeneste, endre tittel → se save bar → bekreft lagring
5. Manuell test: opprett ny melding → "Opprett"-knapp → auto-save overtar etter opprettelse
