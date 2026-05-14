# Endringslogg for admin-panelet — Implementasjonsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Logg alle skriveoperasjoner i admin-panelet til et eget Google Sheets-regneark, med synlig endringslogg-fane i admin-UI-et.

**Architecture:** Eget logg-regneark (ID fra env var `PUBLIC_GOOGLE_ENDRINGSLOGG_ID`). Tilgang sjekkes ved oppstart — skriving blokkeres hvis loggen ikke er skrivbar. Skriveoperasjon utføres alltid før `logAudit`. `logAudit` er asynkron fire-and-forget med synlig toast ved feil.

**Tech Stack:** Vanilla JS (ES modules), Google Sheets API v4 (gapi), Vitest + jsdom, Astro

---

## Filstruktur

| Fil | Endring | Ansvar |
|---|---|---|
| `src/scripts/admin-audit.js` | Ny | `diffObjects`, `getAuditUser`, `logAudit` |
| `src/scripts/admin-sheets.js` | Utvid | `ensureEndringsloggSheet`, `appendAuditEntry` |
| `src/scripts/admin-client.js` | Utvid | Re-eksporter nye sheets-funksjoner |
| `src/scripts/admin-editor-helpers.js` | Utvid | `ENDRINGSLOGG_ID` og `AUDIT_WRITABLE` i `getAdminConfig` |
| `src/scripts/admin-init.js` | Utvid | Audit-tilgangssjekk i `handleAuth`, `openModule` for endringslogg |
| `src/pages/admin/index.astro` | Utvid | `data-endringslogg-id` på `#admin-config`, banner-HTML, endringslogg-kort |
| `.github/workflows/deploy.yml` | Utvid | `PUBLIC_GOOGLE_ENDRINGSLOGG_ID` env var |
| `src/scripts/admin-module-endringslogg.js` | Ny | UI-visning av loggen |
| `src/scripts/admin-module-tannleger.js` | Utvid | `AUDIT_WRITABLE`-sjekk + `logAudit` |
| `src/scripts/admin-module-bilder.js` | Utvid | `AUDIT_WRITABLE`-sjekk + `logAudit` |
| `src/scripts/admin-module-prisliste.js` | Utvid | `AUDIT_WRITABLE`-sjekk + `logAudit` |
| `src/scripts/admin-module-settings.js` | Utvid | `AUDIT_WRITABLE`-sjekk (m/unntak) + `logAudit` |
| `src/scripts/admin-module-meldinger.js` | Utvid | `AUDIT_WRITABLE`-sjekk + `logAudit` |
| `src/scripts/admin-module-kontaktskjema.js` | Utvid | `AUDIT_WRITABLE`-sjekk + `logAudit` |
| `src/scripts/__tests__/admin-audit.test.js` | Ny | Tester for audit-hjelperne |
| `src/scripts/__tests__/admin-sheets.test.js` | Utvid | Tester for nye sheets-funksjoner |
| `src/scripts/__tests__/admin-module-endringslogg.test.js` | Ny | Tester for endringslogg-UI |
| `src/scripts/__tests__/admin-module-tannleger.test.js` | Utvid | Verifiser `logAudit`-kall |
| `src/scripts/__tests__/admin-module-bilder.test.js` | Utvid | Verifiser `logAudit`-kall |
| `src/scripts/__tests__/admin-module-prisliste.test.js` | Utvid | Verifiser `logAudit`-kall |
| `src/scripts/__tests__/admin-module-settings.test.js` | Utvid | Verifiser `logAudit`-kall |
| `src/scripts/__tests__/admin-module-meldinger.test.js` | Utvid | Verifiser `logAudit`-kall |
| `src/scripts/__tests__/admin-module-kontaktskjema.test.js` | Utvid | Verifiser `logAudit`-kall |

---

## Task 1: admin-audit.js — diffObjects, getAuditUser, logAudit

**Files:**
- Create: `src/scripts/admin-audit.js`
- Create: `src/scripts/__tests__/admin-audit.test.js`

- [ ] **Steg 1.1: Skriv feiltestene**

```js
// src/scripts/__tests__/admin-audit.test.js
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../admin-sheets.js', () => ({
    appendAuditEntry: vi.fn().mockResolvedValue(undefined),
    ensureEndringsloggSheet: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../admin-dialog.js', () => ({
    showToast: vi.fn(),
}));

const { diffObjects, getAuditUser, logAudit } = await import('../admin-audit.js');
import { appendAuditEntry } from '../admin-sheets.js';
import { showToast } from '../admin-dialog.js';

describe('diffObjects', () => {
    it('should return empty object when objects are identical', () => {
        expect(diffObjects({ navn: 'Kari', aktiv: true }, { navn: 'Kari', aktiv: true })).toEqual({});
    });
    it('should return diff for changed fields only', () => {
        const result = diffObjects({ navn: 'Kari', tittel: 'Tannlege' }, { navn: 'Kari Holm', tittel: 'Tannlege' });
        expect(result).toEqual({ navn: { fra: 'Kari', til: 'Kari Holm' } });
    });
    it('should handle multiple changed fields', () => {
        const result = diffObjects({ a: 1, b: 2, c: 3 }, { a: 1, b: 99, c: 0 });
        expect(result).toEqual({ b: { fra: 1, til: 99 }, c: { fra: 3, til: 0 } });
    });
    it('should treat null and undefined as equal to empty string', () => {
        expect(diffObjects({ felt: null }, { felt: undefined })).toEqual({});
        expect(diffObjects({ felt: '' }, { felt: null })).toEqual({});
    });
    it('should treat numeric 1 and string "1" as equal', () => {
        expect(diffObjects({ skala: 1 }, { skala: '1' })).toEqual({});
    });
    it('should detect boolean changes', () => {
        const result = diffObjects({ aktiv: false }, { aktiv: true });
        expect(result).toEqual({ aktiv: { fra: false, til: true } });
    });
});

describe('getAuditUser', () => {
    beforeEach(() => sessionStorage.clear());

    it('should return email from sessionStorage token', () => {
        sessionStorage.setItem('admin_google_token', JSON.stringify({
            access_token: 'tok', expiry: Date.now() + 100000,
            user: { email: 'test@example.com', name: 'Test' }
        }));
        expect(getAuditUser()).toBe('test@example.com');
    });
    it('should return "ukjent" when sessionStorage is empty', () => {
        expect(getAuditUser()).toBe('ukjent');
    });
    it('should return "ukjent" when token is malformed', () => {
        sessionStorage.setItem('admin_google_token', 'not-json');
        expect(getAuditUser()).toBe('ukjent');
    });
});

describe('logAudit', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.setItem('admin_google_token', JSON.stringify({
            access_token: 'tok', expiry: Date.now() + 100000,
            user: { email: 'user@example.com' }
        }));
    });

    it('should call appendAuditEntry with correct structure', async () => {
        await logAudit('sheet-123', 'tannleger', 'redigerte', 'Kari Holm', { navn: { fra: 'Kari', til: 'Kari Holm' } });
        expect(appendAuditEntry).toHaveBeenCalledWith('sheet-123', expect.objectContaining({
            bruker: 'user@example.com',
            modul: 'tannleger',
            handling: 'redigerte',
            entitet: 'Kari Holm',
            endringer: JSON.stringify({ navn: { fra: 'Kari', til: 'Kari Holm' } }),
        }));
    });
    it('should silently skip when auditSpreadsheetId is falsy', async () => {
        await logAudit(null, 'tannleger', 'redigerte', 'Kari', {});
        expect(appendAuditEntry).not.toHaveBeenCalled();
    });
    it('should show toast when appendAuditEntry throws', async () => {
        appendAuditEntry.mockRejectedValueOnce(new Error('API error'));
        await logAudit('sheet-123', 'tannleger', 'redigerte', 'Kari', {});
        expect(showToast).toHaveBeenCalledWith(
            expect.stringContaining('Endringen ble lagret, men kunne ikke logges'),
            'warning'
        );
    });
    it('should not throw when appendAuditEntry throws', async () => {
        appendAuditEntry.mockRejectedValueOnce(new Error('API error'));
        await expect(logAudit('sheet-123', 'tannleger', 'redigerte', 'Kari', {})).resolves.toBeUndefined();
    });
});
```

