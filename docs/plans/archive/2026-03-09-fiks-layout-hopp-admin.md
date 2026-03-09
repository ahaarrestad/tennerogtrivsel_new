# Fiks layout-hopp på admin-sider — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fjern visuell CLS (Cumulative Layout Shift) på admin-dashboard og moduler ved å reservere plass for korttellere og bruke smooth height-transition når modul-innhold lastes.

**Architecture:** To uavhengige fixes: (1) CSS-endring for `admin-card-count` og `breadcrumb-count` — fjern `hidden`-toggling, bruk `opacity`-fade i stedet. (2) Ny hjelpefunksjon `smoothReplaceContent()` som animerer høyde-endring når skeleton → innhold byttes i moduler.

**Tech Stack:** CSS transitions, vanilla JS, Vitest (jsdom)

---

### Task 1: Korttellere — CSS og JS-endring

**Files:**
- Modify: `src/styles/global.css:630-632` — endre `.admin-card-count`
- Modify: `src/scripts/admin-dashboard.js:822-827` — endre `setCount()`
- Modify: `src/pages/admin/index.astro:142,148,154,160,166` — fjern `hidden` fra count-elementer
- Test: `src/scripts/__tests__/admin-dashboard.test.js`

**Step 1: Oppdater CSS for `admin-card-count`**

I `src/styles/global.css`, endre `.admin-card-count`:

```css
.admin-card-count {
    @apply block text-xs text-admin-muted-light mt-1;
    min-height: 1lh;
    opacity: 0;
    transition: opacity 200ms ease-out;
}
.admin-card-count.visible {
    opacity: 1;
}
```

`1lh` = én linjehøyde basert på elementets font-size. Dette reserverer nøyaktig riktig plass.

**Step 2: Fjern `hidden` fra count-spans i HTML**

I `src/pages/admin/index.astro`, fjern `hidden` fra alle 5 count-elementer:
- Linje 142: `<span id="card-tjenester-count" class="admin-card-count"></span>`
- Linje 148: `<span id="card-meldinger-count" class="admin-card-count"></span>`
- Linje 154: `<span id="card-tannleger-count" class="admin-card-count"></span>`
- Linje 160: `<span id="card-bilder-count" class="admin-card-count"></span>`
- Linje 166: `<span id="card-prisliste-count" class="admin-card-count"></span>`

**Step 3: Endre `setCount()` i admin-dashboard.js**

Fra:
```js
const setCount = (id, text) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.classList.remove('hidden');
};
```

Til:
```js
const setCount = (id, text) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.classList.add('visible');
};
```

**Step 4: Oppdater tester for `loadDashboardCounts`**

Testene sjekker `el.classList.contains('hidden')` — endre til å sjekke `el.classList.contains('visible')`.

Finn alle assertions som sjekker `hidden` på count-elementer og endre:
- `expect(el.classList.contains('hidden')).toBe(false)` → `expect(el.classList.contains('visible')).toBe(true)`

**Step 5: Kjør tester**

Run: `npx vitest run src/scripts/__tests__/admin-dashboard.test.js`
Expected: PASS

**Step 6: Commit**

```
feat: fjern CLS på dashboard-korttellere
```

---

### Task 2: Brødsmuleteller — samme fix

**Files:**
- Modify: `src/styles/global.css:627-629` — endre `.admin-item-count`
- Modify: `src/scripts/admin-dashboard.js:239-243` — endre `updateBreadcrumbCount()`
- Modify: `src/pages/admin/index.astro:182` — fjern `hidden` fra `breadcrumb-count`
- Test: `src/scripts/__tests__/admin-dashboard.test.js`

**Step 1: Oppdater CSS for `.admin-item-count`**

```css
.admin-item-count {
    @apply text-admin-muted-light;
    opacity: 0;
    transition: opacity 200ms ease-out;
}
.admin-item-count.visible {
    opacity: 1;
}
```

**Step 2: Fjern `hidden` fra breadcrumb-count i HTML**

I `src/pages/admin/index.astro` linje 182:
```html
<span id="breadcrumb-count" class="admin-item-count"></span>
```

**Step 3: Endre `updateBreadcrumbCount()`**

