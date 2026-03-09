# Optimistisk Reorder med Animasjon — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Erstatt "API-kall → full reload" med "DOM-swap → animasjon → API i bakgrunn → revert ved feil" i alle admin-moduler med reorder-funksjonalitet.

**Architecture:** Ny felles modul `admin-reorder.js` med `animateSwap()` og `optimisticReorder()` hjelpefunksjoner. Hver modul endres til å bruke optimistic pattern i stedet for å kalle `reloadModule()` etter reorder. API-kall skjer i bakgrunnen; ved feil reverses DOM-en og en toast vises.

**Tech Stack:** Vanilla JS, CSS transitions, Vitest + jsdom

**Design:** [design-doc](2026-03-09-optimistisk-reorder-design.md)

---

### Task 1: Felles animasjonsmodul — `admin-reorder.js`

**Files:**
- Create: `src/scripts/admin-reorder.js`
- Create: `src/scripts/__tests__/admin-reorder.test.js`

**Step 1: Write the failing tests**

Fil: `src/scripts/__tests__/admin-reorder.test.js`

```js
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { animateSwap, disableReorderButtons, enableReorderButtons } from '../admin-reorder.js';

describe('animateSwap', () => {
    let container, elA, elB;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.innerHTML = '';
        document.body.appendChild(container);

        elA = document.createElement('div');
        elA.textContent = 'A';
        elA.style.height = '50px';
        container.appendChild(elA);

        elB = document.createElement('div');
        elB.textContent = 'B';
        elB.style.height = '50px';
        container.appendChild(elB);
    });

    it('should swap two adjacent elements in DOM (A before B → B before A)', async () => {
        await animateSwap(elA, elB);
        const children = [...container.children];
        expect(children[0].textContent).toBe('B');
        expect(children[1].textContent).toBe('A');
    });

    it('should swap when B is before A (B before A → A before B)', async () => {
        // Remove and re-add in reverse order
        container.innerHTML = '';
        container.appendChild(elB);
        container.appendChild(elA);

        await animateSwap(elB, elA);
        const children = [...container.children];
        expect(children[0].textContent).toBe('A');
        expect(children[1].textContent).toBe('B');
    });

    it('should return a promise that resolves after swap', async () => {
        const result = animateSwap(elA, elB);
        expect(result).toBeInstanceOf(Promise);
        await result;
    });

    it('should handle elements that are not direct siblings', async () => {
        const middle = document.createElement('div');
        middle.textContent = 'M';
        container.insertBefore(middle, elB);
        // Order: A, M, B

        await animateSwap(elA, elB);
        const children = [...container.children];
        expect(children[0].textContent).toBe('B');
        expect(children[1].textContent).toBe('M');
        expect(children[2].textContent).toBe('A');
    });
});

describe('disableReorderButtons', () => {
    it('should set disabled on all matching buttons within container', () => {
        document.body.innerHTML = `
            <div id="container">
                <button class="reorder-btn">Up</button>
                <button class="reorder-btn">Down</button>
                <button class="other-btn">Edit</button>
            </div>`;
        const container = document.getElementById('container');
        disableReorderButtons(container, '.reorder-btn');
        expect(container.querySelectorAll('.reorder-btn')[0].disabled).toBe(true);
        expect(container.querySelectorAll('.reorder-btn')[1].disabled).toBe(true);
        expect(container.querySelector('.other-btn').disabled).toBe(false);
    });
});

describe('enableReorderButtons', () => {
    it('should remove disabled from all matching buttons within container', () => {
        document.body.innerHTML = `
            <div id="container">
                <button class="reorder-btn" disabled>Up</button>
                <button class="reorder-btn" disabled>Down</button>
            </div>`;
        const container = document.getElementById('container');
        enableReorderButtons(container, '.reorder-btn');
        expect(container.querySelectorAll('.reorder-btn')[0].disabled).toBe(false);
        expect(container.querySelectorAll('.reorder-btn')[1].disabled).toBe(false);
    });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/scripts/__tests__/admin-reorder.test.js`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Fil: `src/scripts/admin-reorder.js`

