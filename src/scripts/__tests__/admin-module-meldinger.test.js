/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('dompurify', () => ({ default: { sanitize: vi.fn(html => html) } }));
vi.mock('snarkdown', () => ({ default: vi.fn(text => `<p>${text}</p>`) }));

vi.mock('../admin-client.js', () => ({
    deleteFile: vi.fn(),
    getFileContent: vi.fn(),
    parseMarkdown: vi.fn(),
    stringifyMarkdown: vi.fn(),
    saveFile: vi.fn(),
    createFile: vi.fn(),
    silentLogin: vi.fn(),
}));

vi.mock('../admin-dialog.js', () => ({
    showToast: vi.fn(),
    showConfirm: vi.fn().mockResolvedValue(false),
}));

vi.mock('../textFormatter.js', () => ({
    formatDate: vi.fn(d => d || ''),
    stripStackEditData: vi.fn(s => s),
    slugify: vi.fn(s => s ? s.toLowerCase().replace(/\s+/g, '-') : ''),
}));

vi.mock('../admin-dashboard.js', () => ({
    loadMeldingerModule: vi.fn(),
}));

vi.mock('../admin-editor-helpers.js', () => ({
    getAdminConfig: vi.fn(() => ({
        MELDINGER_FOLDER: 'test-meldinger-folder',
    })),
    showDeletionToast: vi.fn(),
    initEditors: vi.fn(),
}));

vi.mock('../admin-api-retry.js', () => ({
    createAuthRefresher: vi.fn(() => () => Promise.resolve(true)),
}));

import { deleteFile, getFileContent, parseMarkdown, saveFile, createFile, stringifyMarkdown } from '../admin-client.js';
import { showConfirm, showToast } from '../admin-dialog.js';
import { loadMeldingerModule } from '../admin-dashboard.js';
import { showDeletionToast, initEditors } from '../admin-editor-helpers.js';
import { initMeldingerModule, reloadMeldinger } from '../admin-module-meldinger.js';

function setupDOM() {
    document.body.innerHTML = `
        <div id="admin-config" data-meldinger-folder="mf"></div>
        <div id="module-inner"></div>
        <div id="module-actions"></div>
    `;
}

beforeEach(() => {
    setupDOM();
    vi.clearAllMocks();
});

describe('initMeldingerModule', () => {
    it('should register window globals', () => {
        initMeldingerModule();
        expect(typeof window.deleteMelding).toBe('function');
        expect(typeof window.editMelding).toBe('function');
        expect(typeof window.loadMeldingerModule).toBe('function');
    });
});

describe('reloadMeldinger', () => {
    it('should call loadMeldingerModule with config and callbacks', () => {
        reloadMeldinger();
        expect(loadMeldingerModule).toHaveBeenCalledWith(
            'test-meldinger-folder',
            expect.any(Function),
            expect.any(Function)
        );
    });
});

describe('deleteMelding', () => {
    beforeEach(() => {
        initMeldingerModule();
    });

    it('should do nothing when user cancels', async () => {
        showConfirm.mockResolvedValue(false);
        await window.deleteMelding('id1', 'Test');
        expect(deleteFile).not.toHaveBeenCalled();
    });

    it('should delete and show toast when confirmed', async () => {
        showConfirm.mockResolvedValue(true);
        deleteFile.mockResolvedValue();
        await window.deleteMelding('id1', 'Sommerferie');
        expect(deleteFile).toHaveBeenCalledWith('id1');
        expect(showDeletionToast).toHaveBeenCalledWith('Sommerferie', expect.stringContaining('Papirkurv'));
        expect(loadMeldingerModule).toHaveBeenCalled();
    });

    it('should show error on failure', async () => {
        showConfirm.mockResolvedValue(true);
        deleteFile.mockRejectedValue(new Error('fail'));
        await window.deleteMelding('id1', 'Test');
        expect(showToast).toHaveBeenCalledWith('Kunne ikke slette oppslaget.', 'error');
    });
});