- [ ] **Steg 1.2: Verifiser at testene feiler**

```bash
npx vitest run src/scripts/__tests__/admin-audit.test.js
```
Forventet: FAIL — `admin-audit.js` finnes ikke

- [ ] **Steg 1.3: Implementer admin-audit.js**

```js
// src/scripts/admin-audit.js
import { appendAuditEntry } from './admin-sheets.js';
import { showToast } from './admin-dialog.js';

const normalize = (v) => (v === undefined || v === null) ? '' : String(v);

export function diffObjects(oldObj, newObj) {
    const diff = {};
    const keys = new Set([...Object.keys(oldObj ?? {}), ...Object.keys(newObj ?? {})]);
    for (const key of keys) {
        if (normalize(oldObj?.[key]) !== normalize(newObj?.[key])) {
            diff[key] = { fra: oldObj?.[key], til: newObj?.[key] };
        }
    }
    return diff;
}

export function getAuditUser() {
    try {
        const stored = sessionStorage.getItem('admin_google_token');
        if (!stored) return 'ukjent';
        const { user } = JSON.parse(stored);
        return user?.email || user?.name || 'ukjent';
    } catch {
        return 'ukjent';
    }
}

export async function logAudit(auditSpreadsheetId, modul, handling, entitet, endringer) {
    if (!auditSpreadsheetId) return;
    try {
        await appendAuditEntry(auditSpreadsheetId, {
            tidspunkt: new Date().toISOString(),
            bruker: getAuditUser(),
            modul,
            handling,
            entitet: String(entitet ?? ''),
            endringer: JSON.stringify(endringer),
        });
    } catch (err) {
        console.error('[Audit] Kunne ikke logge endring:', err);
        showToast('Endringen ble lagret, men kunne ikke logges.', 'warning');
    }
}
```

- [ ] **Steg 1.4: Kjør tester**

```bash
npx vitest run src/scripts/__tests__/admin-audit.test.js
```
Forventet: alle PASS

- [ ] **Steg 1.5: Commit**

```bash
git add src/scripts/admin-audit.js src/scripts/__tests__/admin-audit.test.js
git commit -m "feat(audit): legg til admin-audit.js med diffObjects, getAuditUser og logAudit"
```

---

## Task 2: admin-sheets.js — ensureEndringsloggSheet og appendAuditEntry

**Files:**
- Modify: `src/scripts/admin-sheets.js`
- Modify: `src/scripts/admin-client.js`
- Modify: `src/scripts/__tests__/admin-sheets.test.js`

- [ ] **Steg 2.1: Legg til tester i admin-sheets.test.js**

Legg til etter eksisterende tester:

```js
// Legg til i eksisterende describe-blokker etter linje ~200 (etter KontaktSkjema-testene)

const {
    ensureEndringsloggSheet,
    appendAuditEntry,
} = await import('../admin-sheets.js');

describe('ensureEndringsloggSheet', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSheets.spreadsheets.get.mockResolvedValue({
            result: { sheets: [{ properties: { title: 'Endringslogg' } }] }
        });
    });

    it('should not create sheet if it already exists', async () => {
        await ensureEndringsloggSheet(SHEET_ID);
        expect(mockSheets.spreadsheets.batchUpdate).not.toHaveBeenCalled();
    });

    it('should create sheet with correct headers if missing', async () => {
        mockSheets.spreadsheets.get.mockResolvedValueOnce({
            result: { sheets: [] }
        });
        mockSheets.spreadsheets.batchUpdate.mockResolvedValue({});
        mockSheets.spreadsheets.values.update.mockResolvedValue({});

        await ensureEndringsloggSheet(SHEET_ID);

        expect(mockSheets.spreadsheets.batchUpdate).toHaveBeenCalled();
        expect(mockSheets.spreadsheets.values.update).toHaveBeenCalledWith(
            expect.objectContaining({
                resource: { values: [['Tidspunkt', 'Bruker', 'Modul', 'Handling', 'Entitet', 'Endringer']] }
            })
        );
    });
});

describe('appendAuditEntry', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSheets.spreadsheets.get.mockResolvedValue({
            result: { sheets: [{ properties: { title: 'Endringslogg' } }] }
        });
        mockSheets.spreadsheets.values.append.mockResolvedValue({});
    });

    it('should append a row with correct values', async () => {
        const entry = {
            tidspunkt: '2026-05-14T12:00:00.000Z',
            bruker: 'test@example.com',
            modul: 'tannleger',
            handling: 'redigerte',
            entitet: 'Kari Holm',
            endringer: '{"navn":{"fra":"Kari","til":"Kari Holm"}}',
        };

        await appendAuditEntry(SHEET_ID, entry);

        expect(mockSheets.spreadsheets.values.append).toHaveBeenCalledWith(
            expect.objectContaining({
                spreadsheetId: SHEET_ID,
                range: 'Endringslogg!A:F',
                valueInputOption: 'RAW',
                insertDataOption: 'INSERT_ROWS',
                resource: {
                    values: [[
                        '2026-05-14T12:00:00.000Z',
                        'test@example.com',
                        'tannleger',
                        'redigerte',
                        'Kari Holm',
                        '{"navn":{"fra":"Kari","til":"Kari Holm"}}',
                    ]]
                }
            })
        );
    });
});
```

- [ ] **Steg 2.2: Verifiser at testene feiler**

```bash
npx vitest run src/scripts/__tests__/admin-sheets.test.js
```
Forventet: FAIL — `ensureEndringsloggSheet` og `appendAuditEntry` ikke eksportert

- [ ] **Steg 2.3: Legg til funksjoner i admin-sheets.js**

Legg til etter `deleteKontaktTemaRow` (siste eksisterende funksjon):