```js
/**
 * Animerer bytte av to DOM-elementer med slide-effekt, deretter swapper dem i DOM.
 * Returnerer et Promise som resolves når animasjonen er ferdig.
 *
 * I jsdom (ingen layout engine) hoppes animasjon over — elementene swappes direkte.
 */
export async function animateSwap(elA, elB) {
    const rectA = elA.getBoundingClientRect();
    const rectB = elB.getBoundingClientRect();

    const deltaY = rectB.top - rectA.top;

    // jsdom: all rects are 0 — skip animation, just swap
    if (deltaY === 0 && rectA.top === 0) {
        swapElements(elA, elB);
        return;
    }

    // Animate: A moves down, B moves up
    elA.style.transition = 'transform 180ms ease-out';
    elB.style.transition = 'transform 180ms ease-out';
    elA.style.transform = `translateY(${deltaY}px)`;
    elB.style.transform = `translateY(${-deltaY}px)`;

    await new Promise(resolve => {
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            elA.style.transition = '';
            elA.style.transform = '';
            elB.style.transition = '';
            elB.style.transform = '';
            swapElements(elA, elB);
            resolve();
        };
        elA.addEventListener('transitionend', finish, { once: true });
        // Fallback if transitionend doesn't fire
        setTimeout(finish, 250);
    });
}

function swapElements(elA, elB) {
    const parentA = elA.parentNode;
    const nextA = elA.nextSibling;

    if (nextA === elB) {
        // A is directly before B
        parentA.insertBefore(elB, elA);
    } else if (elB.nextSibling === elA) {
        // B is directly before A
        parentA.insertBefore(elA, elB);
    } else {
        // Not adjacent — use placeholder
        const placeholder = document.createComment('swap');
        parentA.replaceChild(placeholder, elA);
        elB.parentNode.insertBefore(elA, elB);
        placeholder.parentNode.replaceChild(elB, placeholder);
    }
}

/** Disabler alle reorder-knapper innenfor en container */
export function disableReorderButtons(container, selector) {
    container.querySelectorAll(selector).forEach(btn => { btn.disabled = true; });
}

/** Enabler alle reorder-knapper innenfor en container */
export function enableReorderButtons(container, selector) {
    container.querySelectorAll(selector).forEach(btn => { btn.disabled = false; });
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/scripts/__tests__/admin-reorder.test.js`
Expected: All PASS

**Step 5: Commit**

Melding: `feat: legg til felles animasjonsmodul for optimistisk reorder`

---

### Task 2: Prisliste — optimistisk reorder for rader

**Files:**
- Modify: `src/scripts/admin-module-prisliste.js` (reorder-pris-btn handler, linje ~387-398)
- Modify: `src/scripts/__tests__/admin-module-prisliste.test.js`

**Step 1: Write failing test**

Legg til i eksisterende `admin-module-prisliste.test.js`, i `describe('loadPrislisteList - sorting and reorder buttons')`:

```js
it('should optimistically swap DOM elements on reorder click without full reload', async () => {
    // Setup: render list, click reorder down on first item
    // Assert: DOM order changed before API resolves
    // Assert: reloadPrisliste NOT called
});

it('should revert DOM swap and show toast on API error', async () => {
    reorderPrislisteItem.mockRejectedValueOnce(new Error('API fail'));
    // Setup: render list, click reorder
    // Assert: DOM reverted to original order
    // Assert: toast shown
});

it('should disable reorder buttons during API call', async () => {
    // Setup with a pending promise
    // Assert: buttons disabled during flight
    // Resolve promise
    // Assert: buttons re-enabled
});
```

**Step 2: Modify handler**

I `admin-module-prisliste.js`, endre reorder-pris-btn handler (linje ~387-398):

