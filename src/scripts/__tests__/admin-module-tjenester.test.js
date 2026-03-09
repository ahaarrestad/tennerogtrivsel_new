/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockAutoSaver, mockAdminDialog, setupModuleDOM } from './test-helpers.js';

vi.mock('dompurify');
vi.mock('marked');

vi.mock('../admin-client.js', () => ({
    deleteFile: vi.fn(),
    getFileContent: vi.fn(),
    parseMarkdown: vi.fn(),
    stringifyMarkdown: vi.fn(),
    saveFile: vi.fn(),
    createFile: vi.fn(),
    listFiles: vi.fn(),
    silentLogin: vi.fn(),
}));

vi.mock('../admin-dialog.js', () => mockAdminDialog());

vi.mock('../textFormatter.js', () => ({
    stripStackEditData: vi.fn(s => s),
    slugify: vi.fn(s => s.toLowerCase().replace(/\s+/g, '-')),
}));

vi.mock('../admin-dashboard.js', () => ({
    loadTjenesterModule: vi.fn(),
    formatTimestamp: vi.fn(() => '26. feb kl. 14:00'),
}));

vi.mock('../admin-editor-helpers.js', () => ({
    getAdminConfig: vi.fn(() => ({
        TJENESTER_FOLDER: 'test-folder',
    })),
    getRefreshAuth: vi.fn(() => vi.fn()),
    renderToggleHtml: vi.fn((id, active) => `<button id="${id}" data-active="${active}"><span class="toggle-label">${active ? 'Aktiv' : 'Inaktiv'}</span></button>`),
    attachToggleClick: vi.fn(),
    showDeletionToast: vi.fn(),
    initMarkdownEditor: vi.fn(),
    createAutoSaver: createMockAutoSaver(),
    showSaveBar: vi.fn(),
}));

vi.mock('../admin-api-retry.js', () => ({
    createAuthRefresher: vi.fn(() => () => Promise.resolve(true)),
    classifyError: vi.fn(() => 'non-retryable'),
    withRetry: vi.fn((fn) => fn()),
}));

import { deleteFile, getFileContent, parseMarkdown, saveFile, createFile, stringifyMarkdown, listFiles } from '../admin-client.js';
import { showConfirm, showToast } from '../admin-dialog.js';
import { classifyError, withRetry } from '../admin-api-retry.js';
import { loadTjenesterModule, formatTimestamp } from '../admin-dashboard.js';
import { showDeletionToast, initMarkdownEditor, attachToggleClick, showSaveBar, createAutoSaver, getRefreshAuth } from '../admin-editor-helpers.js';
import { initTjenesterModule, reloadTjenester } from '../admin-module-tjenester.js';

