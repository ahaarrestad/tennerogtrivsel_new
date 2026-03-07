# Redesign tjenester-seksjonen — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add priority-based sorting, limit frontpage to 6 services with "Se mer"-link, and make the section visible on mobile.

**Architecture:** Add `priority` field to tjenester content schema and markdown files. Modify `Tjenester.astro` to accept a `limit` prop for frontpage use and sort by priority. Add "Se mer"-button when limited. Remove mobile-hiding wrapper in `index.astro`. Update admin editor with priority input.

**Tech Stack:** Astro 5, Tailwind CSS v4, Vitest

---

### Task 1: Add `priority` field to content schema

**Files:**
- Modify: `src/content.config.ts:57-65`

**Step 1: Add priority to schema**

In `src/content.config.ts`, add `priority` to the tjenester schema:

```typescript
schema: z.object({
    id: z.string(),
    title: z.string(),
    ingress: z.string(),
    active: z.boolean().default(true),
    priority: z.number().default(99),
}),
```

**Step 2: Verify build works**

Run: `npx astro build 2>&1 | tail -5`
Expected: Build succeeds (default 99 means existing files without priority still work)

**Step 3: Commit**

```
feat: legg til priority-felt i tjenester-schema
```

---

### Task 2: Add `priority` frontmatter to all existing markdown files

**Files:**
- Modify: all 11 files in `src/content/tjenester/*.md`

**Step 1: Add `priority: 99` to each file's frontmatter**

Add `priority: 99` line to each file's YAML frontmatter block. Example for `bleking.md`:

```yaml
---
id: "bleking"
title: "Bleking"
ingress: "Et hvitt smil er alltid pent..."
priority: 99
---
```

Do this for all 11 files. Use `priority: 99` as default — the site owner can reorder later via admin.

**Step 2: Verify build**

Run: `npx astro build 2>&1 | tail -5`
Expected: Build succeeds

**Step 3: Commit**

```
feat: legg til priority-felt i alle tjeneste-filer
```

---

### Task 3: Sort by priority and add limit/button to Tjenester.astro

**Files:**
- Modify: `src/components/Tjenester.astro`

**Step 1: Update Props interface and sorting**

```astro
---
import {getCollection} from 'astro:content';
import Card from './Card.astro';
import { getSiteSettings } from '../scripts/getSettings';
import { getSectionClasses, type SectionVariant } from '../scripts/sectionVariant';
import SectionHeader from './SectionHeader.astro';
import { slugify } from '../scripts/slugify';

const allServices = await getCollection('tjenester');

// Sort by priority (lowest first), then alphabetically as tiebreaker
const sortedServices = allServices
    .filter(s => s.data.active !== false)
    .sort((a, b) => (a.data.priority ?? 99) - (b.data.priority ?? 99) || a.data.title.localeCompare(b.data.title, 'nb'));

const settings = await getSiteSettings();

interface Props { variant?: SectionVariant; limit?: number }
const { variant = 'white', limit } = Astro.props;
const { sectionBg, headerBg } = getSectionClasses(variant);

const displayServices = limit ? sortedServices.slice(0, limit) : sortedServices;
const hasMore = limit ? sortedServices.length > limit : false;
---
```

**Step 2: Add "Se mer"-button after card grid**

After the closing `</div>` of `card-grid`, add:

```astro
{hasMore && (
    <div class="flex justify-center mt-8">
        <a href="/tjenester" class="btn-secondary">
            Se alle våre tjenester
        </a>
    </div>
)}
```

**Step 3: Verify build**

Run: `npx astro build 2>&1 | tail -5`

**Step 4: Commit**

```
feat: sorter tjenester etter prioritet og vis maks N med se-mer-knapp
```

---

### Task 4: Use limit prop and remove mobile-hiding in index.astro

**Files:**
- Modify: `src/pages/index.astro:26-28`

**Step 1: Replace the hidden wrapper with direct component call**

Change:
```html
<div class="hidden md:block">
    <Tjenester variant={tjenesterVariant} />
</div>
```

To:
```html
<Tjenester variant={tjenesterVariant} limit={6} />
```

**Step 2: Verify build and check output**

Run: `npx astro build 2>&1 | tail -5`

**Step 3: Commit**

```
feat: vis tjenester på mobil med maks 6 kort
```

---

### Task 5: Add priority field to admin editor

**Files:**
- Modify: `src/scripts/admin-module-tjenester.js`
- Test: `src/scripts/__tests__/admin-module-tjenester.test.js`

**Step 1: Write failing test — priority field rendered in editor**