```js
// --- ENDRINGSLOGG ---

export async function ensureEndringsloggSheet(spreadsheetId) {
    return ensureSheet(spreadsheetId, 'Endringslogg', 'A1:F1',
        ['Tidspunkt', 'Bruker', 'Modul', 'Handling', 'Entitet', 'Endringer']);
}

export async function appendAuditEntry(spreadsheetId, { tidspunkt, bruker, modul, handling, entitet, endringer }) {
    await ensureEndringsloggSheet(spreadsheetId);
    await gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Endringslogg!A:F',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: { values: [[tidspunkt, bruker, modul, handling, entitet, endringer]] },
    });
}

export async function getEndringsloggRaw(spreadsheetId) {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Endringslogg!A:F',
            valueRenderOption: 'UNFORMATTED_VALUE',
        });
        const rows = response.result.values;
        if (!rows || rows.length <= 1) return [];
        return rows.slice(1).map((row, index) => ({
            rowIndex: index + 2,
            tidspunkt: row[0] || '',
            bruker: row[1] || '',
            modul: row[2] || '',
            handling: row[3] || '',
            entitet: row[4] || '',
            endringer: row[5] || '',
        }));
    } catch (err) {
        console.error('[Admin] Kunne ikke hente endringslogg:', err);
        throw err;
    }
}
```

- [ ] **Steg 2.4: Re-eksporter fra admin-client.js**

Ingen endring nødvendig — `admin-client.js` re-eksporterer automatisk alt fra `admin-sheets.js` via `export * from './admin-sheets.js'`.

- [ ] **Steg 2.5: Kjør tester**

```bash
npx vitest run src/scripts/__tests__/admin-sheets.test.js
```
Forventet: alle eksisterende + nye PASS

- [ ] **Steg 2.6: Commit**

```bash
git add src/scripts/admin-sheets.js src/scripts/__tests__/admin-sheets.test.js
git commit -m "feat(audit): legg til ensureEndringsloggSheet, appendAuditEntry og getEndringsloggRaw"
```

---

## Task 3: Tilgangskontroll og konfigurasjon

**Files:**
- Modify: `src/scripts/admin-editor-helpers.js`
- Modify: `src/scripts/admin-init.js`
- Modify: `src/pages/admin/index.astro`
- Modify: `.github/workflows/deploy.yml`

- [ ] **Steg 3.1: Oppdater getAdminConfig i admin-editor-helpers.js**

Finn `getAdminConfig`-funksjonen (linje ~38) og utvid den:

```js
export function getAdminConfig() {
    const configEl = document.getElementById('admin-config');
    return {
        TJENESTER_FOLDER: configEl?.dataset.tjenesterFolder,
        TANNLEGER_FOLDER: configEl?.dataset.tannlegerFolder,
        MELDINGER_FOLDER: configEl?.dataset.meldingerFolder,
        BILDER_FOLDER: configEl?.dataset.bilderFolder,
        SHEET_ID: configEl?.dataset.sheetId,
        ENDRINGSLOGG_ID: configEl?.dataset.endringsloggId || null,
        AUDIT_WRITABLE: configEl?.dataset.auditWritable === '1',
        HARD_DEFAULTS: JSON.parse(configEl?.dataset.defaults || '{}'),
    };
}
```

- [ ] **Steg 3.2: Legg til data-endringslogg-id i index.astro**

Finn `#admin-config`-elementet (linje ~241) og legg til `data-endringslogg-id`:

```astro
const ENDRINGSLOGG_ID = import.meta.env.PUBLIC_GOOGLE_ENDRINGSLOGG_ID;
```

Legg til variabel-deklarasjonen øverst i frontmatter (etter de andre const-ene), og legg til attributtet på `#admin-config`:

```astro
<div id="admin-config"
     data-tjenester-folder={TJENESTER_FOLDER}
     data-tannleger-folder={TANNLEGER_FOLDER}
     data-meldinger-folder={MELDINGER_FOLDER}
     data-bilder-folder={BILDER_FOLDER}
     data-sheet-id={import.meta.env.PUBLIC_GOOGLE_SHEET_ID}
     data-endringslogg-id={ENDRINGSLOGG_ID}
     data-defaults={JSON.stringify(HARD_DEFAULTS)}
     class="hidden"></div>
```

- [ ] **Steg 3.3: Legg til audit-tilgangssjekk i handleAuth (admin-init.js)**

Finn `handleAuth`-funksjonen og oppdater den:

```js
async function handleAuth(userInfo = null) {
    const { SHEET_ID, TJENESTER_FOLDER, MELDINGER_FOLDER, TANNLEGER_FOLDER, BILDER_FOLDER, ENDRINGSLOGG_ID } = getAdminConfig();
    const user = userInfo || getStoredUser();
    if (!user) return;

    const dashboardVisible = !document.getElementById('dashboard')?.classList.contains('hidden');
    if (!dashboardVisible) showState('loading');

    try {
        const [result, auditAccess] = await Promise.all([
            enforceAccessControl({ SHEET_ID, TJENESTER_FOLDER, MELDINGER_FOLDER, TANNLEGER_FOLDER, BILDER_FOLDER }),
            ENDRINGSLOGG_ID ? checkAccess(ENDRINGSLOGG_ID) : Promise.resolve(null),
        ]);

        if (result === false) {
            const emailEl = document.getElementById('no-access-email');
            if (emailEl) emailEl.textContent = user.email || user.name || '';
            showState('no-access');
            return;
        }

        // auditAccess: true = OK, false = konfigurert men ikke tilgjengelig, null = ikke konfigurert
        const auditWritable = auditAccess === true;
        const configEl = document.getElementById('admin-config');
        if (configEl) configEl.dataset.auditWritable = auditWritable ? '1' : '0';

        const banner = document.getElementById('audit-access-banner');
        if (banner) {
            if (auditAccess === null) {
                banner.textContent = 'Endringslogg ikke konfigurert — kontakt administrator. Kun innstillinger kan endres.';
                banner.classList.remove('hidden');
            } else if (auditAccess === false) {
                banner.textContent = 'Du mangler skrivetilgang til endringsloggen — kontakt administrator. Kun innstillinger kan endres.';
                banner.classList.remove('hidden');
            } else {
                banner.classList.add('hidden');
            }
        }

        showState('dashboard');
        window.scrollTo(0, 0);
        updateUIWithUser(user);
        loadDashboardCounts({ SHEET_ID, TJENESTER_FOLDER, MELDINGER_FOLDER });
        showInstallPromptIfEligible();
    } catch (err) {
        console.error("[Admin] Feil under tilgangskontroll:", err);
        showState('no-access');
    }
}
```

Legg til import av `checkAccess` øverst i admin-init.js (det importeres allerede via admin-client.js — sjekk at `checkAccess` er inkludert, ellers legg til):

```js
import { checkAccess } from './admin-client.js';
```

- [ ] **Steg 3.4: Legg til openModule-case for endringslogg i admin-init.js**

Finn `openModule`-funksjonen og legg til case:

```js
else if (id === 'endringslogg') loadEndringsloggModule();
```

Legg til import øverst:

```js
import { loadEndringsloggModule } from './admin-module-endringslogg.js';
```

Legg til kort i `cardModules`-arrayen:

```js
['card-endringslogg', 'endringslogg', 'Endringsloggen'],
```

- [ ] **Steg 3.5: Legg til banner og endringslogg-kort i index.astro**

