/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('dompurify', () => ({ default: { sanitize: vi.fn(html => html) } }));
vi.mock('marked', () => ({ marked: { parse: vi.fn(text => `<p>${text}</p>`) } }));

vi.mock('../admin-client.js', () => ({
    updateTannlegeRow: vi.fn(),
    addTannlegeRow: vi.fn(),
    deleteTannlegeRowPermanently: vi.fn(),
    getDriveImageBlob: vi.fn(),
    findFileByName: vi.fn(),
    backupToSlettetSheet: vi.fn(),
    getTannlegerRaw: vi.fn(),
    silentLogin: vi.fn(),
}));

vi.mock('../admin-dialog.js', () => ({
    showToast: vi.fn(),
    showConfirm: vi.fn().mockResolvedValue(false),
}));

vi.mock('../admin-gallery.js', () => ({
    loadGallery: vi.fn(),
    setupUploadHandler: vi.fn(),
}));

import { loadGallery, setupUploadHandler } from '../admin-gallery.js';

vi.mock('../admin-dashboard.js', () => ({
    loadTannlegerModule: vi.fn(),
    formatTimestamp: vi.fn(() => '24. feb kl. 12:00'),
}));

vi.mock('../admin-editor-helpers.js', () => ({
    getAdminConfig: vi.fn(() => ({
        SHEET_ID: 'test-sheet',
        TANNLEGER_FOLDER: 'test-tannleger-folder',
    })),
    renderToggleHtml: vi.fn((id, active) => `<button id="${id}" data-active="${active}"><span class="toggle-label">${active ? 'Aktiv' : 'Inaktiv'}</span></button>`),
    attachToggleClick: vi.fn(),
    showDeletionToast: vi.fn(),
    bindSliderStepButtons: vi.fn(),
    bindWheelPrevent: vi.fn(),
    showSaveBar: vi.fn(),
    hideSaveBar: vi.fn(),
    escapeHtml: vi.fn(s => String(s ?? '')),
}));

vi.mock('../admin-api-retry.js', () => ({
    createAuthRefresher: vi.fn(() => () => Promise.resolve(true)),
}));

import {
    updateTannlegeRow, addTannlegeRow, deleteTannlegeRowPermanently, getTannlegerRaw,
    backupToSlettetSheet, findFileByName, getDriveImageBlob
} from '../admin-client.js';
import { showConfirm, showToast } from '../admin-dialog.js';
import { loadTannlegerModule } from '../admin-dashboard.js';
import { showDeletionToast, attachToggleClick, bindSliderStepButtons, bindWheelPrevent, showSaveBar, hideSaveBar } from '../admin-editor-helpers.js';
import { initTannlegerModule, reloadTannleger } from '../admin-module-tannleger.js';

function setupDOM() {
    document.body.innerHTML = `
        <div id="admin-config" data-sheet-id="sid" data-tannleger-folder="taf"></div>
        <div id="module-inner"></div>
        <div id="module-actions"></div>
        <dialog id="image-picker-modal"></dialog>
    `;
}

beforeEach(() => {
    setupDOM();
    vi.clearAllMocks();
});

describe('initTannlegerModule', () => {
    it('should register window globals', () => {
        initTannlegerModule();
        expect(typeof window.deleteTannlege).toBe('function');
        expect(typeof window.editTannlege).toBe('function');
        expect(typeof window.openTannlegerModule).toBe('function');
    });
});

describe('reloadTannleger', () => {
    it('should call loadTannlegerModule with correct args', () => {
        reloadTannleger();
        expect(loadTannlegerModule).toHaveBeenCalledWith(
            'test-sheet',
            expect.any(Function),
            expect.any(Function),
            'test-tannleger-folder',
            expect.any(Function)
        );
    });

    it('should call clearBreadcrumbEditor', () => {
        window.clearBreadcrumbEditor = vi.fn();
        reloadTannleger();
        expect(window.clearBreadcrumbEditor).toHaveBeenCalled();
    });
});

