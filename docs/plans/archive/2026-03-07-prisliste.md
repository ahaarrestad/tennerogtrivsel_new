# Prisliste Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a price list page (`/prisliste`) with Google Sheets integration, admin module, and print support.

**Architecture:** New `Prisliste` sheet in Google Sheets synced via `sync-data.js` to `src/content/prisliste.json`. Content collection loads JSON. Public page renders grouped price cards. Admin module provides CRUD via `admin-sheets.js`. Navbar and footer get new links.

**Tech Stack:** Astro 5, Google Sheets API, Tailwind CSS v4, Vitest

---

### Task 1: Content Collection & Sync — Schema

**Files:**
- Modify: `src/content.config.ts:92-95`

**Step 1: Write the content collection definition**

Add `prisliste` collection to `content.config.ts`, following the `galleri`/`tannleger` JSON-loader pattern:

```typescript
const prisliste = defineCollection({
    loader: async () => {
        const filePath = path.join(process.cwd(), 'src/content/prisliste.json');
        if (!fs.existsSync(filePath)) return [];
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        return data.map((item: any, index: number) => ({
            id: `prisliste-${index}`,
            ...item
        }));
    },
    schema: z.object({
        id: z.string(),
        kategori: z.string(),
        behandling: z.string(),
        pris: z.union([z.string(), z.number()]),
    }),
});
```

Update the export:

```typescript
export const collections = {tjenester, meldinger, innstillinger, tannleger, galleri, prisliste};
```

**Step 2: Create empty seed data**

Create `src/content/prisliste.json`:

```json
[]
```

**Step 3: Verify build**

Run: `npm run build:ci`
Expected: Build succeeds with empty prisliste collection.

**Step 4: Commit**

```
feat: legg til prisliste content collection schema
```

---

### Task 2: Sync-data — syncPrisliste()

**Files:**
- Modify: `src/scripts/sync-data.js`
- Test: `src/scripts/__tests__/sync-data.test.js`

**Step 1: Write the failing test**

Add test in `sync-data.test.js` (after existing tests). Import `syncPrisliste` from the module:

```javascript
describe('syncPrisliste', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fs.existsSync.mockReturnValue(true);
        fs.readdirSync.mockReturnValue([]);
    });

    it('should sync prisliste from Sheets to JSON', async () => {
        mockSheets.spreadsheets.values.get.mockResolvedValue({
            data: {
                values: [
                    ['Undersokelser', 'Vanlig undersokelse', 850],
                    ['Undersokelser', 'Rontgen', 350],
                    ['Bleking', 'Hjemmebleking', 2500],
                ]
            }
        });

        await syncPrisliste();

        expect(mockSheets.spreadsheets.values.get).toHaveBeenCalledWith(
            expect.objectContaining({
                range: 'Prisliste!A2:C',
                valueRenderOption: 'UNFORMATTED_VALUE',
            })
        );

        const writeCall = fs.writeFileSync.mock.calls.find(
            c => c[0].includes('prisliste.json')
        );
        expect(writeCall).toBeTruthy();
        const written = JSON.parse(writeCall[1]);
        expect(written).toHaveLength(3);
        expect(written[0]).toEqual({
            kategori: 'Undersokelser',
            behandling: 'Vanlig undersokelse',
            pris: 850,
        });
    });

    it('should handle empty Prisliste sheet', async () => {
        mockSheets.spreadsheets.values.get.mockResolvedValue({
            data: { values: [] }
        });

        await syncPrisliste();

        const writeCall = fs.writeFileSync.mock.calls.find(
            c => c[0].includes('prisliste.json')
        );
        expect(writeCall).toBeTruthy();
        const written = JSON.parse(writeCall[1]);
        expect(written).toEqual([]);
    });

    it('should handle missing Prisliste sheet gracefully', async () => {
        mockSheets.spreadsheets.values.get.mockRejectedValue({
            code: 400,
            message: 'Unable to parse range: Prisliste!A2:C'
        });

        await syncPrisliste();

        const writeCall = fs.writeFileSync.mock.calls.find(
            c => c[0].includes('prisliste.json')
        );
        expect(writeCall).toBeTruthy();
        const written = JSON.parse(writeCall[1]);
        expect(written).toEqual([]);
    });

    it('should preserve string prices like "Fra 500,-"', async () => {
        mockSheets.spreadsheets.values.get.mockResolvedValue({
            data: {
                values: [
                    ['Bleking', 'Hjemmebleking', 'Fra 2500,-'],
                ]
            }
        });

        await syncPrisliste();

        const writeCall = fs.writeFileSync.mock.calls.find(
            c => c[0].includes('prisliste.json')
        );
        const written = JSON.parse(writeCall[1]);
        expect(written[0].pris).toBe('Fra 2500,-');
    });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/scripts/__tests__/sync-data.test.js`