beforeEach(() => {
    setupModuleDOM({ configAttrs: 'data-tjenester-folder="tf"' });
    vi.clearAllMocks();
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('initTjenesterModule', () => {
    it('should register window globals', () => {
        initTjenesterModule();
        expect(typeof window.deleteTjeneste).toBe('function');
        expect(typeof window.editTjeneste).toBe('function');
        expect(typeof window.loadTjenesterModule).toBe('function');
    });
});

describe('reloadTjenester', () => {
    it('should call loadTjenesterModule with config and callbacks including onReorder', () => {
        reloadTjenester();
        expect(loadTjenesterModule).toHaveBeenCalledWith(
            'test-folder',
            expect.any(Function),
            expect.any(Function),
            expect.any(Function),
            expect.any(Function)
        );
    });

    it('should call clearBreadcrumbEditor', () => {
        window.clearBreadcrumbEditor = vi.fn();
        reloadTjenester();
        expect(window.clearBreadcrumbEditor).toHaveBeenCalled();
    });
});

describe('deleteTjeneste', () => {
    beforeEach(() => {
        initTjenesterModule();
    });

    it('should do nothing when user cancels confirm dialog', async () => {
        showConfirm.mockResolvedValue(false);
        await window.deleteTjeneste('id1', 'Test');
        expect(deleteFile).not.toHaveBeenCalled();
    });

    it('should delete file and show toast when confirmed', async () => {
        showConfirm.mockResolvedValue(true);
        deleteFile.mockResolvedValue();
        await window.deleteTjeneste('id1', 'Min tjeneste');
        expect(deleteFile).toHaveBeenCalledWith('id1');
        expect(showDeletionToast).toHaveBeenCalledWith('Min tjeneste', expect.stringContaining('Papirkurv'));
        expect(loadTjenesterModule).toHaveBeenCalled();
    });

    it.each([
        ['non-retryable', new Error('fail'), 'Kunne ikke slette tjenesten.'],
        ['auth', { status: 401 }, 'Økten din er utløpt. Last siden på nytt.'],
        ['retryable', new Error('network'), 'Nettverksfeil — prøv igjen.'],
    ])('should show %s error toast when deletion fails', async (errorType, rejection, expectedMessage) => {
        classifyError.mockReturnValueOnce(errorType);
        showConfirm.mockResolvedValue(true);
        deleteFile.mockRejectedValue(rejection);
        await window.deleteTjeneste('id1', 'Test');
        expect(showToast).toHaveBeenCalledWith(expectedMessage, 'error');
    });
});

describe('editTjeneste', () => {
    beforeEach(() => {
        initTjenesterModule();
    });

    it('should show loading state', async () => {
        getFileContent.mockReturnValue(new Promise(() => {}));
        window.editTjeneste('id1', 'Test');
        expect(document.getElementById('module-inner').innerHTML).toContain('Laster editor');
    });

    it('should render editor form for existing tjeneste', async () => {
        getFileContent.mockResolvedValue('raw');
        parseMarkdown.mockReturnValue({
            data: { title: 'Tannbleking', ingress: 'Fin', id: 'tb', active: true },
            body: 'Innhold'
        });

        await window.editTjeneste('id1', 'Tannbleking');

        const inner = document.getElementById('module-inner');
        // Values are now set programmatically, not in innerHTML
        expect(document.getElementById('edit-title').value).toBe('Tannbleking');
        expect(document.getElementById('edit-ingress').value).toBe('Fin');
        expect(initMarkdownEditor).toHaveBeenCalled();
    });

    it('should NOT render priority input in editor form', async () => {
        getFileContent.mockResolvedValue('raw');
        parseMarkdown.mockReturnValue({
            data: { title: 'Test', ingress: 'Ing', id: 'test', active: true, priority: 5 },
            body: 'Content'
        });

        await window.editTjeneste('id1', 'Test');

        const priorityInput = document.getElementById('edit-priority');
        expect(priorityInput).toBeNull();
    });

    it('should render empty form for new tjeneste', async () => {
        await window.editTjeneste(null, null);

        const inner = document.getElementById('module-inner');
        expect(inner.querySelector('#edit-title')).not.toBeNull();
        expect(inner.querySelector('#edit-ingress')).not.toBeNull();
        expect(initMarkdownEditor).toHaveBeenCalled();
    });

    it('should show error when editor load fails', async () => {
        getFileContent.mockRejectedValue(new Error('fail'));
        await window.editTjeneste('id1', 'Test');

        const inner = document.getElementById('module-inner');
        expect(inner.innerHTML).toContain('feil oppstod');
    });

    it('should not crash when module-inner is missing', async () => {
        document.body.innerHTML = '';
        await expect(window.editTjeneste('id1', 'Test')).resolves.toBeUndefined();
    });

    describe('existing tjeneste (auto-save)', () => {
        beforeEach(async () => {
            getFileContent.mockResolvedValue('raw');
            parseMarkdown.mockReturnValue({
                data: { title: 'Old', ingress: '', id: 'old', active: true },
                body: 'Body'
            });
            stringifyMarkdown.mockReturnValue('---\n---\n');
            saveFile.mockResolvedValue();
        });

        it('should not show save button for existing (navigation via breadcrumb)', async () => {
            await window.editTjeneste('id1', 'Old');
            const inner = document.getElementById('module-inner');
            expect(inner.querySelector('#btn-save-tjeneste')).toBeNull();
        });

        it('should set breadcrumb editor for existing tjeneste', async () => {
            window.setBreadcrumbEditor = vi.fn();
            await window.editTjeneste('id1', 'Old');
            expect(window.setBreadcrumbEditor).toHaveBeenCalledWith('Redigerer tjeneste', expect.any(Function));
        });

        it('should auto-save on title input change', async () => {
            await window.editTjeneste('id1', 'Old');

            const autoSaver = createAutoSaver.mock.results[0].value;
            document.getElementById('edit-title').value = 'New Title';
            document.getElementById('edit-title').dispatchEvent(new Event('input'));

            expect(autoSaver.trigger).toHaveBeenCalled();
        });

        it('should auto-save on ingress input change', async () => {
            await window.editTjeneste('id1', 'Old');

            const autoSaver = createAutoSaver.mock.results[0].value;
            document.getElementById('edit-ingress').value = 'New ingress';
            document.getElementById('edit-ingress').dispatchEvent(new Event('input'));

            expect(autoSaver.trigger).toHaveBeenCalled();
        });

        it('should include priority in save payload', async () => {
            await window.editTjeneste('id1', 'Old');

            const saveFn = createAutoSaver.mock.calls[0][0];
            await saveFn();

            expect(stringifyMarkdown).toHaveBeenCalledWith(
                expect.objectContaining({ priority: expect.any(Number) }),
                expect.any(String)
            );
        });

        it('should preserve existing priority in save payload from data', async () => {
            parseMarkdown.mockReturnValue({
                data: { title: 'Old', ingress: '', id: 'old', active: true, priority: 5 },
                body: 'Body'
            });
            await window.editTjeneste('id1', 'Old');

            const saveFn = createAutoSaver.mock.calls[0][0];
            await saveFn();

            expect(stringifyMarkdown).toHaveBeenCalledWith(
                expect.objectContaining({ priority: 5 }),
                expect.any(String)
            );
        });

        it('should auto-save on EasyMDE change', async () => {
            const mockCodemirror = { on: vi.fn() };
            const mockEasyMDE = { value: vi.fn(() => 'content'), codemirror: mockCodemirror };
            initMarkdownEditor.mockReturnValueOnce(mockEasyMDE);

            await window.editTjeneste('id1', 'Old');

            expect(mockCodemirror.on).toHaveBeenCalledWith('change', expect.any(Function));
            const changeHandler = mockCodemirror.on.mock.calls[0][1];
            changeHandler();

            const autoSaver = createAutoSaver.mock.results[0].value;
            expect(autoSaver.trigger).toHaveBeenCalled();
        });

        it('should auto-save on toggle click', async () => {
            await window.editTjeneste('id1', 'Old');

            expect(attachToggleClick).toHaveBeenCalledWith('edit-active-toggle', expect.any(Function));
            const onToggleChange = attachToggleClick.mock.calls[0][1];
            onToggleChange();

            const autoSaver = createAutoSaver.mock.results[0].value;
            expect(autoSaver.trigger).toHaveBeenCalled();
        });

        it('should debounce auto-save (trigger called for each input change)', async () => {
            await window.editTjeneste('id1', 'Old');

            const autoSaver = createAutoSaver.mock.results[0].value;
            const titleInput = document.getElementById('edit-title');
            titleInput.value = 'First';
            titleInput.dispatchEvent(new Event('input'));
            titleInput.value = 'Second';
            titleInput.dispatchEvent(new Event('input'));

            expect(autoSaver.trigger).toHaveBeenCalledTimes(2);
        });

        it('should pass saveFn that calls saveFile to createAutoSaver', async () => {
            await window.editTjeneste('id1', 'Old');

            const saveFn = createAutoSaver.mock.calls[0][0];
            await saveFn();

            expect(saveFile).toHaveBeenCalledWith('id1', expect.any(String), expect.any(String));
        });

        it('should show auth toast when saveFn fails with auth error', async () => {
            classifyError.mockReturnValueOnce('auth');
            saveFile.mockRejectedValue({ status: 401 });

            await window.editTjeneste('id1', 'Old');

            const saveFn = createAutoSaver.mock.calls[0][0];
            await expect(saveFn()).rejects.toEqual({ status: 401 });

            expect(showToast).toHaveBeenCalledWith('Økten din er utløpt. Last siden på nytt.', 'error');
        });

        it('should show network toast when saveFn fails with retryable error', async () => {
            classifyError.mockReturnValueOnce('retryable');
            saveFile.mockRejectedValue(new Error('network'));

            await window.editTjeneste('id1', 'Old');

            const saveFn = createAutoSaver.mock.calls[0][0];
            await expect(saveFn()).rejects.toThrow('network');

            expect(showToast).toHaveBeenCalledWith('Nettverksfeil — prøv igjen.', 'error');
        });
    });

    describe('new tjeneste (manual create)', () => {
        it('should show "Opprett tjeneste" button for new tjeneste', async () => {
            await window.editTjeneste(null, null);
            const saveBtn = document.getElementById('btn-save-tjeneste');
            expect(saveBtn).not.toBeNull();
            expect(saveBtn.textContent).toContain('Opprett tjeneste');
        });

        it('should not render priority input for new tjeneste', async () => {
            await window.editTjeneste(null, null);

            const priorityInput = document.getElementById('edit-priority');
            expect(priorityInput).toBeNull();
        });

        it('should assign priority after existing max for new tjeneste', async () => {
            listFiles.mockResolvedValue([
                { id: 'existing1', name: 'e1.md' },
                { id: 'existing2', name: 'e2.md' }
            ]);
            getFileContent.mockResolvedValueOnce('raw1').mockResolvedValueOnce('raw2');
            parseMarkdown
                .mockReturnValueOnce({ data: { title: 'E1', priority: 3 }, body: '' })
                .mockReturnValueOnce({ data: { title: 'E2', priority: 7 }, body: '' });
            stringifyMarkdown.mockReturnValue('---\n---\n');
            createFile.mockResolvedValue();

            await window.editTjeneste(null, null);

            const saveBtn = document.getElementById('btn-save-tjeneste');
            await saveBtn.onclick();

            expect(stringifyMarkdown).toHaveBeenCalledWith(
                expect.objectContaining({ priority: 8 }),
                expect.any(String)
            );
        });

        it('should handle services with undefined priority when computing max', async () => {
            listFiles.mockResolvedValue([
                { id: 'existing1', name: 'e1.md' }
            ]);
            getFileContent.mockResolvedValueOnce('raw1');
            parseMarkdown
                .mockReturnValueOnce({ data: { title: 'E1' }, body: '' }); // no priority
            stringifyMarkdown.mockReturnValue('---\n---\n');
            createFile.mockResolvedValue();

            await window.editTjeneste(null, null);

            const saveBtn = document.getElementById('btn-save-tjeneste');
            await saveBtn.onclick();

            // undefined priority → treated as 0, so next = 1
            expect(stringifyMarkdown).toHaveBeenCalledWith(
                expect.objectContaining({ priority: 1 }),
                expect.any(String)
            );
        });

        it('should fallback to priority 99 if loading services fails', async () => {
            listFiles.mockRejectedValue(new Error('network'));
            stringifyMarkdown.mockReturnValue('---\n---\n');
            createFile.mockResolvedValue();

            await window.editTjeneste(null, null);

            const saveBtn = document.getElementById('btn-save-tjeneste');
            await saveBtn.onclick();

            expect(stringifyMarkdown).toHaveBeenCalledWith(
                expect.objectContaining({ priority: 99 }),
                expect.any(String)
            );
        });

        it('should create file on Opprett button click', async () => {
            stringifyMarkdown.mockReturnValue('---\n---\n');
            createFile.mockResolvedValue();

            await window.editTjeneste(null, null);

            const saveBtn = document.getElementById('btn-save-tjeneste');
            await saveBtn.onclick();

            expect(createFile).toHaveBeenCalledWith('test-folder', expect.any(String), expect.any(String));
            expect(loadTjenesterModule).toHaveBeenCalled();
        });

        it('should disable button and show Oppretter text while saving', async () => {
            createFile.mockReturnValue(new Promise(() => {}));

            await window.editTjeneste(null, null);

            const saveBtn = document.getElementById('btn-save-tjeneste');
            saveBtn.onclick();

            expect(saveBtn.disabled).toBe(true);
            expect(saveBtn.textContent).toBe('Oppretter...');
        });

        it('should re-enable button on create failure', async () => {
            createFile.mockRejectedValue(new Error('fail'));

            await window.editTjeneste(null, null);

            const saveBtn = document.getElementById('btn-save-tjeneste');
            await saveBtn.onclick();

            expect(saveBtn.disabled).toBe(false);
            expect(saveBtn.textContent).toBe('Opprett tjeneste');
            expect(showToast).toHaveBeenCalledWith('Kunne ikke lagre endringene.', 'error');
        });

        it('should not trigger auto-save on input for new tjeneste', async () => {
            await window.editTjeneste(null, null);

            document.getElementById('edit-title').value = 'New';
            document.getElementById('edit-title').dispatchEvent(new Event('input'));
            vi.advanceTimersByTime(2000);

            expect(showSaveBar).not.toHaveBeenCalled();
            expect(saveFile).not.toHaveBeenCalled();
        });

        it('should call attachToggleClick without onChange for new', async () => {
            await window.editTjeneste(null, null);

            expect(attachToggleClick).toHaveBeenCalledWith('edit-active-toggle');
        });
    });
});

describe('toggleTjenesteActive', () => {
    let toggleFn;

    function addToggleButton(driveId, active, { hasLabel = true } = {}) {
        document.body.innerHTML += `
            <div class="admin-card-interactive">
                <button class="toggle-active-btn" data-id="${driveId}" data-active="${active}">
                    ${hasLabel ? `<span class="toggle-label">${active ? 'Aktiv' : 'Inaktiv'}</span>` : ''}
                </button>
            </div>
        `;
    }

    beforeEach(() => {
        initTjenesterModule();
        reloadTjenester();
        toggleFn = loadTjenesterModule.mock.calls[0][3];
        vi.clearAllMocks();
    });

    it.each([
        [true, false, 'Inaktiv'],
        [false, true, 'Aktiv'],
    ])('should toggle active=%s → %s and update UI label to "%s"', async (initial, expected, expectedLabel) => {
        addToggleButton('drive1', initial);
        getFileContent.mockResolvedValue('raw');
        parseMarkdown.mockReturnValue({ data: { active: initial, title: 'T' }, body: 'B' });
        stringifyMarkdown.mockReturnValue('md');
        saveFile.mockResolvedValue();

        const service = { active: initial };
        await toggleFn('drive1', 'file.md', service);

        expect(saveFile).toHaveBeenCalledWith('drive1', 'file.md', 'md');
        expect(service.active).toBe(expected);
        const btn = document.querySelector('.toggle-active-btn[data-id="drive1"]');
        expect(btn.dataset.active).toBe(String(expected));
        expect(btn.querySelector('.toggle-label').textContent).toBe(expectedLabel);
    });

    it.each([
        [true, 'true', 'Aktiv'],
        [false, 'false', 'Inaktiv'],
    ])('should revert UI on save failure when initial active=%s', async (initial, expectedAttr, expectedLabel) => {
        addToggleButton('drive1', initial);
        getFileContent.mockResolvedValue('raw');
        parseMarkdown.mockReturnValue({ data: { active: initial }, body: '' });
        saveFile.mockRejectedValue(new Error('fail'));

        const service = { active: initial };
        await toggleFn('drive1', 'file.md', service);

        const btn = document.querySelector('.toggle-active-btn[data-id="drive1"]');
        expect(btn.dataset.active).toBe(expectedAttr);
        expect(btn.querySelector('.toggle-label').textContent).toBe(expectedLabel);
        expect(showToast).toHaveBeenCalledWith('Kunne ikke oppdatere synlighet.', 'error');
    });

    it('should toggle opacity on card when deactivating', async () => {
        addToggleButton('drive1', true);
        getFileContent.mockResolvedValue('raw');
        parseMarkdown.mockReturnValue({ data: { active: true }, body: '' });
        stringifyMarkdown.mockReturnValue('md');
        saveFile.mockResolvedValue();

        await toggleFn('drive1', 'file.md', { active: true });

        const card = document.querySelector('.admin-card-interactive');
        expect(card.classList.contains('opacity-60')).toBe(true);
    });

    it('should save without btn/card in DOM', async () => {
        getFileContent.mockResolvedValue('raw');
        parseMarkdown.mockReturnValue({ data: { active: true, title: 'T' }, body: 'B' });
        stringifyMarkdown.mockReturnValue('md');
        saveFile.mockResolvedValue();

        const service = { active: true };
        await toggleFn('no-btn', 'file.md', service);

        expect(saveFile).toHaveBeenCalled();
        expect(service.active).toBe(false);
    });

    it('should show error and reload on failure without btn/card in DOM', async () => {
        getFileContent.mockResolvedValue('raw');
        parseMarkdown.mockReturnValue({ data: { active: true }, body: '' });
        saveFile.mockRejectedValue(new Error('fail'));

        await toggleFn('no-btn', 'file.md', { active: true });

        expect(showToast).toHaveBeenCalledWith('Kunne ikke oppdatere synlighet.', 'error');
        expect(loadTjenesterModule).toHaveBeenCalled();
    });

    it('should toggle without label span', async () => {
        addToggleButton('drive1', true, { hasLabel: false });
        getFileContent.mockResolvedValue('raw');
        parseMarkdown.mockReturnValue({ data: { active: true, title: 'T' }, body: 'B' });
        stringifyMarkdown.mockReturnValue('md');
        saveFile.mockResolvedValue();

        const service = { active: true };
        await toggleFn('drive1', 'file.md', service);

        expect(service.active).toBe(false);
    });
});

describe('reorderTjeneste', () => {
    let reorderFn;

    beforeEach(() => {
        initTjenesterModule();
        reloadTjenester();
        // onReorder is the 5th argument to loadTjenesterModule
        reorderFn = loadTjenesterModule.mock.calls[0][4];
        vi.clearAllMocks();
    });

    it('should re-index all services sequentially after moving item down', async () => {
        listFiles.mockResolvedValue([
            { id: 'driveA', name: 'a.md' },
            { id: 'driveB', name: 'b.md' },
            { id: 'driveC', name: 'c.md' }
        ]);
        getFileContent.mockResolvedValueOnce('raw1').mockResolvedValueOnce('raw2').mockResolvedValueOnce('raw3');
        parseMarkdown
            .mockReturnValueOnce({ data: { title: 'A', priority: 99 }, body: 'bodyA' })
            .mockReturnValueOnce({ data: { title: 'B', priority: 99 }, body: 'bodyB' })
            .mockReturnValueOnce({ data: { title: 'C', priority: 99 }, body: 'bodyC' });
        stringifyMarkdown.mockReturnValue('md');
        saveFile.mockResolvedValue();

        // Move A down (sorted: A, B, C alphabetically since all priority 99)
        await reorderFn('driveA', 1);

        // All 3 should be saved with sequential priorities
        expect(saveFile).toHaveBeenCalledTimes(3);
        // New order: B(1), A(2), C(3)
        expect(stringifyMarkdown).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'B', priority: 1 }),
            'bodyB'
        );
        expect(stringifyMarkdown).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'A', priority: 2 }),
            'bodyA'
        );
        expect(stringifyMarkdown).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'C', priority: 3 }),
            'bodyC'
        );
        expect(loadTjenesterModule).toHaveBeenCalled();
    });

    it('should re-index all services sequentially after moving item up', async () => {
        listFiles.mockResolvedValue([
            { id: 'driveA', name: 'a.md' },
            { id: 'driveB', name: 'b.md' },
            { id: 'driveC', name: 'c.md' }
        ]);
        getFileContent.mockResolvedValueOnce('raw1').mockResolvedValueOnce('raw2').mockResolvedValueOnce('raw3');
        parseMarkdown
            .mockReturnValueOnce({ data: { title: 'A', priority: 1 }, body: 'bodyA' })
            .mockReturnValueOnce({ data: { title: 'B', priority: 2 }, body: 'bodyB' })
            .mockReturnValueOnce({ data: { title: 'C', priority: 3 }, body: 'bodyC' });
        stringifyMarkdown.mockReturnValue('md');
        saveFile.mockResolvedValue();

        // Move C up
        await reorderFn('driveC', -1);

        // New order: A(1), C(2), B(3)
        expect(stringifyMarkdown).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'A', priority: 1 }),
            'bodyA'
        );
        expect(stringifyMarkdown).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'C', priority: 2 }),
            'bodyC'
        );
        expect(stringifyMarkdown).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'B', priority: 3 }),
            'bodyB'
        );
    });

    it('should show error toast on save failure', async () => {
        listFiles.mockResolvedValue([
            { id: 'driveA', name: 'a.md' },
            { id: 'driveB', name: 'b.md' }
        ]);
        getFileContent.mockResolvedValueOnce('raw1').mockResolvedValueOnce('raw2');
        parseMarkdown
            .mockReturnValueOnce({ data: { title: 'A', priority: 1 }, body: 'bodyA' })
            .mockReturnValueOnce({ data: { title: 'B', priority: 2 }, body: 'bodyB' });
        stringifyMarkdown.mockReturnValue('md');
        saveFile.mockRejectedValue(new Error('fail'));

        await reorderFn('driveA', 1);

        const { showToast } = await import('../admin-dialog.js');
        expect(showToast).toHaveBeenCalledWith(expect.stringContaining('sortere'), 'error');
    });
});