Fra:
```js
inner.querySelectorAll('.reorder-pris-btn').forEach(btn => {
    btn.onclick = async (e) => {
        e.stopPropagation();
        const rowIndex = parseInt(btn.dataset.row);
        const direction = parseInt(btn.dataset.dir);
        const item = items.find(i => i.rowIndex === rowIndex);
        if (!item) return;
        const categoryRows = grouped.get(item.kategori) || [];
        await reorderPrislisteItem(sheetId, categoryRows, rowIndex, direction);
        reloadPrisliste();
    };
});
```

Til:
```js
inner.querySelectorAll('.reorder-pris-btn').forEach(btn => {
    btn.onclick = async (e) => {
        e.stopPropagation();
        const rowIndex = parseInt(btn.dataset.row);
        const direction = parseInt(btn.dataset.dir);
        const item = items.find(i => i.rowIndex === rowIndex);
        if (!item) return;
        const categoryRows = grouped.get(item.kategori) || [];

        // Finn DOM-elementene for current og neighbor
        const currentIdx = categoryRows.findIndex(i => i.rowIndex === rowIndex);
        const neighborIdx = currentIdx + direction;
        if (neighborIdx < 0 || neighborIdx >= categoryRows.length) return;

        const currentEl = btn.closest('.group');
        const allRows = [...currentEl.parentNode.children].filter(el => el.classList.contains('group'));
        const neighborEl = allRows[neighborIdx];
        if (!currentEl || !neighborEl) return;

        // Disable knapper
        disableReorderButtons(inner, '.reorder-pris-btn');

        // Optimistisk DOM-swap
        await animateSwap(currentEl, neighborEl);

        try {
            await reorderPrislisteItem(sheetId, categoryRows, rowIndex, direction);
            enableReorderButtons(inner, '.reorder-pris-btn');
        } catch (err) {
            // Revert
            await animateSwap(neighborEl, currentEl);
            enableReorderButtons(inner, '.reorder-pris-btn');
            showToast('Kunne ikke endre rekkefølge.', 'error');
        }
    };
});
```

Legg til import øverst i filen:
```js
import { animateSwap, disableReorderButtons, enableReorderButtons } from './admin-reorder.js';
```

**Step 3: Run tests**

Run: `npx vitest run src/scripts/__tests__/admin-module-prisliste.test.js`

**Step 4: Commit**

Melding: `feat(prisliste): optimistisk reorder med animasjon for prisrader`

---

### Task 3: Prisliste — optimistisk reorder for kategorier

**Files:**
- Modify: `src/scripts/admin-module-prisliste.js` (reorder-kategori-btn handler, linje ~400-408)
- Modify: `src/scripts/__tests__/admin-module-prisliste.test.js`

**Step 1: Write failing test for kategori-reorder**

```js
it('should optimistically swap kategori sections on reorder click', async () => {
    // Assert: category DOM sections swapped
    // Assert: reloadPrisliste NOT called
});

it('should revert kategori swap on API error', async () => {
    // Assert: reverted + toast
});
```

**Step 2: Modify kategori handler**

I `admin-module-prisliste.js`, endre reorder-kategori-btn handler (linje ~400-408):

Fra:
```js
inner.querySelectorAll('.reorder-kategori-btn').forEach(btn => {
    btn.onclick = async (e) => {
        e.stopPropagation();
        const kategori = btn.dataset.kategori;
        const direction = parseInt(btn.dataset.dir);
        await reorderPrislisteKategori(sheetId, kategoriOrder, kategori, direction);
        reloadPrisliste();
    };
});
```

