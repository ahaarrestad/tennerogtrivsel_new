# Galleri-lightbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Commits:** Følg prosjektets `/commit`-arbeidsflyt (CLAUDE.md / memory). «Commit»-stegene under er logiske sjekkpunkter; rut dem gjennom `/commit`. Endelig review skjer via `review-loop` etter implementasjon.

**Goal:** Klikk på et galleribilde åpner det i en stor lightbox-overlay med navigasjon (piler, piltaster, Esc, klikk-utenfor, swipe) på mobil og desktop.

**Architecture:** En singleton-overlay (`Lightbox.astro`) styres av en vanilla-JS-modul (`gallery-lightbox.js`). `Galleri.astro` genererer høyoppløste bildevarianter med `getImage()` og sender hele den sorterte bildelista som JSON til klienten. Styling ligger i gjenbrukbare klasser i `global.css` (`@layer components`).

**Tech Stack:** Astro 5 (`astro:assets`/`getImage`), Tailwind v4 (`@theme`-tokens, `@layer components`), Vitest + jsdom.

**Spec:** [`docs/superpowers/specs/2026-06-05-galleri-lightbox-design.md`](../specs/2026-06-05-galleri-lightbox-design.md)

---

## Prod-sikkerhet per commit (invariant)

CI (`deploy.yml`) kjører `unit-tests` (`npm test` med **global** 80%-terskel for lines/functions/branches/statements), `lint` og `e2e-tests` (axe på `/` og `/galleri/`, CSP-sjekk, lenker) på hver push/PR til `main`. **Deploy er gated på at alle tre er grønne.** Derfor gjelder:

1. **«Dark launch»-rekkefølge:** Commit 1–4 endrer **ingen** rendret oppførsel — `gallery-lightbox.js` og `Lightbox.astro` er død kode (ikke importert/rendret) til **Task 5** kobler dem på. En unrendret `.astro` bundles ikke av `astro build`, så ingen ekstra script/CSP-effekt i prod før aktiveringen. Eksisterende galleri ser identisk ut ved hver av disse commitene.
2. **Hver JS-commit må stå på egne ben coverage-messig:** test-en for en gren skrives i **samme** task som grenen introduseres (ikke utsatt). Hver JS-task kjører **hele** `npm test` (ikke bare én fil) før commit, så den globale terskelen er verifisert grønn.
3. **Task 5 er den eneste commiten som endrer prod-oppførsel.** Den må derfor bestå unit + lint + **E2E** + `astro build` lokalt før den committes (axe på de nye knappene/dialogen, CSP uendret). Verifiseres eksplisitt i Task 5.
4. **Eksisterende oppførsel bevares:** «Bilde mangler»-tiles forblir `<div>` (ikke-klikkbare), «Se alle bilder →»-lenken og nav-lenkene røres ikke.

---

## Filstruktur

| Fil | Ansvar | Endring |
|-----|--------|---------|
| `src/styles/global.css` | Gjenbrukbare lightbox-klasser i `@layer components` | Modifiser |
| `src/components/Lightbox.astro` | Singleton overlay-markup + script-wiring | Opprett |
| `src/scripts/gallery-lightbox.js` | All klient-logikk (`initGalleryLightbox`) | Opprett |
| `src/scripts/__tests__/gallery-lightbox.test.js` | Enhetstester (jsdom) | Opprett |
| `src/components/Galleri.astro` | `getImage`-varianter, JSON-data, tiles→knapper, inkluder `<Lightbox/>` | Modifiser |

**DOM-kontrakt** (delt mellom markup, modul og tester):
- Overlay: `#galleri-lightbox.lightbox[role=dialog][aria-modal][hidden]`
- Knapper: `[data-lightbox-close]`, `[data-lightbox-prev]`, `[data-lightbox-next]`
- Scene/bilde: `[data-lightbox-stage]`, `[data-lightbox-img]`
- Tekst: `[data-lightbox-title]`, `[data-lightbox-count]`
- Data: `<script type="application/json" id="galleri-lightbox-data">` med `[{ src, srcset, title, alt }]`
- Tiles: `<button data-lightbox-index="N">` der `N` er indeks i JSON-lista
- Åpen/lukket-tilstand: `root.hidden` (`false` = åpen)

---

## Task 1: Lightbox CSS-klasser

**Files:**
- Modify: `src/styles/global.css` (inne i `@layer components { … }`, ved siden av `.image-overlay-gradient` rundt linje 573)