describe('deleteTannlege', () => {
    beforeEach(() => {
        initTannlegerModule();
    });

    it('should do nothing when user cancels', async () => {
        showConfirm.mockResolvedValue(false);
        await window.deleteTannlege(2, 'Dr. Tansen');
        expect(deleteTannlegeRowPermanently).not.toHaveBeenCalled();
    });

    it('should backup, delete, and show toast when confirmed', async () => {
        showConfirm.mockResolvedValue(true);
        getTannlegerRaw.mockResolvedValue([
            { rowIndex: 2, name: 'Dr. Tansen', title: 'Tannlege' }
        ]);
        backupToSlettetSheet.mockResolvedValue();
        deleteTannlegeRowPermanently.mockResolvedValue();

        await window.deleteTannlege(2, 'Dr. Tansen');

        expect(backupToSlettetSheet).toHaveBeenCalledWith('test-sheet', 'tannlege', 'Dr. Tansen', expect.any(String));
        expect(deleteTannlegeRowPermanently).toHaveBeenCalledWith('test-sheet', 2);
        expect(showDeletionToast).toHaveBeenCalledWith('Dr. Tansen', expect.stringContaining('sikkerhetskopi'));
        expect(loadTannlegerModule).toHaveBeenCalled();
    });

    it('should show error on failure', async () => {
        showConfirm.mockResolvedValue(true);
        getTannlegerRaw.mockRejectedValue(new Error('fail'));
        await window.deleteTannlege(2, 'Dr. Tansen');
        expect(showToast).toHaveBeenCalledWith('Kunne ikke slette profilen.', 'error');
    });

    it('should delete even when row not found for backup', async () => {
        showConfirm.mockResolvedValue(true);
        getTannlegerRaw.mockResolvedValue([]); // No matching row
        deleteTannlegeRowPermanently.mockResolvedValue();

        await window.deleteTannlege(999, 'Missing');

        expect(backupToSlettetSheet).not.toHaveBeenCalled();
        expect(deleteTannlegeRowPermanently).toHaveBeenCalledWith('test-sheet', 999);
    });
});

