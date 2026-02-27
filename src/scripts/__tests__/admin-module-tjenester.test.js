/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('dompurify', () => ({ default: { sanitize: vi.fn(html => html) } }));
vi.mock('marked', () => ({ marked: { parse: vi.fn(text => `<p>${text}</p>`) } }));

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
    renderToggleHtml: vi.fn((id, active) => `<button id="${id}" data-active="${active}"><span class="toggle-label">${active ? 'Aktiv' : 'Inaktiv'}</span></button>`),
    attachToggleClick: vi.fn(),
    showDeletionToast: vi.fn(),
    initMarkdownEditor: vi.fn(),
    createAutoSaver: vi.fn((saveFn) => ({ trigger: vi.fn(), cancel: vi.fn(), _saveFn: saveFn })),
    showSaveBar: vi.fn(),
}));

vi.mock('../admin-api-retry.js', () => ({
    createAuthRefresher: vi.fn(() => () => Promise.resolve(true)),
    classifyError: vi.fn(() => 'non-retryable'),
}));

import { deleteFile, getFileContent, parseMarkdown, saveFile, createFile, stringifyMarkdown } from '../admin-client.js';
import { showConfirm, showToast } from '../admin-dialog.js';
import { classifyError } from '../admin-api-retry.js';
import { loadTjenesterModule, formatTimestamp } from '../admin-dashboard.js';
import { showDeletionToast, initMarkdownEditor, attachToggleClick, showSaveBar, createAutoSaver } from '../admin-editor-helpers.js';
import { initTjenesterModule, reloadTjenester } from '../admin-module-tjenester.js';