- [ ] **Step 1: Legg til lightbox-klassene**

Lim inn følgende rett etter `.image-overlay-gradient-full`-linjen, fortsatt inne i `@layer components`:

```css
    /* Galleri-lightbox */
    .lightbox {
        @apply fixed inset-0 z-50 hidden items-center justify-center bg-brand-dark/90;
        backdrop-filter: blur(2px);
    }
    .lightbox:not([hidden]) { @apply flex; }
    .lightbox-stage {
        @apply relative w-full h-full flex items-center justify-center;
        padding: 3.5rem 1rem 5.25rem;
    }
    @media (min-width: 768px) {
        .lightbox-stage { padding: 3.5rem 5rem 5.75rem; }
    }
    .lightbox-img { @apply max-w-full max-h-full object-contain rounded-md select-none; }
    .lightbox-info { @apply absolute inset-x-0 bottom-0 z-10 text-center px-5 pt-6 pb-5 pointer-events-none; }
    .lightbox-title { @apply text-brand-light text-sm md:text-base font-semibold mb-1; }
    .lightbox-count { @apply text-brand-light/70 text-xs tracking-wide; }
    .lightbox-nav-btn {
        @apply absolute top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-12 h-12 rounded-full bg-brand-light/15 hover:bg-brand-light/25 text-brand-light text-2xl leading-none cursor-pointer transition-colors;
        backdrop-filter: blur(4px);
    }
    .lightbox-nav-btn--prev { @apply left-3 md:left-5; }
    .lightbox-nav-btn--next { @apply right-3 md:right-5; }
    .lightbox-close {
        @apply absolute top-3 right-3 z-20 flex items-center justify-center w-11 h-11 rounded-full bg-brand-light/15 hover:bg-brand-light/25 text-brand-light text-xl cursor-pointer transition-colors;
        backdrop-filter: blur(4px);
    }
```

Merk: nav-knappene og lukk-knappen har `z-20`, stage/bilde har ingen z-index → knappene ligger alltid **over** bildet (fikser regresjonen fra prototypen). Info-blokkens gradient kommer fra gjenbruk av `image-overlay-gradient` i markupen (Task 4) — ikke duplisert her.

- [ ] **Step 2: Verifiser at CSS kompilerer**

Run: `npx astro build`
Expected: Build fullføres uten Tailwind/`@apply`-feil. (Visuelt resultat verifiseres i Task 6.)

- [ ] **Step 3: Commit** (via `/commit`)

`style: lightbox-klasser i global.css`

---

## Task 2: Lightbox-modul — kjerne (åpne/lukke/navigasjon)

**Files:**
- Create: `src/scripts/gallery-lightbox.js`
- Test: `src/scripts/__tests__/gallery-lightbox.test.js`

- [ ] **Step 1: Skriv testene for kjernen**

Opprett `src/scripts/__tests__/gallery-lightbox.test.js`:

```js
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initGalleryLightbox } from '../gallery-lightbox.js';

const IMAGES = [
    { src: '/img/a.webp', srcset: '/img/a-1024.webp 1024w, /img/a-1600.webp 1600w', title: 'Bilde A', alt: 'Alt A' },
    { src: '/img/b.webp', srcset: '', title: 'Bilde B', alt: 'Alt B' },
    { src: '/img/c.webp', srcset: '', title: '', alt: 'Alt C' },
];

function setupDOM(images = IMAGES) {
    const tiles = images.map((_, i) => `<button data-lightbox-index="${i}" id="tile-${i}">tile ${i}</button>`).join('');
    document.body.innerHTML = `
        <div class="grid">${tiles}</div>
        <div id="galleri-lightbox" class="lightbox" role="dialog" aria-modal="true" aria-hidden="true" hidden>
            <button data-lightbox-close aria-label="Lukk">&times;</button>
            <button data-lightbox-prev aria-label="Forrige">&lsaquo;</button>
            <button data-lightbox-next aria-label="Neste">&rsaquo;</button>
            <div class="lightbox-stage" data-lightbox-stage><img data-lightbox-img alt="" /></div>
            <div class="lightbox-info"><p data-lightbox-title></p><p data-lightbox-count></p></div>
        </div>
        <script type="application/json" id="galleri-lightbox-data">${JSON.stringify(images)}</script>`;
}

const root = () => document.getElementById('galleri-lightbox');
const img = () => document.querySelector('[data-lightbox-img]');
const title = () => document.querySelector('[data-lightbox-title]');
const count = () => document.querySelector('[data-lightbox-count]');

beforeEach(() => setupDOM());
afterEach(() => { document.body.innerHTML = ''; document.body.style.overflow = ''; });

describe('gallery-lightbox – kjerne', () => {
    it('åpner på bildet som ble klikket', () => {
        initGalleryLightbox();
        document.getElementById('tile-1').click();
        expect(root().hidden).toBe(false);
        expect(img().getAttribute('src')).toBe('/img/b.webp');
        expect(title().textContent).toBe('Bilde B');
        expect(count().textContent).toBe('2 / 3');
    });

    it('setter srcset og alt fra dataene', () => {
        initGalleryLightbox();
        document.getElementById('tile-0').click();
        expect(img().getAttribute('srcset')).toContain('1600w');
        expect(img().getAttribute('alt')).toBe('Alt A');
    });

    it('skjuler tittel når bildet mangler tittel', () => {
        initGalleryLightbox();
        document.getElementById('tile-2').click();
        expect(title().hidden).toBe(true);
        expect(title().textContent).toBe('');
    });

    it('blar til neste og wrapper fra siste til første', () => {
        initGalleryLightbox();
        document.getElementById('tile-2').click();
        document.querySelector('[data-lightbox-next]').click();
        expect(count().textContent).toBe('1 / 3');
        expect(img().getAttribute('src')).toBe('/img/a.webp');
    });

    it('blar til forrige og wrapper fra første til siste', () => {
        initGalleryLightbox();
        document.getElementById('tile-0').click();
        document.querySelector('[data-lightbox-prev]').click();
        expect(count().textContent).toBe('3 / 3');
    });

    it('×-knappen lukker', () => {
        initGalleryLightbox();
        document.getElementById('tile-0').click();
        document.querySelector('[data-lightbox-close]').click();
        expect(root().hidden).toBe(true);
    });

    it('låser body-scroll ved åpning og frigjør ved lukking', () => {
        initGalleryLightbox();
        document.getElementById('tile-0').click();
        expect(document.body.style.overflow).toBe('hidden');
        document.querySelector('[data-lightbox-close]').click();
        expect(document.body.style.overflow).toBe('');
    });

    it('returnerer fokus til utløsende tile ved lukking', () => {
        initGalleryLightbox();
        const tile = document.getElementById('tile-0');
        tile.click();
        document.querySelector('[data-lightbox-close]').click();
        expect(document.activeElement).toBe(tile);
    });

    it('dobbel init binder ikke handlere to ganger', () => {
        initGalleryLightbox();
        initGalleryLightbox();
        document.getElementById('tile-0').click();
        document.querySelector('[data-lightbox-next]').click();
        expect(count().textContent).toBe('2 / 3');
    });

    it('gjør ingenting når lightbox-elementet mangler', () => {
        document.body.innerHTML = '';
        expect(() => initGalleryLightbox()).not.toThrow();
    });

    it('gjør ingenting når data-elementet mangler (men root finnes)', () => {
        document.getElementById('galleri-lightbox-data').remove();
        initGalleryLightbox();
        document.getElementById('tile-0').click();
        expect(root().hidden).toBe(true);
    });

    it('gjør ingenting når dataene er tomme', () => {
        setupDOM([]);
        expect(() => initGalleryLightbox()).not.toThrow();
        expect(root().hidden).toBe(true);
    });

    it('takler ugyldig JSON i data-elementet uten å kaste', () => {
        setupDOM();
        document.getElementById('galleri-lightbox-data').textContent = '{ ikke gyldig json';
        expect(() => initGalleryLightbox()).not.toThrow();
        expect(root().hidden).toBe(true);
    });

    it('ignorerer tile med ugyldig data-lightbox-index', () => {
        initGalleryLightbox();
        const tile = document.getElementById('tile-0');
        tile.setAttribute('data-lightbox-index', 'xyz');
        tile.click();
        expect(root().hidden).toBe(true);
    });
});
```

Guard-testene dekker grenene `!dataEl`, `images.length === 0`, `catch` (ugyldig JSON), og `!Number.isNaN(idx)` (false-grenen) — samme task som grenene introduseres, så filen holder ≥80% branch ved denne commiten.

- [ ] **Step 2: Kjør testene – verifiser at de feiler**