Til:
```js
inner.querySelectorAll('.reorder-kategori-btn').forEach(btn => {
    btn.onclick = async (e) => {
        e.stopPropagation();
        const kategori = btn.dataset.kategori;
        const direction = parseInt(btn.dataset.dir);

        // Finn kategori-seksjonene (de hvite rundede boksene)
        const currentSection = btn.closest('.bg-white');
        const allSections = [...inner.querySelectorAll(':scope > div > .bg-white')];
        const currentSectionIdx = allSections.indexOf(currentSection);
        const neighborSectionIdx = currentSectionIdx + direction;
        if (neighborSectionIdx < 0 || neighborSectionIdx >= allSections.length) return;
        const neighborSection = allSections[neighborSectionIdx];

        disableReorderButtons(inner, '.reorder-kategori-btn');
        await animateSwap(currentSection, neighborSection);

        try {
            await reorderPrislisteKategori(sheetId, kategoriOrder, kategori, direction);
            enableReorderButtons(inner, '.reorder-kategori-btn');
        } catch (err) {
            await animateSwap(neighborSection, currentSection);
            enableReorderButtons(inner, '.reorder-kategori-btn');
            showToast('Kunne ikke endre rekkefølge.', 'error');
        }
    };
});
```

**Step 3: Run tests**

Run: `npx vitest run src/scripts/__tests__/admin-module-prisliste.test.js`

**Step 4: Commit**

Melding: `feat(prisliste): optimistisk reorder med animasjon for kategorier`

---

### Task 4: Galleri — optimistisk reorder

**Files:**
- Modify: `src/scripts/admin-module-bilder.js` (`handleReorder`, linje ~391-405)
- Modify: `src/scripts/__tests__/admin-module-bilder.test.js`

**Step 1: Write failing tests**

Legg til i `describe('handleReorder')`:

```js
it('should optimistically swap DOM elements without full reload', async () => {
    // Assert: loadGalleriListeModule NOT called again after reorder
});

it('should revert and show toast on API error', async () => {
    reorderGalleriItem.mockRejectedValueOnce(new Error('fail'));
    // Assert: DOM reverted, toast shown
});
```

**Step 2: Modify handleReorder**

I `admin-module-bilder.js`, endre `handleReorder` (linje ~391-405).

Merk: Galleri-handleReorder henter items fra API *først* (`getGalleriRaw`). Vi beholder dette for å ha korrekt data, men unngår full reload etterpå.

Fra:
```js
const handleReorder = async (rowIndex, direction) => {
    const items = await getGalleriRaw(SHEET_ID);
    items.sort(/* ... */);
    await reorderGalleriItem(SHEET_ID, items, rowIndex, direction);
    reloadGalleriListe();
};
```

Til:
```js
const handleReorder = async (rowIndex, direction) => {
    const container = document.getElementById('module-inner');
    const currentCard = container?.querySelector(`.admin-card-interactive[data-row="${rowIndex}"]`)
        ?? container?.querySelector(`[data-row="${rowIndex}"]`)?.closest('.admin-card-interactive');
    const allCards = container ? [...container.querySelectorAll('.admin-card-interactive')] : [];
    const currentCardIdx = allCards.indexOf(currentCard);
    const neighborCardIdx = currentCardIdx + direction;
    const neighborCard = allCards[neighborCardIdx];

    if (container) disableReorderButtons(container, '.reorder-btn');

    if (currentCard && neighborCard) {
        await animateSwap(currentCard, neighborCard);
    }

    try {
        const items = await getGalleriRaw(SHEET_ID);
        items.sort((a, b) => {
            const aSpecial = a.type === 'forsidebilde' || a.type === 'fellesbilde';
            const bSpecial = b.type === 'forsidebilde' || b.type === 'fellesbilde';
            if (aSpecial && !bSpecial) return -1;
            if (!aSpecial && bSpecial) return 1;
            if (a.type === 'forsidebilde' && b.type === 'fellesbilde') return -1;
            if (a.type === 'fellesbilde' && b.type === 'forsidebilde') return 1;
            return (a.order ?? 99) - (b.order ?? 99);
        });
        await reorderGalleriItem(SHEET_ID, items, rowIndex, direction);
        if (container) enableReorderButtons(container, '.reorder-btn');
    } catch (err) {
        if (currentCard && neighborCard) {
            await animateSwap(neighborCard, currentCard);
        }
        if (container) enableReorderButtons(container, '.reorder-btn');
        showToast('Kunne ikke endre rekkefølge.', 'error');
    }
};
```

