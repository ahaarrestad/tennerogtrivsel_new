# Plan: Konsistent aktiv/inaktiv-visning i admin-editorer

> **Status: FULLFØRT**

## Problem

De tre editor-visningene (tjenester, tannleger, galleri) bruker ulike UI-mønstre for aktiv/inaktiv:

| Modul | Editor-element | Tilstandslesing |
|-------|---------------|-----------------|
| **Tjenester** | Toggle-switch (`<button>` med `data-active`) | `dataset.active === 'true'` |
| **Tannleger** | Checkbox (`<input type="checkbox">`) | `checked` |
| **Galleri** | Select/dropdown (`<select>` med Ja/Nei) | `value === 'ja'` |

**Tjeneste-editoren er referansemønsteret.** Den har en toggle-switch med grønn/grå track, dot-animasjon, og "Aktiv"/"Inaktiv"-label — identisk utseende som listene.

## Mål

Erstatt checkbox (tannleger) og select (galleri) med toggle-switch identisk med tjeneste-editoren. Etter endring skal alle tre editorer ha:

1. `flex items-center justify-between` med label "Synlighet" til venstre
2. Toggle-switch (`<button>` med track/dot/label) til høyre
3. `data-active`-attributt for tilstandshåndtering
4. Programmatisk klikk-handler som flipper visuell tilstand

## Referansemønster (tjeneste-editoren)

### HTML (linje 458–466 i index.astro)
```html
<div class="flex items-center justify-between">
    <label class="admin-label !mb-0">Synlighet</label>
    <button id="edit-active-toggle" type="button"
            class="flex items-center gap-1.5 cursor-pointer group/toggle"
            data-active="${isActive}">
        <span class="toggle-track relative inline-flex h-5 w-10 items-center rounded-full transition-colors duration-200 ${trackClass}">
            <span class="toggle-dot inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ml-0.5 ${dotClass}"></span>
        </span>
        <span class="toggle-label text-[10px] font-semibold ${labelClass}">${labelText}</span>
    </button>
</div>
```

### Klikk-handler (linje 487–510)
```javascript
editToggle.addEventListener('click', () => {
    const current = editToggle.dataset.active === 'true';
    const next = !current;
    editToggle.dataset.active = String(next);
    // Oppdater track: bg-green-500 ↔ bg-slate-300
    // Oppdater dot: translate-x-5 ↔ translate-x-0
    // Oppdater label: "Aktiv" (text-green-700) ↔ "Inaktiv" (text-slate-500)
});
```

### Styling-variabler
```javascript
const isActive = /* boolean */;
const trackClass = isActive ? 'bg-green-500' : 'bg-slate-300';
const dotClass   = isActive ? 'translate-x-5' : 'translate-x-0';
const labelText  = isActive ? 'Aktiv' : 'Inaktiv';
const labelClass = isActive ? 'text-green-700' : 'text-slate-500';
```

---

## Steg

### Steg 1: Tannlege-editor — bytt checkbox til toggle-switch

**Fil:** `src/pages/admin/index.astro`

**1a) HTML (linje 824–829)** — Erstatt checkbox-blokken:

Nåværende:
```html
<div class="flex items-center justify-between">
    <h3 class="text-brand font-black uppercase tracking-tighter">Rediger profil</h3>
    <div class="flex items-center gap-2">
        <label class="text-[10px] font-bold text-slate-400 uppercase">Aktiv på nettsiden</label>
        <input type="checkbox" id="edit-t-active" ${t.active ? 'checked' : ''} class="w-5 h-5 accent-brand cursor-pointer">
    </div>
</div>
```

Ny:
```html
<h3 class="text-brand font-black uppercase tracking-tighter">Rediger profil</h3>
<div class="flex items-center justify-between">
    <label class="admin-label !mb-0">Synlighet</label>
    <button id="edit-t-active-toggle" type="button"
            class="flex items-center gap-1.5 cursor-pointer group/toggle"
            data-active="${t.active}">
        <span class="toggle-track relative inline-flex h-5 w-10 items-center rounded-full transition-colors duration-200 ${tActiveTrack}">
            <span class="toggle-dot inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ml-0.5 ${tActiveDot}"></span>
        </span>
        <span class="toggle-label text-[10px] font-semibold ${tActiveLabelClass}">${tActiveLabel}</span>
    </button>
</div>
```

Legg til styling-variabler for `tActiveTrack`, `tActiveDot`, `tActiveLabel`, `tActiveLabelClass` (beregnet fra `t.active`).

**1b) Lagre-logikk (linje 1007, 1016, 1046)** — Bytt fra `activeInp.checked` til toggle `dataset.active`:
```javascript
// Før:
const activeInp = document.getElementById('edit-t-active') as HTMLInputElement;
const active = activeInp.checked;

// Etter:
const activeToggle = document.getElementById('edit-t-active-toggle') as HTMLButtonElement;
const active = activeToggle?.dataset.active === 'true';
```

**1c) updatePreview-listen (linje 1085)** — Bytt ID:
```javascript
// Før:
['edit-t-name', 'edit-t-title', 'edit-t-desc', 'edit-t-image', 'edit-t-scale', 'edit-t-x', 'edit-t-y', 'edit-t-active'].forEach(...)

// Etter:
['edit-t-name', 'edit-t-title', 'edit-t-desc', 'edit-t-image', 'edit-t-scale', 'edit-t-x', 'edit-t-y'].forEach(...)
```

Toggle-klikk-handleren (steg 3) kaller `updatePreview()` direkte — fjern `edit-t-active` fra listen.