Run: `npx vitest run src/scripts/__tests__/gallery-lightbox.test.js`
Expected: FAIL — `initGalleryLightbox` finnes ikke / modulen mangler.

- [ ] **Step 3: Implementer kjernen**

Opprett `src/scripts/gallery-lightbox.js`:

```js
/**
 * Galleri-lightbox: åpner galleribilder i en stor overlay med navigasjon.
 * Idempotent — trygg å kalle flere ganger (astro:page-load + umiddelbart).
 */
export function initGalleryLightbox() {
    const root = document.getElementById('galleri-lightbox');
    const dataEl = document.getElementById('galleri-lightbox-data');
    if (!root || !dataEl) return;
    if (root.dataset.bound === 'true') return;
    root.dataset.bound = 'true';

    let images = [];
    try {
        images = JSON.parse(dataEl.textContent || '[]');
    } catch {
        images = [];
    }
    if (images.length === 0) return;

    const imgEl = root.querySelector('[data-lightbox-img]');
    const titleEl = root.querySelector('[data-lightbox-title]');
    const countEl = root.querySelector('[data-lightbox-count]');
    const stage = root.querySelector('[data-lightbox-stage]');

    let current = 0;
    let lastTrigger = null;

    function render() {
        const im = images[current];
        imgEl.setAttribute('src', im.src);
        if (im.srcset) imgEl.setAttribute('srcset', im.srcset);
        else imgEl.removeAttribute('srcset');
        imgEl.setAttribute('alt', im.alt || im.title || '');
        titleEl.textContent = im.title || '';
        titleEl.hidden = !im.title;
        countEl.textContent = `${current + 1} / ${images.length}`;
    }

    function open(index, trigger) {
        current = index;
        lastTrigger = trigger || null;
        render();
        root.hidden = false;
        root.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        root.querySelector('[data-lightbox-close]')?.focus();
    }

    function close() {
        root.hidden = true;
        root.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        lastTrigger?.focus();
    }

    function next() { current = (current + 1) % images.length; render(); }
    function prev() { current = (current - 1 + images.length) % images.length; render(); }

    document.querySelectorAll('[data-lightbox-index]').forEach((tile) => {
        tile.addEventListener('click', () => {
            const idx = Number(tile.getAttribute('data-lightbox-index'));
            if (!Number.isNaN(idx)) open(idx, tile);
        });
    });

    root.querySelector('[data-lightbox-next]')?.addEventListener('click', (e) => { e.stopPropagation(); next(); });
    root.querySelector('[data-lightbox-prev]')?.addEventListener('click', (e) => { e.stopPropagation(); prev(); });
    root.querySelector('[data-lightbox-close]')?.addEventListener('click', (e) => { e.stopPropagation(); close(); });

    // Task 3 setter inn keyboard/klikk-utenfor/swipe/focus-trap her, rett før }.
}
```

Variabelen `stage` er allerede deklarert øverst og brukes av Task 3.

- [ ] **Step 4: Kjør HELE test-suiten med coverage – verifiser at alt passerer**

Run: `npm test`
Expected: PASS. Global terskel (80% lines/functions/branches/statements) grønn, og `gallery-lightbox.js` ≥80% branch. (Kjører hele suiten slik CI gjør — ikke bare én fil.)

- [ ] **Step 5: Commit** (via `/commit`)

`feat: lightbox-modul – åpne/lukke/navigasjon`

---

## Task 3: Lightbox-modul — input (tastatur, klikk-utenfor, swipe, guards)

**Files:**
- Modify: `src/scripts/gallery-lightbox.js`
- Test: `src/scripts/__tests__/gallery-lightbox.test.js`

- [ ] **Step 1: Legg til testene for input-metodene**

Legg til en ny `describe`-blokk nederst i testfilen (gjenbruker hjelperne øverst):