Expected: FAIL — `syncPrisliste` is not exported.

**Step 3: Write the implementation**

Add to `sync-data.js` config paths (in `getConfig()`):

```javascript
prislisteData: path.join(process.cwd(), 'src/content/prisliste.json'),
```

Add `syncPrisliste()` function (after `syncInnstillinger`, before `runSync`):

```javascript
async function syncPrisliste() {
    const config = getConfig();
    const sheets = getSheets();

    console.log('Synkroniserer prisliste...');

    try {
        let res;
        try {
            res = await sheets.spreadsheets.values.get({
                spreadsheetId: config.spreadsheetId,
                range: 'Prisliste!A2:C',
                valueRenderOption: 'UNFORMATTED_VALUE',
            });
        } catch (sheetErr) {
            if (sheetErr.code === 400 || sheetErr.message?.includes('Unable to parse range')) {
                console.log('  Fane "Prisliste" finnes ikke enda. Skriver tom fil.');
                fs.writeFileSync(config.paths.prislisteData, JSON.stringify([]));
                return;
            }
            throw sheetErr;
        }

        const rows = res.data.values || [];
        const prislisteData = rows
            .filter(row => row[0] && row[1])
            .map(([kategori, behandling, pris]) => ({
                kategori: String(kategori).trim(),
                behandling: String(behandling).trim(),
                pris: pris ?? '',
            }));

        fs.writeFileSync(config.paths.prislisteData, JSON.stringify(prislisteData, null, 2));
        console.log(`  Synkroniserte ${prislisteData.length} prisrader.`);
    } catch (err) {
        console.error('Feil under synkronisering av prisliste:', err.message);
        throw err;
    }
}
```

Add `syncPrisliste()` call in `runSync()` after `syncInnstillinger()`:

```javascript
// 2. Synkroniser prisliste fra Sheets
await syncPrisliste();
```

(Bump subsequent comment numbers accordingly.)

Add to the export at the bottom:

```javascript
export { ..., syncPrisliste, ... };
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/scripts/__tests__/sync-data.test.js`
Expected: PASS

**Step 5: Check coverage**

Run: `npx vitest run --coverage src/scripts/__tests__/sync-data.test.js`
Expected: `sync-data.js` >= 80% branch coverage.

**Step 6: Commit**

```
feat: legg til syncPrisliste() i sync-data.js
```

---

### Task 3: Public Page — /prisliste

**Files:**
- Create: `src/pages/prisliste.astro`

**Step 1: Create the page**