describe('editTannlege', () => {
    beforeEach(() => {
        initTannlegerModule();
    });

    it('should show loading state', async () => {
        findFileByName.mockReturnValue(new Promise(() => {}));
        window.editTannlege(2, { name: 'Test', title: '', description: '', image: 'test.jpg', active: true, scale: 1, positionX: 50, positionY: 50 });
        expect(document.getElementById('module-inner').innerHTML).toContain('Henter profil');
    });

    it('should render editor for new tannlege (no data)', async () => {
        await window.editTannlege(null);

        const inner = document.getElementById('module-inner');
        expect(inner.querySelector('#edit-t-name')).not.toBeNull();
        expect(inner.querySelector('#edit-t-title')).not.toBeNull();
        expect(inner.querySelector('#edit-t-desc')).not.toBeNull();
        expect(attachToggleClick).toHaveBeenCalledWith('edit-t-active-toggle', expect.any(Function));
        expect(bindSliderStepButtons).toHaveBeenCalled();
        expect(bindWheelPrevent).toHaveBeenCalled();
    });

    it('should render editor with existing data', async () => {
        await window.editTannlege(2, {
            name: 'Dr. Hansen',
            title: 'Tannlege',
            description: 'Erfaren tannlege',
            image: '',
            active: true,
            scale: 1.5,
            positionX: 30,
            positionY: 70
        });

        const inner = document.getElementById('module-inner');
        expect(inner.querySelector('#edit-t-name').value).toBe('Dr. Hansen');
        expect(inner.querySelector('#edit-t-title').value).toBe('Tannlege');
        expect(inner.querySelector('#edit-t-scale').value).toBe('1.5');
    });

    it('should try to load preview image for existing tannlege with image file', async () => {
        findFileByName.mockResolvedValue({ id: 'file-id' });
        getDriveImageBlob.mockResolvedValue('blob:test');

        await window.editTannlege(2, {
            name: 'Dr. Hansen',
            title: 'Tannlege',
            description: '',
            image: 'hansen.jpg',
            active: true,
            scale: 1,
            positionX: 50,
            positionY: 50
        });

        expect(findFileByName).toHaveBeenCalledWith('hansen.jpg', 'test-tannleger-folder');
        expect(getDriveImageBlob).toHaveBeenCalledWith('file-id');
    });

    it('should handle long image ID (Drive ID) directly', async () => {
        getDriveImageBlob.mockResolvedValue('blob:test');

        await window.editTannlege(2, {
            name: 'Dr. Hansen',
            title: '',
            description: '',
            image: '1234567890abcdefghijk',
            active: true,
            scale: 1,
            positionX: 50,
            positionY: 50
        });

        expect(findFileByName).not.toHaveBeenCalled();
        expect(getDriveImageBlob).toHaveBeenCalledWith('1234567890abcdefghijk');
    });

    it('should set breadcrumb editor and clear actions', async () => {
        window.setBreadcrumbEditor = vi.fn();
        await window.editTannlege(null);

        const actions = document.getElementById('module-actions');
        expect(actions.innerHTML).toBe('');
        expect(window.setBreadcrumbEditor).toHaveBeenCalledWith('Redigerer profil', expect.any(Function));
    });

    it('should not crash when module-inner is missing', async () => {
        document.body.innerHTML = '';
        await expect(window.editTannlege(null)).resolves.toBeUndefined();
    });

    it('should set up image gallery button', async () => {
        await window.editTannlege(null);

        const btnGallery = document.getElementById('btn-open-gallery');
        expect(btnGallery).not.toBeNull();
    });

    it('should render preview card', async () => {
        await window.editTannlege(2, {
            name: 'Dr. A',
            title: 'Tannlege',
            description: 'Beskrivelse',
            image: '',
            active: true,
            scale: 1,
            positionX: 50,
            positionY: 50
        });

        const inner = document.getElementById('module-inner');
        expect(inner.querySelector('#preview-name').textContent).toBe('Dr. A');
        expect(inner.querySelector('#preview-title').textContent).toBe('Tannlege');
    });

    it('should update preview when name input changes', async () => {
        await window.editTannlege(2, {
            name: 'Dr. A', title: 'T', description: 'D',
            image: '', active: true, scale: 1, positionX: 50, positionY: 50
        });

        const nameInp = document.getElementById('edit-t-name');
        nameInp.value = 'Dr. B';
        nameInp.dispatchEvent(new Event('input'));

        expect(document.getElementById('preview-name').textContent).toBe('Dr. B');
    });

    it('should update preview when scale slider changes', async () => {
        await window.editTannlege(2, {
            name: 'N', title: 'T', description: 'D',
            image: '', active: true, scale: 1, positionX: 50, positionY: 50
        });

        const scaleInp = document.getElementById('edit-t-scale');
        scaleInp.value = '2.0';
        scaleInp.dispatchEvent(new Event('input'));

        expect(document.getElementById('val-scale').textContent).toBe('2.0x');
    });

    it('should show status text on preview update', async () => {
        vi.useFakeTimers();
        await window.editTannlege(2, {
            name: 'N', title: 'T', description: 'D',
            image: '', active: true, scale: 1, positionX: 50, positionY: 50
        });

        const nameInp = document.getElementById('edit-t-name');
        nameInp.value = 'Changed';
        nameInp.dispatchEvent(new Event('input'));

        expect(showSaveBar).toHaveBeenCalledWith('changed', expect.stringContaining('Endringer oppdaget'));
        vi.useRealTimers();
    });

    it('should auto-save after debounce for existing row', async () => {
        vi.useFakeTimers();
        updateTannlegeRow.mockResolvedValue();
        getTannlegerRaw.mockResolvedValue([{ rowIndex: 2, name: 'Changed' }]);

        await window.editTannlege(2, {
            name: 'N', title: 'T', description: 'D',
            image: '', active: true, scale: 1, positionX: 50, positionY: 50
        });

        const nameInp = document.getElementById('edit-t-name');
        nameInp.value = 'Changed';
        nameInp.dispatchEvent(new Event('input'));

        // Advance past debounce
        await vi.advanceTimersByTimeAsync(1500);

        expect(updateTannlegeRow).toHaveBeenCalledWith('test-sheet', 2, expect.objectContaining({ name: 'Changed' }));
        vi.useRealTimers();
    });

    it('should add new tannlege row when no rowIndex', async () => {
        vi.useFakeTimers();
        addTannlegeRow.mockResolvedValue();

        await window.editTannlege(null, {
            name: 'New', title: 'T', description: 'D',
            image: '', active: true, scale: 1, positionX: 50, positionY: 50
        });

        const nameInp = document.getElementById('edit-t-name');
        nameInp.value = 'New';
        nameInp.dispatchEvent(new Event('input'));

        await vi.advanceTimersByTimeAsync(1500);

        expect(addTannlegeRow).toHaveBeenCalledWith('test-sheet', expect.objectContaining({ name: 'New' }));
        vi.useRealTimers();
    });

    it('should handle save error', async () => {
        vi.useFakeTimers();
        updateTannlegeRow.mockRejectedValue(new Error('save fail'));

        await window.editTannlege(2, {
            name: 'N', title: 'T', description: 'D',
            image: '', active: true, scale: 1, positionX: 50, positionY: 50
        });

        const nameInp = document.getElementById('edit-t-name');
        nameInp.value = 'X';
        nameInp.dispatchEvent(new Event('input'));

        await vi.advanceTimersByTimeAsync(1500);

        expect(showSaveBar).toHaveBeenCalledWith('error', expect.stringContaining('Feil ved lagring'));
        vi.useRealTimers();
    });

    it('should handle verification mismatch after save', async () => {
        vi.useFakeTimers();
        updateTannlegeRow.mockResolvedValue();
        // Return a row with different name to trigger mismatch
        getTannlegerRaw.mockResolvedValue([{ rowIndex: 2, name: 'Different' }]);

        await window.editTannlege(2, {
            name: 'N', title: 'T', description: 'D',
            image: '', active: true, scale: 1, positionX: 50, positionY: 50
        });

        const nameInp = document.getElementById('edit-t-name');
        nameInp.value = 'Expected';
        nameInp.dispatchEvent(new Event('input'));

        await vi.advanceTimersByTimeAsync(1500);

        expect(showSaveBar).toHaveBeenCalledWith('error', expect.stringContaining('Laster på nytt'));
        vi.useRealTimers();
    });

    it('should handle verification failure gracefully', async () => {
        vi.useFakeTimers();
        updateTannlegeRow.mockResolvedValue();
        getTannlegerRaw.mockRejectedValue(new Error('verify fail'));

        await window.editTannlege(2, {
            name: 'N', title: 'T', description: 'D',
            image: '', active: true, scale: 1, positionX: 50, positionY: 50
        });

        const nameInp = document.getElementById('edit-t-name');
        nameInp.value = 'Changed';
        nameInp.dispatchEvent(new Event('input'));

        await vi.advanceTimersByTimeAsync(1500);

        // Should still show success despite verify failure
        expect(showSaveBar).toHaveBeenCalledWith('saved', expect.stringContaining('Lagret'));
        vi.useRealTimers();
    });

    it('should update position X/Y preview labels', async () => {
        await window.editTannlege(2, {
            name: 'N', title: 'T', description: 'D',
            image: '', active: true, scale: 1, positionX: 50, positionY: 50
        });

        const xInp = document.getElementById('edit-t-x');
        xInp.value = '30';
        xInp.dispatchEvent(new Event('input'));
        expect(document.getElementById('val-x').textContent).toBe('30%');

        const yInp = document.getElementById('edit-t-y');
        yInp.value = '70';
        yInp.dispatchEvent(new Event('input'));
        expect(document.getElementById('val-y').textContent).toBe('70%');
    });

    it('should use fallback preview path when Drive fetch fails', async () => {
        findFileByName.mockRejectedValue(new Error('fail'));

        await window.editTannlege(2, {
            name: 'N', title: 'T', description: 'D',
            image: 'bilde.jpg', active: true, scale: 1, positionX: 50, positionY: 50
        });

        const img = document.getElementById('preview-img');
        expect(img.src).toContain('/src/assets/tannleger/bilde.jpg');
    });

    it('should handle image with no Drive result and no filename extension', async () => {
        getDriveImageBlob.mockResolvedValue(null);

        await window.editTannlege(2, {
            name: 'N', title: 'T', description: 'D',
            image: '1234567890abcdefghijk',
            active: true, scale: 1, positionX: 50, positionY: 50
        });

        // No preview should be shown (no blob, no extension to fall back to)
        const img = document.getElementById('preview-img');
        expect(img.classList.contains('hidden')).toBe(true);
    });

    it('should open gallery modal on btn-open-gallery click', async () => {
        // Need dialog element with showModal
        const dialog = document.getElementById('image-picker-modal');
        dialog.showModal = vi.fn();
        dialog.close = vi.fn();

        await window.editTannlege(null);

        const btnGallery = document.getElementById('btn-open-gallery');
        btnGallery.click();
        expect(dialog.showModal).toHaveBeenCalled();
        expect(loadGallery).toHaveBeenCalledWith('test-tannleger-folder', expect.any(Function));
    });

    it('should update image input when gallery file is selected', async () => {
        const dialog = document.getElementById('image-picker-modal');
        dialog.showModal = vi.fn();
        dialog.close = vi.fn();
        getDriveImageBlob.mockResolvedValue('blob:new-img');

        await window.editTannlege(null);

        document.getElementById('btn-open-gallery').click();

        // Get the onSelect callback from loadGallery
        const onSelect = loadGallery.mock.calls[0][1];
        await onSelect('file-id-123', 'new-image.jpg');

        expect(document.getElementById('edit-t-image').value).toBe('new-image.jpg');
        expect(dialog.close).toHaveBeenCalled();
    });

    it('should handle upload handler callback', async () => {
        const dialog = document.getElementById('image-picker-modal');
        dialog.showModal = vi.fn();
        dialog.close = vi.fn();
        getDriveImageBlob.mockResolvedValue('blob:uploaded');

        await window.editTannlege(null);

        // Get the upload handler callback
        const onUpload = setupUploadHandler.mock.calls[0][1];
        await onUpload({ id: 'uploaded-id', name: 'uploaded.jpg' });

        expect(document.getElementById('edit-t-image').value).toBe('uploaded.jpg');
        expect(dialog.close).toHaveBeenCalled();
    });

    it('should ignore upload handler with null file', async () => {
        const dialog = document.getElementById('image-picker-modal');
        dialog.showModal = vi.fn();
        dialog.close = vi.fn();

        await window.editTannlege(null);

        const onUpload = setupUploadHandler.mock.calls[0][1];
        await onUpload(null);

        // Image input should remain empty
        expect(document.getElementById('edit-t-image').value).toBe('');
        expect(dialog.close).not.toHaveBeenCalled();
    });

    it('should handle gallery select with null blob URL', async () => {
        const dialog = document.getElementById('image-picker-modal');
        dialog.showModal = vi.fn();
        dialog.close = vi.fn();
        getDriveImageBlob.mockResolvedValue(null);

        await window.editTannlege(null);
        document.getElementById('btn-open-gallery').click();

        const onSelect = loadGallery.mock.calls[0][1];
        await onSelect('file-id', 'new.jpg');

        expect(document.getElementById('edit-t-image').value).toBe('new.jpg');
        // Preview should remain hidden (blob was null)
        const img = document.getElementById('preview-img');
        expect(img.classList.contains('hidden')).toBe(true);
    });

    it('should handle upload with null blob URL', async () => {
        const dialog = document.getElementById('image-picker-modal');
        dialog.showModal = vi.fn();
        dialog.close = vi.fn();
        getDriveImageBlob.mockResolvedValue(null);

        await window.editTannlege(null);

        const onUpload = setupUploadHandler.mock.calls[0][1];
        await onUpload({ id: 'new-id', name: 'uploaded.jpg' });

        expect(document.getElementById('edit-t-image').value).toBe('uploaded.jpg');
        const img = document.getElementById('preview-img');
        expect(img.classList.contains('hidden')).toBe(true);
    });

    it('should handle findFileByName returning null', async () => {
        findFileByName.mockResolvedValue(null);

        await window.editTannlege(2, {
            name: 'N', title: 'T', description: 'D',
            image: 'test.jpg', active: true, scale: 1, positionX: 50, positionY: 50
        });

        // No Drive ID → falls back to local path
        const img = document.getElementById('preview-img');
        expect(img.src).toContain('/src/assets/tannleger/test.jpg');
    });

    it('should update last-fetched time on verification', async () => {
        vi.useFakeTimers();
        document.body.innerHTML += '<span id="tannleger-last-fetched"></span>';
        updateTannlegeRow.mockResolvedValue();
        getTannlegerRaw.mockResolvedValue([{ rowIndex: 2, name: 'N' }]);

        await window.editTannlege(2, {
            name: 'N', title: 'T', description: 'D',
            image: '', active: true, scale: 1, positionX: 50, positionY: 50
        });

        document.getElementById('edit-t-name').value = 'N';
        document.getElementById('edit-t-name').dispatchEvent(new Event('input'));
        await vi.advanceTimersByTimeAsync(1500);

        expect(document.getElementById('tannleger-last-fetched').textContent).toContain('24. feb');
        vi.useRealTimers();
    });

    it('should show saved and schedule hide after success', async () => {
        vi.useFakeTimers();
        updateTannlegeRow.mockResolvedValue();
        getTannlegerRaw.mockResolvedValue([{ rowIndex: 2, name: 'N' }]);

        await window.editTannlege(2, {
            name: 'N', title: 'T', description: 'D',
            image: '', active: true, scale: 1, positionX: 50, positionY: 50
        });

        document.getElementById('edit-t-name').value = 'N';
        document.getElementById('edit-t-name').dispatchEvent(new Event('input'));
        await vi.advanceTimersByTimeAsync(1500);

        expect(showSaveBar).toHaveBeenCalledWith('saved', expect.stringContaining('Lagret'));
        expect(hideSaveBar).toHaveBeenCalledWith(5000);
        vi.useRealTimers();
    });

    it('should update preview description on change', async () => {
        await window.editTannlege(2, {
            name: 'N', title: 'T', description: 'Old desc',
            image: '', active: true, scale: 1, positionX: 50, positionY: 50
        });

        const descInp = document.getElementById('edit-t-desc');
        descInp.value = 'New desc';
        descInp.dispatchEvent(new Event('change'));

        expect(document.getElementById('preview-desc').textContent).toBe('New desc');
    });

    it('should show empty placeholders when fields are cleared', async () => {
        await window.editTannlege(2, {
            name: 'N', title: 'T', description: 'D',
            image: '', active: true, scale: 1, positionX: 50, positionY: 50
        });

        document.getElementById('edit-t-name').value = '';
        document.getElementById('edit-t-name').dispatchEvent(new Event('input'));
        expect(document.getElementById('preview-name').textContent).toBe('Navn');

        document.getElementById('edit-t-title').value = '';
        document.getElementById('edit-t-title').dispatchEvent(new Event('change'));
        expect(document.getElementById('preview-title').textContent).toBe('Tittel');
    });
});