Add to the `editTjeneste` describe block in the test file:

```javascript
it('should render priority input in editor form', async () => {
    getFileContent.mockResolvedValue('raw');
    parseMarkdown.mockReturnValue({
        data: { title: 'Test', ingress: 'Ing', id: 'test', active: true, priority: 5 },
        body: 'Content'
    });

    await window.editTjeneste('id1', 'Test');

    const priorityInput = document.getElementById('edit-priority');
    expect(priorityInput).not.toBeNull();
    expect(priorityInput.type).toBe('number');
    expect(priorityInput.value).toBe('5');
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/scripts/__tests__/admin-module-tjenester.test.js`
Expected: FAIL — `edit-priority` is null

**Step 3: Add priority input to editor HTML**

In `admin-module-tjenester.js`, in the `editTjeneste` function's `inner.innerHTML` template, add after the ingress textarea block:

```html
<div class="flex flex-col gap-2">
    <label class="admin-label">Prioritet (lavere tall = vises først)</label>
    <input type="number" id="edit-priority" min="1" max="99" class="admin-input w-24">
</div>
```

Then after the programmatic value-setting lines, add:

```javascript
document.getElementById('edit-priority').value = data.priority ?? 99;
```

**Step 4: Add priority to buildTjenestePayload**

In the `buildTjenestePayload` function, add `priority` to the frontmatter object:

```javascript
const frontmatter = {
    id: entryId,
    title: title,
    ingress: document.getElementById('edit-ingress').value,
    active: activeVal,
    priority: parseInt(document.getElementById('edit-priority').value, 10) || 99
};
```

**Step 5: Wire auto-save on priority change**

In the auto-save section (after the ingress input listener), add:

```javascript
document.getElementById('edit-priority')?.addEventListener('input', () => autoSaver.trigger());
```

**Step 6: Write test — priority included in save payload**

```javascript
it('should include priority in save payload', async () => {
    getFileContent.mockResolvedValue('raw');
    parseMarkdown.mockReturnValue({
        data: { title: 'Old', ingress: '', id: 'old', active: true, priority: 3 },
        body: 'Body'
    });
    stringifyMarkdown.mockReturnValue('---\n---\n');
    saveFile.mockResolvedValue();

    await window.editTjeneste('id1', 'Old');

    const saveFn = createAutoSaver.mock.calls[0][0];
    await saveFn();

    expect(stringifyMarkdown).toHaveBeenCalledWith(
        expect.objectContaining({ priority: 3 }),
        expect.any(String)
    );
});
```

**Step 7: Write test — priority auto-save triggers on input**

```javascript
it('should auto-save on priority input change', async () => {
    getFileContent.mockResolvedValue('raw');
    parseMarkdown.mockReturnValue({
        data: { title: 'Old', ingress: '', id: 'old', active: true, priority: 5 },
        body: 'Body'
    });
    stringifyMarkdown.mockReturnValue('---\n---\n');
    saveFile.mockResolvedValue();

    await window.editTjeneste('id1', 'Old');

    const autoSaver = createAutoSaver.mock.results[0].value;
    document.getElementById('edit-priority').value = '2';
    document.getElementById('edit-priority').dispatchEvent(new Event('input'));

    expect(autoSaver.trigger).toHaveBeenCalled();
});
```

**Step 8: Write test — default priority for new tjeneste**

```javascript
it('should default priority to 99 for new tjeneste', async () => {
    stringifyMarkdown.mockReturnValue('---\n---\n');
    createFile.mockResolvedValue();

    await window.editTjeneste(null, null);

    const priorityInput = document.getElementById('edit-priority');
    expect(priorityInput.value).toBe('99');
});
```

**Step 9: Run all tests**

Run: `npx vitest run src/scripts/__tests__/admin-module-tjenester.test.js`
Expected: ALL PASS

**Step 10: Run coverage check**

Run: `npx vitest run --coverage src/scripts/__tests__/admin-module-tjenester.test.js`
Expected: Branch coverage >= 80% for `admin-module-tjenester.js`

**Step 11: Commit**

```
feat: legg til prioritet-felt i tjeneste-admin-editor
```

---

### Task 6: Full build and quality gate

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 2: Run build**

Run: `npx astro build`
Expected: Build succeeds

**Step 3: Check coverage for modified files**

Run: `npx vitest run --coverage`
Verify: `admin-module-tjenester.js` >= 80% branch coverage

**Step 4: Update TODO.md**

Mark "Redesign tjenester-seksjonen" as complete and archive.