```astro
---
import Layout from '../layouts/Layout.astro';
import { getSiteSettings } from '../scripts/getSettings';
import { getCollection } from 'astro:content';

const settings = await getSiteSettings();
const rawPrisliste = await getCollection('prisliste');

// Grupper etter kategori, behold rekkefølge fra Sheets
const kategorier = new Map();
for (const item of rawPrisliste) {
    const key = item.data.kategori;
    if (!kategorier.has(key)) kategorier.set(key, []);
    kategorier.get(key).push(item.data);
}

function formatPris(pris) {
    if (typeof pris === 'number') return `kr ${pris.toLocaleString('nb-NO')}`;
    return String(pris);
}
---
<Layout
    title="Prisliste | Tenner og Trivsel"
    description="Oversikt over priser for tannbehandlinger hos Tenner og Trivsel."
>
    <main class="section-container variant-white">
        <div class="section-content max-w-4xl mx-auto">
            <div class="text-center mb-10">
                <h1 class="h1">Prisliste</h1>
                <p class="text-brand-hover mt-2 max-w-2xl mx-auto">
                    Prisene er veiledende og kan variere etter behandlingens omfang.
                </p>
            </div>

            <div class="flex justify-end mb-6 print:hidden">
                <button id="print-btn" class="btn-secondary text-sm py-2 px-4 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                    Skriv ut
                </button>
            </div>

            {kategorier.size === 0 && (
                <p class="text-center text-brand-hover italic py-12">Prislisten er tom.</p>
            )}

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                {[...kategorier.entries()].map(([kategori, items]) => (
                    <div class="bg-white rounded-2xl border border-brand-border/60 shadow-sm overflow-hidden">
                        <div class="p-5 border-b border-brand-border/60">
                            <h2 class="font-heading font-bold text-xl text-brand">{kategori}</h2>
                        </div>
                        <div class="p-5">
                            {items.map((item, i) => (
                                <div class:list={[
                                    "flex justify-between items-baseline py-3",
                                    i < items.length - 1 && "border-b border-brand-border/60"
                                ]}>
                                    <span class="text-base">{item.behandling}</span>
                                    <span class="font-semibold text-base ml-4 whitespace-nowrap">{formatPris(item.pris)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </main>

    {/* Print header — hidden on screen, shown in print */}
    <div class="hidden print:block text-center mb-8">
        <p class="text-sm text-gray-600">Tenner og Trivsel</p>
        <p class="text-xs text-gray-500 mt-1">Prisliste</p>
    </div>
</Layout>

<style>
    @media print {
        nav, footer, #print-btn, .print\\:hidden { display: none !important; }
        main { padding: 0 !important; }
        .shadow-sm { box-shadow: none !important; }
        .border { border-color: #e5e5e5 !important; }
        .rounded-2xl { border-radius: 0.5rem !important; }
        div[class*="grid"] { display: block !important; }
        div[class*="grid"] > * { break-inside: avoid; margin-bottom: 1rem; }
    }
</style>

<script>
    document.getElementById('print-btn')?.addEventListener('click', () => window.print());
</script>
```

**Step 2: Verify build**

Run: `npm run build:ci`
Expected: Build succeeds, `/prisliste` page generated.

**Step 3: Commit**

```
feat: legg til /prisliste-side med print-stotte
```

---

### Task 4: Navigation — Navbar & Footer

**Files:**
- Modify: `src/components/Navbar.astro:9-15`
- Modify: `src/components/Footer.astro:39-64`

**Step 1: Add Prisliste to Navbar**

In `Navbar.astro`, add after the Tjenester link in `allNavLinks` array (line ~13):

```javascript
{ name: 'Prisliste', href: '/prisliste', mobileHref: '/prisliste' },
```

Full array becomes:
```javascript
const allNavLinks = [
    { name: 'Forside', href: '/', mobileHref: '/' },
    { name: settings.kontaktTittel || 'Kontakt', href: '/#kontakt', mobileHref: '/#kontakt' },
    { name: settings.galleriTittel || 'Klinikken var', href: '/#galleri', mobileHref: '/galleri' },
    { name: settings.tjenesterTittel || 'Tjenester', href: '/#tjenester', mobileHref: '/tjenester' },
    { name: 'Prisliste', href: '/prisliste', mobileHref: '/prisliste' },
    { name: settings.tannlegerTittel || 'Om oss', href: '/#tannleger', mobileHref: '/tannleger' },
];
```

**Step 2: Add Prisliste link to Footer**

In `Footer.astro`, add a link inside kolonne 2 (Kontakt section), after the email block (~line 63):

```astro
<p class="pt-2">
    <a href="/prisliste" class="hover:text-white transition-colors underline">
        Se prisliste
    </a>
</p>
```

**Step 3: Verify build**

Run: `npm run build:ci`
Expected: Build succeeds, navbar and footer show prisliste link.

**Step 4: Commit**

