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
    deleteFile: vi.fn(),
    listImages: vi.fn(),
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
    renderImageCropSliders: vi.fn(({ prefix, valPrefix, scale = 1, posX = 50, posY = 50 }) =>
        `<div><input type="range" id="${prefix}-scale" value="${scale}"><span id="${valPrefix}-scale">${scale}x</span><input type="range" id="${prefix}-x" value="${posX}"><span id="${valPrefix}-x">${posX}%</span><input type="range" id="${prefix}-y" value="${posY}"><span id="${valPrefix}-y">${posY}%</span></div>`),
    createAutoSaver: vi.fn((saveFn) => ({ trigger: vi.fn(), cancel: vi.fn(), _saveFn: saveFn })),
    bindSliderStepButtons: vi.fn(),
    bindWheelPrevent: vi.fn(),
    showSaveBar: vi.fn(),
    hideSaveBar: vi.fn(),
    escapeHtml: vi.fn(s => String(s ?? '')),
    resolveImagePreview: vi.fn().mockResolvedValue({ src: '', imageId: null }),
    handleImageSelected: vi.fn().mockResolvedValue(undefined),
    verifySave: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../admin-api-retry.js', () => ({
    createAuthRefresher: vi.fn(() => () => Promise.resolve(true)),
}));

import {
    updateTannlegeRow, addTannlegeRow, deleteTannlegeRowPermanently, getTannlegerRaw,
    backupToSlettetSheet, getDriveImageBlob, findFileByName, deleteFile
} from '../admin-client.js';
import { showConfirm, showToast } from '../admin-dialog.js';
import { loadTannlegerModule } from '../admin-dashboard.js';
import { showDeletionToast, attachToggleClick, bindSliderStepButtons, bindWheelPrevent, showSaveBar, hideSaveBar, createAutoSaver, resolveImagePreview, handleImageSelected, verifySave } from '../admin-editor-helpers.js';
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
    resolveImagePreview.mockResolvedValue({ src: '', imageId: null });
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

