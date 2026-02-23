# Plan: Konsistent aktiv/inaktiv-visning i admin på tvers av moduler

## Problem

De tre modulene (tjenester, tannleger, galleri) bruker ulike UI-mønstre for aktiv/inaktiv i editorene:

| Modul | Liste | Editor |
|-------|-------|--------|
| **Tjenester** | Toggle-switch | Toggle-switch (label + `data-active`) |
| **Tannleger** | Toggle-switch | Checkbox (`<input type="checkbox">`) |
| **Galleri** | Toggle-switch | Select/dropdown (`<select> Ja/Nei`) |

**Listene** er allerede konsistente — alle bruker toggle-switch med grønn/grå track, dot-animasjon og label.

**Editorene** er inkonsistente. Tjenester-modulen har det beste mønsteret: en toggle-switch med "Synlighet"-label, identisk med listen. Tannleger bruker en enkel checkbox, galleri bruker en select-dropdown.

## Mål

Bruk tjeneste-editorens toggle-mønster som referanse for tannleger og galleri. Alle tre editorer skal ha:

1. `flex items-center justify-between` rad med label "Synlighet" til venstre
2. Toggle-switch (identisk med listen) til høyre
3. `data-active`-attributt for tilstandshåndtering
4. Programmatisk klikk-handler (samme mønster som tjeneste-editoren)

## Steg

### Steg 1: Tannlege-editor — bytt checkbox til toggle-switch

**Fil:** `src/pages/admin/index.astro` (linje ~824–829)

Erstatt:
```html
<div class="flex items-center gap-2">
    <label class="text-[10px] font-bold text-slate-400 uppercase">Aktiv på nettsiden</label>
    <input type="checkbox" id="edit-t-active" ... class="w-5 h-5 accent-brand cursor-pointer">
</div>
```

Med tjeneste-editorens mønster:
```html
<div class="flex items-center justify-between">
    <label class="admin-label !mb-0">Synlighet</label>
    <button id="edit-t-active-toggle" type="button" class="flex items-center gap-1.5 cursor-pointer group/toggle" data-active="${t.active}">
        <span class="toggle-track ...">
            <span class="toggle-dot ..."></span>
        </span>
        <span class="toggle-label ...">${label}</span>
    </button>
</div>
```

Oppdater lagre-logikken (linje ~1007) til å lese `data-active` i stedet for `checked`.

Oppdater `updatePreview`-listen (linje ~1085) til å bruke den nye toggle-ID-en.

### Steg 2: Galleri-editor — bytt select til toggle-switch

**Fil:** `src/pages/admin/index.astro` (linje ~1246–1252)

Erstatt:
```html
<div id="galleri-active-field" class="admin-field-container flex items-center gap-3">
    <label class="admin-label !mb-0">Aktiv</label>
    <select id="galleri-edit-active" class="admin-input w-24">
        <option value="ja">Ja</option>
        <option value="nei">Nei</option>
    </select>
</div>
```

Med toggle-switch (samme mønster). Behold `id="galleri-active-field"` for skjul/vis-logikken ved forsidebilde.

Oppdater alle steder som leser `activeSelect.value === 'ja'` til å lese `data-active === 'true'` i stedet.

Oppdater `forsideCheckbox.change`-handleren som setter `activeSelect.value = 'ja'` til å oppdatere toggle-state.

### Steg 3: Legg til klikk-handler for nye toggles

Begge nye toggles trenger identisk klikk-handler som tjeneste-editoren (linje ~487–510):
- Flip `data-active`
- Oppdater track, dot og label-klasser

For galleri-editoren: kall `updateGalleriPreview()` etter toggle-endring.

### Steg 4: Tester

Oppdater eksisterende tester som verifiserer checkbox/select-interaksjon:
- `admin-dashboard.test.js`: Sjekk at tester som bruker `checked` eller `select.value` oppdateres til `data-active`
- Nye tester for toggle-klikk i tannlege- og galleri-editor

Estimat: ~4–6 nye/oppdaterte tester.

## Filer som endres

| Fil | Endring |
|-----|---------|
| `src/pages/admin/index.astro` | Bytt checkbox → toggle (tannleger), select → toggle (galleri), oppdater lagre- og preview-logikk |
| `src/scripts/__tests__/admin-dashboard.test.js` | Oppdater tester for nye toggle-elementer |

## Avgrensninger

- **Listen** endres ikke — den er allerede konsistent
- **Tjeneste-editoren** endres ikke — den er referansemønsteret
- Toggle-logikken i listen (optimistisk UI, revert) berøres ikke
