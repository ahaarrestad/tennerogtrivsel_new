/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
    formatTimestamp: vi.fn(() => '26. feb kl. 14:00'),
}));

vi.mock('../admin-editor-helpers.js', () => ({
    getAdminConfig: vi.fn(() => ({
        MELDINGER_FOLDER: 'test-meldinger-folder',
    })),
    showDeletionToast: vi.fn(),
    initEditors: vi.fn(() => ({ easyMDE: null, flatpickrInstances: [] })),
    showSaveBar: vi.fn(),
    hideSaveBar: vi.fn(),
}));

vi.mock('../admin-api-retry.js', () => ({
    createAuthRefresher: vi.fn(() => () => Promise.resolve(true)),
    classifyError: vi.fn(() => 'non-retryable'),
}));

import { deleteFile, getFileContent, parseMarkdown, saveFile, createFile, stringifyMarkdown } from '../admin-client.js';
import { showConfirm, showToast } from '../admin-dialog.js';
import { classifyError } from '../admin-api-retry.js';
import { loadMeldingerModule } from '../admin-dashboard.js';
import { showDeletionToast, initEditors, showSaveBar, hideSaveBar } from '../admin-editor-helpers.js';
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
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
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

    it('should call clearBreadcrumbEditor', () => {
        window.clearBreadcrumbEditor = vi.fn();
        reloadMeldinger();
        expect(window.clearBreadcrumbEditor).toHaveBeenCalled();
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

    it('should show auth toast when deletion fails with auth error', async () => {
        classifyError.mockReturnValueOnce('auth');
        showConfirm.mockResolvedValue(true);
        deleteFile.mockRejectedValue({ status: 401 });
        await window.deleteMelding('id1', 'Test');
        expect(showToast).toHaveBeenCalledWith('Økten din er utløpt. Last siden på nytt.', 'error');
    });

    it('should show network toast when deletion fails with retryable error', async () => {
        classifyError.mockReturnValueOnce('retryable');
        showConfirm.mockResolvedValue(true);
        deleteFile.mockRejectedValue(new Error('network'));
        await window.deleteMelding('id1', 'Test');
        expect(showToast).toHaveBeenCalledWith('Nettverksfeil — prøv igjen.', 'error');
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
        expect(initEditors).toHaveBeenCalledWith(expect.any(Function));
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

    describe('existing melding (auto-save)', () => {
        beforeEach(async () => {
            getFileContent.mockResolvedValue('raw');
            parseMarkdown.mockReturnValue({
                data: { title: 'Melding', startDate: '2024-01-01', endDate: '2024-12-31' },
                body: 'Innhold'
            });
            stringifyMarkdown.mockReturnValue('md');
            saveFile.mockResolvedValue();
        });

        it('should not show save button for existing (navigation via breadcrumb)', async () => {
            await window.editMelding('id1', 'Melding');
            const inner = document.getElementById('module-inner');
            expect(inner.querySelector('#btn-save-melding')).toBeNull();
        });

        it('should set breadcrumb editor for existing melding', async () => {
            window.setBreadcrumbEditor = vi.fn();
            await window.editMelding('id1', 'Melding');
            expect(window.setBreadcrumbEditor).toHaveBeenCalledWith('Redigerer melding', expect.any(Function));
        });

        it('should auto-save on title input change', async () => {
            await window.editMelding('id1', 'Melding');

            document.getElementById('edit-title').value = 'New Title';
            document.getElementById('edit-title').dispatchEvent(new Event('input'));

            expect(showSaveBar).toHaveBeenCalledWith('changed', '⏳ Endringer oppdaget...');
            vi.advanceTimersByTime(1500);
            await vi.runAllTimersAsync();

            expect(showSaveBar).toHaveBeenCalledWith('saving', '💾 Lagrer til Google Drive...');
            expect(saveFile).toHaveBeenCalledWith('id1', expect.any(String), 'md');
            expect(showSaveBar).toHaveBeenCalledWith('saved', expect.stringContaining('✅ Lagret'));
            expect(hideSaveBar).toHaveBeenCalledWith(5000);
        });

        it('should auto-save on EasyMDE change', async () => {
            const mockCodemirror = { on: vi.fn() };
            const mockEasyMDE = { value: vi.fn(() => 'content'), codemirror: mockCodemirror };
            initEditors.mockReturnValueOnce({ easyMDE: mockEasyMDE, flatpickrInstances: [] });

            await window.editMelding('id1', 'Melding');

            expect(mockCodemirror.on).toHaveBeenCalledWith('change', expect.any(Function));
            const changeHandler = mockCodemirror.on.mock.calls[0][1];
            changeHandler();

            expect(showSaveBar).toHaveBeenCalledWith('changed', '⏳ Endringer oppdaget...');
            vi.advanceTimersByTime(1500);
            await vi.runAllTimersAsync();

            expect(saveFile).toHaveBeenCalled();
        });

        it('should auto-save on date change when dates are valid', async () => {
            await window.editMelding('id1', 'Melding');

            const startInput = document.getElementById('edit-start');
            const endInput = document.getElementById('edit-end');
            startInput.value = '2024-01-01';
            endInput.value = '2024-12-31';
            startInput.dispatchEvent(new Event('change'));

            expect(showSaveBar).toHaveBeenCalledWith('changed', '⏳ Endringer oppdaget...');
            vi.advanceTimersByTime(1500);
            await vi.runAllTimersAsync();

            expect(saveFile).toHaveBeenCalled();
        });

        it('should NOT auto-save when dates are invalid', async () => {
            await window.editMelding('id1', 'Melding');

            const startInput = document.getElementById('edit-start');
            const endInput = document.getElementById('edit-end');
            startInput.value = '2024-06-01';
            endInput.value = '2024-01-01';
            startInput.dispatchEvent(new Event('change'));

            // date-error should be shown
            const errorBox = document.getElementById('date-error');
            expect(errorBox.classList.contains('hidden')).toBe(false);

            // Should NOT trigger auto-save
            expect(showSaveBar).not.toHaveBeenCalled();
            vi.advanceTimersByTime(2000);
            expect(saveFile).not.toHaveBeenCalled();
        });

        it('should debounce auto-save (reset timer on multiple changes)', async () => {
            await window.editMelding('id1', 'Melding');

            const titleInput = document.getElementById('edit-title');
            titleInput.value = 'First';
            titleInput.dispatchEvent(new Event('input'));
            vi.advanceTimersByTime(1000);

            titleInput.value = 'Second';
            titleInput.dispatchEvent(new Event('input'));
            vi.advanceTimersByTime(1000);

            expect(saveFile).not.toHaveBeenCalled();

            vi.advanceTimersByTime(500);
            await vi.runAllTimersAsync();

            expect(saveFile).toHaveBeenCalledTimes(1);
        });

        it('should show error save bar when save fails', async () => {
            saveFile.mockRejectedValue(new Error('save fail'));

            await window.editMelding('id1', 'Melding');

            document.getElementById('edit-title').dispatchEvent(new Event('input'));
            vi.advanceTimersByTime(1500);
            await vi.runAllTimersAsync();

            expect(showSaveBar).toHaveBeenCalledWith('error', '❌ Feil ved lagring!');
            expect(showToast).toHaveBeenCalledWith('Kunne ikke lagre endringene.', 'error');
        });

        it('should show auth toast when save fails with auth error', async () => {
            classifyError.mockReturnValueOnce('auth');
            saveFile.mockRejectedValue({ status: 401 });

            await window.editMelding('id1', 'Melding');

            document.getElementById('edit-title').dispatchEvent(new Event('input'));
            vi.advanceTimersByTime(1500);
            await vi.runAllTimersAsync();

            expect(showToast).toHaveBeenCalledWith('Økten din er utløpt. Last siden på nytt.', 'error');
        });

        it('should show network toast when save fails with retryable error', async () => {
            classifyError.mockReturnValueOnce('retryable');
            saveFile.mockRejectedValue(new Error('network'));

            await window.editMelding('id1', 'Melding');

            document.getElementById('edit-title').dispatchEvent(new Event('input'));
            vi.advanceTimersByTime(1500);
            await vi.runAllTimersAsync();

            expect(showToast).toHaveBeenCalledWith('Nettverksfeil — prøv igjen.', 'error');
        });
    });

    describe('new melding (manual create)', () => {
        it('should show "Opprett melding" button for new melding', async () => {
            await window.editMelding(null, null);
            const saveBtn = document.getElementById('btn-save-melding');
            expect(saveBtn).not.toBeNull();
            expect(saveBtn.textContent).toContain('Opprett melding');
        });

        it('should create file on Opprett button click', async () => {
            stringifyMarkdown.mockReturnValue('md');
            createFile.mockResolvedValue();

            await window.editMelding(null, null);

            const saveBtn = document.getElementById('btn-save-melding');
            await saveBtn.onclick();

            expect(createFile).toHaveBeenCalledWith('test-meldinger-folder', expect.any(String), 'md');
            expect(loadMeldingerModule).toHaveBeenCalled();
        });

        it('should disable button and show Oppretter text while saving', async () => {
            createFile.mockReturnValue(new Promise(() => {}));

            await window.editMelding(null, null);

            const saveBtn = document.getElementById('btn-save-melding');
            saveBtn.onclick();

            expect(saveBtn.disabled).toBe(true);
            expect(saveBtn.textContent).toBe('Oppretter...');
        });

        it('should re-enable button on create failure', async () => {
            createFile.mockRejectedValue(new Error('fail'));

            await window.editMelding(null, null);

            const saveBtn = document.getElementById('btn-save-melding');
            await saveBtn.onclick();

            expect(saveBtn.disabled).toBe(false);
            expect(saveBtn.textContent).toBe('Opprett melding');
            expect(showToast).toHaveBeenCalledWith('Kunne ikke lagre endringene.', 'error');
        });

        it('should not trigger auto-save on input for new melding', async () => {
            await window.editMelding(null, null);

            document.getElementById('edit-title').value = 'New';
            document.getElementById('edit-title').dispatchEvent(new Event('input'));
            vi.advanceTimersByTime(2000);

            expect(showSaveBar).not.toHaveBeenCalled();
            expect(saveFile).not.toHaveBeenCalled();
        });

        it('should validate date order for new melding', async () => {
            await window.editMelding(null, null);

            const startInput = document.getElementById('edit-start');
            const endInput = document.getElementById('edit-end');
            const saveBtn = document.getElementById('btn-save-melding');

            startInput.value = '2024-06-01';
            endInput.value = '2024-01-01';
            startInput.dispatchEvent(new Event('change'));

            const errorBox = document.getElementById('date-error');
            expect(errorBox.classList.contains('hidden')).toBe(false);
            expect(saveBtn.disabled).toBe(true);
        });

        it('should enable save button when dates are valid for new melding', async () => {
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

            startInput.value = '2024-06-01';
            endInput.value = '2024-01-01';
            startInput.dispatchEvent(new Event('change'));

            const saveBtn = document.getElementById('btn-save-melding');
            await saveBtn.onclick();

            expect(saveFile).not.toHaveBeenCalled();
            expect(createFile).not.toHaveBeenCalled();
        });
    });
});