```
feat: legg til prisliste-lenke i navbar og footer
```

---

### Task 5: Admin Sheets — CRUD functions

**Files:**
- Modify: `src/scripts/admin-sheets.js`
- Create: `src/scripts/__tests__/admin-sheets.test.js`

**Step 1: Write the failing tests**

Create `src/scripts/__tests__/admin-sheets.test.js`:

```javascript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock gapi globally
const mockSheets = {
    spreadsheets: {
        values: {
            get: vi.fn(),
            update: vi.fn(),
            append: vi.fn(),
        },
        get: vi.fn(),
        batchUpdate: vi.fn(),
    },
};
const mockDrive = {
    files: { get: vi.fn() },
};

vi.stubGlobal('gapi', {
    client: {
        sheets: mockSheets,
        drive: mockDrive,
    },
});

vi.mock('../image-config.js', () => ({
    parseImageConfig: vi.fn((s, x, y) => ({
        scale: s ?? 1, positionX: x ?? 50, positionY: y ?? 50
    })),
}));

const {
    getPrislisteRaw,
    addPrislisteRow,
    updatePrislisteRow,
    deletePrislisteRowPermanently,
    ensurePrislisteSheet,
} = await import('../admin-sheets.js');

const SHEET_ID = 'test-sheet-id';

describe('Prisliste CRUD', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getPrislisteRaw', () => {
        it('should return parsed prisliste rows', async () => {
            mockSheets.spreadsheets.values.get.mockResolvedValue({
                result: {
                    values: [
                        ['Header1', 'Header2', 'Header3'],
                        ['Undersokelser', 'Vanlig undersokelse', 850],
                        ['Bleking', 'Hjemmebleking', 'Fra 2500,-'],
                    ]
                }
            });

            const result = await getPrislisteRaw(SHEET_ID);
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                rowIndex: 2,
                kategori: 'Undersokelser',
                behandling: 'Vanlig undersokelse',
                pris: 850,
            });
            expect(result[1].pris).toBe('Fra 2500,-');
        });

        it('should return empty array when no data', async () => {
            mockSheets.spreadsheets.values.get.mockResolvedValue({
                result: { values: null }
            });
            const result = await getPrislisteRaw(SHEET_ID);
            expect(result).toEqual([]);
        });
    });

    describe('addPrislisteRow', () => {
        it('should append a new row', async () => {
            mockSheets.spreadsheets.get.mockResolvedValue({
                result: { sheets: [{ properties: { title: 'Prisliste' } }] }
            });
            mockSheets.spreadsheets.values.append.mockResolvedValue({});

            await addPrislisteRow(SHEET_ID, {
                kategori: 'Bleking',
                behandling: 'Hjemmebleking',
                pris: 2500,
            });

            expect(mockSheets.spreadsheets.values.append).toHaveBeenCalledWith(
                expect.objectContaining({
                    range: 'Prisliste!A:C',
                    resource: { values: [['Bleking', 'Hjemmebleking', 2500]] },
                })
            );
        });
    });

    describe('updatePrislisteRow', () => {
        it('should update existing row', async () => {
            mockSheets.spreadsheets.values.update.mockResolvedValue({});

            await updatePrislisteRow(SHEET_ID, 3, {
                kategori: 'Bleking',
                behandling: 'Hjemmebleking',
                pris: 3000,
            });

            expect(mockSheets.spreadsheets.values.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    range: 'Prisliste!A3:C3',
                })
            );
        });
    });

    describe('deletePrislisteRowPermanently', () => {
        it('should delete the row', async () => {
            mockSheets.spreadsheets.get.mockResolvedValue({
                result: {
                    sheets: [{ properties: { title: 'Prisliste', sheetId: 42 } }]
                }
            });
            mockSheets.spreadsheets.batchUpdate.mockResolvedValue({});

            await deletePrislisteRowPermanently(SHEET_ID, 5);

            expect(mockSheets.spreadsheets.batchUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    resource: {
                        requests: [{
                            deleteDimension: {
                                range: {
                                    sheetId: 42,
                                    dimension: 'ROWS',
                                    startIndex: 4,
                                    endIndex: 5,
                                }
                            }
                        }]
                    }
                })
            );
        });
    });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/scripts/__tests__/admin-sheets.test.js`