describe('loadAllServices — withRetry integration', () => {
    beforeEach(() => {
        initTjenesterModule();
    });

    it('should wrap listFiles call with withRetry and refreshAuth', async () => {
        listFiles.mockResolvedValue([]);

        await window.editTjeneste(null, null);

        expect(withRetry).toHaveBeenCalledWith(
            expect.any(Function),
            expect.objectContaining({ refreshAuth: expect.any(Function) })
        );
    });

    it('should wrap getFileContent calls with withRetry', async () => {
        listFiles.mockResolvedValue([
            { id: 'f1', name: 'f1.md' },
            { id: 'f2', name: 'f2.md' }
        ]);
        getFileContent.mockResolvedValueOnce('raw1').mockResolvedValueOnce('raw2');
        parseMarkdown
            .mockReturnValueOnce({ data: { title: 'S1', priority: 1 }, body: 'b1' })
            .mockReturnValueOnce({ data: { title: 'S2', priority: 2 }, body: 'b2' });

        await window.editTjeneste(null, null);

        // 1 call for listFiles + 2 calls for getFileContent = 3 withRetry calls
        expect(withRetry).toHaveBeenCalledTimes(3);
    });

    it('should pass getRefreshAuth result as refreshAuth option', async () => {
        const mockRefreshFn = vi.fn();
        getRefreshAuth.mockReturnValueOnce(mockRefreshFn);
        listFiles.mockResolvedValue([]);

        await window.editTjeneste(null, null);

        expect(withRetry).toHaveBeenCalledWith(
            expect.any(Function),
            { refreshAuth: mockRefreshFn }
        );
    });
});

