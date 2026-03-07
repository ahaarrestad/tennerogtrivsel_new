/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('dompurify', () => ({ default: { sanitize: vi.fn(html => html) } }));

vi.mock('../admin-client.js', () => ({
    getPrislisteRaw: vi.fn(),
    addPrislisteRow: vi.fn(),
    updatePrislisteRow: vi.fn(),
    deletePrislisteRowPermanently: vi.fn(),
    backupToSlettetSheet: vi.fn(),
}));

vi.mock('../admin-dialog.js', () => ({
    showToast: vi.fn(),
    showConfirm: vi.fn().mockResolvedValue(false),
}));

vi.mock('../admin-dashboard.js', () => ({
    formatTimestamp: vi.fn(() => '7. mar kl. 10:00'),
    ICON_ADD: '+',
}));

vi.mock('../admin-editor-helpers.js', () => ({
    getAdminConfig: vi.fn(() => ({ SHEET_ID: 'test-sheet' })),
    escapeHtml: vi.fn(s => String(s ?? '')),
    createAutoSaver: vi.fn((saveFn) => ({ trigger: vi.fn(), cancel: vi.fn(), _saveFn: saveFn })),
    verifySave: vi.fn().mockResolvedValue(undefined),
}));

import {
    getPrislisteRaw, addPrislisteRow, updatePrislisteRow,
    deletePrislisteRowPermanently, backupToSlettetSheet,
} from '../admin-client.js';
import { showConfirm, showToast } from '../admin-dialog.js';
import { createAutoSaver, verifySave } from '../admin-editor-helpers.js';
import { initPrislisteModule, reloadPrisliste } from '../admin-module-prisliste.js';

function setupDOM() {
    document.body.innerHTML = `
        <div id="admin-config" data-sheet-id="test-sheet"></div>
        <div id="module-inner"></div>
        <div id="module-actions"></div>
        <span id="breadcrumb-count" class="hidden"></span>
    `;
}

beforeEach(() => {
    setupDOM();
    vi.clearAllMocks();
});

describe('initPrislisteModule', () => {
    it('should register window globals', () => {
        initPrislisteModule();
        expect(typeof window.deletePrisRad).toBe('function');
        expect(typeof window.editPrisRad).toBe('function');
        expect(typeof window.openPrislisteModule).toBe('function');
    });
});

describe('reloadPrisliste', () => {
    it('should call clearBreadcrumbEditor', () => {
        window.clearBreadcrumbEditor = vi.fn();
        getPrislisteRaw.mockResolvedValue([]);
        reloadPrisliste();
        expect(window.clearBreadcrumbEditor).toHaveBeenCalled();
    });

    it('should load prisliste list', async () => {
        getPrislisteRaw.mockResolvedValue([]);
        reloadPrisliste();
        await new Promise(r => setTimeout(r, 0));
        expect(getPrislisteRaw).toHaveBeenCalledWith('test-sheet');
    });
});