describe('editMelding', () => {
    beforeEach(() => {
        initMeldingerModule();
    });

    it('should show loading state', async () => {
        getFileContent.mockReturnValue(new Promise(() => {}));
        window.editMelding('id1', 'Test');
        expect(document.getElementById('module-inner').innerHTML).toContain('Laster editor');
    });

    it('should render editor for existing melding', async () => {
        getFileContent.mockResolvedValue('raw');
        parseMarkdown.mockReturnValue({
            data: { title: 'Sommeråpent', startDate: '2024-06-01', endDate: '2024-08-31' },
            body: 'Velkommen'
        });

        await window.editMelding('id1', 'Sommeråpent');

        const inner = document.getElementById('module-inner');
        expect(inner.querySelector('#edit-title').value).toBe('Sommeråpent');
        expect(inner.querySelector('#edit-start').value).toBe('2024-06-01');
        expect(inner.querySelector('#edit-end').value).toBe('2024-08-31');
        expect(initEditors).toHaveBeenCalledWith(expect.any(Function), expect.any(Function));
    });

    it('should render empty form for new melding', async () => {
        await window.editMelding(null, null);

        const inner = document.getElementById('module-inner');
        expect(inner.querySelector('#edit-title')).not.toBeNull();
        expect(inner.querySelector('#edit-start')).not.toBeNull();
        expect(initEditors).toHaveBeenCalled();
    });

    it('should show error when editor load fails', async () => {
        getFileContent.mockRejectedValue(new Error('fail'));
        await window.editMelding('id1', 'Test');

        expect(document.getElementById('module-inner').innerHTML).toContain('feil oppstod');
    });

    it('should not crash when module-inner is missing', async () => {
        document.body.innerHTML = '';
        await expect(window.editMelding('id1', 'Test')).resolves.toBeUndefined();
    });

    it('should save existing melding on save callback', async () => {
        getFileContent.mockResolvedValue('raw');
        parseMarkdown.mockReturnValue({
            data: { title: 'Melding', startDate: '2024-01-01', endDate: '2024-12-31' },
            body: 'Innhold'
        });
        stringifyMarkdown.mockReturnValue('md');
        saveFile.mockResolvedValue();

        await window.editMelding('id1', 'Melding');

        const onSave = initEditors.mock.calls[0][1];
        await onSave(null);

        expect(saveFile).toHaveBeenCalledWith('id1', expect.any(String), 'md');
        expect(loadMeldingerModule).toHaveBeenCalled();
    });

    it('should create new melding when no id', async () => {
        stringifyMarkdown.mockReturnValue('md');
        createFile.mockResolvedValue();

        await window.editMelding(null, null);

        const onSave = initEditors.mock.calls[0][1];
        await onSave(null);

        expect(createFile).toHaveBeenCalledWith('test-meldinger-folder', expect.any(String), 'md');
    });

    it('should show error toast when save fails', async () => {
        getFileContent.mockResolvedValue('raw');
        parseMarkdown.mockReturnValue({
            data: { title: 'M', startDate: '', endDate: '' },
            body: ''
        });
        saveFile.mockRejectedValue(new Error('save fail'));

        await window.editMelding('id1', 'M');

        const onSave = initEditors.mock.calls[0][1];
        await onSave(null);

        expect(showToast).toHaveBeenCalledWith('Kunne ikke lagre endringene.', 'error');
    });

    it('should bind date change listeners', async () => {
        await window.editMelding(null, null);

        const startInput = document.getElementById('edit-start');
        const endInput = document.getElementById('edit-end');
        expect(startInput).not.toBeNull();
        expect(endInput).not.toBeNull();
    });

    it('should validate date order on change', async () => {
        await window.editMelding(null, null);

        const startInput = document.getElementById('edit-start');
        const endInput = document.getElementById('edit-end');
        const saveBtn = document.getElementById('btn-save-melding');

        // Set end date before start date
        startInput.value = '2024-06-01';
        endInput.value = '2024-01-01';
        startInput.dispatchEvent(new Event('change'));

        const errorBox = document.getElementById('date-error');
        expect(errorBox.classList.contains('hidden')).toBe(false);
        expect(saveBtn.disabled).toBe(true);
    });

    it('should enable save button when dates are valid', async () => {
        await window.editMelding(null, null);

        const startInput = document.getElementById('edit-start');
        const endInput = document.getElementById('edit-end');
        const saveBtn = document.getElementById('btn-save-melding');

        startInput.value = '2024-01-01';
        endInput.value = '2024-06-01';
        startInput.dispatchEvent(new Event('change'));

        expect(saveBtn.disabled).toBe(false);
    });

    it('should not save when save button is disabled', async () => {
        await window.editMelding(null, null);

        const startInput = document.getElementById('edit-start');
        const endInput = document.getElementById('edit-end');
        const saveBtn = document.getElementById('btn-save-melding');

        // Make save disabled
        startInput.value = '2024-06-01';
        endInput.value = '2024-01-01';
        startInput.dispatchEvent(new Event('change'));

        const onSave = initEditors.mock.calls[0][1];
        await onSave(null);

        expect(saveFile).not.toHaveBeenCalled();
        expect(createFile).not.toHaveBeenCalled();
    });
});