describe('editTjeneste — saveBtn null-check branches', () => {
    beforeEach(() => {
        initTjenesterModule();
    });

    it('should handle create failure when save button has been removed from DOM', async () => {
        createFile.mockImplementation(() => {
            // Simulate button removal before rejection (e.g., user navigated away)
            document.getElementById('btn-save-tjeneste')?.remove();
            return Promise.reject(new Error('fail'));
        });

        await window.editTjeneste(null, null);

        const saveBtn = document.getElementById('btn-save-tjeneste');
        // The onclick disables the button, then doSave runs createFile which removes it and rejects
        await saveBtn.onclick();

        // Should not throw even though btn was removed — the null-check protects it
        expect(showToast).toHaveBeenCalledWith('Kunne ikke lagre endringene.', 'error');
        // Button should no longer be in DOM
        expect(document.getElementById('btn-save-tjeneste')).toBeNull();
    });

    it('should handle setup when btn-save-tjeneste is missing from rendered HTML', async () => {
        // Override initMarkdownEditor to clear the module-inner HTML before the saveBtn binding
        initMarkdownEditor.mockImplementation(() => {
            // Remove the save button after rendering, simulating a race condition
            document.getElementById('btn-save-tjeneste')?.remove();
            return null;
        });

        await window.editTjeneste(null, null);

        // editTjeneste should not throw when saveBtn is null at binding time
        expect(document.getElementById('btn-save-tjeneste')).toBeNull();
    });
});