Legg til import:
```js
import { animateSwap, disableReorderButtons, enableReorderButtons } from './admin-reorder.js';
```

**Step 3: Run tests**

Run: `npx vitest run src/scripts/__tests__/admin-module-bilder.test.js`

**Step 4: Commit**

Melding: `feat(galleri): optimistisk reorder med animasjon`

---

### Task 5: Tjenester — optimistisk reorder

**Files:**
- Modify: `src/scripts/admin-module-tjenester.js` (`handleReorder`, linje 220-247)
- Modify: `src/scripts/__tests__/admin-module-tjenester.test.js`

**Step 1: Write failing tests**

Legg til i `describe('reorderTjeneste')`:

```js
it('should optimistically swap DOM cards without full reload', async () => {
    // Assert: reloadTjenester (loadTjenesterModule) NOT called after reorder
});

it('should revert DOM swap and show toast on API error', async () => {
    saveFile.mockRejectedValueOnce(new Error('fail'));
    // Assert: DOM reverted, toast shown
});
```

**Step 2: Modify handleReorder**

I `admin-module-tjenester.js`, endre `handleReorder` (linje 220-247):

Fra:
```js
async function handleReorder(driveId, direction) {
    try {
        const services = await loadAllServices();
        const currentIdx = services.findIndex(s => s.driveId === driveId);
        const neighborIdx = currentIdx + direction;
        if (currentIdx < 0 || neighborIdx < 0 || neighborIdx >= services.length) return;

        const [moved] = services.splice(currentIdx, 1);
        services.splice(neighborIdx, 0, moved);

        await Promise.all(services.map((s, idx) => {
            const frontmatter = { ...s };
            delete frontmatter.driveId;
            delete frontmatter.name;
            delete frontmatter.body;
            frontmatter.priority = idx + 1;
            return saveFile(s.driveId, s.name, stringifyMarkdown(frontmatter, s.body));
        }));

        reloadTjenester();
    } catch (e) {
        console.error('Reorder failed:', e);
        showToast('Kunne ikke sortere tjenesten.', 'error');
    }
}
```

Til:
```js
async function handleReorder(driveId, direction) {
    const container = document.getElementById('module-inner');
    const currentCard = container?.querySelector(`.admin-card-interactive[data-id="${driveId}"]`)
        ?? container?.querySelector(`[data-id="${driveId}"]`)?.closest('.admin-card-interactive');
    const allCards = container ? [...container.querySelectorAll('.admin-card-interactive')] : [];
    const currentCardIdx = allCards.indexOf(currentCard);
    const neighborCardIdx = currentCardIdx + direction;
    const neighborCard = allCards[neighborCardIdx];

    if (container) disableReorderButtons(container, '.reorder-tjeneste-btn');

    if (currentCard && neighborCard) {
        await animateSwap(currentCard, neighborCard);
    }

    try {
        const services = await loadAllServices();
        const currentIdx = services.findIndex(s => s.driveId === driveId);
        const neighborIdx = currentIdx + direction;
        if (currentIdx < 0 || neighborIdx < 0 || neighborIdx >= services.length) {
            // Edge case: revert swap if data doesn't match DOM
            if (currentCard && neighborCard) await animateSwap(neighborCard, currentCard);
            if (container) enableReorderButtons(container, '.reorder-tjeneste-btn');
            return;
        }

        const [moved] = services.splice(currentIdx, 1);
        services.splice(neighborIdx, 0, moved);

        await Promise.all(services.map((s, idx) => {
            const frontmatter = { ...s };
            delete frontmatter.driveId;
            delete frontmatter.name;
            delete frontmatter.body;
            frontmatter.priority = idx + 1;
            return saveFile(s.driveId, s.name, stringifyMarkdown(frontmatter, s.body));
        }));

        if (container) enableReorderButtons(container, '.reorder-tjeneste-btn');
    } catch (e) {
        console.error('Reorder failed:', e);
        if (currentCard && neighborCard) {
            await animateSwap(neighborCard, currentCard);
        }
        if (container) enableReorderButtons(container, '.reorder-tjeneste-btn');
        showToast('Kunne ikke sortere tjenesten.', 'error');
    }
}
```

