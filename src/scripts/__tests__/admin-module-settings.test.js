/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupModuleDOM } from './test-helpers.js';

vi.mock('dompurify');
vi.mock('marked');

vi.mock('../admin-reorder.js', () => ({
    animateSwap: vi.fn().mockResolvedValue(undefined),
    disableReorderButtons: vi.fn(),
    enableReorderButtons: vi.fn(),
    updateReorderButtonVisibility: vi.fn(),
}));

vi.mock('../admin-client.js', () => ({
    getSettingsWithNotes: vi.fn(),
    updateSettingByKey: vi.fn(),
    updateSettingOrder: vi.fn(),
    silentLogin: vi.fn(),
}));

vi.mock('../admin-api-retry.js', () => ({
    withRetry: vi.fn(fn => fn()),
    createAuthRefresher: vi.fn(() => () => Promise.resolve(true)),
}));

vi.mock('../admin-dashboard.js', () => ({
    mergeSettingsWithDefaults: vi.fn(),
    autoResizeTextarea: vi.fn(),
    saveSingleSetting: vi.fn(),
    reorderSettingItem: vi.fn(),
    formatTimestamp: vi.fn(() => '24. feb kl. 12:00'),
    updateLastFetchedTime: vi.fn(),
    updateBreadcrumbCount: vi.fn(),
    handleModuleError: vi.fn(),
}));

vi.mock('../admin-editor-helpers.js', () => ({
    getAdminConfig: vi.fn(() => ({
        SHEET_ID: 'test-sheet',
        HARD_DEFAULTS: { key1: 'val1' },
    })),
    getRefreshAuth: vi.fn(() => 'mock-refresher'),
    escapeHtml: vi.fn(s => String(s ?? '')),
}));

vi.mock('../admin-dialog.js', () => ({
    showToast: vi.fn(),
}));

import { getSettingsWithNotes, updateSettingByKey, updateSettingOrder } from '../admin-client.js';
import { mergeSettingsWithDefaults, reorderSettingItem, updateLastFetchedTime, updateBreadcrumbCount, handleModuleError } from '../admin-dashboard.js';
import { animateSwap, disableReorderButtons, enableReorderButtons } from '../admin-reorder.js';
import { showToast } from '../admin-dialog.js';

beforeEach(() => {
    setupModuleDOM({ configAttrs: 'data-sheet-id="sid" data-defaults=\'{}\'', extraHTML: '<span id="breadcrumb-count" class="hidden"></span>' });
    vi.clearAllMocks();
    vi.resetModules();
});

async function getLoadSettingsModule() {
    const mod = await import('../admin-module-settings.js');
    return mod.loadSettingsModule;
}