```js
describe('gallery-lightbox – input', () => {
    function fireTouch(el, type, x) {
        const ev = new Event(type, { bubbles: true });
        ev.touches = x === null ? [] : [{ clientX: x }];
        el.dispatchEvent(ev);
    }

    // keydown-handleren ligger på root (se impl), så testene dispatcher på root().
    it('piltaster blar og Esc lukker', () => {
        initGalleryLightbox();
        document.getElementById('tile-0').click();
        root().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        expect(count().textContent).toBe('2 / 3');
        root().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
        expect(count().textContent).toBe('1 / 3');
        root().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(root().hidden).toBe(true);
    });

    it('ignorerer piltaster når lightbox er lukket', () => {
        initGalleryLightbox();
        root().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        expect(root().hidden).toBe(true);
    });

    it('klikk på overlay utenfor bildet lukker', () => {
        initGalleryLightbox();
        document.getElementById('tile-0').click();
        root().click();
        expect(root().hidden).toBe(true);
    });

    it('klikk på bildet lukker ikke', () => {
        initGalleryLightbox();
        document.getElementById('tile-0').click();
        img().click();
        expect(root().hidden).toBe(false);
    });

    it('klikk på scenen (utenfor bildet) lukker', () => {
        initGalleryLightbox();
        document.getElementById('tile-0').click();
        document.querySelector('[data-lightbox-stage]').click();
        expect(root().hidden).toBe(true);
    });

    it('swipe forbi terskel blar til neste', () => {
        initGalleryLightbox();
        document.getElementById('tile-0').click();
        const stage = document.querySelector('[data-lightbox-stage]');
        fireTouch(stage, 'touchstart', 200);
        fireTouch(stage, 'touchmove', 120);
        fireTouch(stage, 'touchend', null);
        expect(count().textContent).toBe('2 / 3');
    });

    it('swipe under terskel blar ikke', () => {
        initGalleryLightbox();
        document.getElementById('tile-0').click();
        const stage = document.querySelector('[data-lightbox-stage]');
        fireTouch(stage, 'touchstart', 200);
        fireTouch(stage, 'touchmove', 180);
        fireTouch(stage, 'touchend', null);
        expect(count().textContent).toBe('1 / 3');
    });

    it('swipe mot høyre blar til forrige (wrap)', () => {
        initGalleryLightbox();
        document.getElementById('tile-0').click();
        const stage = document.querySelector('[data-lightbox-stage]');
        fireTouch(stage, 'touchstart', 120);
        fireTouch(stage, 'touchmove', 220);
        fireTouch(stage, 'touchend', null);
        expect(count().textContent).toBe('3 / 3');
    });

    it('Tab med fokus i midten beholder standard tab-oppførsel', () => {
        initGalleryLightbox();
        document.getElementById('tile-0').click();
        const buttons = root().querySelectorAll('button');
        buttons[1].focus(); // verken første eller siste
        const ev = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true, bubbles: true });
        root().dispatchEvent(ev);
        expect(ev.defaultPrevented).toBe(false);
    });

    it('Tab fra siste knapp går til første (focus-trap)', () => {
        initGalleryLightbox();
        document.getElementById('tile-0').click();
        const buttons = root().querySelectorAll('button');
        buttons[buttons.length - 1].focus();
        const ev = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true, bubbles: true });
        root().dispatchEvent(ev);
        expect(document.activeElement).toBe(buttons[0]);
        expect(ev.defaultPrevented).toBe(true);
    });

    it('Shift+Tab fra første knapp går til siste (focus-trap)', () => {
        initGalleryLightbox();
        document.getElementById('tile-0').click();
        const buttons = root().querySelectorAll('button');
        buttons[0].focus();
        const ev = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true, bubbles: true });
        root().dispatchEvent(ev);
        expect(document.activeElement).toBe(buttons[buttons.length - 1]);
        expect(ev.defaultPrevented).toBe(true);
    });
});
```

(Tom-data-grenen testes allerede i Task 2; ikke duplisert her.)

- [ ] **Step 2: Kjør de nye testene – verifiser at de feiler**

Run: `npx vitest run src/scripts/__tests__/gallery-lightbox.test.js -t "input"`
Expected: FAIL — tastatur/klikk-utenfor/swipe/focus-trap ikke implementert ennå.

- [ ] **Step 3: Implementer input-håndtering + focus-trap**

Sett inn følgende rett før den avsluttende `}` i `initGalleryLightbox` (der Task 2 etterlot kommentaren «Task 3 setter inn …»):