Expected: FAIL — functions not exported.

**Step 3: Write the implementation**

Add to `src/scripts/admin-sheets.js` (at the end, before any final comments):

```javascript
// --- PRISLISTE CRUD ---

export async function ensurePrislisteSheet(spreadsheetId) {
    const resp = await gapi.client.sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties.title'
    });
    const exists = (resp.result.sheets || []).some(
        s => s.properties.title === 'Prisliste'
    );
    if (!exists) {
        await gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: { requests: [{ addSheet: { properties: { title: 'Prisliste' } } }] }
        });
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId,
            range: 'Prisliste!A1:C1',
            valueInputOption: 'RAW',
            resource: { values: [['Kategori', 'Behandling', 'Pris']] }
        });
        console.log("[Admin] Prisliste-ark opprettet med overskrifter.");
    }
}

export async function getPrislisteRaw(spreadsheetId) {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Prisliste!A:C',
            valueRenderOption: 'UNFORMATTED_VALUE',
        });

        const rows = response.result.values;
        if (!rows || rows.length <= 1) return [];

        return rows.slice(1).map((row, index) => ({
            rowIndex: index + 2,
            kategori: (row[0] || '') + '',
            behandling: (row[1] || '') + '',
            pris: row[2] ?? '',
        }));
    } catch (err) {
        console.error("[Admin] Kunne ikke hente prisliste:", err);
        throw err;
    }
}

export async function updatePrislisteRow(spreadsheetId, rowIndex, data) {
    const values = [data.kategori, data.behandling, data.pris];
    return updateSheetRow(spreadsheetId, 'Prisliste', rowIndex, 'C', values, 'Prisliste');
}

export async function addPrislisteRow(spreadsheetId, data) {
    try {
        await ensurePrislisteSheet(spreadsheetId);

        const values = [[
            data.kategori || '',
            data.behandling || 'Ny behandling',
            data.pris ?? '',
        ]];

        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId,
            range: 'Prisliste!A:C',
            valueInputOption: 'RAW',
            resource: { values }
        });

        console.log("[Admin] Ny prisrad lagt til i Sheets.");
        return true;
    } catch (err) {
        console.error("[Admin] Kunne ikke legge til prisrad:", err);
        throw err;
    }
}

export async function deletePrislisteRowPermanently(spreadsheetId, rowIndex) {
    return deleteSheetRow(spreadsheetId, 'Prisliste', rowIndex);
}
```

**Step 4: Run tests**

Run: `npx vitest run src/scripts/__tests__/admin-sheets.test.js`
Expected: PASS

**Step 5: Check coverage**

Run: `npx vitest run --coverage src/scripts/__tests__/admin-sheets.test.js`
Expected: New functions >= 80% branch coverage.

**Step 6: Commit**

```
feat: legg til prisliste CRUD-funksjoner i admin-sheets.js
```

---

### Task 6: Admin Module — prisliste

**Files:**
- Create: `src/scripts/admin-module-prisliste.js`
- Modify: `src/scripts/admin-init.js:1-14,30-35,98-99,130-136`
- Modify: `src/pages/admin/index.astro:163-164`

**Step 1: Create admin module**

Create `src/scripts/admin-module-prisliste.js`:

```javascript
import DOMPurify from 'dompurify';
import {
    getPrislisteRaw, addPrislisteRow, updatePrislisteRow,
    deletePrislisteRowPermanently, backupToSlettetSheet,
} from './admin-client.js';
import { showToast, showConfirm } from './admin-dialog.js';
import { getAdminConfig, escapeHtml, createAutoSaver, verifySave } from './admin-editor-helpers.js';
import { formatTimestamp } from './admin-dashboard.js';

async function deletePrisRad(rowIndex, behandling) {
    const { SHEET_ID } = getAdminConfig();
    if (await showConfirm(`Vil du slette "${behandling}" permanent?`, { destructive: true })) {
        try {
            const allRows = await getPrislisteRaw(SHEET_ID);
            const rowData = allRows.find(r => r.rowIndex === rowIndex);
            if (rowData) {
                await backupToSlettetSheet(SHEET_ID, 'prisliste', rowData.behandling, JSON.stringify(rowData));
            }
            await deletePrislisteRowPermanently(SHEET_ID, rowIndex);
            reloadPrisliste();
            showToast('Prisrad slettet.', 'success');
        } catch (e) {
            showToast('Kunne ikke slette prisraden.', 'error');
        }
    }
}

async function editPrisRad(rowIndex, data = null) {
    const { SHEET_ID } = getAdminConfig();
    const inner = document.getElementById('module-inner');
    const actions = document.getElementById('module-actions');
    if (!inner || !actions) return;

    actions.innerHTML = '';
    window.setBreadcrumbEditor?.('Redigerer prisrad', reloadPrisliste);

    const p = data || { kategori: '', behandling: '', pris: '' };

    inner.innerHTML = DOMPurify.sanitize(`
        <div class="max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h3 class="text-brand font-black uppercase tracking-tighter mb-6">
                ${rowIndex ? 'Rediger prisrad' : 'Ny prisrad'}
            </h3>
            <div class="space-y-4">
                <div class="admin-field-container">
                    <label class="admin-label">Kategori</label>
                    <input type="text" id="edit-pris-kategori" value="" class="admin-input" placeholder="F.eks. Undersokelser">
                </div>
                <div class="admin-field-container">
                    <label class="admin-label">Behandling</label>
                    <input type="text" id="edit-pris-behandling" value="" class="admin-input" placeholder="F.eks. Vanlig undersokelse">
                </div>
                <div class="admin-field-container">
                    <label class="admin-label">Pris</label>
                    <input type="text" id="edit-pris-pris" value="" class="admin-input" placeholder="F.eks. 850 eller Fra 500,-">
                </div>
            </div>
        </div>
    `);

    // Set values programmatically (safe — no HTML parsing)
    const kategoriInput = document.getElementById('edit-pris-kategori');
    const behandlingInput = document.getElementById('edit-pris-behandling');
    const prisInput = document.getElementById('edit-pris-pris');
    if (kategoriInput) kategoriInput.value = p.kategori || '';
    if (behandlingInput) behandlingInput.value = p.behandling || '';
    if (prisInput) prisInput.value = p.pris !== undefined ? String(p.pris) : '';

    const savePris = async () => {
        const kategori = document.getElementById('edit-pris-kategori')?.value || '';
        const behandling = document.getElementById('edit-pris-behandling')?.value || '';
        const prisStr = document.getElementById('edit-pris-pris')?.value || '';
        const prisNum = parseFloat(prisStr);
        const pris = isNaN(prisNum) ? prisStr : prisNum;

        const updateData = { kategori, behandling, pris };

        if (rowIndex) {
            await updatePrislisteRow(SHEET_ID, rowIndex, updateData);
        } else {
            await addPrislisteRow(SHEET_ID, updateData);
            reloadPrisliste();
            return;
        }
        await verifySave({
            fetchFn: () => getPrislisteRaw(SHEET_ID),
            rowIndex,
            compareField: 'behandling',
            expectedValue: updateData.behandling,
            timestampElId: 'prisliste-last-fetched',
            reloadFn: reloadPrisliste,
        });
    };
    const autoSaver = createAutoSaver(savePris);

    ['edit-pris-kategori', 'edit-pris-behandling', 'edit-pris-pris'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => autoSaver.trigger());
    });
}

function reloadPrisliste() {
    window.clearBreadcrumbEditor?.();
    const { SHEET_ID } = getAdminConfig();
    loadPrislisteList(SHEET_ID);
}

async function loadPrislisteList(sheetId) {
    const inner = document.getElementById('module-inner');
    const actions = document.getElementById('module-actions');
    if (!inner || !actions) return;

    actions.innerHTML = `<button id="btn-new-pris" class="btn-primary text-xs py-2 px-4 shadow-md">+ Legg til prisrad</button>`;
    inner.innerHTML = '<div class="text-admin-muted italic text-sm animate-pulse">Henter prisliste...</div>';

    try {
        const items = await getPrislisteRaw(sheetId);

        const countEl = document.getElementById('breadcrumb-count');
        if (countEl) {
            countEl.textContent = `(${items.length})`;
            countEl.classList.remove('hidden');
        }

        if (items.length === 0) {
            inner.innerHTML = '<div class="text-center py-12 text-admin-muted-light italic">Ingen prisrader funnet.</div>';
        } else {
            // Group by category for display
            const grouped = new Map();
            for (const item of items) {
                if (!grouped.has(item.kategori)) grouped.set(item.kategori, []);
                grouped.get(item.kategori).push(item);
            }

            let html = `<p class="text-xs text-admin-muted-light mb-3">Sist hentet: <span id="prisliste-last-fetched">${formatTimestamp(new Date())}</span></p>`;
            html += '<div class="space-y-6 max-w-4xl">';

            for (const [kategori, rows] of grouped) {
                html += `<div>
                    <h3 class="font-bold text-brand text-sm uppercase tracking-wider mb-2">${escapeHtml(kategori)}</h3>
                    <div class="space-y-2">`;
                for (const item of rows) {
                    const prisDisplay = typeof item.pris === 'number' ? `kr ${item.pris.toLocaleString('nb-NO')}` : escapeHtml(String(item.pris));
                    html += `
                        <div class="admin-card-interactive group flex justify-between items-center gap-4" onclick="this.querySelector('.edit-pris-btn').click()">
                            <div class="flex-grow min-w-0">
                                <span class="font-medium text-brand">${escapeHtml(item.behandling)}</span>
                                <span class="text-admin-muted ml-2">${prisDisplay}</span>
                            </div>
                            <div class="flex gap-2 shrink-0">
                                <button class="edit-pris-btn admin-icon-btn" data-row="${item.rowIndex}" title="Rediger">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                </button>
                                <button class="delete-pris-btn admin-icon-btn" data-row="${item.rowIndex}" data-name="${escapeHtml(item.behandling)}" title="Slett">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                </button>
                            </div>
                        </div>`;
                }
                html += '</div></div>';
            }
            html += '</div>';

            inner.innerHTML = DOMPurify.sanitize(html);

            inner.querySelectorAll('.edit-pris-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const row = parseInt(btn.dataset.row);
                    editPrisRad(row, items.find(i => i.rowIndex === row));
                };
            });
            inner.querySelectorAll('.delete-pris-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    deletePrisRad(parseInt(btn.dataset.row), btn.dataset.name);
                };
            });
        }

        document.getElementById('btn-new-pris').onclick = () => editPrisRad(null, null);
    } catch (e) {
        console.error('[Admin] Prisliste load failed:', e);
        inner.innerHTML = '<div class="text-center py-12 text-red-500">Kunne ikke laste prisliste.</div>';
    }
}

export function initPrislisteModule() {
    window.deletePrisRad = deletePrisRad;
    window.editPrisRad = editPrisRad;
    window.openPrislisteModule = reloadPrisliste;
}

export { reloadPrisliste };
```