function setupDOM() {
    document.body.innerHTML = `
        <div id="admin-config" data-tjenester-folder="tf"></div>
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

describe('initTjenesterModule', () => {
    it('should register window globals', () => {
        initTjenesterModule();
        expect(typeof window.deleteTjeneste).toBe('function');
        expect(typeof window.editTjeneste).toBe('function');
        expect(typeof window.loadTjenesterModule).toBe('function');
    });
});

describe('reloadTjenester', () => {
    it('should call loadTjenesterModule with config and callbacks', () => {
        reloadTjenester();
        expect(loadTjenesterModule).toHaveBeenCalledWith(
            'test-folder',
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

    it('should show error toast when deletion fails', async () => {
        showConfirm.mockResolvedValue(true);
        deleteFile.mockRejectedValue(new Error('fail'));
        await window.deleteTjeneste('id1', 'Test');
        expect(showToast).toHaveBeenCalledWith('Kunne ikke slette tjenesten.', 'error');
    });

    it('should show auth toast when deletion fails with auth error', async () => {
        classifyError.mockReturnValueOnce('auth');
        showConfirm.mockResolvedValue(true);
        deleteFile.mockRejectedValue({ status: 401 });
        await window.deleteTjeneste('id1', 'Test');
        expect(showToast).toHaveBeenCalledWith('Økten din er utløpt. Last siden på nytt.', 'error');
    });

    it('should show network toast when deletion fails with retryable error', async () => {
        classifyError.mockReturnValueOnce('retryable');
        showConfirm.mockResolvedValue(true);
        deleteFile.mockRejectedValue(new Error('network'));
        await window.deleteTjeneste('id1', 'Test');
        expect(showToast).toHaveBeenCalledWith('Nettverksfeil — prøv igjen.', 'error');
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

    beforeEach(() => {
        initTjenesterModule();
        // Get toggleTjenesteActive from the loadTjenesterModule callback
        reloadTjenester();
        toggleFn = loadTjenesterModule.mock.calls[0][3];
        vi.clearAllMocks();

        document.body.innerHTML += `
            <div class="admin-card-interactive">
                <button class="toggle-active-btn" data-id="drive1" data-active="true">
                    <span class="toggle-label">Aktiv</span>
                </button>
            </div>
        `;
    });

    it('should toggle to inactive and save', async () => {
        getFileContent.mockResolvedValue('raw');
        parseMarkdown.mockReturnValue({ data: { active: true, title: 'T' }, body: 'B' });
        stringifyMarkdown.mockReturnValue('md');
        saveFile.mockResolvedValue();

        const service = { active: true };
        await toggleFn('drive1', 'file.md', service);

        expect(getFileContent).toHaveBeenCalledWith('drive1');
        expect(saveFile).toHaveBeenCalledWith('drive1', 'file.md', 'md');
        expect(service.active).toBe(false);
    });

    it('should toggle to active and save', async () => {
        getFileContent.mockResolvedValue('raw');
        parseMarkdown.mockReturnValue({ data: { active: false, title: 'T' }, body: 'B' });
        stringifyMarkdown.mockReturnValue('md');
        saveFile.mockResolvedValue();

        const service = { active: false };
        document.querySelector('.toggle-active-btn').dataset.active = 'false';
        await toggleFn('drive1', 'file.md', service);

        expect(service.active).toBe(true);
    });

    it('should do optimistic UI update', async () => {
        getFileContent.mockResolvedValue('raw');
        parseMarkdown.mockReturnValue({ data: { active: true }, body: '' });
        stringifyMarkdown.mockReturnValue('md');
        saveFile.mockResolvedValue();

        const service = { active: true };
        await toggleFn('drive1', 'file.md', service);

        const btn = document.querySelector('.toggle-active-btn[data-id="drive1"]');
        expect(btn.dataset.active).toBe('false');
        expect(btn.querySelector('.toggle-label').textContent).toBe('Inaktiv');
    });

    it('should revert UI on save failure', async () => {
        getFileContent.mockResolvedValue('raw');
        parseMarkdown.mockReturnValue({ data: { active: true }, body: '' });
        saveFile.mockRejectedValue(new Error('fail'));

        const service = { active: true };
        await toggleFn('drive1', 'file.md', service);

        const btn = document.querySelector('.toggle-active-btn[data-id="drive1"]');
        expect(btn.dataset.active).toBe('true');
        expect(btn.querySelector('.toggle-label').textContent).toBe('Aktiv');
        expect(showToast).toHaveBeenCalledWith('Kunne ikke oppdatere synlighet.', 'error');
    });

    it('should toggle opacity on card', async () => {
        getFileContent.mockResolvedValue('raw');
        parseMarkdown.mockReturnValue({ data: { active: true }, body: '' });
        stringifyMarkdown.mockReturnValue('md');
        saveFile.mockResolvedValue();

        const service = { active: true };
        await toggleFn('drive1', 'file.md', service);

        const card = document.querySelector('.admin-card-interactive');
        expect(card.classList.contains('opacity-60')).toBe(true);
    });
});

describe('toggleTjenesteActive — additional branch coverage', () => {
    let toggleFn;

    beforeEach(() => {
        initTjenesterModule();
        reloadTjenester();
        toggleFn = loadTjenesterModule.mock.calls[0][3];
        vi.clearAllMocks();
    });

    it('should toggle inactive→active with label showing "Aktiv"', async () => {
        document.body.innerHTML += `
            <div class="admin-card-interactive">
                <button class="toggle-active-btn" data-id="drive1" data-active="false">
                    <span class="toggle-label">Inaktiv</span>
                </button>
            </div>
        `;

        getFileContent.mockResolvedValue('raw');
        parseMarkdown.mockReturnValue({ data: { active: false, title: 'T' }, body: 'B' });
        stringifyMarkdown.mockReturnValue('md');
        saveFile.mockResolvedValue();

        const service = { active: false };
        await toggleFn('drive1', 'file.md', service);

        const btn = document.querySelector('.toggle-active-btn[data-id="drive1"]');
        expect(btn.dataset.active).toBe('true');
        expect(btn.querySelector('.toggle-label').textContent).toBe('Aktiv');
        expect(service.active).toBe(true);
    });

    it('should revert inactive→active toggle on failure with label showing "Inaktiv"', async () => {
        document.body.innerHTML += `
            <div class="admin-card-interactive">
                <button class="toggle-active-btn" data-id="drive1" data-active="false">
                    <span class="toggle-label">Inaktiv</span>
                </button>
            </div>
        `;

        getFileContent.mockResolvedValue('raw');
        parseMarkdown.mockReturnValue({ data: { active: false }, body: '' });
        saveFile.mockRejectedValue(new Error('fail'));

        const service = { active: false };
        await toggleFn('drive1', 'file.md', service);

        const btn = document.querySelector('.toggle-active-btn[data-id="drive1"]');
        // Reverted back to the original inactive state
        expect(btn.dataset.active).toBe('false');
        expect(btn.querySelector('.toggle-label').textContent).toBe('Inaktiv');
        expect(showToast).toHaveBeenCalledWith('Kunne ikke oppdatere synlighet.', 'error');
    });

    it('should succeed toggle without btn/card in DOM', async () => {
        // No toggle button or card in DOM for this driveId
        getFileContent.mockResolvedValue('raw');
        parseMarkdown.mockReturnValue({ data: { active: true, title: 'T' }, body: 'B' });
        stringifyMarkdown.mockReturnValue('md');
        saveFile.mockResolvedValue();

        const service = { active: true };
        await toggleFn('no-btn', 'file.md', service);

        expect(saveFile).toHaveBeenCalled();
        expect(service.active).toBe(false);
    });

    it('should handle toggle error without btn/card in DOM', async () => {
        // No toggle button or card in DOM
        getFileContent.mockResolvedValue('raw');
        parseMarkdown.mockReturnValue({ data: { active: true }, body: '' });
        saveFile.mockRejectedValue(new Error('fail'));

        const service = { active: true };
        await toggleFn('no-btn', 'file.md', service);

        expect(showToast).toHaveBeenCalledWith('Kunne ikke oppdatere synlighet.', 'error');
        expect(loadTjenesterModule).toHaveBeenCalled();
    });

    it('should succeed toggle without label span', async () => {
        document.body.innerHTML += `
            <div class="admin-card-interactive">
                <button class="toggle-active-btn" data-id="drive1" data-active="true">
                </button>
            </div>
        `;

        getFileContent.mockResolvedValue('raw');
        parseMarkdown.mockReturnValue({ data: { active: true, title: 'T' }, body: 'B' });
        stringifyMarkdown.mockReturnValue('md');
        saveFile.mockResolvedValue();

        const service = { active: true };
        await toggleFn('drive1', 'file.md', service);

        const btn = document.querySelector('.toggle-active-btn[data-id="drive1"]');
        expect(btn.dataset.active).toBe('false');
        // No label to update, but toggle should still work
        expect(service.active).toBe(false);
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