describe('toggleTannlegeActive', () => {
    it('should optimistically update UI and revert on error', async () => {
        initTannlegerModule();

        document.body.innerHTML += `
            <div class="admin-card-interactive">
                <button class="toggle-active-btn" data-row="2" data-active="true">
                    <span class="toggle-label">Aktiv</span>
                </button>
            </div>
        `;

        // toggleTannlegeActive is passed as callback via loadTannlegerModule
        // We can get it from the mock call
        reloadTannleger();
        const toggleFn = loadTannlegerModule.mock.calls[0][4];

        updateTannlegeRow.mockRejectedValue(new Error('fail'));
        const t = { active: true };
        await toggleFn(2, t);

        // Should have been reverted on error
        const btn = document.querySelector('.toggle-active-btn[data-row="2"]');
        expect(btn.dataset.active).toBe('true');
        expect(loadTannlegerModule).toHaveBeenCalledTimes(2); // reload + error reload
    });

    it('should update data on success', async () => {
        initTannlegerModule();
        reloadTannleger();
        const toggleFn = loadTannlegerModule.mock.calls[0][4];

        updateTannlegeRow.mockResolvedValue();
        const t = { active: true };
        await toggleFn(2, t);

        expect(t.active).toBe(false);
        expect(updateTannlegeRow).toHaveBeenCalledWith('test-sheet', 2, expect.objectContaining({ active: false }));
    });

    it('should update label text on successful toggle with label', async () => {
        initTannlegerModule();

        // Add toggle button with label BEFORE calling reloadTannleger
        const wrapper = document.createElement('div');
        wrapper.className = 'admin-card-interactive';
        wrapper.innerHTML = '<button class="toggle-active-btn" data-row="5" data-active="true"><span class="toggle-label">Aktiv</span></button>';
        document.body.appendChild(wrapper);

        reloadTannleger();
        const toggleFn = loadTannlegerModule.mock.calls[0][4];

        updateTannlegeRow.mockResolvedValue();
        const t = { active: true };
        await toggleFn(5, t);

        const btn = document.querySelector('.toggle-active-btn[data-row="5"]');
        expect(btn.querySelector('.toggle-label').textContent).toBe('Inaktiv');
        expect(btn.dataset.active).toBe('false');
    });

    it('should handle toggle without btn/card in DOM', async () => {
        initTannlegerModule();
        reloadTannleger();
        const toggleFn = loadTannlegerModule.mock.calls[0][4];

        // No toggle button in DOM for this row
        updateTannlegeRow.mockResolvedValue();
        const t = { active: true };
        await toggleFn(999, t);

        expect(t.active).toBe(false);
    });

    it('should handle toggle error without btn/card in DOM', async () => {
        initTannlegerModule();
        reloadTannleger();
        const toggleFn = loadTannlegerModule.mock.calls[0][4];

        // No toggle button in DOM
        updateTannlegeRow.mockRejectedValue(new Error('fail'));
        const t = { active: true };
        await toggleFn(999, t);

        // Should not crash and should reload
        expect(loadTannlegerModule).toHaveBeenCalledTimes(2);
    });

    it('should handle toggle without label span', async () => {
        initTannlegerModule();

        document.body.innerHTML += `
            <div class="admin-card-interactive">
                <button class="toggle-active-btn" data-row="3" data-active="true"></button>
            </div>
        `;

        reloadTannleger();
        const toggleFn = loadTannlegerModule.mock.calls[0][4];

        updateTannlegeRow.mockResolvedValue();
        const t = { active: true };
        await toggleFn(3, t);

        const btn = document.querySelector('.toggle-active-btn[data-row="3"]');
        expect(btn.dataset.active).toBe('false');
        expect(t.active).toBe(false);
    });

    it('should handle toggle error revert without label span', async () => {
        initTannlegerModule();

        document.body.innerHTML += `
            <div class="admin-card-interactive">
                <button class="toggle-active-btn" data-row="4" data-active="true"></button>
            </div>
        `;

        reloadTannleger();
        const toggleFn = loadTannlegerModule.mock.calls[0][4];

        updateTannlegeRow.mockRejectedValue(new Error('fail'));
        const t = { active: true };
        await toggleFn(4, t);

        const btn = document.querySelector('.toggle-active-btn[data-row="4"]');
        expect(btn.dataset.active).toBe('true'); // reverted
    });

    it('should set label to Aktiv when toggling inactive→active', async () => {
        initTannlegerModule();

        const wrapper = document.createElement('div');
        wrapper.className = 'admin-card-interactive opacity-60';
        wrapper.innerHTML = '<button class="toggle-active-btn" data-row="10" data-active="false"><span class="toggle-label">Inaktiv</span></button>';
        document.body.appendChild(wrapper);

        reloadTannleger();
        const toggleFn = loadTannlegerModule.mock.calls[0][4];

        updateTannlegeRow.mockResolvedValue();
        const t = { active: false };
        await toggleFn(10, t);

        const btn = document.querySelector('.toggle-active-btn[data-row="10"]');
        expect(btn.querySelector('.toggle-label').textContent).toBe('Aktiv');
        expect(t.active).toBe(true);
    });

    it('should revert label to Inaktiv on failed toggle from inactive→active', async () => {
        initTannlegerModule();

        const wrapper = document.createElement('div');
        wrapper.className = 'admin-card-interactive opacity-60';
        wrapper.innerHTML = '<button class="toggle-active-btn" data-row="11" data-active="false"><span class="toggle-label">Inaktiv</span></button>';
        document.body.appendChild(wrapper);

        reloadTannleger();
        const toggleFn = loadTannlegerModule.mock.calls[0][4];

        updateTannlegeRow.mockRejectedValue(new Error('fail'));
        const t = { active: false };
        await toggleFn(11, t);

        // Should revert: label back to Inaktiv, active stays false
        const btn = document.querySelector('.toggle-active-btn[data-row="11"]');
        expect(btn.querySelector('.toggle-label').textContent).toBe('Inaktiv');
        expect(btn.dataset.active).toBe('false');
    });
});