**Step 2: Register module in admin-init.js**

Add import (with the other admin module imports):
```javascript
import { initPrislisteModule, reloadPrisliste } from './admin-module-prisliste.js';
```

Add to `openModule()` function:
```javascript
else if (id === 'prisliste') reloadPrisliste();
```

Add to `setup()`:
```javascript
initPrislisteModule();
```

Add to `cardModules` array:
```javascript
['card-prisliste', 'prisliste', 'Prisliste'],
```

**Step 3: Add dashboard card in admin/index.astro**

After the bilder card (line ~163), add:

```html
<div id="card-prisliste" class="admin-card-interactive group" role="link" tabindex="0" aria-label="Ga til prisliste">
    <h2 class="admin-subtitle group-hover:text-brand-hover">Juster prisene</h2>
    <p class="admin-description">Administrer priser for alle behandlinger.</p>
    <span id="card-prisliste-count" class="admin-card-count hidden"></span>
    <span class="admin-card-chevron" aria-hidden="true">&rsaquo;</span>
</div>
```

**Step 4: Verify build**

Run: `npm run build:ci`
Expected: Build succeeds with admin module registered.

**Step 5: Commit**

```
feat: legg til admin-modul for prisliste
```

---

### Task 7: Admin Dashboard Count for Prisliste

