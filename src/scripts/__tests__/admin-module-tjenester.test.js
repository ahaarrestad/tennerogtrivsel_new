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
    stripStackEditData: vi.fn(s => s),
    slugify: vi.fn(s => s.toLowerCase().replace(/\s+/g, '-')),
}));

vi.mock('../admin-dashboard.js', () => ({
    loadTjenesterModule: vi.fn(),
}));

vi.mock('../admin-editor-helpers.js', () => ({
    getAdminConfig: vi.fn(() => ({
        TJENESTER_FOLDER: 'test-folder',
    })),
    renderToggleHtml: vi.fn((id, active) => `<button id="${id}" data-active="${active}"><span class="toggle-label">${active ? 'Aktiv' : 'Inaktiv'}</span></button>`),
    attachToggleClick: vi.fn(),
    showDeletionToast: vi.fn(),
    initMarkdownEditor: vi.fn(),
}));

vi.mock('../admin-api-retry.js', () => ({
    createAuthRefresher: vi.fn(() => () => Promise.resolve(true)),
}));

import { deleteFile, getFileContent, parseMarkdown, saveFile, createFile, stringifyMarkdown } from '../admin-client.js';
import { showConfirm, showToast } from '../admin-dialog.js';
import { loadTjenesterModule } from '../admin-dashboard.js';
import { showDeletionToast, initMarkdownEditor } from '../admin-editor-helpers.js';
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
        expect(inner.innerHTML).toContain('Tannbleking');
        expect(inner.innerHTML).toContain('Fin');
        expect(initMarkdownEditor).toHaveBeenCalledWith(expect.any(Function));
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

    it('should save existing tjeneste on save callback', async () => {
        getFileContent.mockResolvedValue('raw');
        parseMarkdown.mockReturnValue({
            data: { title: 'Old', ingress: '', id: 'old', active: true },
            body: 'Body'
        });
        stringifyMarkdown.mockReturnValue('---\n---\n');
        saveFile.mockResolvedValue();

        await window.editTjeneste('id1', 'Old');

        // Get the onSave callback passed to initMarkdownEditor
        const onSave = initMarkdownEditor.mock.calls[0][0];
        await onSave(null);

        expect(saveFile).toHaveBeenCalledWith('id1', expect.any(String), expect.any(String));
        expect(loadTjenesterModule).toHaveBeenCalled();
    });

    it('should create new tjeneste when no id', async () => {
        stringifyMarkdown.mockReturnValue('---\n---\n');
        createFile.mockResolvedValue();

        await window.editTjeneste(null, null);

        const onSave = initMarkdownEditor.mock.calls[0][0];
        await onSave(null);

        expect(createFile).toHaveBeenCalledWith('test-folder', expect.any(String), expect.any(String));
    });

    it('should show error toast when save fails', async () => {
        getFileContent.mockResolvedValue('raw');
        parseMarkdown.mockReturnValue({
            data: { title: 'T', ingress: '', id: 't', active: true },
            body: ''
        });
        saveFile.mockRejectedValue(new Error('save fail'));

        await window.editTjeneste('id1', 'T');

        const onSave = initMarkdownEditor.mock.calls[0][0];
        await onSave(null);

        expect(showToast).toHaveBeenCalledWith('Kunne ikke lagre endringene.', 'error');
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
