# Kollapserbare kategorier i prisliste-admin — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Legg til kollaps/ekspander-funksjonalitet for kategori-seksjoner i prisliste-admin, med per-kategori toggle og en global "Kollaps/Ekspander alle"-knapp.

**Architecture:** Ren DOM/CSS-løsning i `admin-module-prisliste.js`. Chevron-ikon i kategori-header roterer ved toggle. Innholdscontaineren skjules/vises med `hidden`-klasse. Global toggle-knapp plasseres i `module-actions` ved siden av eksisterende knapper.

**Tech Stack:** Vanilla JS, CSS transitions, Vitest + jsdom

**Design:** [design-doc](2026-03-09-kollapserbare-kategorier-design.md)

---

### Task 1: Chevron-ikon og klikk-handler på kategori-header

**Files:**
- Modify: `src/scripts/admin-module-prisliste.js:326-337`
- Test: `src/scripts/__tests__/admin-module-prisliste.test.js`

**Step 1: Write the failing tests**

Legg til ny `describe`-blokk i `admin-module-prisliste.test.js`:

```js
describe('collapsible categories', () => {
    it('should render chevron icon in each category header', async () => {
        getPrislisteRaw.mockResolvedValue([
            { rowIndex: 2, behandling: 'Tannbleking', pris: 3000, kategori: 'Bleking', order: 1 },
            { rowIndex: 3, behandling: 'Undersøkelse', pris: 800, kategori: 'Generelt', order: 1 }
        ]);
        getKategoriRekkefølge.mockResolvedValue([
            { rowIndex: 2, kategori: 'Bleking', order: 1 },
            { rowIndex: 3, kategori: 'Generelt', order: 2 }
        ]);
        await loadPrislisteModule();

        const chevrons = document.querySelectorAll('.kategori-chevron');
        expect(chevrons).toHaveLength(2);
    });

    it('should hide category rows when header is clicked', async () => {
        getPrislisteRaw.mockResolvedValue([
            { rowIndex: 2, behandling: 'Tannbleking', pris: 3000, kategori: 'Bleking', order: 1 }
        ]);
        getKategoriRekkefølge.mockResolvedValue([
            { rowIndex: 2, kategori: 'Bleking', order: 1 }
        ]);
        await loadPrislisteModule();

        const header = document.querySelector('.kategori-header');
        const content = document.querySelector('.kategori-content');
        expect(content.classList.contains('hidden')).toBe(false);

        header.click();
        expect(content.classList.contains('hidden')).toBe(true);
    });

    it('should show category rows when collapsed header is clicked again', async () => {
        getPrislisteRaw.mockResolvedValue([
            { rowIndex: 2, behandling: 'Tannbleking', pris: 3000, kategori: 'Bleking', order: 1 }
        ]);
        getKategoriRekkefølge.mockResolvedValue([
            { rowIndex: 2, kategori: 'Bleking', order: 1 }
        ]);
        await loadPrislisteModule();

        const header = document.querySelector('.kategori-header');
        const content = document.querySelector('.kategori-content');

        header.click(); // collapse
        header.click(); // expand
        expect(content.classList.contains('hidden')).toBe(false);
    });

    it('should rotate chevron when collapsed', async () => {
        getPrislisteRaw.mockResolvedValue([
            { rowIndex: 2, behandling: 'Tannbleking', pris: 3000, kategori: 'Bleking', order: 1 }
        ]);
        getKategoriRekkefølge.mockResolvedValue([
            { rowIndex: 2, kategori: 'Bleking', order: 1 }
        ]);
        await loadPrislisteModule();

        const header = document.querySelector('.kategori-header');
        const chevron = document.querySelector('.kategori-chevron');

        header.click();
        expect(chevron.classList.contains('-rotate-90')).toBe(true);

        header.click();
        expect(chevron.classList.contains('-rotate-90')).toBe(false);
    });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/scripts/__tests__/admin-module-prisliste.test.js`