**Files:**
- Modify: `src/scripts/admin-dashboard.js`

**Step 1: Check how existing counts are loaded**

Look at `loadDashboardCounts()` in `admin-dashboard.js`. It loads counts for tjenester, meldinger, tannleger, bilder. Add prisliste.

**Step 2: Add prisliste count**

In `loadDashboardCounts()`, add after existing count loads:

```javascript
// Prisliste count
(async () => {
    try {
        const items = await withRetry(() => getPrislisteRaw(SHEET_ID), { refreshAuth: getRefreshAuth() });
        updateCardCount('card-prisliste-count', items.length);
    } catch { /* silent */ }
})();
```

Import `getPrislisteRaw` from `./admin-sheets.js` if not already imported.

**Step 3: Verify build**

Run: `npm run build:ci`
Expected: PASS

**Step 4: Commit**

```
feat: vis prisrader-antall pa admin-dashboard
```

---

### Task 8: Architecture Documentation

**Files:**
- Create: `docs/architecture/prisliste.md`

**Step 1: Write architecture doc**

```markdown
# Prisliste — Arkitektur

## Dataflyt

```
Google Sheets (Prisliste-ark)
    |
    v  sync-data.js: syncPrisliste()
    |  valueRenderOption: 'UNFORMATTED_VALUE'
    v
src/content/prisliste.json
    |
    v  content.config.ts (JSON-loader)
    |
    v
Astro content collection
    |
    +---> /prisliste (public page)
    +---> Admin module (live CRUD via gapi)
```

## Google Sheets

- Ark: `Prisliste`
- Kolonner: `Kategori` (A), `Behandling` (B), `Pris` (C)
- Pris kan vaere tall (850) eller tekst ("Fra 500,-")
- UNFORMATTED_VALUE brukes for a unnga norsk locale-formatering

## Content Collection

- Fil: `src/content/prisliste.json`
- Schema: `{ kategori: string, behandling: string, pris: string | number }`
- Loader: JSON-basert (som tannleger/galleri)

## Public Side

- Rute: `/prisliste`
- Grupperer etter kategori, rendrer som kort-liste
- Print-support via @media print

## Admin

- Modul: `admin-module-prisliste.js`
- CRUD: `admin-sheets.js` (getPrislisteRaw, addPrislisteRow, updatePrislisteRow, deletePrislisteRowPermanently)
- Auto-save med 1.5s debounce
- Sikkerhet: escapeHtml() for listevisning, programmatisk .value for input-felt, DOMPurify.sanitize() for innerHTML

## Berorte filer

- `src/content.config.ts` — prisliste collection
- `src/content/prisliste.json` — synkronisert data
- `src/scripts/sync-data.js` — syncPrisliste()
- `src/pages/prisliste.astro` — publik side
- `src/components/Navbar.astro` — menylenke
- `src/components/Footer.astro` — footer-lenke
- `src/scripts/admin-sheets.js` — CRUD-funksjoner
- `src/scripts/admin-module-prisliste.js` — admin-modul
- `src/scripts/admin-init.js` — modul-registrering
- `src/pages/admin/index.astro` — dashboard-kort
```

**Step 2: Commit**

```
docs: legg til arkitekturdokumentasjon for prisliste
```

---

### Task 9: Update TODO & Archive

**Files:**
- Modify: `TODO.md`
- Modify: `TODO-archive.md`

**Step 1: Mark task complete in TODO.md**

Change `- [ ] **Prisliste — ny side og admin-modul**` to `- [x]` with summary.

**Step 2: Archive**

Move the completed task to `TODO-archive.md`.

**Step 3: Commit**

```
chore: marker prisliste-oppgave som fullfort
```