```js
    root.addEventListener('click', (e) => {
        if (e.target === root || e.target === stage) close();
    });

    // keydown bindes til root (ikke document): fokus er fanget inni dialogen når
    // den er åpen, så Esc/piltaster/Tab bobler hit. Da unngår vi en listener-lekkasje
    // ved Astro view transitions, der #galleri-lightbox re-initialiseres per navigasjon.
    root.addEventListener('keydown', (e) => {
        if (root.hidden) return;
        if (e.key === 'Escape') { close(); return; }
        if (e.key === 'ArrowRight') { next(); return; }
        if (e.key === 'ArrowLeft') { prev(); return; }
        if (e.key === 'Tab') {
            // DOM-kontrakten garanterer tre knapper (close/prev/next) i dialogen.
            const focusable = root.querySelectorAll('button');
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    });

    let startX = null;
    let deltaX = 0;
    stage.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; deltaX = 0; }, { passive: true });
    stage.addEventListener('touchmove', (e) => { if (startX !== null) deltaX = e.touches[0].clientX - startX; }, { passive: true });
    stage.addEventListener('touchend', () => {
        if (startX !== null && Math.abs(deltaX) > 50) {
            if (deltaX < 0) next(); else prev();
        }
        startX = null;
        deltaX = 0;
    });
```

Focus-trapen holder Tab innenfor dialogens knapper (close → prev → next → close) begge veier, slik spec-en krever.

- [ ] **Step 4: Kjør HELE test-suiten med coverage – verifiser at alt passerer**

Run: `npm test`
Expected: PASS. Hele suiten grønn, global terskel grønn, og `gallery-lightbox.js` ≥80% branch. Hvis filen er under: legg til test for den udekkede grenen før commit.

- [ ] **Step 5: Commit** (via `/commit`)

`feat: lightbox-input – tastatur, klikk-utenfor, swipe, focus-trap`

---

## Task 4: Lightbox.astro-komponent

**Files:**
- Create: `src/components/Lightbox.astro`

- [ ] **Step 1: Opprett komponenten**

```astro
---
// Singleton overlay for galleri-lightbox. Inkluderes én gang fra Galleri.astro.
// All styling ligger i global.css (.lightbox*). Ingen inline-styling her.
---
<div id="galleri-lightbox" class="lightbox" role="dialog" aria-modal="true" aria-label="Bildevisning" aria-hidden="true" hidden>
    <button type="button" class="lightbox-close" data-lightbox-close aria-label="Lukk">&times;</button>
    <button type="button" class="lightbox-nav-btn lightbox-nav-btn--prev" data-lightbox-prev aria-label="Forrige">&lsaquo;</button>
    <button type="button" class="lightbox-nav-btn lightbox-nav-btn--next" data-lightbox-next aria-label="Neste">&rsaquo;</button>
    <div class="lightbox-stage" data-lightbox-stage>
        <img class="lightbox-img" data-lightbox-img alt="" sizes="100vw" />
    </div>
    <div class="lightbox-info image-overlay-gradient">
        <p class="lightbox-title" data-lightbox-title></p>
        <p class="lightbox-count" data-lightbox-count></p>
    </div>
</div>
<script>
    import { initGalleryLightbox } from '../scripts/gallery-lightbox.js';
    document.addEventListener('astro:page-load', initGalleryLightbox);
    initGalleryLightbox();
</script>
```

- [ ] **Step 2: Verifiser at den bygger**

Run: `npx astro check`
Expected: Ingen feil for `Lightbox.astro` (komponenten er ikke brukt ennå; kobles inn i Task 5).

- [ ] **Step 3: Commit** (via `/commit`)

`feat: Lightbox.astro overlay-komponent`

---

## Task 5: Galleri.astro-integrasjon

**Files:**
- Modify: `src/components/Galleri.astro`

- [ ] **Step 1: Importer `getImage` og `Lightbox`**

I frontmatter (toppen), legg til import-linjene:

```js
import { Image, getImage } from 'astro:assets';
import Lightbox from './Lightbox.astro';
```

(Bytt ut den eksisterende `import { Image } from 'astro:assets';`.)

- [ ] **Step 2: Bygg lightbox-data fra HELE den sorterte lista**

Rett etter `const visibleImages = …` / `const hasMore = …`-blokken, legg til:

```js
// Lightbox: hele galleriet (ikke bare preview). Indeks holdes 1:1 med tiles via indexById.
const lightboxImages = [];
const indexById = new Map();
for (const item of sortert) {
    const imgPath = `/src/assets/galleri/${item.data.image}`;
    const loader = item.data.image ? images[imgPath] : undefined;
    if (!loader) continue;
    const mod = await loader();
    // Klamp bredder til kildens width så Sharp ikke oppskalerer/advarer for små bilder
    // (galleribilder lastes opp via admin og kan variere i størrelse).
    const maxWidth = mod.default.width;
    const widths = [1024, 1600, 2016].filter((w) => w <= maxWidth);
    if (widths.length === 0) widths.push(maxWidth);
    const optimized = await getImage({ src: mod.default, widths, format: 'webp' });
    indexById.set(item.id, lightboxImages.length);
    lightboxImages.push({
        src: optimized.src,
        srcset: optimized.srcSet?.attribute ?? '',
        title: item.data.title ?? '',
        alt: item.data.altText || item.data.title || '',
    });
}
// Escape "<" så JSON er trygt inne i <script>.
const lightboxJson = JSON.stringify(lightboxImages).replace(/</g, '\\u003c');
```

- [ ] **Step 3: Gjør hver bilde-tile til en klikkbar knapp**

Erstatt tile-`return`-blokken (det ytre `<div class="rounded-xl …">…</div>`) med en variant der bilder blir `<button>` med `data-lightbox-index`, og «Bilde mangler»-tilfellet forblir en `<div>`:

```jsx
                const lbIndex = indexById.get(item.id);
                const tileClass = "rounded-xl overflow-hidden shadow-sm aspect-[4/3] bg-brand-active relative group transition-all duration-300 hover:shadow-md";

                if (hasImage && lbIndex !== undefined) {
                    return (
                        <button
                            type="button"
                            data-lightbox-index={lbIndex}
                            aria-label={`Vis større: ${item.data.title || item.data.altText || 'galleribilde'}`}
                            class={`${tileClass} block w-full p-0 border-0 appearance-none cursor-zoom-in text-left`}
                        >
                            <Image
                                src={images[imgPath]()}
                                alt={item.data.altText || item.data.title}
                                widths={[400, 600, 800, 1200, 1600]}
                                sizes="(min-width: 1024px) 25vw, 50vw"
                                class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                                style={imgStyle}
                                loading="lazy"
                            />
                            {item.data.title && (
                                <div class="absolute bottom-0 inset-x-0 image-overlay-gradient p-3 md:p-4">
                                    <p class="text-white text-xs md:text-sm font-bold">{item.data.title}</p>
                                </div>
                            )}
                        </button>
                    );
                }

                return (
                    <div class={tileClass}>
                        <div class="w-full h-full flex items-center justify-center text-brand-hover">
                            Bilde mangler
                        </div>
                    </div>
                );
```

- [ ] **Step 4: Emitter JSON-data og inkluder lightboxen**

Rett før `</section>` (etter `{hasMore && (…)}`-blokken), legg til:

```jsx
        <script type="application/json" id="galleri-lightbox-data" set:html={lightboxJson}></script>
        <Lightbox />
```

- [ ] **Step 5: Verifiser de samme gatene som CI (denne commiten endrer prod-oppførsel)**

Dette er den eneste commiten som aktiverer funksjonen, så den må bestå alle deploy-gatene lokalt **før** commit:

Run: `npm test`
Expected: Hele unit-suiten grønn, global coverage-terskel grønn.

Run: `npm run lint`
Expected: Ingen feil (spesielt ingen `local/no-unsafe-inner-html`).

Run: `npm run build:ci`
Expected: Build OK; `getImage` genererer webp-varianter (1024/1600/2016) for galleribildene.

Run: `npx playwright test tests/accessibility.spec.ts tests/csp-check.spec.ts tests/links.spec.ts`
Expected: PASS. Axe finner ingen brudd på `/` og `/galleri/` med de nye `<button>`-tiles og dialogen (dialogen er `hidden` ved last → ignoreres av axe; knappene har `aria-label`). CSP uendret (`<script type="application/json">` er en data-blokk, ikke kjørbar; modul-scriptet bundles som de øvrige). Ingen døde lenker.

- [ ] **Step 6: Commit** (via `/commit`)

`feat: koble lightbox til galleriet (getImage + klikkbare tiles)`

---

## Task 6: Kvalitetssikring og manuell verifisering

**Files:** (ingen nye)

- [ ] **Step 1: Lint (inkl. innerHTML-regelen)**

Run: `npm run lint`
Expected: Ingen feil. Spesielt ingen `local/no-unsafe-inner-html`-brudd (modulen bruker `textContent`/`setAttribute`, ikke `innerHTML`).

- [ ] **Step 2: Full testkjøring med coverage**