Legg til import:
```js
import { animateSwap, disableReorderButtons, enableReorderButtons } from './admin-reorder.js';
```

**Step 3: Run tests**

Run: `npx vitest run src/scripts/__tests__/admin-module-tjenester.test.js`

**Step 4: Commit**

Melding: `feat(tjenester): optimistisk reorder med animasjon`

---

### Task 6: Settings — optimistisk reorder

**Files:**
- Modify: `src/scripts/admin-module-settings.js` (reorder-btn handler, linje ~146-157)
- Modify: `src/scripts/__tests__/admin-module-settings.test.js`

**Step 1: Write failing tests**

Legg til i settings-tester:

```js
it('should optimistically swap setting containers on reorder', async () => {
    // Assert: DOM containers swapped
    // Assert: loadSettingsModule NOT called again
});

it('should revert and show toast on API error', async () => {
    reorderSettingItem.mockRejectedValueOnce(new Error('fail'));
    // Assert: reverted, toast shown
});
```

**Step 2: Modify handler**

I `admin-module-settings.js`, endre reorder-btn handler (linje ~146-157):

Fra:
```js
inner.querySelectorAll('.settings-reorder-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx);
        const dir = parseInt(btn.dataset.dir);
        const ok = await reorderSettingItem(SHEET_ID, allSettings, idx, dir);
        if (ok) {
            updateLastFetchedTime(new Date());
            loadSettingsModule();
        }
    });
});
```

Til:
```js
inner.querySelectorAll('.settings-reorder-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx);
        const dir = parseInt(btn.dataset.dir);

        const currentEl = document.getElementById(`setting-container-${idx}`);
        const neighborEl = document.getElementById(`setting-container-${idx + dir}`);
        if (!currentEl || !neighborEl) return;

        disableReorderButtons(inner, '.settings-reorder-btn');
        await animateSwap(currentEl, neighborEl);

        try {
            await reorderSettingItem(SHEET_ID, allSettings, idx, dir);
            updateLastFetchedTime(new Date());
            // Oppdater container-IDs etter swap
            currentEl.id = `setting-container-${idx + dir}`;
            neighborEl.id = `setting-container-${idx}`;
            enableReorderButtons(inner, '.settings-reorder-btn');
        } catch (err) {
            await animateSwap(neighborEl, currentEl);
            enableReorderButtons(inner, '.settings-reorder-btn');
            showToast('Kunne ikke endre rekkefølge.', 'error');
        }
    });
});
```

Legg til import:
```js
import { animateSwap, disableReorderButtons, enableReorderButtons } from './admin-reorder.js';
```

**Step 3: Run tests**

Run: `npx vitest run src/scripts/__tests__/admin-module-settings.test.js`

**Step 4: Commit**

Melding: `feat(settings): optimistisk reorder med animasjon`

---

### Task 7: Oppdater opp/ned-knappenes synlighet etter swap

**Files:**
- Modify: `src/scripts/admin-reorder.js`
- Modify: `src/scripts/__tests__/admin-reorder.test.js`

Etter en swap må vi oppdatere hvilke knapper som er `invisible` (første element skal ikke ha opp-knapp, siste ikke ned-knapp). Legg til en hjelpefunksjon.

**Step 1: Write failing test**