Expected: FAIL — `.kategori-chevron` not found

**Step 3: Modify prisliste module**

I `admin-module-prisliste.js`, gjør tre endringer:

**3a.** Legg til chevron-ikon-konstant øverst i filen (etter imports):

```js
const ICON_CHEVRON_DOWN = '<svg class="kategori-chevron transition-transform duration-150" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
```

**3b.** Endre kategori-header HTML (linje ~326-337). Legg til `kategori-header`-klasse, `cursor-pointer`, chevron-ikon, og `kategori-content`-klasse på innholdscontaineren:

Fra:
```js
html += `<div class="bg-white rounded-2xl border border-brand-border/60 shadow-sm overflow-hidden">
    <div class="px-6 py-4 border-b border-brand-border/60 flex items-center justify-between">
        <div class="flex items-center gap-2">
            <div class="flex flex-col gap-1">
                <button data-kategori="${escapeHtml(kategori)}" data-dir="-1" class="reorder-kategori-btn admin-icon-btn-reorder ${isFirstKat ? 'invisible' : ''}" title="Flytt kategori opp">${ICON_UP}</button>
                <button data-kategori="${escapeHtml(kategori)}" data-dir="1" class="reorder-kategori-btn admin-icon-btn-reorder ${isLastKat ? 'invisible' : ''}" title="Flytt kategori ned">${ICON_DOWN}</button>
            </div>
            <h3 class="font-heading font-bold text-xl text-brand">${escapeHtml(kategori)}</h3>
        </div>
        <button class="add-pris-kategori-btn btn-primary p-1.5 rounded-lg min-w-[32px] min-h-[32px] flex items-center justify-center" data-kategori="${escapeHtml(kategori)}" title="Ny prisrad i ${escapeHtml(kategori)}" aria-label="Ny prisrad i ${escapeHtml(kategori)}">${ICON_ADD}</button>
    </div>
    <div class="px-6 py-2">`;
```

Til:
```js
html += `<div class="bg-white rounded-2xl border border-brand-border/60 shadow-sm overflow-hidden">
    <div class="kategori-header px-6 py-4 border-b border-brand-border/60 flex items-center justify-between cursor-pointer select-none">
        <div class="flex items-center gap-2">
            <div class="flex flex-col gap-1" onclick="event.stopPropagation()">
                <button data-kategori="${escapeHtml(kategori)}" data-dir="-1" class="reorder-kategori-btn admin-icon-btn-reorder ${isFirstKat ? 'invisible' : ''}" title="Flytt kategori opp">${ICON_UP}</button>
                <button data-kategori="${escapeHtml(kategori)}" data-dir="1" class="reorder-kategori-btn admin-icon-btn-reorder ${isLastKat ? 'invisible' : ''}" title="Flytt kategori ned">${ICON_DOWN}</button>
            </div>
            ${ICON_CHEVRON_DOWN}
            <h3 class="font-heading font-bold text-xl text-brand">${escapeHtml(kategori)}</h3>
        </div>
        <div class="flex items-center gap-2" onclick="event.stopPropagation()">
            <button class="add-pris-kategori-btn btn-primary p-1.5 rounded-lg min-w-[32px] min-h-[32px] flex items-center justify-center" data-kategori="${escapeHtml(kategori)}" title="Ny prisrad i ${escapeHtml(kategori)}" aria-label="Ny prisrad i ${escapeHtml(kategori)}">${ICON_ADD}</button>
        </div>
    </div>
    <div class="kategori-content px-6 py-2">`;
```

Merk:
- Reorder-knapper og add-knapp har `onclick="event.stopPropagation()"` slik at klikk på dem ikke trigger kollaps
- Chevron-ikonet er inni headeren, mellom reorder-knapper og tittel

**3c.** Legg til klikk-handler etter `inner.innerHTML = DOMPurify.sanitize(html)` (linje ~366), før eksisterende event listeners:

```js
// Kollaps/ekspander kategori-headers
inner.querySelectorAll('.kategori-header').forEach(header => {
    header.addEventListener('click', () => {
        const section = header.closest('.bg-white');
        const content = section?.querySelector('.kategori-content');
        const chevron = header.querySelector('.kategori-chevron');
        if (content) content.classList.toggle('hidden');
        if (chevron) chevron.classList.toggle('-rotate-90');
    });
});
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/scripts/__tests__/admin-module-prisliste.test.js`
Expected: All PASS

**Step 5: Commit**

Melding: `feat(prisliste): kollapserbare kategori-seksjoner med chevron-ikon`

---

### Task 2: Global "Kollaps/Ekspander alle"-knapp

**Files:**
- Modify: `src/scripts/admin-module-prisliste.js:264` (actions-linjen)
- Test: `src/scripts/__tests__/admin-module-prisliste.test.js`

**Step 1: Write the failing tests**

Legg til i `describe('collapsible categories')`:

```js
it('should render collapse-all icon button in module-actions', async () => {
    getPrislisteRaw.mockResolvedValue([
        { rowIndex: 2, behandling: 'Test', pris: 100, kategori: 'Kat', order: 1 }
    ]);
    getKategoriRekkefølge.mockResolvedValue([{ rowIndex: 2, kategori: 'Kat', order: 1 }]);
    await loadPrislisteModule();

    const btn = document.getElementById('btn-toggle-collapse');
    expect(btn).not.toBeNull();
});

it('should collapse all categories when collapse-all button is clicked', async () => {
    getPrislisteRaw.mockResolvedValue([
        { rowIndex: 2, behandling: 'A', pris: 100, kategori: 'Kat1', order: 1 },
        { rowIndex: 3, behandling: 'B', pris: 200, kategori: 'Kat2', order: 1 }
    ]);
    getKategoriRekkefølge.mockResolvedValue([
        { rowIndex: 2, kategori: 'Kat1', order: 1 },
        { rowIndex: 3, kategori: 'Kat2', order: 2 }
    ]);
    await loadPrislisteModule();

    const btn = document.getElementById('btn-toggle-collapse');
    btn.click();

    const contents = document.querySelectorAll('.kategori-content');
    contents.forEach(c => expect(c.classList.contains('hidden')).toBe(true));
});

it('should expand all categories when clicked again after collapsing', async () => {
    getPrislisteRaw.mockResolvedValue([
        { rowIndex: 2, behandling: 'A', pris: 100, kategori: 'Kat1', order: 1 },
        { rowIndex: 3, behandling: 'B', pris: 200, kategori: 'Kat2', order: 1 }
    ]);
    getKategoriRekkefølge.mockResolvedValue([
        { rowIndex: 2, kategori: 'Kat1', order: 1 },
        { rowIndex: 3, kategori: 'Kat2', order: 2 }
    ]);
    await loadPrislisteModule();

    const btn = document.getElementById('btn-toggle-collapse');
    btn.click(); // collapse all
    btn.click(); // expand all

    const contents = document.querySelectorAll('.kategori-content');
    contents.forEach(c => expect(c.classList.contains('hidden')).toBe(false));
});

it('should update chevrons when collapse-all is clicked', async () => {
    getPrislisteRaw.mockResolvedValue([
        { rowIndex: 2, behandling: 'A', pris: 100, kategori: 'Kat1', order: 1 }
    ]);
    getKategoriRekkefølge.mockResolvedValue([{ rowIndex: 2, kategori: 'Kat1', order: 1 }]);
    await loadPrislisteModule();

    const btn = document.getElementById('btn-toggle-collapse');
    btn.click();

    const chevrons = document.querySelectorAll('.kategori-chevron');
    chevrons.forEach(c => expect(c.classList.contains('-rotate-90')).toBe(true));
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/scripts/__tests__/admin-module-prisliste.test.js`
Expected: FAIL — `#btn-toggle-collapse` not found