Run: `npx vitest run --coverage`
Expected: Alle tester grønne; `gallery-lightbox.js` ≥ 80% branch. Presenter fersk testrapport (CLAUDE.md-krav).

- [ ] **Step 3: Manuell verifisering i appen (mobil + desktop)**

Run: `npm run dev` og åpne forsiden + `/galleri`. Sjekk mot spec-ens UX-liste:
- Klikk på preview-bilde på forsiden → lightbox åpner og blar gjennom **hele** galleriet.
- Piler, piltaster (← →), Esc, klikk-utenfor, ×, swipe (smal viewport/device-toolbar).
- **Focus-trap:** Tab sykler kun mellom dialogens knapper (close → prev → next) begge veier; fokus returnerer til klikket tile ved lukking.
- **Venstre-pilen synes på smal skjerm** (regresjonen fra prototypen) — knappene ligger over bildet.
- Tittel + teller nederst; toppen har kun ×.
- Bildet vises skarpt (riktig srcset-variant lastes).

- [ ] **Step 4: Review-gate**

Sett `/goal review-loop rapporterer REVIEW_LOOP: CLEAN` og kjør `review-loop` til den er ren (jf. TODO.md-arbeidsflyt). Foreslå `/commit` først når `/goal` bekrefter rent resultat.

---

## Self-review (utført under planskriving)

- **Spec-dekning:** Omfang (begge steder, forside blar gjennom alle) → Task 5 (`lightboxImages` fra hele `sortert`). Innhold (tittel+teller samlet, kun × øverst) → Task 1/4. Input (piler/tastatur/Esc/utenfor/×/swipe) → Task 2/3. Oppløsning (`getImage` srcset) → Task 5. Design-system (gjenbrukbare klasser, token-opacity, gjenbruk `image-overlay-gradient`) → Task 1/4. Sikkerhet (ingen innerHTML, ingen CSP-endring) → Task 2/6. A11y (dialog/aria/focus-trap-retur) → Task 2/4. TDD/coverage → Task 2/3/6. Regresjon (knapper over bildet) → Task 1 (`z-20`) + Task 6 manuell.
- **Placeholder-skann:** Ingen TBD/«handle edge cases» — all kode er konkret.
- **Type-/navnekonsistens:** `initGalleryLightbox`, `data-lightbox-*`, `#galleri-lightbox`, `#galleri-lightbox-data`, `root.hidden`, `indexById`/`lightboxImages` er brukt konsistent på tvers av tasks og DOM-kontrakt.
- **Focus-trap:** Full Tab-innfanging (begge retninger) + focus-inn + focus-retur er inkludert i Task 3 med egne tester.
- **Prod-sikkerhet:** Dekket av «Prod-sikkerhet per commit»-seksjonen — dark-launch (commit 1–4 inert), per-task full `npm test`, og E2E/lint/build-gate på aktiveringscommiten (Task 5).

## Review-gjennomgang (UI / teknisk / gjenbruk)

Gjennomgått langs tre akser; funn rettet inline:

**UI**
- Tittel + teller samlet nederst, kun × øverst, nav-knapper over bildet på alle bredder (z-20). ✓
- Token-baserte farger med opacity (`bg-brand-dark/90`, `bg-brand-light/15`), gjenbruk av `image-overlay-gradient`. ✓
- Akseptert som minor (ingen endring): mulig scrollbar-hopp på desktop ved body-scroll-lås; `text-white` i tile-caption er videreført eksisterende mønster, ikke nytt avvik.

**Teknisk (rettet)**
- T1: `keydown` flyttet fra `document` til `root` → ingen listener-lekkasje ved Astro view transitions. Tester dispatcher nå på `root()`.
- T2: `getImage`-bredder klampes til kildens `width` → ingen oppskalering/build-advarsler for små opplastede bilder.
- T3: `sizes="100vw"` lagt til lightbox-`<img>` for korrekt srcset-valg.
- Test-robusthet: fjernet død `focusable.length === 0`-vakt; lagt til grentester for swipe-høyre→prev, klikk på scenen, Tab-i-midten og manglende data-element → trygt ≥80% branch per fil.

**Gjenbruk**
- `tileClass` DRY (delt mellom knapp/`div`), semantiske `.lightbox*`-klasser i `@layer components`, modulen følger prosjektets `initX()`-mønster, `image-overlay-gradient` gjenbrukt. ✓

**Konklusjon:** Ingen gjenstående Critical/Important. Planen er klar for implementasjon.
```