describe('loadPrislisteList', () => {
    it('should show empty state when no items', async () => {
        getPrislisteRaw.mockResolvedValue([]);
        reloadPrisliste();
        await new Promise(r => setTimeout(r, 0));

        const inner = document.getElementById('module-inner');
        expect(inner.innerHTML).toContain('Ingen prisrader funnet');
    });

    it('should display sistOppdatert when present', async () => {
        getPrislisteRaw.mockResolvedValue([
            { rowIndex: 2, kategori: 'Test', behandling: 'A', pris: 100, sistOppdatert: '2026-03-07T12:00:00.000Z' },
        ]);
        reloadPrisliste();
        await new Promise(r => setTimeout(r, 0));

        const inner = document.getElementById('module-inner');
        expect(inner.innerHTML).toContain('Oppdatert:');
    });

    it('should not display sistOppdatert when empty', async () => {
        getPrislisteRaw.mockResolvedValue([
            { rowIndex: 2, kategori: 'Test', behandling: 'A', pris: 100, sistOppdatert: '' },
        ]);
        reloadPrisliste();
        await new Promise(r => setTimeout(r, 0));

        const inner = document.getElementById('module-inner');
        expect(inner.innerHTML).not.toContain('Oppdatert:');
    });

    it('should display items grouped by kategori', async () => {
        getPrislisteRaw.mockResolvedValue([
            { rowIndex: 2, kategori: 'Undersokelser', behandling: 'Vanlig undersokelse', pris: 850 },
            { rowIndex: 3, kategori: 'Undersokelser', behandling: 'Akutt undersokelse', pris: 1200 },
            { rowIndex: 4, kategori: 'Kirurgi', behandling: 'Tannuttrekking', pris: 2500 },
        ]);
        reloadPrisliste();
        await new Promise(r => setTimeout(r, 0));

        const inner = document.getElementById('module-inner');
        expect(inner.innerHTML).toContain('Undersokelser');
        expect(inner.innerHTML).toContain('Kirurgi');
        expect(inner.innerHTML).toContain('Vanlig undersokelse');
        expect(inner.innerHTML).toContain('Tannuttrekking');
    });

    it('should display numeric prices with kr prefix', async () => {
        getPrislisteRaw.mockResolvedValue([
            { rowIndex: 2, kategori: 'Test', behandling: 'Test', pris: 850 },
        ]);
        reloadPrisliste();
        await new Promise(r => setTimeout(r, 0));

        const inner = document.getElementById('module-inner');
        expect(inner.innerHTML).toContain('kr');
    });

    it('should display string prices escaped', async () => {
        getPrislisteRaw.mockResolvedValue([
            { rowIndex: 2, kategori: 'Test', behandling: 'Test', pris: 'Fra 500,-' },
        ]);
        reloadPrisliste();
        await new Promise(r => setTimeout(r, 0));

        const inner = document.getElementById('module-inner');
        expect(inner.innerHTML).toContain('Fra 500,-');
    });

    it('should update breadcrumb count', async () => {
        getPrislisteRaw.mockResolvedValue([
            { rowIndex: 2, kategori: 'Test', behandling: 'A', pris: 100 },
            { rowIndex: 3, kategori: 'Test', behandling: 'B', pris: 200 },
        ]);
        reloadPrisliste();
        await new Promise(r => setTimeout(r, 0));

        const countEl = document.getElementById('breadcrumb-count');
        expect(countEl.textContent).toBe('(2)');
        expect(countEl.classList.contains('hidden')).toBe(false);
    });

    it('should show error on fetch failure', async () => {
        getPrislisteRaw.mockRejectedValue(new Error('API error'));
        reloadPrisliste();
        await new Promise(r => setTimeout(r, 0));

        const inner = document.getElementById('module-inner');
        expect(inner.innerHTML).toContain('Kunne ikke laste prisliste');
    });

    it('should set up new pris button', async () => {
        getPrislisteRaw.mockResolvedValue([]);
        reloadPrisliste();
        await new Promise(r => setTimeout(r, 0));

        const btn = document.getElementById('btn-new-pris');
        expect(btn).not.toBeNull();
    });

    it('should attach edit click handlers', async () => {
        getPrislisteRaw.mockResolvedValue([
            { rowIndex: 2, kategori: 'Test', behandling: 'A', pris: 100 },
        ]);
        reloadPrisliste();
        await new Promise(r => setTimeout(r, 0));

        const editBtn = document.querySelector('.edit-pris-btn');
        expect(editBtn).not.toBeNull();
        expect(editBtn.dataset.row).toBe('2');
    });

    it('should attach delete click handlers', async () => {
        getPrislisteRaw.mockResolvedValue([
            { rowIndex: 2, kategori: 'Test', behandling: 'A', pris: 100 },
        ]);
        reloadPrisliste();
        await new Promise(r => setTimeout(r, 0));

        const deleteBtn = document.querySelector('.delete-pris-btn');
        expect(deleteBtn).not.toBeNull();
        expect(deleteBtn.dataset.row).toBe('2');
        expect(deleteBtn.dataset.name).toBe('A');
    });

    it('should not crash when module-inner is missing', async () => {
        document.body.innerHTML = '';
        getPrislisteRaw.mockResolvedValue([]);
        reloadPrisliste();
        await new Promise(r => setTimeout(r, 0));
        // Should not throw
    });

    it('should open editor when edit button is clicked', async () => {
        getPrislisteRaw.mockResolvedValue([
            { rowIndex: 2, kategori: 'Test', behandling: 'A', pris: 100 },
        ]);
        reloadPrisliste();
        await new Promise(r => setTimeout(r, 0));

        const editBtn = document.querySelector('.edit-pris-btn');
        const event = new Event('click', { bubbles: true });
        event.stopPropagation = vi.fn();
        await editBtn.onclick(event);

        // Editor should now be rendered
        const inner = document.getElementById('module-inner');
        expect(inner.querySelector('#edit-pris-kategori')).not.toBeNull();
    });

    it('should call deletePrisRad when delete button is clicked', async () => {
        showConfirm.mockResolvedValue(false);
        getPrislisteRaw.mockResolvedValue([
            { rowIndex: 2, kategori: 'Test', behandling: 'A', pris: 100 },
        ]);
        reloadPrisliste();
        await new Promise(r => setTimeout(r, 0));

        const deleteBtn = document.querySelector('.delete-pris-btn');
        const event = new Event('click', { bubbles: true });
        event.stopPropagation = vi.fn();
        deleteBtn.onclick(event);

        expect(showConfirm).toHaveBeenCalledWith(expect.stringContaining('A'), expect.any(Object));
    });

    it('should open editor for new row when add button is clicked', async () => {
        getPrislisteRaw.mockResolvedValue([]);
        reloadPrisliste();
        await new Promise(r => setTimeout(r, 0));

        const btn = document.getElementById('btn-new-pris');
        await btn.onclick();

        const inner = document.getElementById('module-inner');
        expect(inner.innerHTML).toContain('Ny prisrad');
    });

    it('should show add button in actions area', async () => {
        getPrislisteRaw.mockResolvedValue([]);
        reloadPrisliste();
        await new Promise(r => setTimeout(r, 0));

        const actions = document.getElementById('module-actions');
        expect(actions.innerHTML).toContain('Legg til prisrad');
    });

    it('should show print button in actions area', async () => {
        getPrislisteRaw.mockResolvedValue([]);
        reloadPrisliste();
        await new Promise(r => setTimeout(r, 0));

        const printBtn = document.getElementById('btn-print-prisliste');
        expect(printBtn).not.toBeNull();
        expect(printBtn.title).toBe('Skriv ut prisliste');
        expect(printBtn.querySelector('svg')).not.toBeNull();
    });

    it('should call printPrisliste when print button is clicked', async () => {
        initPrislisteModule();
        getPrislisteRaw.mockResolvedValue([]);
        reloadPrisliste();
        await new Promise(r => setTimeout(r, 0));

        const mockPopup = { addEventListener: vi.fn(), close: vi.fn() };
        const openSpy = vi.spyOn(window, 'open').mockReturnValue(mockPopup);

        const printBtn = document.getElementById('btn-print-prisliste');
        printBtn.click();

        expect(openSpy).toHaveBeenCalledWith('/prisliste?print=1', 'prisliste-print', expect.stringContaining('width='));
        openSpy.mockRestore();
    });

    it('should open a popup window with correct URL when printing', () => {
        initPrislisteModule();
        const mockPopup = { addEventListener: vi.fn(), close: vi.fn() };
        const openSpy = vi.spyOn(window, 'open').mockReturnValue(mockPopup);

        window.printPrisliste();

        expect(openSpy).toHaveBeenCalledWith(
            '/prisliste?print=1',
            'prisliste-print',
            expect.stringContaining('width=')
        );
        openSpy.mockRestore();
    });

    it('should register afterprint listener to close popup', () => {
        initPrislisteModule();
        const mockPopup = { addEventListener: vi.fn(), close: vi.fn() };
        const openSpy = vi.spyOn(window, 'open').mockReturnValue(mockPopup);

        window.printPrisliste();

        expect(mockPopup.addEventListener).toHaveBeenCalledWith('afterprint', expect.any(Function));

        // Simulate afterprint — should close popup
        const afterprintHandler = mockPopup.addEventListener.mock.calls[0][1];
        afterprintHandler();
        expect(mockPopup.close).toHaveBeenCalled();

        openSpy.mockRestore();
    });

    it('should handle popup blocker gracefully', () => {
        initPrislisteModule();
        const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

        expect(() => window.printPrisliste()).not.toThrow();

        openSpy.mockRestore();
    });
});