```js
describe('updateReorderButtonVisibility', () => {
    it('should hide up-button on first item and down-button on last item', () => {
        document.body.innerHTML = `
            <div id="list">
                <div class="item">
                    <button data-dir="-1" class="reorder-btn">Up</button>
                    <button data-dir="1" class="reorder-btn">Down</button>
                </div>
                <div class="item">
                    <button data-dir="-1" class="reorder-btn">Up</button>
                    <button data-dir="1" class="reorder-btn">Down</button>
                </div>
                <div class="item">
                    <button data-dir="-1" class="reorder-btn">Up</button>
                    <button data-dir="1" class="reorder-btn">Down</button>
                </div>
            </div>`;
        const items = document.querySelectorAll('.item');
        updateReorderButtonVisibility(items, '.reorder-btn');

        // First: up invisible, down visible
        expect(items[0].querySelector('[data-dir="-1"]').classList.contains('invisible')).toBe(true);
        expect(items[0].querySelector('[data-dir="1"]').classList.contains('invisible')).toBe(false);
        // Middle: both visible
        expect(items[1].querySelector('[data-dir="-1"]').classList.contains('invisible')).toBe(false);
        expect(items[1].querySelector('[data-dir="1"]').classList.contains('invisible')).toBe(false);
        // Last: up visible, down invisible
        expect(items[2].querySelector('[data-dir="-1"]').classList.contains('invisible')).toBe(false);
        expect(items[2].querySelector('[data-dir="1"]').classList.contains('invisible')).toBe(true);
    });
});
```

**Step 2: Implement**

```js
/**
 * Oppdaterer synligheten av opp/ned-knapper basert på posisjon i listen.
 * Første element: skjul opp. Siste element: skjul ned. Resten: vis begge.
 */
export function updateReorderButtonVisibility(items, buttonSelector) {
    const arr = [...items];
    arr.forEach((item, idx) => {
        const upBtn = item.querySelector(`${buttonSelector}[data-dir="-1"]`);
        const downBtn = item.querySelector(`${buttonSelector}[data-dir="1"]`);
        if (upBtn) upBtn.classList.toggle('invisible', idx === 0);
        if (downBtn) downBtn.classList.toggle('invisible', idx === arr.length - 1);
    });
}
```

**Step 3: Integrer i modulene**

Kall `updateReorderButtonVisibility()` etter suksessfull swap i Task 2-6. Legg til i import og kall etter `enableReorderButtons()`.

**Step 4: Run all tests**

Run: `npx vitest run src/scripts/__tests__/admin-reorder.test.js src/scripts/__tests__/admin-module-prisliste.test.js src/scripts/__tests__/admin-module-bilder.test.js src/scripts/__tests__/admin-module-tjenester.test.js src/scripts/__tests__/admin-module-settings.test.js`

**Step 5: Commit**

Melding: `feat: oppdater opp/ned-knappsynlighet etter optimistisk reorder`

---

### Task 8: Coverage og kvalitetssjekk

**Files:** Ingen nye — verifisering av eksisterende

**Step 1: Kjør full kvalitetssjekk**

Run: `npx vitest run --coverage`

Verifiser at alle berørte filer har ≥80% branch coverage:
- `src/scripts/admin-reorder.js`
- `src/scripts/admin-module-prisliste.js`
- `src/scripts/admin-module-bilder.js`
- `src/scripts/admin-module-tjenester.js`
- `src/scripts/admin-module-settings.js`

**Step 2: Skriv manglende tester for å nå 80%**

Fokuser på udekkede brancher — spesielt edge cases som:
- Reorder på første/siste element (boundary)
- Container ikke funnet (null-sjekker)
- Dobbel-klikk mens API pågår (disabled-sjekk)

**Step 3: Kjør build**

Run: `npm run build`
Expected: Ingen feil

**Step 4: Commit**

Melding: `test: dekningsgrad for optimistisk reorder`