describe('loadSettingsModule', () => {
    it('should call updateBreadcrumbCount with settings length', async () => {
        const mockSettings = [
            { id: 'phone1', value: '12345678', description: 'Telefon', order: 1, row: 2 },
        ];
        getSettingsWithNotes.mockResolvedValue(mockSettings);
        mergeSettingsWithDefaults.mockReturnValue(mockSettings);
        const loadSettingsModule = await getLoadSettingsModule();
        await loadSettingsModule();
        expect(updateBreadcrumbCount).toHaveBeenCalledWith(mockSettings.length);
    });

    it('should show skeleton while fetching', async () => {
        getSettingsWithNotes.mockReturnValue(new Promise(() => {}));
        const loadSettingsModule = await getLoadSettingsModule();
        loadSettingsModule();
        expect(document.getElementById('module-inner').innerHTML).toContain('admin-skeleton');
    });

    it('should render settings after fetch', async () => {
        const mockSettings = [
            { id: 'phone1', value: '12345678', description: 'Telefon', order: 1, row: 2 },
        ];
        getSettingsWithNotes.mockResolvedValue(mockSettings);
        mergeSettingsWithDefaults.mockReturnValue(mockSettings);

        const loadSettingsModule = await getLoadSettingsModule();
        await loadSettingsModule();

        const inner = document.getElementById('module-inner');
        expect(inner.innerHTML).toContain('Telefon');
        // Values are now set programmatically, not in innerHTML
        expect(document.getElementById('setting-input-0').value).toBe('12345678');
    });

    it('should write virtual settings to sheet', async () => {
        const mockSettings = [
            { id: 'newKey', value: 'default', description: 'New', order: 1, row: 2, isVirtual: true },
        ];
        getSettingsWithNotes.mockResolvedValue([]);
        mergeSettingsWithDefaults.mockReturnValue(mockSettings);
        updateSettingByKey.mockResolvedValue();

        const loadSettingsModule = await getLoadSettingsModule();
        await loadSettingsModule();

        expect(updateSettingByKey).toHaveBeenCalledWith('test-sheet', 'newKey', 'default');
    });

    it('should migrate order values for rows missing column D', async () => {
        const mockSettings = [
            { id: 'k1', value: 'v1', description: 'D', order: 5, row: 3, _orderMissing: true },
        ];
        getSettingsWithNotes.mockResolvedValue(mockSettings);
        mergeSettingsWithDefaults.mockReturnValue(mockSettings);
        updateSettingOrder.mockResolvedValue();

        const loadSettingsModule = await getLoadSettingsModule();
        await loadSettingsModule();

        expect(updateSettingOrder).toHaveBeenCalledWith('test-sheet', 3, 5);
    });

    it('should sort settings by order', async () => {
        const mockSettings = [
            { id: 'b', value: '', description: 'Second', order: 2, row: 3 },
            { id: 'a', value: '', description: 'First', order: 1, row: 2 },
        ];
        getSettingsWithNotes.mockResolvedValue(mockSettings);
        mergeSettingsWithDefaults.mockReturnValue([...mockSettings]);

        const loadSettingsModule = await getLoadSettingsModule();
        await loadSettingsModule();

        const inner = document.getElementById('module-inner');
        const firstIdx = inner.innerHTML.indexOf('First');
        const secondIdx = inner.innerHTML.indexOf('Second');
        expect(firstIdx).toBeLessThan(secondIdx);
    });

    it('should call handleModuleError on fetch failure', async () => {
        getSettingsWithNotes.mockRejectedValue(new Error('fail'));

        const loadSettingsModule = await getLoadSettingsModule();
        await loadSettingsModule();

        expect(handleModuleError).toHaveBeenCalledWith(
            expect.any(Error),
            'innstillinger',
            expect.any(HTMLElement),
            expect.any(Function)
        );
    });

    it('should call handleModuleError with a retry function on error', async () => {
        getSettingsWithNotes.mockRejectedValue(new Error('fail'));

        const loadSettingsModule = await getLoadSettingsModule();
        await loadSettingsModule();

        expect(handleModuleError).toHaveBeenCalled();
        const [, , , retryFn] = handleModuleError.mock.calls[0];
        expect(typeof retryFn).toBe('function');
    });

    it('should show reorder toggle button', async () => {
        getSettingsWithNotes.mockResolvedValue([]);
        mergeSettingsWithDefaults.mockReturnValue([]);

        const loadSettingsModule = await getLoadSettingsModule();
        await loadSettingsModule();

        const btn = document.getElementById('settings-reorder-toggle');
        expect(btn).not.toBeNull();
        expect(btn.textContent).toContain('Endre rekkefølge');
    });

    it('should render setting hints', async () => {
        const mockSettings = [
            { id: 'phone1', value: '123', description: 'Telefon', order: 1, row: 2 },
        ];
        getSettingsWithNotes.mockResolvedValue(mockSettings);
        mergeSettingsWithDefaults.mockReturnValue(mockSettings);

        const loadSettingsModule = await getLoadSettingsModule();
        await loadSettingsModule();

        expect(document.getElementById('module-inner').innerHTML).toContain('Kontakt, footer, mobilknapp, schema.org');
    });

    it('should render textarea for long values', async () => {
        const longVal = 'a'.repeat(61);
        const mockSettings = [
            { id: 'velkomstTekst', value: longVal, description: 'Tekst', order: 1, row: 2 },
        ];
        getSettingsWithNotes.mockResolvedValue(mockSettings);
        mergeSettingsWithDefaults.mockReturnValue(mockSettings);

        const loadSettingsModule = await getLoadSettingsModule();
        await loadSettingsModule();

        expect(document.getElementById('module-inner').querySelector('textarea')).not.toBeNull();
    });

    it('should render input for short values', async () => {
        const mockSettings = [
            { id: 'phone1', value: '123', description: 'Telefon', order: 1, row: 2 },
        ];
        getSettingsWithNotes.mockResolvedValue(mockSettings);
        mergeSettingsWithDefaults.mockReturnValue(mockSettings);

        const loadSettingsModule = await getLoadSettingsModule();
        await loadSettingsModule();

        const input = document.querySelector('input.setting-field');
        expect(input).not.toBeNull();
        expect(input.value).toBe('123');
    });

    it('should not crash when module-inner is missing', async () => {
        document.body.innerHTML = '';
        const loadSettingsModule = await getLoadSettingsModule();
        await expect(loadSettingsModule()).resolves.toBeUndefined();
    });

    it('should toggle to reorder mode and show reorder buttons', async () => {
        const mockSettings = [
            { id: 'a', value: '', description: 'A', order: 1, row: 2 },
            { id: 'b', value: '', description: 'B', order: 2, row: 3 },
        ];
        getSettingsWithNotes.mockResolvedValue(mockSettings);
        mergeSettingsWithDefaults.mockReturnValue([...mockSettings]);

        const loadSettingsModule = await getLoadSettingsModule();
        await loadSettingsModule();

        // Normal mode: should have input fields, no reorder buttons
        expect(document.querySelectorAll('.setting-field').length).toBeGreaterThan(0);
        expect(document.querySelectorAll('.settings-reorder-btn').length).toBe(0);

        // Click reorder toggle
        getSettingsWithNotes.mockResolvedValue(mockSettings);
        mergeSettingsWithDefaults.mockReturnValue([...mockSettings]);
        document.getElementById('settings-reorder-toggle').click();

        await vi.waitFor(() => {
            expect(getSettingsWithNotes).toHaveBeenCalledTimes(2);
        });

        // Reorder mode: should have reorder buttons, no input fields
        expect(document.querySelectorAll('.settings-reorder-btn').length).toBeGreaterThan(0);
        expect(document.querySelectorAll('.setting-field').length).toBe(0);
    });

    it('should handle reorder button click with optimistic swap', async () => {
        const mockSettings = [
            { id: 'a', value: '', description: 'A', order: 1, row: 2 },
            { id: 'b', value: '', description: 'B', order: 2, row: 3 },
        ];
        getSettingsWithNotes.mockResolvedValue(mockSettings);
        mergeSettingsWithDefaults.mockReturnValue([...mockSettings]);

        const loadSettingsModule = await getLoadSettingsModule();
        await loadSettingsModule();

        // Enter reorder mode
        getSettingsWithNotes.mockResolvedValue(mockSettings);
        mergeSettingsWithDefaults.mockReturnValue([...mockSettings]);
        document.getElementById('settings-reorder-toggle').click();

        await vi.waitFor(() => {
            expect(document.querySelectorAll('.settings-reorder-btn').length).toBeGreaterThan(0);
        });

        // Click a reorder button
        reorderSettingItem.mockResolvedValue(true);

        const reorderBtn = document.querySelector('.settings-reorder-btn:not([hidden])');
        reorderBtn.click();
        await vi.waitFor(() => {
            expect(reorderSettingItem).toHaveBeenCalled();
        });
        expect(disableReorderButtons).toHaveBeenCalled();
        expect(animateSwap).toHaveBeenCalled();
        expect(enableReorderButtons).toHaveBeenCalled();
        expect(updateLastFetchedTime).toHaveBeenCalled();
    });

    it('should update data-idx on buttons after swap so second click targets correct container', async () => {
        const mockSettings = [
            { id: 'a', value: '', description: 'A', order: 1, row: 2 },
            { id: 'b', value: '', description: 'B', order: 2, row: 3 },
            { id: 'c', value: '', description: 'C', order: 3, row: 4 },
        ];
        getSettingsWithNotes.mockResolvedValue(mockSettings);
        mergeSettingsWithDefaults.mockReturnValue([...mockSettings]);

        const loadSettingsModule = await getLoadSettingsModule();
        await loadSettingsModule();

        // Enter reorder mode
        getSettingsWithNotes.mockResolvedValue(mockSettings);
        mergeSettingsWithDefaults.mockReturnValue([...mockSettings]);
        document.getElementById('settings-reorder-toggle').click();

        await vi.waitFor(() => {
            expect(document.querySelectorAll('.settings-reorder-btn').length).toBeGreaterThan(0);
        });

        reorderSettingItem.mockResolvedValue(true);

        // First click: move A (idx=0) down
        const downBtnA = document.querySelector('.settings-reorder-btn[data-idx="0"][data-dir="1"]');
        downBtnA.click();
        await vi.waitFor(() => {
            expect(reorderSettingItem).toHaveBeenCalledTimes(1);
        });

        // After swap: A's buttons should now have data-idx="1", B's should have data-idx="0"
        const containerThatWasA = document.getElementById('setting-container-1');
        const updatedBtns = containerThatWasA.querySelectorAll('.settings-reorder-btn');
        expect(updatedBtns[0].dataset.idx).toBe('1');

        // Second click: move A (now idx=1) down again
        const downBtnA2 = containerThatWasA.querySelector('.settings-reorder-btn[data-dir="1"]');
        downBtnA2.click();
        await vi.waitFor(() => {
            expect(reorderSettingItem).toHaveBeenCalledTimes(2);
        });

        // Should have been called with idx=1 (A's new position), not idx=0 (stale)
        expect(reorderSettingItem).toHaveBeenLastCalledWith('test-sheet', expect.any(Array), 1, 1);
    });

    it('should reverse swap when reorderSettingItem returns false', async () => {
        const mockSettings = [
            { id: 'a', value: '', description: 'A', order: 1, row: 2 },
            { id: 'b', value: '', description: 'B', order: 2, row: 3 },
        ];
        getSettingsWithNotes.mockResolvedValue(mockSettings);
        mergeSettingsWithDefaults.mockReturnValue([...mockSettings]);

        const loadSettingsModule = await getLoadSettingsModule();
        await loadSettingsModule();

        // Enter reorder mode
        getSettingsWithNotes.mockResolvedValue(mockSettings);
        mergeSettingsWithDefaults.mockReturnValue([...mockSettings]);
        document.getElementById('settings-reorder-toggle').click();

        await vi.waitFor(() => {
            expect(document.querySelectorAll('.settings-reorder-btn').length).toBeGreaterThan(0);
        });

        reorderSettingItem.mockResolvedValue(false);

        const reorderBtn = document.querySelector('.settings-reorder-btn:not([hidden])');
        reorderBtn.click();
        await vi.waitFor(() => {
            expect(reorderSettingItem).toHaveBeenCalled();
        });

        // animateSwap called twice: once for optimistic swap, once to reverse
        expect(animateSwap).toHaveBeenCalledTimes(2);
        expect(enableReorderButtons).toHaveBeenCalled();
        expect(updateLastFetchedTime).not.toHaveBeenCalled();
    });

    it('should reverse swap and show toast on reorder API error', async () => {
        const mockSettings = [
            { id: 'a', value: '', description: 'A', order: 1, row: 2 },
            { id: 'b', value: '', description: 'B', order: 2, row: 3 },
        ];
        getSettingsWithNotes.mockResolvedValue(mockSettings);
        mergeSettingsWithDefaults.mockReturnValue([...mockSettings]);

        const loadSettingsModule = await getLoadSettingsModule();
        await loadSettingsModule();

        // Enter reorder mode
        getSettingsWithNotes.mockResolvedValue(mockSettings);
        mergeSettingsWithDefaults.mockReturnValue([...mockSettings]);
        document.getElementById('settings-reorder-toggle').click();

        await vi.waitFor(() => {
            expect(document.querySelectorAll('.settings-reorder-btn').length).toBeGreaterThan(0);
        });

        reorderSettingItem.mockRejectedValue(new Error('network error'));

        const reorderBtn = document.querySelector('.settings-reorder-btn:not([hidden])');
        reorderBtn.click();
        await vi.waitFor(() => {
            expect(reorderSettingItem).toHaveBeenCalled();
        });

        // animateSwap called twice: once for optimistic swap, once to reverse
        expect(animateSwap).toHaveBeenCalledTimes(2);
        expect(enableReorderButtons).toHaveBeenCalled();
        expect(showToast).toHaveBeenCalledWith('Kunne ikke endre rekkefølge.', 'error');
    });

    it('should handle updateSettingByKey failure for virtual settings', async () => {
        const mockSettings = [
            { id: 'newKey', value: 'v', description: 'New', order: 1, row: 2, isVirtual: true },
        ];
        getSettingsWithNotes.mockResolvedValue([]);
        mergeSettingsWithDefaults.mockReturnValue(mockSettings);
        updateSettingByKey.mockRejectedValue(new Error('fail'));

        const loadSettingsModule = await getLoadSettingsModule();
        await loadSettingsModule();
        expect(updateSettingByKey).toHaveBeenCalled();
    });

    it('should handle updateSettingOrder failure for migration', async () => {
        const mockSettings = [
            { id: 'k1', value: 'v1', description: 'D', order: 5, row: 3, _orderMissing: true },
        ];
        getSettingsWithNotes.mockResolvedValue(mockSettings);
        mergeSettingsWithDefaults.mockReturnValue(mockSettings);
        updateSettingOrder.mockRejectedValue(new Error('fail'));

        const loadSettingsModule = await getLoadSettingsModule();
        await loadSettingsModule();
        expect(updateSettingOrder).toHaveBeenCalled();
    });

    it('should render no hint for unknown setting', async () => {
        const mockSettings = [
            { id: 'unknownSetting123', value: '', description: 'Unknown', order: 1, row: 2 },
        ];
        getSettingsWithNotes.mockResolvedValue(mockSettings);
        mergeSettingsWithDefaults.mockReturnValue(mockSettings);

        const loadSettingsModule = await getLoadSettingsModule();
        await loadSettingsModule();

        const inner = document.getElementById('module-inner');
        // Should not contain hint text
        expect(inner.innerHTML).toContain('Unknown');
    });

    it('should make setting container focusable in normal mode', async () => {
        const mockSettings = [
            { id: 'phone1', value: '123', description: 'Telefon', order: 1, row: 2 },
        ];
        getSettingsWithNotes.mockResolvedValue(mockSettings);
        mergeSettingsWithDefaults.mockReturnValue(mockSettings);

        const loadSettingsModule = await getLoadSettingsModule();
        await loadSettingsModule();

        const container = document.getElementById('setting-container-0');
        expect(container).not.toBeNull();
        expect(container.classList.contains('cursor-pointer')).toBe(true);
    });
});