describe('deletePrisRad', () => {
    beforeEach(() => {
        initPrislisteModule();
    });

    it('should do nothing when user cancels', async () => {
        showConfirm.mockResolvedValue(false);
        await window.deletePrisRad(2, 'Test behandling');
        expect(deletePrislisteRowPermanently).not.toHaveBeenCalled();
    });

    it('should backup, delete and show toast on confirm', async () => {
        showConfirm.mockResolvedValue(true);
        getPrislisteRaw.mockResolvedValue([
            { rowIndex: 2, behandling: 'Tannrens', kategori: 'Forebyggende', pris: 500 }
        ]);
        backupToSlettetSheet.mockResolvedValue();
        deletePrislisteRowPermanently.mockResolvedValue();

        await window.deletePrisRad(2, 'Tannrens');

        expect(backupToSlettetSheet).toHaveBeenCalledWith('test-sheet', 'prisliste', 'Tannrens', expect.any(String));
        expect(deletePrislisteRowPermanently).toHaveBeenCalledWith('test-sheet', 2);
        expect(showToast).toHaveBeenCalledWith('Prisrad slettet.', 'success');
    });

    it('should delete even when row not found for backup', async () => {
        showConfirm.mockResolvedValue(true);
        getPrislisteRaw.mockResolvedValue([]);
        deletePrislisteRowPermanently.mockResolvedValue();

        await window.deletePrisRad(999, 'Missing');

        expect(backupToSlettetSheet).not.toHaveBeenCalled();
        expect(deletePrislisteRowPermanently).toHaveBeenCalledWith('test-sheet', 999);
    });

    it('should show error toast on failure', async () => {
        showConfirm.mockResolvedValue(true);
        getPrislisteRaw.mockRejectedValue(new Error('fail'));

        await window.deletePrisRad(2, 'Test');

        expect(showToast).toHaveBeenCalledWith('Kunne ikke slette prisraden.', 'error');
    });
});