Legg til banner-div rett etter `<header>`-blokken inne i `#dashboard`:

```html
<div id="audit-access-banner" class="hidden w-full rounded-xl bg-yellow-900/40 border border-yellow-700/50 text-yellow-200 text-sm px-4 py-3 mb-4"></div>
```

Legg til endringslogg-kort sist i `.admin-module-grid`:

```html
<div id="card-endringslogg" class="admin-card-interactive group" role="link" tabindex="0" aria-label="Gå til Endringsloggen">
    <h2 class="admin-subtitle group-hover:text-brand-hover">Endringsloggen</h2>
    <p class="admin-description">Se hvem som har endret hva og når.</p>
    <span class="admin-card-chevron" aria-hidden="true">&rsaquo;</span>
</div>
```

- [ ] **Steg 3.6: Legg til env var i deploy.yml**

Finn alle forekomster av env-blokken i deploy.yml og legg til (det er to steder med samme env-blokk):

```yaml
PUBLIC_GOOGLE_ENDRINGSLOGG_ID: ${{ secrets.GOOGLE_ENDRINGSLOGG_ID }}
```

- [ ] **Steg 3.7: Verifiser build**

```bash
npm run build:ci
```
Forventet: bygger uten feil

- [ ] **Steg 3.8: Commit**

```bash
git add src/scripts/admin-editor-helpers.js src/scripts/admin-init.js src/pages/admin/index.astro .github/workflows/deploy.yml
git commit -m "feat(audit): legg til tilgangskontroll og konfigurasjon for endringslogg"
```

---

## Task 4: admin-module-endringslogg.js — visningsmodul

**Files:**
- Create: `src/scripts/admin-module-endringslogg.js`
- Create: `src/scripts/__tests__/admin-module-endringslogg.test.js`

- [ ] **Steg 4.1: Skriv feiltestene**

```js
// src/scripts/__tests__/admin-module-endringslogg.test.js
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockAutoSaver, mockAdminDialog, setupModuleDOM } from './test-helpers.js';

vi.mock('../admin-client.js', () => ({
    getEndringsloggRaw: vi.fn(),
}));
vi.mock('../admin-dialog.js', () => mockAdminDialog());
vi.mock('../admin-editor-helpers.js', () => ({
    getAdminConfig: vi.fn(() => ({ ENDRINGSLOGG_ID: 'audit-sheet-id' })),
}));

import { getEndringsloggRaw } from '../admin-client.js';
import { loadEndringsloggModule } from '../admin-module-endringslogg.js';

const MOCK_ROWS = [
    { tidspunkt: '2026-05-14T10:00:00Z', bruker: 'a@b.com', modul: 'tannleger', handling: 'redigerte', entitet: 'Kari', endringer: '{}' },
    { tidspunkt: '2026-05-13T09:00:00Z', bruker: 'a@b.com', modul: 'galleri', handling: 'opprettet', entitet: 'Bilde 1', endringer: '{"_ny":{}}' },
    { tidspunkt: '2026-05-12T08:00:00Z', bruker: 'a@b.com', modul: 'tannleger', handling: 'slettet', entitet: 'Ole', endringer: '{}' },
];

beforeEach(() => {
    setupModuleDOM({ configAttrs: 'data-endringslogg-id="audit-sheet-id"' });
    vi.clearAllMocks();
});

describe('loadEndringsloggModule', () => {
    it('should render table rows for all entries', async () => {
        getEndringsloggRaw.mockResolvedValue(MOCK_ROWS);
        await loadEndringsloggModule();
        const inner = document.getElementById('module-inner');
        expect(inner.querySelectorAll('tr[data-modul]').length).toBe(3);
    });

    it('should render entries newest first', async () => {
        getEndringsloggRaw.mockResolvedValue(MOCK_ROWS);
        await loadEndringsloggModule();
        const rows = document.querySelectorAll('tr[data-modul]');
        expect(rows[0].dataset.modul).toBeDefined();
        // Newest: 2026-05-14 should be first
        expect(rows[0].textContent).toContain('Kari');
    });

    it('should filter rows by modul', async () => {
        getEndringsloggRaw.mockResolvedValue(MOCK_ROWS);
        await loadEndringsloggModule();
        const select = document.getElementById('endringslogg-modul-filter');
        select.value = 'galleri';
        select.dispatchEvent(new Event('change'));
        const visibleRows = [...document.querySelectorAll('tr[data-modul]')]
            .filter(r => !r.classList.contains('hidden'));
        expect(visibleRows.length).toBe(1);
        expect(visibleRows[0].dataset.modul).toBe('galleri');
    });

    it('should show "Last eldre" button when more than 100 rows', async () => {
        const manyRows = Array.from({ length: 110 }, (_, i) => ({
            tidspunkt: `2026-05-${String(i+1).padStart(2,'0')}T10:00:00Z`,
            bruker: 'a@b.com', modul: 'tannleger', handling: 'redigerte',
            entitet: `Person ${i}`, endringer: '{}',
        }));
        getEndringsloggRaw.mockResolvedValue(manyRows);
        await loadEndringsloggModule();
        expect(document.getElementById('endringslogg-load-more')).not.toBeNull();
    });

    it('should not show "Last eldre" when 100 or fewer rows', async () => {
        getEndringsloggRaw.mockResolvedValue(MOCK_ROWS);
        await loadEndringsloggModule();
        expect(document.getElementById('endringslogg-load-more')).toBeNull();
    });

    it('should show error message when getEndringsloggRaw throws', async () => {
        getEndringsloggRaw.mockRejectedValue(new Error('403'));
        await loadEndringsloggModule();
        const inner = document.getElementById('module-inner');
        expect(inner.textContent).toContain('Du har ikke lesetilgang til endringsloggen');
    });
});
```

- [ ] **Steg 4.2: Verifiser at testene feiler**

```bash
npx vitest run src/scripts/__tests__/admin-module-endringslogg.test.js
```
Forventet: FAIL — modulen finnes ikke

- [ ] **Steg 4.3: Implementer admin-module-endringslogg.js**