**1d) Legg til klikk-handler** (etter innerHTML-blokken) — identisk med tjeneste-editorens (linje 487–510), men med ID `edit-t-active-toggle`. Kall `updatePreview()` på slutten.

---

### Steg 2: Galleri-editor — bytt select til toggle-switch

**Fil:** `src/pages/admin/index.astro`

**2a) HTML (linje 1246–1252)** — Erstatt select-blokken:

Nåværende:
```html
<div id="galleri-active-field" class="admin-field-container flex items-center gap-3">
    <label class="admin-label !mb-0">Aktiv</label>
    <select id="galleri-edit-active" class="admin-input w-24">
        <option value="ja">Ja</option>
        <option value="nei">Nei</option>
    </select>
</div>
```

Ny (behold `id="galleri-active-field"` for forsidebilde-skjuling):
```html
<div id="galleri-active-field" class="admin-field-container flex items-center justify-between">
    <label class="admin-label !mb-0">Synlighet</label>
    <button id="galleri-edit-active-toggle" type="button"
            class="flex items-center gap-1.5 cursor-pointer group/toggle"
            data-active="${gActiveInitial}">
        <span class="toggle-track ...">
            <span class="toggle-dot ..."></span>
        </span>
        <span class="toggle-label ...">${gActiveLabel}</span>
    </button>
</div>
```

**2b) Alle steder som leser `activeSelect.value === 'ja'`** — oppdater til toggle:

| Linje | Nåværende | Ny |
|-------|-----------|-----|
| 1330 | `const activeSelect = document.getElementById('galleri-edit-active') as HTMLSelectElement;` | `const activeToggle = document.getElementById('galleri-edit-active-toggle') as HTMLButtonElement;` |
| 1339 | `activeSelect.value = item.active ? 'ja' : 'nei';` | Oppdater toggle visuelt: `dataset.active`, track, dot, label |
| 1344 | `activeSelect.value = 'ja';` (forsidebilde-auto) | Sett toggle til aktiv |
| 1383 | `activeSelect.value = 'ja';` (forsidebilde-checkbox) | Sett toggle til aktiv |
| 1407 | `active: activeSelect?.value === 'ja'` (lagring) | `active: activeToggle?.dataset.active === 'true'` |
| 1493 | `active: activeSelect?.value === 'ja'` (ny-lagring) | `active: activeToggle?.dataset.active === 'true'` |

**Hjelpefunksjon:** Lag en `setToggleState(toggleEl, isActive)` funksjon for å unngå duplisering av visuell oppdatering (brukes i klikk-handler, populering, og forsidebilde-auto-aktiv). Denne kan gjenbrukes av tannlege-toggle også.

**2c) updatePreview-listen (linje 1526)** — Fjern `galleri-edit-active` fra listen (toggle-klikk kaller preview direkte).

**2d) Legg til klikk-handler** — identisk mønster. Kall `updateGalleriPreview()` etter toggle.

---

### Steg 3: Felles hjelpefunksjon for toggle-oppdatering

For å unngå duplisert kode på tvers av tre editorer + populering, lag en felles funksjon:

```javascript
function setToggleState(toggleBtn, isActive) {
    if (!toggleBtn) return;
    toggleBtn.dataset.active = String(isActive);
    const track = toggleBtn.querySelector('.toggle-track');
    const dot = toggleBtn.querySelector('.toggle-dot');
    const lbl = toggleBtn.querySelector('.toggle-label');
    if (track) {
        track.classList.toggle('bg-green-500', isActive);
        track.classList.toggle('bg-slate-300', !isActive);
    }
    if (dot) {
        dot.classList.toggle('translate-x-5', isActive);
        dot.classList.toggle('translate-x-0', !isActive);
    }
    if (lbl) {
        lbl.textContent = isActive ? 'Aktiv' : 'Inaktiv';
        lbl.classList.toggle('text-green-700', isActive);
        lbl.classList.toggle('text-slate-500', !isActive);
    }
}
```

Kall denne fra:
- Klikk-handlere (flip + oppdater)
- Populering av eksisterende verdi (galleri linje 1339)
- Forsidebilde-auto-aktiv (galleri linje 1344, 1383)

Refaktorer tjeneste-editorens eksisterende klikk-handler (linje 487–510) til å bruke samme funksjon for full konsistens.

---

### Steg 4: Tester

**Fil:** `src/scripts/__tests__/admin-dashboard.test.js`

**4a) Oppdater eksisterende tester** som bruker:
- `checkbox.checked` → `toggleBtn.dataset.active`
- `select.value = 'ja'/'nei'` → `toggleBtn.dataset.active = 'true'/'false'`

**4b) Nye tester:**
- Tannlege-editor: toggle-klikk flipper `data-active` og oppdaterer visuelt
- Galleri-editor: toggle-klikk flipper `data-active` og oppdaterer visuelt
- `setToggleState()`: setter riktige klasser for true/false
- Galleri forsidebilde-auto-aktiv: setter toggle til aktiv

Estimat: ~4–6 nye/oppdaterte tester.

---

## Filer som endres

| Fil | Endring |
|-----|---------|
| `src/pages/admin/index.astro` | Checkbox → toggle (tannleger), select → toggle (galleri), felles `setToggleState()`, refaktorer tjeneste-toggle |
| `src/scripts/__tests__/admin-dashboard.test.js` | Oppdater tester for nye toggle-elementer |

## Avgrensninger

- **Listene** endres ikke — de er allerede konsistente
- **Tjeneste-editorens utseende** endres ikke — den refaktoreres kun til å bruke felles hjelpefunksjon
- Toggle-logikken i listene (optimistisk UI, revert) berøres ikke
- Ingen nye filer opprettes