describe('editPrisRad', () => {
    beforeEach(() => {
        initPrislisteModule();
    });

    it('should render editor for new prisrad (no data)', async () => {
        await window.editPrisRad(null, null);

        const inner = document.getElementById('module-inner');
        expect(inner.querySelector('#edit-pris-kategori')).not.toBeNull();
        expect(inner.querySelector('#edit-pris-behandling')).not.toBeNull();
        expect(inner.querySelector('#edit-pris-pris')).not.toBeNull();
        expect(inner.innerHTML).toContain('Ny prisrad');
    });

    it('should render editor with existing data', async () => {
        await window.editPrisRad(2, {
            kategori: 'Undersokelser',
            behandling: 'Vanlig undersokelse',
            pris: 850,
        });

        const inner = document.getElementById('module-inner');
        expect(inner.querySelector('#edit-pris-kategori').value).toBe('Undersokelser');
        expect(inner.querySelector('#edit-pris-behandling').value).toBe('Vanlig undersokelse');
        expect(inner.querySelector('#edit-pris-pris').value).toBe('850');
        expect(inner.innerHTML).toContain('Rediger prisrad');
    });

    it('should set breadcrumb editor and clear actions', async () => {
        window.setBreadcrumbEditor = vi.fn();
        await window.editPrisRad(null);

        const actions = document.getElementById('module-actions');
        expect(actions.innerHTML).toBe('');
        expect(window.setBreadcrumbEditor).toHaveBeenCalledWith('Redigerer prisrad', expect.any(Function));
    });

    it('should not crash when module-inner is missing', async () => {
        document.body.innerHTML = '';
        await expect(window.editPrisRad(null)).resolves.toBeUndefined();
    });

    it('should show Tilbake button for existing rows', async () => {
        window.clearBreadcrumbEditor = vi.fn();
        getPrislisteRaw.mockResolvedValue([]);
        await window.editPrisRad(2, { kategori: 'K', behandling: 'B', pris: 100 });

        const backBtn = document.querySelector('.admin-btn-cancel');
        expect(backBtn).not.toBeNull();
        expect(backBtn.textContent).toBe('Tilbake til listen');

        backBtn.click();
        expect(window.clearBreadcrumbEditor).toHaveBeenCalled();
    });

    it('should set up autoSaver with input listeners', async () => {
        await window.editPrisRad(2, { kategori: 'K', behandling: 'B', pris: 100 });

        expect(createAutoSaver).toHaveBeenCalledWith(expect.any(Function));

        const autoSaver = createAutoSaver.mock.results[0].value;
        document.getElementById('edit-pris-kategori').dispatchEvent(new Event('input'));
        expect(autoSaver.trigger).toHaveBeenCalled();
    });

    it('should trigger autoSaver on behandling input', async () => {
        await window.editPrisRad(2, { kategori: 'K', behandling: 'B', pris: 100 });

        const autoSaver = createAutoSaver.mock.results[0].value;
        document.getElementById('edit-pris-behandling').dispatchEvent(new Event('input'));
        expect(autoSaver.trigger).toHaveBeenCalledTimes(1);
    });

    it('should trigger autoSaver on pris input', async () => {
        await window.editPrisRad(2, { kategori: 'K', behandling: 'B', pris: 100 });

        const autoSaver = createAutoSaver.mock.results[0].value;
        document.getElementById('edit-pris-pris').dispatchEvent(new Event('input'));
        expect(autoSaver.trigger).toHaveBeenCalledTimes(1);
    });

    it('should call updatePrislisteRow for existing row in saveFn', async () => {
        updatePrislisteRow.mockResolvedValue();

        await window.editPrisRad(2, { kategori: 'K', behandling: 'B', pris: 100 });

        document.getElementById('edit-pris-behandling').value = 'Updated';
        const saveFn = createAutoSaver.mock.calls[0][0];
        await saveFn();

        expect(updatePrislisteRow).toHaveBeenCalledWith('test-sheet', 2, expect.objectContaining({ behandling: 'Updated' }));
    });

    it('should call addPrislisteRow and reload when Opprett button is clicked', async () => {
        window.clearBreadcrumbEditor = vi.fn();
        addPrislisteRow.mockResolvedValue();
        getPrislisteRaw.mockResolvedValueOnce([]) // initial categories fetch
            .mockResolvedValueOnce([]); // reloadPrisliste after create

        await window.editPrisRad(null, null);

        document.getElementById('edit-pris-behandling').value = 'New';
        document.getElementById('edit-pris-pris').value = '500';

        const createBtn = document.querySelector('#new-row-actions .btn-primary');
        expect(createBtn).not.toBeNull();
        await createBtn.click();
        await new Promise(r => setTimeout(r, 0));

        expect(addPrislisteRow).toHaveBeenCalledWith('test-sheet', expect.objectContaining({
            behandling: 'New',
            pris: 500,
        }));
        expect(showToast).toHaveBeenCalledWith('Prisrad opprettet.', 'success');
        expect(window.clearBreadcrumbEditor).toHaveBeenCalled();
    });

    it('should show error toast when Opprett fails', async () => {
        addPrislisteRow.mockRejectedValue(new Error('fail'));
        getPrislisteRaw.mockResolvedValue([]);

        await window.editPrisRad(null, null);

        document.getElementById('edit-pris-behandling').value = 'New';
        const createBtn = document.querySelector('#new-row-actions .btn-primary');
        await createBtn.click();

        expect(showToast).toHaveBeenCalledWith('Kunne ikke opprette prisraden.', 'error');
    });

    it('should not set up autoSaver for new rows', async () => {
        getPrislisteRaw.mockResolvedValue([]);
        await window.editPrisRad(null, null);
        expect(createAutoSaver).not.toHaveBeenCalled();
    });

    it('should navigate back when Avbryt button is clicked', async () => {
        window.clearBreadcrumbEditor = vi.fn();
        getPrislisteRaw.mockResolvedValue([]);
        await window.editPrisRad(null, null);

        const cancelBtn = document.querySelector('#new-row-actions .admin-btn-cancel');
        expect(cancelBtn).not.toBeNull();
        cancelBtn.click();
        expect(window.clearBreadcrumbEditor).toHaveBeenCalled();
    });

    it('should parse numeric pris values', async () => {
        updatePrislisteRow.mockResolvedValue();

        await window.editPrisRad(2, { kategori: 'K', behandling: 'B', pris: 100 });

        document.getElementById('edit-pris-pris').value = '1500';
        const saveFn = createAutoSaver.mock.calls[0][0];
        await saveFn();

        expect(updatePrislisteRow).toHaveBeenCalledWith('test-sheet', 2, expect.objectContaining({ pris: 1500 }));
    });

    it('should keep string pris values that are not numeric', async () => {
        updatePrislisteRow.mockResolvedValue();

        await window.editPrisRad(2, { kategori: 'K', behandling: 'B', pris: 'Fra 500,-' });

        document.getElementById('edit-pris-pris').value = 'Fra 500,-';
        const saveFn = createAutoSaver.mock.calls[0][0];
        await saveFn();

        expect(updatePrislisteRow).toHaveBeenCalledWith('test-sheet', 2, expect.objectContaining({ pris: 'Fra 500,-' }));
    });

    it('should call verifySave with correct args after update', async () => {
        updatePrislisteRow.mockResolvedValue();

        await window.editPrisRad(2, { kategori: 'K', behandling: 'B', pris: 100 });

        document.getElementById('edit-pris-behandling').value = 'Updated';
        const saveFn = createAutoSaver.mock.calls[0][0];
        await saveFn();

        expect(verifySave).toHaveBeenCalledWith(expect.objectContaining({
            rowIndex: 2,
            compareField: 'behandling',
            expectedValue: 'Updated',
            timestampElId: 'prisliste-last-fetched',
        }));
    });

    it('should handle default data when called with no data', async () => {
        await window.editPrisRad(null);

        expect(document.getElementById('edit-pris-kategori').value).toBe('');
        expect(document.getElementById('edit-pris-behandling').value).toBe('');
        expect(document.getElementById('edit-pris-pris').value).toBe('');
    });

    it('should handle pris undefined in data', async () => {
        await window.editPrisRad(2, { kategori: 'K', behandling: 'B' });

        expect(document.getElementById('edit-pris-pris').value).toBe('');
    });

    it('should populate custom dropdown with existing categories on focus', async () => {
        getPrislisteRaw.mockResolvedValue([
            { rowIndex: 2, kategori: 'Undersokelser', behandling: 'A', pris: 100 },
            { rowIndex: 3, kategori: 'Kirurgi', behandling: 'B', pris: 200 },
            { rowIndex: 4, kategori: 'Undersokelser', behandling: 'C', pris: 300 },
        ]);

        await window.editPrisRad(null, null);

        const input = document.getElementById('edit-pris-kategori');
        input.dispatchEvent(new Event('focus'));

        const dropdown = document.querySelector('.admin-category-dropdown');
        expect(dropdown).not.toBeNull();
        const options = dropdown.querySelectorAll('.admin-category-option');
        expect(options).toHaveLength(2);
        const values = [...options].map(o => o.dataset.value);
        expect(values).toContain('Undersokelser');
        expect(values).toContain('Kirurgi');
    });

    it('should show create option for new category text', async () => {
        getPrislisteRaw.mockResolvedValue([
            { rowIndex: 2, kategori: 'Undersokelser', behandling: 'A', pris: 100 },
        ]);

        await window.editPrisRad(null, null);

        const input = document.getElementById('edit-pris-kategori');
        input.value = 'Ny kategori';
        input.dispatchEvent(new Event('input'));

        const dropdown = document.querySelector('.admin-category-dropdown');
        const newOption = dropdown.querySelector('.admin-category-new');
        expect(newOption).not.toBeNull();
        expect(newOption.textContent).toContain('Ny kategori');
    });

    it('should render empty dropdown when getPrislisteRaw fails', async () => {
        getPrislisteRaw.mockRejectedValue(new Error('fail'));

        await window.editPrisRad(null, null);

        const input = document.getElementById('edit-pris-kategori');
        input.dispatchEvent(new Event('focus'));

        const dropdown = document.querySelector('.admin-category-dropdown');
        expect(dropdown).not.toBeNull();
        expect(dropdown.querySelectorAll('.admin-category-option')).toHaveLength(0);
    });

    it('should select category from dropdown on mousedown', async () => {
        getPrislisteRaw.mockResolvedValue([
            { rowIndex: 2, kategori: 'Undersokelser', behandling: 'A', pris: 100 },
        ]);

        await window.editPrisRad(null, null);

        const input = document.getElementById('edit-pris-kategori');
        input.dispatchEvent(new Event('focus'));

        const dropdown = document.querySelector('.admin-category-dropdown');
        const option = dropdown.querySelector('.admin-category-option');
        option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

        expect(input.value).toBe('Undersokelser');
    });

    it('should navigate dropdown with ArrowDown key', async () => {
        getPrislisteRaw.mockResolvedValue([
            { rowIndex: 2, kategori: 'Undersokelser', behandling: 'A', pris: 100 },
            { rowIndex: 3, kategori: 'Kirurgi', behandling: 'B', pris: 200 },
        ]);

        await window.editPrisRad(null, null);

        const input = document.getElementById('edit-pris-kategori');
        input.dispatchEvent(new Event('focus'));

        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        const dropdown = document.querySelector('.admin-category-dropdown');
        const active = dropdown.querySelector('.admin-category-option.active');
        expect(active).not.toBeNull();
    });

    it('should navigate dropdown with ArrowUp key', async () => {
        getPrislisteRaw.mockResolvedValue([
            { rowIndex: 2, kategori: 'Undersokelser', behandling: 'A', pris: 100 },
            { rowIndex: 3, kategori: 'Kirurgi', behandling: 'B', pris: 200 },
        ]);

        await window.editPrisRad(null, null);

        const input = document.getElementById('edit-pris-kategori');
        input.dispatchEvent(new Event('focus'));

        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
        const dropdown = document.querySelector('.admin-category-dropdown');
        const active = dropdown.querySelector('.admin-category-option.active');
        expect(active).not.toBeNull();
    });

    it('should select active option on Enter key', async () => {
        getPrislisteRaw.mockResolvedValue([
            { rowIndex: 2, kategori: 'Undersokelser', behandling: 'A', pris: 100 },
        ]);

        await window.editPrisRad(null, null);

        const input = document.getElementById('edit-pris-kategori');
        input.dispatchEvent(new Event('focus'));
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

        expect(input.value).toBe('Undersokelser');
    });

    it('should close dropdown on Escape key', async () => {
        getPrislisteRaw.mockResolvedValue([
            { rowIndex: 2, kategori: 'Undersokelser', behandling: 'A', pris: 100 },
        ]);

        await window.editPrisRad(null, null);

        const input = document.getElementById('edit-pris-kategori');
        input.dispatchEvent(new Event('focus'));

        const dropdown = document.querySelector('.admin-category-dropdown');
        expect(dropdown.classList.contains('hidden')).toBe(false);

        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(dropdown.classList.contains('hidden')).toBe(true);
    });

    it('should close dropdown on blur', async () => {
        getPrislisteRaw.mockResolvedValue([
            { rowIndex: 2, kategori: 'Undersokelser', behandling: 'A', pris: 100 },
        ]);

        await window.editPrisRad(null, null);

        const input = document.getElementById('edit-pris-kategori');
        input.dispatchEvent(new Event('focus'));

        const dropdown = document.querySelector('.admin-category-dropdown');
        expect(dropdown.classList.contains('hidden')).toBe(false);

        input.dispatchEvent(new Event('blur'));
        expect(dropdown.classList.contains('hidden')).toBe(true);
    });
});