**Step 3: Modify module**

**3a.** Legg til ikoner øverst i filen (etter `ICON_CHEVRON_DOWN`):

```js
const ICON_COLLAPSE_ALL = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 3 12 8 17 3"/><polyline points="7 13 12 18 17 13"/></svg>';
const ICON_EXPAND_ALL = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 8 12 3 17 8"/><polyline points="7 18 12 13 17 18"/></svg>';
```

**3b.** Endre `actions.innerHTML` (linje 264) — legg til toggle-knapp:

Fra:
```js
actions.innerHTML = `<div class="flex items-center gap-2"><button id="btn-new-pris" ...>${ICON_ADD}</button><button id="btn-print-prisliste" ...>...</button></div>`;
```

Til (legg til ny knapp mellom print og slutten):
```js
actions.innerHTML = `<div class="flex items-center gap-2"><button id="btn-new-pris" class="btn-primary p-2.5 shadow-md rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center" title="Legg til prisrad" aria-label="Legg til prisrad">${ICON_ADD}</button><button id="btn-print-prisliste" class="btn-secondary p-2.5 shadow-md rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center" title="Skriv ut prisliste" aria-label="Skriv ut prisliste"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg></button><button id="btn-toggle-collapse" class="btn-secondary p-2.5 shadow-md rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center" title="Kollaps alle kategorier" aria-label="Kollaps alle kategorier">${ICON_COLLAPSE_ALL}</button></div>`;
```

**3c.** Legg til klikk-handler etter eksisterende `btn-print-prisliste` handler (linje ~412):

```js
let allCollapsed = false;
document.getElementById('btn-toggle-collapse').onclick = () => {
    allCollapsed = !allCollapsed;
    const contents = inner.querySelectorAll('.kategori-content');
    const chevrons = inner.querySelectorAll('.kategori-chevron');
    const btn = document.getElementById('btn-toggle-collapse');

    contents.forEach(c => c.classList.toggle('hidden', allCollapsed));
    chevrons.forEach(c => c.classList.toggle('-rotate-90', allCollapsed));

    if (btn) {
        btn.innerHTML = allCollapsed ? ICON_EXPAND_ALL : ICON_COLLAPSE_ALL;
        btn.title = allCollapsed ? 'Ekspander alle kategorier' : 'Kollaps alle kategorier';
        btn.setAttribute('aria-label', btn.title);
    }
};
```

Merk: `allCollapsed` deklareres i funksjonsscope til `loadPrislisteList`, ikke som modul-level variabel, slik at den resettes ved ny lasting.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/scripts/__tests__/admin-module-prisliste.test.js`
Expected: All PASS

**Step 5: Commit**

Melding: `feat(prisliste): global kollaps/ekspander-knapp for alle kategorier`

---

### Task 3: Coverage og kvalitetssjekk

**Files:** Ingen nye — verifisering av eksisterende

**Step 1: Kjør coverage for berørte filer**

Run: `npx vitest run --coverage src/scripts/__tests__/admin-module-prisliste.test.js`

Verifiser at `src/scripts/admin-module-prisliste.js` har ≥80% branch coverage.

**Step 2: Skriv manglende tester for å nå 80%**

Mulige edge cases:
- Klikk på reorder-knapp inne i header trigger ikke kollaps (stopPropagation)
- Klikk på add-knapp inne i header trigger ikke kollaps
- Kollapser én kategori manuelt, klikker "Kollaps alle" → alle kollapset
- Ekspanderer én kategori manuelt, klikker "Ekspander alle" → alle ekspandert

**Step 3: Kjør build**

Run: `npm run build`
Expected: Ingen feil

**Step 4: Commit**

Melding: `test: dekningsgrad for kollapserbare prisliste-kategorier`