Fra:
```js
export function updateBreadcrumbCount(count) {
    const el = document.getElementById('breadcrumb-count');
    if (!el) return;
    el.textContent = `(${count})`;
    el.classList.remove('hidden');
}
```

Til:
```js
export function updateBreadcrumbCount(count) {
    const el = document.getElementById('breadcrumb-count');
    if (!el) return;
    el.textContent = `(${count})`;
    el.classList.add('visible');
}
```

**Step 4: Oppdater også `openModule()` i admin-init.js som resetter breadcrumb**

I `src/scripts/admin-init.js` linje 29, endre:
```js
if (breadcrumbCount) { breadcrumbCount.textContent = ''; breadcrumbCount.classList.add('hidden'); }
```
til:
```js
if (breadcrumbCount) { breadcrumbCount.textContent = ''; breadcrumbCount.classList.remove('visible'); }
```

**Step 5: Oppdater tester**

Endre testene for `updateBreadcrumbCount` fra `hidden`-sjekk til `visible`-sjekk:
- `expect(el.classList.contains('hidden')).toBe(false)` → `expect(el.classList.contains('visible')).toBe(true)`

**Step 6: Kjør tester**

Run: `npx vitest run src/scripts/__tests__/admin-dashboard.test.js`
Expected: PASS

**Step 7: Commit**

```
feat: fjern CLS på brødsmuleteller
```

---

### Task 3: Smooth height-transition for modul-innlasting

**Files:**
- Create: `src/scripts/admin-transition.js` — hjelpefunksjon
- Create: `src/scripts/__tests__/admin-transition.test.js` — tester
- Modify: `src/scripts/admin-dashboard.js` — bruk ny funksjon i alle load*Module-funksjoner
- Modify: `src/styles/global.css` — legg til `.admin-content-transition`

**Step 1: Skriv tester for `smoothReplaceContent()`**

Opprett `src/scripts/__tests__/admin-transition.test.js`:

```js
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { smoothReplaceContent } from '../admin-transition.js';

describe('smoothReplaceContent', () => {
    let container;

    beforeEach(() => {
        vi.useFakeTimers();
        container = document.createElement('div');
        document.body.appendChild(container);
        container.innerHTML = '<p>Old content</p>';
        // Mock offsetHeight since jsdom doesn't do layout
        Object.defineProperty(container, 'offsetHeight', { value: 100, configurable: true });
    });

    afterEach(() => {
        vi.useRealTimers();
        container.remove();
    });

    it('should replace innerHTML with new content', () => {
        smoothReplaceContent(container, '<p>New content</p>');
        expect(container.innerHTML).toContain('New content');
    });

    it('should set explicit height and overflow during transition', () => {
        smoothReplaceContent(container, '<p>New</p>');
        expect(container.style.height).toBe('100px');
        expect(container.style.overflow).toBe('hidden');
    });

    it('should clean up inline styles after transition ends', () => {
        smoothReplaceContent(container, '<p>New</p>');
        // Trigger transitionend
        container.dispatchEvent(new Event('transitionend'));
        expect(container.style.height).toBe('');
        expect(container.style.overflow).toBe('');
    });

    it('should clean up via timeout fallback if transitionend does not fire', () => {
        smoothReplaceContent(container, '<p>New</p>');
        vi.advanceTimersByTime(300);
        expect(container.style.height).toBe('');
        expect(container.style.overflow).toBe('');
    });

    it('should not double-cleanup', () => {
        smoothReplaceContent(container, '<p>New</p>');
        container.dispatchEvent(new Event('transitionend'));
        // Second transitionend should not throw
        container.dispatchEvent(new Event('transitionend'));
        expect(container.style.height).toBe('');
    });
});
```

**Step 2: Kjør test for å verifisere at den feiler**

Run: `npx vitest run src/scripts/__tests__/admin-transition.test.js`
Expected: FAIL — modul finnes ikke

**Step 3: Implementer `smoothReplaceContent()`**

Opprett `src/scripts/admin-transition.js`:

```js
/**
 * Erstatter innerHTML i en container med smooth høyde-animasjon.
 * Måler nåværende høyde, setter nytt innhold, måler ny høyde, animerer mellom.
 */
export function smoothReplaceContent(container, newHTML) {
    const oldHeight = container.offsetHeight;

    container.style.height = oldHeight + 'px';
    container.style.overflow = 'hidden';
    container.innerHTML = newHTML;

    // Vent én frame så nettleseren registrerer startverdien
    requestAnimationFrame(() => {
        // Mål ny høyde midlertidig
        container.style.height = 'auto';
        const newHeight = container.offsetHeight;
        container.style.height = oldHeight + 'px';

        // Tving reflow, deretter sett target-høyde
        void container.offsetHeight;
        container.style.transition = 'height 200ms ease-out';
        container.style.height = newHeight + 'px';

        let cleaned = false;
        const cleanup = () => {
            if (cleaned) return;
            cleaned = true;
            container.style.height = '';
            container.style.overflow = '';
            container.style.transition = '';
        };

        container.addEventListener('transitionend', cleanup, { once: true });
        setTimeout(cleanup, 300); // fallback
    });
}
```

**Step 4: Kjør testene**

Run: `npx vitest run src/scripts/__tests__/admin-transition.test.js`
Expected: PASS (noen tester kan trenge justering pga. rAF i jsdom — se steg 5)

**Step 5: Juster tester om nødvendig for rAF**

Jsdom har ikke ekte `requestAnimationFrame`. Vitest faker den, men den kan trenge manuell flush. Hvis tester feiler, mock `requestAnimationFrame`:

```js
vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => { cb(); return 0; });
```

Legg dette til i `beforeEach`.

**Step 6: Commit**

```
feat: legg til smoothReplaceContent-hjelpefunksjon
```

---

### Task 4: Integrer smooth transition i alle moduler

**Files:**
- Modify: `src/scripts/admin-dashboard.js` — import og bruk `smoothReplaceContent`

**Step 1: Importer funksjonen**

Legg til øverst i `admin-dashboard.js`:
```js
import { smoothReplaceContent } from './admin-transition.js';
```

**Step 2: Erstatt `inner.innerHTML = ...` med `smoothReplaceContent()` i alle moduler**

Dette gjelder KUN der skeleton erstattes med faktisk innhold — IKKE der skeleton settes initielt. Konkret:

1. **loadMeldingerModule** — linje der `inner.innerHTML` settes etter data er hentet (tomt-state og html-grid)
2. **loadTjenesterModule** — linje der `inner.innerHTML` settes etter data er hentet
3. **loadTannlegerModule** — linje der `inner.innerHTML` settes etter data er hentet
4. **loadGalleriListeModule** — bruker `container.innerHTML` (ikke `inner`) — erstatt tilsvarende

For hver modul, endre:
```js
inner.innerHTML = html;
```
til:
```js
smoothReplaceContent(inner, html);
```

Og for tomt-state:
```js
inner.innerHTML = `<div class="text-center ...">Ingen ... funnet.</div>`;
```
til:
```js
smoothReplaceContent(inner, `<div class="text-center ...">Ingen ... funnet.</div>`);
```

**Merk:** Feilhåndtering (`handleModuleError`) og initial skeleton-setting skal IKKE endres — de trenger ikke animasjon.

**Step 3: Kjør alle admin-tester**

Run: `npx vitest run src/scripts/__tests__/admin-dashboard.test.js src/scripts/__tests__/admin-init.test.js`
Expected: PASS

**Step 4: Commit**

```
feat: smooth height-transition ved modul-innlasting
```

---

### Task 5: Manuell visuell test

**Step 1: Start dev-server**

Run: `npm run dev`

**Step 2: Verifiser i nettleser**

1. Gå til `/admin` og logg inn
2. Sjekk at korttellerne fader inn uten at kortene hopper
3. Klikk inn på hver modul (Finpussen, Oppslagstavla, Tannlegekrakken, Røntgenbildene, Takstlista, Rutinesjekken)
4. Verifiser at skeleton → innhold-overgangen er smooth uten hopp
5. Brødsmuletelleren skal også fade inn uten hopp

**Step 3: Commit alt samlet hvis ikke allerede committet per task**

```
feat: fiks layout-hopp på admin-sider
```