```js
// src/scripts/admin-module-endringslogg.js
import DOMPurify from 'dompurify';
import { getEndringsloggRaw } from './admin-client.js';
import { getAdminConfig, escapeHtml } from './admin-editor-helpers.js';

const PAGE_SIZE = 100;

const HANDLING_COLORS = {
    opprettet: 'text-green-400',
    redigerte: 'text-yellow-400',
    slettet: 'text-red-400',
};

const MODUL_LABELS = {
    tannleger: 'Tannleger',
    galleri: 'Galleri',
    prisliste: 'Prisliste',
    innstillinger: 'Innstillinger',
    meldinger: 'Meldinger',
    kontaktskjema: 'Kontaktskjema',
};

function formatTidspunkt(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatEndringer(raw) {
    if (!raw) return '';
    try {
        const obj = JSON.parse(raw);
        if (obj._ny) return `<em>Opprettet:</em> ${escapeHtml(JSON.stringify(obj._ny))}`;
        if (obj._slettet) return `<em>Slettet:</em> ${escapeHtml(JSON.stringify(obj._slettet))}`;
        return Object.entries(obj).map(([k, v]) =>
            `<span class="font-mono text-xs">${escapeHtml(k)}: <span class="text-red-300">${escapeHtml(String(v.fra))}</span> → <span class="text-green-300">${escapeHtml(String(v.til))}</span></span>`
        ).join('<br>');
    } catch {
        return escapeHtml(raw);
    }
}

function renderTable(rows, offset) {
    const page = rows.slice(0, offset + PAGE_SIZE);
    const hasMore = rows.length > page.length;

    const rowsHtml = page.map(r => `
        <tr data-modul="${escapeHtml(r.modul)}" class="border-b border-admin-border hover:bg-admin-hover transition-colors">
            <td class="px-3 py-2 text-xs text-admin-muted whitespace-nowrap">${formatTidspunkt(r.tidspunkt)}</td>
            <td class="px-3 py-2 text-xs text-admin-muted truncate max-w-[120px]" title="${escapeHtml(r.bruker)}">${escapeHtml(r.bruker)}</td>
            <td class="px-3 py-2"><span class="admin-badge text-xs">${escapeHtml(MODUL_LABELS[r.modul] || r.modul)}</span></td>
            <td class="px-3 py-2 text-xs font-semibold ${HANDLING_COLORS[r.handling] || ''}">${escapeHtml(r.handling)}</td>
            <td class="px-3 py-2 text-xs text-brand">${escapeHtml(r.entitet)}</td>
            <td class="px-3 py-2 text-xs">
                <details><summary class="cursor-pointer text-admin-muted hover:text-brand">Se endringer</summary>
                <div class="mt-2 p-2 bg-admin-surface rounded text-[11px] leading-relaxed space-y-1">${formatEndringer(r.endringer)}</div></details>
            </td>
        </tr>
    `).join('');

    const loadMoreHtml = hasMore
        ? `<button id="endringslogg-load-more" class="mt-4 admin-btn-secondary text-sm">Last eldre</button>`
        : '';

    return `
        <div class="space-y-4">
            <div class="flex items-center gap-3">
                <label class="text-sm text-admin-muted" for="endringslogg-modul-filter">Filtrer modul:</label>
                <select id="endringslogg-modul-filter" class="admin-input text-sm py-1 w-auto">
                    <option value="">Alle</option>
                    ${Object.entries(MODUL_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
                </select>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left text-sm">
                    <thead><tr class="border-b border-brand-border">
                        <th class="px-3 py-2 text-xs font-black uppercase tracking-widest text-admin-muted-light">Tidspunkt</th>
                        <th class="px-3 py-2 text-xs font-black uppercase tracking-widest text-admin-muted-light">Bruker</th>
                        <th class="px-3 py-2 text-xs font-black uppercase tracking-widest text-admin-muted-light">Modul</th>
                        <th class="px-3 py-2 text-xs font-black uppercase tracking-widest text-admin-muted-light">Handling</th>
                        <th class="px-3 py-2 text-xs font-black uppercase tracking-widest text-admin-muted-light">Entitet</th>
                        <th class="px-3 py-2 text-xs font-black uppercase tracking-widest text-admin-muted-light">Endringer</th>
                    </tr></thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
            ${loadMoreHtml}
        </div>
    `;
}

export async function loadEndringsloggModule() {
    const inner = document.getElementById('module-inner');
    if (!inner) return;
    inner.innerHTML = '<p class="text-admin-muted italic text-sm animate-pulse">Laster endringslogg...</p>';

    const { ENDRINGSLOGG_ID } = getAdminConfig();

    try {
        const allRows = await getEndringsloggRaw(ENDRINGSLOGG_ID);
        const sorted = [...allRows].sort((a, b) => b.tidspunkt.localeCompare(a.tidspunkt));
        let currentOffset = 0;

        const render = (filter) => {
            const filtered = filter
                ? sorted.filter(r => r.modul === filter)
                : sorted;
            inner.innerHTML = DOMPurify.sanitize(renderTable(filtered, currentOffset));

            document.getElementById('endringslogg-modul-filter')?.addEventListener('change', (e) => {
                currentOffset = 0;
                render(e.target.value);
            });

            document.getElementById('endringslogg-load-more')?.addEventListener('click', () => {
                currentOffset += PAGE_SIZE;
                render(filter);
            });
        };

        render('');
    } catch (err) {
        console.error('[Admin] Feil ved lasting av endringslogg:', err);
        inner.innerHTML = '<p class="text-admin-muted italic">Du har ikke lesetilgang til endringsloggen, eller loggen er ikke konfigurert.</p>';
    }
}
```

- [ ] **Steg 4.4: Kjør tester**

```bash
npx vitest run src/scripts/__tests__/admin-module-endringslogg.test.js
```
Forventet: alle PASS

- [ ] **Steg 4.5: Commit**

```bash
git add src/scripts/admin-module-endringslogg.js src/scripts/__tests__/admin-module-endringslogg.test.js
git commit -m "feat(audit): legg til admin-module-endringslogg.js med tabell, filter og paginering"
```

---

## Task 5: Instrument admin-module-tannleger.js

**Files:**
- Modify: `src/scripts/admin-module-tannleger.js`
- Modify: `src/scripts/__tests__/admin-module-tannleger.test.js`

- [ ] **Steg 5.1: Legg til test for AUDIT_WRITABLE-sjekk og logAudit-kall**

Finn eksisterende `describe`-blokker og legg til:

```js
// Legg til i eksisterende vi.mock-blokk for admin-client.js:
// deleteTannlegeRowPermanently: vi.fn(),  ← allerede der
// Legg til:

vi.mock('../admin-audit.js', () => ({
    logAudit: vi.fn().mockResolvedValue(undefined),
    diffObjects: vi.fn().mockReturnValue({ navn: { fra: 'Gammel', til: 'Ny' } }),
}));

// I beforeEach, legg til i configAttrs:
// 'data-sheet-id="sid" data-tannleger-folder="taf" data-audit-writable="1" data-endringslogg-id="audit-id"'

import { logAudit } from '../admin-audit.js';

describe('audit-logging i tannleger', () => {
    it('should call logAudit after successful updateTannlegeRow', async () => {
        // Sett opp editTannlege med eksisterende data
        getTannlegerRaw.mockResolvedValue([{ rowIndex: 2, name: 'Kari', title: 'Tannlege', description: '', image: '', active: true, scale: 1, positionX: 50, positionY: 50 }]);
        await reloadTannleger();
        // Klikk rediger-knapp og lagre
        // ... avhengig av DOM-setup
        expect(logAudit).toHaveBeenCalledWith(
            'audit-id', 'tannleger', expect.stringMatching(/opprettet|redigerte|slettet/), expect.any(String), expect.any(Object)
        );
    });

    it('should block save when AUDIT_WRITABLE is false', async () => {
        setupModuleDOM({ configAttrs: 'data-sheet-id="sid" data-tannleger-folder="taf" data-audit-writable="0" data-endringslogg-id="audit-id"' });
        // Forsøk save → skal vise toast, ikke kalle updateTannlegeRow
        // ... test-implementasjon avhengig av eksisterende test-pattern
    });
});
```

- [ ] **Steg 5.2: Legg til import og sjekk i admin-module-tannleger.js**

Legg til øverst i filen:

```js
import { logAudit, diffObjects } from './admin-audit.js';
```

Legg til AUDIT_WRITABLE-sjekk i `deleteTannlege`, rett etter `const { SHEET_ID, TANNLEGER_FOLDER } = getAdminConfig()`:

```js
async function deleteTannlege(rowIndex, name) {
    const { SHEET_ID, TANNLEGER_FOLDER, ENDRINGSLOGG_ID, AUDIT_WRITABLE } = getAdminConfig();
    if (!AUDIT_WRITABLE) {
        showToast('Skriveoperasjoner er deaktivert — endringsloggen er ikke tilgjengelig.', 'error');
        return;
    }
    if (await showConfirm(`Vil du slette «${name}» permanent? Dette kan ikke angres.`, { destructive: true })) {
        try {
            const allRows = await getTannlegerRaw(SHEET_ID);
            const rowData = allRows.find(r => r.rowIndex === rowIndex);
            if (rowData) {
                await backupToSlettetSheet(SHEET_ID, 'tannlege', rowData.name, JSON.stringify(rowData));
            }
            await deleteTannlegeRowPermanently(SHEET_ID, rowIndex);
            await logAudit(ENDRINGSLOGG_ID, 'tannleger', 'slettet', name, rowData ? { _slettet: rowData } : {});
            // ... resten uendret
```

Legg til AUDIT_WRITABLE-sjekk og logAudit i `saveTannlege` (inne i `editTannlege`), rett etter at `updateData` er komponert:

```js
const { SHEET_ID, TANNLEGER_FOLDER, ENDRINGSLOGG_ID, AUDIT_WRITABLE } = getAdminConfig();
if (!AUDIT_WRITABLE) {
    showToast('Skriveoperasjoner er deaktivert — endringsloggen er ikke tilgjengelig.', 'error');
    return;
}
// ... eksisterende: if (rowIndex) { await updateTannlegeRow(...) } else { await addTannlegeRow(...) }
if (rowIndex) {
    await updateTannlegeRow(SHEET_ID, rowIndex, updateData);
    await logAudit(ENDRINGSLOGG_ID, 'tannleger', 'redigerte', updateData.name || String(rowIndex), diffObjects(t, updateData));
} else {
    await addTannlegeRow(SHEET_ID, updateData);
    await logAudit(ENDRINGSLOGG_ID, 'tannleger', 'opprettet', updateData.name || 'Ny tannlege', { _ny: updateData });
    reloadTannleger();
    return;
}
```

- [ ] **Steg 5.3: Kjør tester**

```bash
npx vitest run src/scripts/__tests__/admin-module-tannleger.test.js
```
Forventet: alle eksisterende + nye PASS

- [ ] **Steg 5.4: Commit**

```bash
git add src/scripts/admin-module-tannleger.js src/scripts/__tests__/admin-module-tannleger.test.js
git commit -m "feat(audit): instrument tannleger-modul med AUDIT_WRITABLE-sjekk og logAudit"
```

---

## Task 6: Instrument admin-module-bilder.js

**Files:**
- Modify: `src/scripts/admin-module-bilder.js`
- Modify: `src/scripts/__tests__/admin-module-bilder.test.js`

- [ ] **Steg 6.1: Legg til test**

Legg til i eksisterende testfil:

```js
vi.mock('../admin-audit.js', () => ({
    logAudit: vi.fn().mockResolvedValue(undefined),
    diffObjects: vi.fn().mockReturnValue({}),
}));

import { logAudit } from '../admin-audit.js';

it('should call logAudit after updateGalleriRow', async () => {
    // Sett AUDIT_WRITABLE=1 i configAttrs, trigger en lagre-operasjon
    // Verifiser at logAudit ble kalt med modul='galleri'
    expect(logAudit).toHaveBeenCalledWith(
        expect.any(String), 'galleri', expect.any(String), expect.any(String), expect.any(Object)
    );
});
```

- [ ] **Steg 6.2: Legg til import og AUDIT_WRITABLE-sjekk i admin-module-bilder.js**

Legg til øverst:

```js
import { logAudit, diffObjects } from './admin-audit.js';
```

Finn alle steder der `updateGalleriRow`, `addGalleriRow`, `deleteGalleriRowPermanently`, `setForsideBildeInGalleri` og `setFellesBildeInGalleri` kalles. Legg til AUDIT_WRITABLE-sjekk i save-handler og `logAudit` etter hvert kall:

For `updateGalleriRow` (linje ~216, ~254, ~305) — eksempel:
```js
const { SHEET_ID, ENDRINGSLOGG_ID, AUDIT_WRITABLE } = getAdminConfig();
if (!AUDIT_WRITABLE) {
    showToast('Skriveoperasjoner er deaktivert — endringsloggen er ikke tilgjengelig.', 'error');
    return;
}
const oldImg = allRows.find(r => r.rowIndex === rowIndex);
const newData = getGalleriFormData('galleri');
await updateGalleriRow(SHEET_ID, rowIndex, newData);
await logAudit(ENDRINGSLOGG_ID, 'galleri', 'redigerte', newData.title || String(rowIndex), oldImg ? diffObjects(oldImg, newData) : { _ny: newData });
```

For `setForsideBildeInGalleri` (linje ~203):
```js
await setForsideBildeInGalleri(SHEET_ID, rowIndex);
await logAudit(ENDRINGSLOGG_ID, 'galleri', 'redigerte', img.title || String(rowIndex), { type: { fra: img.type, til: 'forsidebilde' } });
```

For `addGalleriRow` (linje ~474):
```js
await addGalleriRow(SHEET_ID, { ... });
await logAudit(ENDRINGSLOGG_ID, 'galleri', 'opprettet', title || 'Nytt bilde', { _ny: { title, image, active: true } });
```

For `deleteGalleriRowPermanently` (linje ~357):
```js
await deleteGalleriRowPermanently(SHEET_ID, rowIndex);
await logAudit(ENDRINGSLOGG_ID, 'galleri', 'slettet', img?.title || String(rowIndex), img ? { _slettet: img } : {});
```

For toggle `aktiv` (linje ~435):
```js
await updateGalleriRow(SHEET_ID, rowIndex, { ...img, active: newActive });
await logAudit(ENDRINGSLOGG_ID, 'galleri', 'redigerte', img.title, { aktiv: { fra: img.active, til: newActive } });
```

- [ ] **Steg 6.3: Kjør tester**

```bash
npx vitest run src/scripts/__tests__/admin-module-bilder.test.js
```
Forventet: alle eksisterende + nye PASS

- [ ] **Steg 6.4: Commit**

```bash
git add src/scripts/admin-module-bilder.js src/scripts/__tests__/admin-module-bilder.test.js
git commit -m "feat(audit): instrument bilder-modul med AUDIT_WRITABLE-sjekk og logAudit"
```

---

## Task 7: Instrument admin-module-prisliste.js

**Files:**
- Modify: `src/scripts/admin-module-prisliste.js`
- Modify: `src/scripts/__tests__/admin-module-prisliste.test.js`

- [ ] **Steg 7.1: Legg til test**

```js
vi.mock('../admin-audit.js', () => ({
    logAudit: vi.fn().mockResolvedValue(undefined),
    diffObjects: vi.fn().mockReturnValue({}),
}));
import { logAudit } from '../admin-audit.js';

it('should call logAudit after deletePrisRad', async () => {
    showConfirm.mockResolvedValueOnce(true);
    getPrislisteRaw.mockResolvedValue([{ rowIndex: 2, behandling: 'Rens', pris: 500, kategori: 'Basis', sistOppdatert: '', order: 0 }]);
    deletePrislisteRowPermanently.mockResolvedValue(true);
    // Trigger deletePrisRad(2, 'Rens')
    // ...
    expect(logAudit).toHaveBeenCalledWith(expect.any(String), 'prisliste', 'slettet', 'Rens', expect.objectContaining({ _slettet: expect.any(Object) }));
});
```

- [ ] **Steg 7.2: Legg til import og AUDIT_WRITABLE-sjekk i admin-module-prisliste.js**

Legg til øverst:

```js
import { logAudit, diffObjects } from './admin-audit.js';
```

I `deletePrisRad`:
```js
async function deletePrisRad(rowIndex, behandling) {
    const { SHEET_ID, ENDRINGSLOGG_ID, AUDIT_WRITABLE } = getAdminConfig();
    if (!AUDIT_WRITABLE) {
        showToast('Skriveoperasjoner er deaktivert — endringsloggen er ikke tilgjengelig.', 'error');
        return;
    }
    if (await showConfirm(`Vil du slette "${behandling}" permanent?`, { destructive: true })) {
        try {
            const allRows = await getPrislisteRaw(SHEET_ID);
            const rowData = allRows.find(r => r.rowIndex === rowIndex);
            if (rowData) {
                await backupToSlettetSheet(SHEET_ID, 'prisliste', rowData.behandling, JSON.stringify(rowData));
            }
            await deletePrislisteRowPermanently(SHEET_ID, rowIndex);
            await logAudit(ENDRINGSLOGG_ID, 'prisliste', 'slettet', behandling, rowData ? { _slettet: rowData } : {});
            reloadPrisliste();
            showToast('Prisrad slettet.', 'success');
        } catch (e) {
            showToast('Kunne ikke slette prisraden.', 'error');
        }
    }
}
```

I save-handler for `updatePrislisteRow` (finn der `autoSaver`/save-knapp kaller `updatePrislisteRow`):
```js
const { SHEET_ID, ENDRINGSLOGG_ID, AUDIT_WRITABLE } = getAdminConfig();
if (!AUDIT_WRITABLE) {
    showToast('Skriveoperasjoner er deaktivert — endringsloggen er ikke tilgjengelig.', 'error');
    return;
}
// Les gammel data
const allRows = await getPrislisteRaw(SHEET_ID);
const oldRow = allRows.find(r => r.rowIndex === rowIndex);
await updatePrislisteRow(SHEET_ID, rowIndex, newData);
await logAudit(ENDRINGSLOGG_ID, 'prisliste', 'redigerte', newData.behandling || String(rowIndex), oldRow ? diffObjects(oldRow, newData) : { _ny: newData });
```

I `addPrislisteRow`-kall:
```js
await addPrislisteRow(SHEET_ID, newData);
await logAudit(ENDRINGSLOGG_ID, 'prisliste', 'opprettet', newData.behandling || 'Ny behandling', { _ny: newData });
```

- [ ] **Steg 7.3: Kjør tester**

```bash
npx vitest run src/scripts/__tests__/admin-module-prisliste.test.js
```
Forventet: alle eksisterende + nye PASS

- [ ] **Steg 7.4: Commit**

```bash
git add src/scripts/admin-module-prisliste.js src/scripts/__tests__/admin-module-prisliste.test.js
git commit -m "feat(audit): instrument prisliste-modul med AUDIT_WRITABLE-sjekk og logAudit"
```

---

## Task 8: Instrument admin-module-settings.js

**Files:**
- Modify: `src/scripts/admin-module-settings.js`
- Modify: `src/scripts/__tests__/admin-module-settings.test.js` (hvis finnes, ellers sjekk dekningsgrad manuelt)

Merk: Innstillinger-modulen har **unntak** — `endringsloggId`-nøkkelen kan lagres uten at `AUDIT_WRITABLE` er satt.

- [ ] **Steg 8.1: Legg til test**

```js
vi.mock('../admin-audit.js', () => ({
    logAudit: vi.fn().mockResolvedValue(undefined),
    diffObjects: vi.fn().mockReturnValue({}),
}));
import { logAudit } from '../admin-audit.js';

it('should allow saving endringsloggId even when AUDIT_WRITABLE is false', async () => {
    // Setup: AUDIT_WRITABLE=0, forsøk save av endringsloggId-innstilling
    // Forventet: updateSettingByKey kalles, showToast med error IKKE kalt
});
it('should block saving other settings when AUDIT_WRITABLE is false', async () => {
    // Setup: AUDIT_WRITABLE=0, forsøk save av annen innstilling
    // Forventet: showToast med 'error' kalt, updateSettingByKey IKKE kalt
});
```

- [ ] **Steg 8.2: Legg til import og AUDIT_WRITABLE-sjekk i admin-module-settings.js**

Legg til øverst:

```js
import { logAudit } from './admin-audit.js';
```

Finn save-handler for enkeltinnstilling (der `updateSettingByKey` kalles). Legg til sjekk med unntak for `endringsloggId`:

```js
const { SHEET_ID, ENDRINGSLOGG_ID, AUDIT_WRITABLE } = getAdminConfig();
const isAuditConfig = key === 'endringsloggId';
if (!AUDIT_WRITABLE && !isAuditConfig) {
    showToast('Skriveoperasjoner er deaktivert — endringsloggen er ikke tilgjengelig.', 'error');
    return;
}
const oldSettings = await getSettingsWithNotes(SHEET_ID);
const oldSetting = oldSettings.find(s => s.id === key);
await updateSettingByKey(SHEET_ID, key, value);
if (!isAuditConfig) {
    await logAudit(ENDRINGSLOGG_ID, 'innstillinger', 'redigerte', key, { verdi: { fra: oldSetting?.value ?? '', til: value } });
}
```

- [ ] **Steg 8.3: Kjør tester**

```bash
npx vitest run src/scripts/__tests__/admin-module-settings.test.js 2>/dev/null || echo "Ingen testfil — sjekk coverage manuelt"
```

- [ ] **Steg 8.4: Commit**

```bash
git add src/scripts/admin-module-settings.js
git commit -m "feat(audit): instrument settings-modul med AUDIT_WRITABLE-sjekk og logAudit (unntak for endringsloggId)"
```

---

## Task 9: Instrument admin-module-meldinger.js

**Files:**
- Modify: `src/scripts/admin-module-meldinger.js`
- Modify: `src/scripts/__tests__/admin-module-meldinger.test.js`

- [ ] **Steg 9.1: Legg til test**

```js
vi.mock('../admin-audit.js', () => ({
    logAudit: vi.fn().mockResolvedValue(undefined),
    diffObjects: vi.fn().mockReturnValue({}),
}));
import { logAudit } from '../admin-audit.js';

it('should call logAudit after createFile with opprettet', async () => {
    // ... trigger opprett melding
    expect(logAudit).toHaveBeenCalledWith(
        expect.any(String), 'meldinger', 'opprettet', expect.any(String), expect.any(Object)
    );
});
it('should call logAudit after saveFile with redigerte', async () => {
    // ... trigger rediger melding
    expect(logAudit).toHaveBeenCalledWith(
        expect.any(String), 'meldinger', 'redigerte', expect.any(String), expect.any(Object)
    );
});
it('should call logAudit after deleteFile with slettet', async () => {
    // ... trigger slett melding
    expect(logAudit).toHaveBeenCalledWith(
        expect.any(String), 'meldinger', 'slettet', expect.any(String), expect.any(Object)
    );
});
```

- [ ] **Steg 9.2: Legg til import og AUDIT_WRITABLE-sjekk i admin-module-meldinger.js**

Legg til øverst:

```js
import { logAudit, diffObjects } from './admin-audit.js';
```

I `deleteMelding`:
```js
async function deleteMelding(id, name) {
    const { MELDINGER_FOLDER, ENDRINGSLOGG_ID, AUDIT_WRITABLE } = getAdminConfig();
    if (!AUDIT_WRITABLE) {
        showToast('Skriveoperasjoner er deaktivert — endringsloggen er ikke tilgjengelig.', 'error');
        return;
    }
    if (await showConfirm(`Vil du slette «${name}»?`, { destructive: true })) {
        try {
            await deleteFile(id);
            await logAudit(ENDRINGSLOGG_ID, 'meldinger', 'slettet', name, { _slettet: { id, name } });
            // ... resten uendret
```

I save-handler for `saveFile` (rediger) og `createFile` (opprett). For frontmatter-diff:
```js
// Ved redigering — les gammel data først
const raw = await getFileContent(id);
const { data: oldData, body: oldBody } = parseMarkdown(raw);
// ... bruker redigerer
// Ved lagring:
const { data: newData, body: newBody } = { data, body };
const frontmatterDiff = diffObjects(oldData, newData);
if (oldBody !== newBody) frontmatterDiff.innholdEndret = true;
await saveFile(id, fileName, stringifyMarkdown(newData, newBody));
await logAudit(ENDRINGSLOGG_ID, 'meldinger', 'redigerte', newData.title || name, frontmatterDiff);

// Ved opprettelse:
const bodyLen = body.length;
await createFile(MELDINGER_FOLDER, newFileName, stringifyMarkdown(data, body));
await logAudit(ENDRINGSLOGG_ID, 'meldinger', 'opprettet', data.title || newFileName, { _ny: { ...data, innhold: `${bodyLen} tegn` } });
```

- [ ] **Steg 9.3: Kjør tester**

```bash
npx vitest run src/scripts/__tests__/admin-module-meldinger.test.js
```
Forventet: alle eksisterende + nye PASS

- [ ] **Steg 9.4: Commit**

```bash
git add src/scripts/admin-module-meldinger.js src/scripts/__tests__/admin-module-meldinger.test.js
git commit -m "feat(audit): instrument meldinger-modul med AUDIT_WRITABLE-sjekk og logAudit"
```

---

## Task 10: Instrument admin-module-kontaktskjema.js

**Files:**
- Modify: `src/scripts/admin-module-kontaktskjema.js`
- Modify: `src/scripts/__tests__/admin-module-kontaktskjema.test.js`

- [ ] **Steg 10.1: Legg til test**

```js
vi.mock('../admin-audit.js', () => ({
    logAudit: vi.fn().mockResolvedValue(undefined),
}));
import { logAudit } from '../admin-audit.js';

it('should call logAudit after updateKontaktSkjemaField', async () => {
    // trigger en feltoppdatering
    expect(logAudit).toHaveBeenCalledWith(
        expect.any(String), 'kontaktskjema', 'redigerte', expect.any(String), expect.any(Object)
    );
});
it('should block save when AUDIT_WRITABLE is false', async () => {
    setupModuleDOM({ configAttrs: 'data-sheet-id="sid" data-audit-writable="0"' });
    // trigger oppdatering — showToast med 'error' forventes
});
```

- [ ] **Steg 10.2: Legg til import og AUDIT_WRITABLE-sjekk i admin-module-kontaktskjema.js**

Legg til øverst:

```js
import { logAudit } from './admin-audit.js';
```

Finn alle tre `updateKontaktSkjemaField`-kall (linje ~98, ~116, ~127) og wrap dem:

```js
// Eksempel for aktiv-toggle (linje ~98):
const { SHEET_ID, ENDRINGSLOGG_ID, AUDIT_WRITABLE } = getAdminConfig();
if (!AUDIT_WRITABLE) {
    showToast('Skriveoperasjoner er deaktivert — endringsloggen er ikke tilgjengelig.', 'error');
    return;
}
const nyVerdi = aktiv ? 'ja' : 'nei';
await withRetry(() => updateKontaktSkjemaField(SHEET_ID, raw.aktiv.rowIndex, nyVerdi), { refreshAuth: getRefreshAuth() });
await logAudit(ENDRINGSLOGG_ID, 'kontaktskjema', 'redigerte', 'aktiv', { verdi: { fra: aktiv ? 'nei' : 'ja', til: nyVerdi } });

// Eksempel for feltoppdatering (linje ~116):
const { SHEET_ID, ENDRINGSLOGG_ID, AUDIT_WRITABLE } = getAdminConfig();
if (!AUDIT_WRITABLE) {
    showToast('Skriveoperasjoner er deaktivert — endringsloggen er ikke tilgjengelig.', 'error');
    return;
}
const oldValue = el.dataset.originalValue || '';
await withRetry(() => updateKontaktSkjemaField(SHEET_ID, rowIndex, el.value), { refreshAuth: getRefreshAuth() });
await logAudit(ENDRINGSLOGG_ID, 'kontaktskjema', 'redigerte', fieldName, { verdi: { fra: oldValue, til: el.value } });
```

- [ ] **Steg 10.3: Kjør tester**

```bash
npx vitest run src/scripts/__tests__/admin-module-kontaktskjema.test.js
```
Forventet: alle eksisterende + nye PASS

- [ ] **Steg 10.4: Kjør full testsuite**

```bash
npx vitest run
```
Forventet: alle PASS

- [ ] **Steg 10.5: Commit**

```bash
git add src/scripts/admin-module-kontaktskjema.js src/scripts/__tests__/admin-module-kontaktskjema.test.js
git commit -m "feat(audit): instrument kontaktskjema-modul med AUDIT_WRITABLE-sjekk og logAudit"
```

---

## Sluttsjekk

- [ ] Kjør `npm run build:ci` — verifiser ingen build-feil
- [ ] Kjør `npx vitest run --coverage` — verifiser ≥80% branch coverage på alle endrede filer
- [ ] Verifiser at `PUBLIC_GOOGLE_ENDRINGSLOGG_ID` er lagt til som GitHub Secret i repo-settings