describe('consistency check (tannleger)', () => {
    it('should show warning when Sheet references missing Drive files', async () => {
        getTannlegerRaw.mockResolvedValue([
            { rowIndex: 2, name: 'Dr. A', image: 'a.jpg' },
            { rowIndex: 3, name: 'Dr. B', image: 'mangler.jpg' }
        ]);
        const { listImages } = await import('../admin-client.js');
        listImages.mockResolvedValue([{ name: 'a.jpg' }]);

        reloadTannleger();
        await new Promise(r => setTimeout(r, 0));

        expect(showToast).toHaveBeenCalledWith(
            expect.stringContaining('1 profil(er) refererer bilder som ikke finnes i Drive'),
            'warning'
        );
    });

    it('should show info when Drive has orphaned files', async () => {
        getTannlegerRaw.mockResolvedValue([
            { rowIndex: 2, name: 'Dr. A', image: 'a.jpg' }
        ]);
        const { listImages } = await import('../admin-client.js');
        listImages.mockResolvedValue([
            { name: 'a.jpg' },
            { name: 'orphan.jpg' }
        ]);

        reloadTannleger();
        await new Promise(r => setTimeout(r, 0));

        expect(showToast).toHaveBeenCalledWith(
            expect.stringContaining('1 bilde(r) i Drive-mappen er ikke koblet'),
            'info'
        );
    });

    it('should show no warnings when everything is consistent', async () => {
        getTannlegerRaw.mockResolvedValue([
            { rowIndex: 2, name: 'Dr. A', image: 'a.jpg' }
        ]);
        const { listImages } = await import('../admin-client.js');
        listImages.mockResolvedValue([{ name: 'a.jpg' }]);

        reloadTannleger();
        await new Promise(r => setTimeout(r, 0));

        expect(showToast).not.toHaveBeenCalled();
    });

    it('should not crash when listImages fails (best-effort)', async () => {
        const { listImages } = await import('../admin-client.js');
        listImages.mockRejectedValue(new Error('Drive API error'));
        getTannlegerRaw.mockResolvedValue([]);

        reloadTannleger();
        await new Promise(r => setTimeout(r, 0));

        expect(showToast).not.toHaveBeenCalled();
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

    it('should backup, delete Sheet row and Drive file when confirmed (happy path)', async () => {
        showConfirm.mockResolvedValue(true);
        getTannlegerRaw.mockResolvedValue([
            { rowIndex: 2, name: 'Dr. Tansen', title: 'Tannlege', image: 'tansen.jpg' }
        ]);
        backupToSlettetSheet.mockResolvedValue();
        deleteTannlegeRowPermanently.mockResolvedValue();
        findFileByName.mockResolvedValue({ id: 'drive-file-id' });
        deleteFile.mockResolvedValue();

        await window.deleteTannlege(2, 'Dr. Tansen');

        expect(backupToSlettetSheet).toHaveBeenCalledWith('test-sheet', 'tannlege', 'Dr. Tansen', expect.any(String));
        expect(deleteTannlegeRowPermanently).toHaveBeenCalledWith('test-sheet', 2);
        expect(findFileByName).toHaveBeenCalledWith('tansen.jpg', 'test-tannleger-folder');
        expect(deleteFile).toHaveBeenCalledWith('drive-file-id');
        expect(showDeletionToast).toHaveBeenCalledWith('Dr. Tansen', expect.stringContaining('Drive-papirkurven'));
        expect(loadTannlegerModule).toHaveBeenCalled();
    });

    it('should skip Drive deletion when image field is empty', async () => {
        showConfirm.mockResolvedValue(true);
        getTannlegerRaw.mockResolvedValue([
            { rowIndex: 2, name: 'Dr. Tansen', title: 'Tannlege', image: '' }
        ]);
        backupToSlettetSheet.mockResolvedValue();
        deleteTannlegeRowPermanently.mockResolvedValue();

        await window.deleteTannlege(2, 'Dr. Tansen');

        expect(findFileByName).not.toHaveBeenCalled();
        expect(deleteFile).not.toHaveBeenCalled();
    });

    it('should not call deleteFile when file not found in Drive', async () => {
        showConfirm.mockResolvedValue(true);
        getTannlegerRaw.mockResolvedValue([
            { rowIndex: 2, name: 'Dr. Tansen', image: 'mangler.jpg' }
        ]);
        backupToSlettetSheet.mockResolvedValue();
        deleteTannlegeRowPermanently.mockResolvedValue();
        findFileByName.mockResolvedValue(null);

        await window.deleteTannlege(2, 'Dr. Tansen');

        expect(findFileByName).toHaveBeenCalledWith('mangler.jpg', 'test-tannleger-folder');
        expect(deleteFile).not.toHaveBeenCalled();
        expect(showDeletionToast).toHaveBeenCalled();
    });

    it('should show toast even when Drive deletion fails (best-effort)', async () => {
        showConfirm.mockResolvedValue(true);
        getTannlegerRaw.mockResolvedValue([
            { rowIndex: 2, name: 'Dr. Tansen', image: 'bilde.jpg' }
        ]);
        backupToSlettetSheet.mockResolvedValue();
        deleteTannlegeRowPermanently.mockResolvedValue();
        findFileByName.mockRejectedValue(new Error('Drive API error'));

        await window.deleteTannlege(2, 'Dr. Tansen');

        expect(showDeletionToast).toHaveBeenCalled();
        expect(showToast).not.toHaveBeenCalled();
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
        expect(findFileByName).not.toHaveBeenCalled();
    });
});

describe('editTannlege', () => {
    beforeEach(() => {
        initTannlegerModule();
    });

    it('should show loading state', async () => {
        resolveImagePreview.mockReturnValueOnce(new Promise(() => {}));
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

    it('should call resolveImagePreview for existing tannlege with image file', async () => {
        resolveImagePreview.mockResolvedValue({ src: 'blob:test', imageId: 'file-id' });

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

        expect(resolveImagePreview).toHaveBeenCalledWith('hansen.jpg', 'test-tannleger-folder', { localFallbackDir: '/src/assets/tannleger/' });
    });

    it('should call resolveImagePreview for Drive ID image', async () => {
        resolveImagePreview.mockResolvedValue({ src: 'blob:test', imageId: '1234567890abcdefghijk' });

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

        expect(resolveImagePreview).toHaveBeenCalledWith('1234567890abcdefghijk', 'test-tannleger-folder', { localFallbackDir: '/src/assets/tannleger/' });
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

    it('should trigger autoSaver on preview update', async () => {
        await window.editTannlege(2, {
            name: 'N', title: 'T', description: 'D',
            image: '', active: true, scale: 1, positionX: 50, positionY: 50
        });

        const autoSaver = createAutoSaver.mock.results[0].value;
        const nameInp = document.getElementById('edit-t-name');
        nameInp.value = 'Changed';
        nameInp.dispatchEvent(new Event('input'));

        expect(autoSaver.trigger).toHaveBeenCalled();
    });

    it('should pass saveFn that calls updateTannlegeRow for existing row', async () => {
        updateTannlegeRow.mockResolvedValue();
        getTannlegerRaw.mockResolvedValue([{ rowIndex: 2, name: 'Changed' }]);

        await window.editTannlege(2, {
            name: 'N', title: 'T', description: 'D',
            image: '', active: true, scale: 1, positionX: 50, positionY: 50
        });

        document.getElementById('edit-t-name').value = 'Changed';
        const saveFn = createAutoSaver.mock.calls[0][0];
        await saveFn();

        expect(updateTannlegeRow).toHaveBeenCalledWith('test-sheet', 2, expect.objectContaining({ name: 'Changed' }));
    });

    it('should pass saveFn that calls addTannlegeRow when no rowIndex', async () => {
        addTannlegeRow.mockResolvedValue();

        await window.editTannlege(null, {
            name: 'New', title: 'T', description: 'D',
            image: '', active: true, scale: 1, positionX: 50, positionY: 50
        });

        document.getElementById('edit-t-name').value = 'New';
        const saveFn = createAutoSaver.mock.calls[0][0];
        await saveFn();

        expect(addTannlegeRow).toHaveBeenCalledWith('test-sheet', expect.objectContaining({ name: 'New' }));
    });

    it('should handle save error in saveFn', async () => {
        updateTannlegeRow.mockRejectedValue(new Error('save fail'));

        await window.editTannlege(2, {
            name: 'N', title: 'T', description: 'D',
            image: '', active: true, scale: 1, positionX: 50, positionY: 50
        });

        const saveFn = createAutoSaver.mock.calls[0][0];
        await expect(saveFn()).rejects.toThrow('save fail');
    });

    it('should handle verification mismatch after save', async () => {
        updateTannlegeRow.mockResolvedValue();
        verifySave.mockRejectedValueOnce(new Error('Mismatch'));

        await window.editTannlege(2, {
            name: 'N', title: 'T', description: 'D',
            image: '', active: true, scale: 1, positionX: 50, positionY: 50
        });

        document.getElementById('edit-t-name').value = 'Expected';
        const saveFn = createAutoSaver.mock.calls[0][0];
        await expect(saveFn()).rejects.toThrow('Mismatch');
    });

    it('should call verifySave with correct args after save', async () => {
        updateTannlegeRow.mockResolvedValue();

        await window.editTannlege(2, {
            name: 'N', title: 'T', description: 'D',
            image: '', active: true, scale: 1, positionX: 50, positionY: 50
        });

        document.getElementById('edit-t-name').value = 'Updated';
        const saveFn = createAutoSaver.mock.calls[0][0];
        await saveFn();

        expect(verifySave).toHaveBeenCalledWith(expect.objectContaining({
            rowIndex: 2,
            compareField: 'name',
            expectedValue: 'Updated',
            timestampElId: 'tannleger-last-fetched'
        }));
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

    it('should use fallback preview path from resolveImagePreview', async () => {
        resolveImagePreview.mockResolvedValue({ src: '/src/assets/tannleger/bilde.jpg', imageId: null });

        await window.editTannlege(2, {
            name: 'N', title: 'T', description: 'D',
            image: 'bilde.jpg', active: true, scale: 1, positionX: 50, positionY: 50
        });

        const img = document.getElementById('preview-img');
        expect(img.src).toContain('/src/assets/tannleger/bilde.jpg');
    });

    it('should escape previewSrc in img src attribute (XSS prevention)', async () => {
        const { escapeHtml } = await import('../admin-editor-helpers.js');
        const maliciousSrc = '" onerror="alert(1)';
        resolveImagePreview.mockResolvedValue({ src: maliciousSrc, imageId: 'file-id' });

        await window.editTannlege(2, {
            name: 'N', title: 'T', description: 'D',
            image: 'test.jpg', active: true, scale: 1, positionX: 50, positionY: 50
        });

        expect(escapeHtml).toHaveBeenCalledWith(maliciousSrc);
    });

    it('should handle image with no preview src', async () => {
        resolveImagePreview.mockResolvedValue({ src: '', imageId: null });

        await window.editTannlege(2, {
            name: 'N', title: 'T', description: 'D',
            image: '1234567890abcdefghijk',
            active: true, scale: 1, positionX: 50, positionY: 50
        });

        // No preview should be shown (no src from resolveImagePreview)
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

    it('should call handleImageSelected when gallery file is selected', async () => {
        const dialog = document.getElementById('image-picker-modal');
        dialog.showModal = vi.fn();
        dialog.close = vi.fn();

        await window.editTannlege(null);

        document.getElementById('btn-open-gallery').click();

        const onSelect = loadGallery.mock.calls[0][1];
        await onSelect('file-id-123', 'new-image.jpg');

        expect(handleImageSelected).toHaveBeenCalledWith(expect.objectContaining({
            fileId: 'file-id-123', fileName: 'new-image.jpg'
        }));
        expect(dialog.close).toHaveBeenCalled();
    });

    it('should call handleImageSelected from upload handler', async () => {
        const dialog = document.getElementById('image-picker-modal');
        dialog.showModal = vi.fn();
        dialog.close = vi.fn();

        await window.editTannlege(null);

        const onUpload = setupUploadHandler.mock.calls[0][1];
        await onUpload({ id: 'uploaded-id', name: 'uploaded.jpg' });

        expect(handleImageSelected).toHaveBeenCalledWith(expect.objectContaining({
            fileId: 'uploaded-id', fileName: 'uploaded.jpg'
        }));
        expect(dialog.close).toHaveBeenCalled();
    });

    it('should ignore upload handler with null file', async () => {
        const dialog = document.getElementById('image-picker-modal');
        dialog.showModal = vi.fn();
        dialog.close = vi.fn();

        await window.editTannlege(null);

        const onUpload = setupUploadHandler.mock.calls[0][1];
        await onUpload(null);

        expect(handleImageSelected).not.toHaveBeenCalled();
        expect(dialog.close).not.toHaveBeenCalled();
    });

    it('should show fallback preview when resolveImagePreview returns local path', async () => {
        resolveImagePreview.mockResolvedValue({ src: '/src/assets/tannleger/test.jpg', imageId: null });

        await window.editTannlege(2, {
            name: 'N', title: 'T', description: 'D',
            image: 'test.jpg', active: true, scale: 1, positionX: 50, positionY: 50
        });

        const img = document.getElementById('preview-img');
        expect(img.src).toContain('/src/assets/tannleger/test.jpg');
    });

    it('should pass timestampElId to verifySave', async () => {
        updateTannlegeRow.mockResolvedValue();

        await window.editTannlege(2, {
            name: 'N', title: 'T', description: 'D',
            image: '', active: true, scale: 1, positionX: 50, positionY: 50
        });

        document.getElementById('edit-t-name').value = 'N';
        const saveFn = createAutoSaver.mock.calls[0][0];
        await saveFn();

        expect(verifySave).toHaveBeenCalledWith(expect.objectContaining({
            timestampElId: 'tannleger-last-fetched'
        }));
    });

    it('should call createAutoSaver and trigger on input changes', async () => {
        updateTannlegeRow.mockResolvedValue();
        getTannlegerRaw.mockResolvedValue([{ rowIndex: 2, name: 'N' }]);

        await window.editTannlege(2, {
            name: 'N', title: 'T', description: 'D',
            image: '', active: true, scale: 1, positionX: 50, positionY: 50
        });

        expect(createAutoSaver).toHaveBeenCalledWith(expect.any(Function));

        const autoSaver = createAutoSaver.mock.results[0].value;
        document.getElementById('edit-t-name').value = 'N';
        document.getElementById('edit-t-name').dispatchEvent(new Event('input'));

        expect(autoSaver.trigger).toHaveBeenCalled();
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
