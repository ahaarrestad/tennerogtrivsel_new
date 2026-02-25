/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('dompurify', () => ({ default: { sanitize: vi.fn(html => html) } }));
vi.mock('snarkdown', () => ({ default: vi.fn(text => `<p>${text}</p>`) }));

vi.mock('../admin-client.js', () => ({
    getSheetParentFolder: vi.fn(),
    getGalleriRaw: vi.fn(),
    updateGalleriRow: vi.fn(),
    addGalleriRow: vi.fn(),
    deleteGalleriRowPermanently: vi.fn(),
    setForsideBildeInGalleri: vi.fn(),
    migrateForsideBildeToGalleri: vi.fn(),
    getDriveImageBlob: vi.fn(),
    findFileByName: vi.fn(),
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

vi.mock('../admin-dashboard.js', () => ({
    loadGalleriListeModule: vi.fn(),
    reorderGalleriItem: vi.fn(),
    formatTimestamp: vi.fn(() => '24. feb kl. 12:00'),
}));

vi.mock('../admin-editor-helpers.js', () => ({
    getAdminConfig: vi.fn(() => ({
        SHEET_ID: 'test-sheet',
    })),
    renderToggleHtml: vi.fn((id, active) => `<button id="${id}" data-active="${active}"><span class="toggle-label">${active ? 'Aktiv' : 'Inaktiv'}</span></button>`),
    setToggleState: vi.fn(),
    attachToggleClick: vi.fn(),
    showDeletionToast: vi.fn(),
    bindSliderStepButtons: vi.fn(),
    bindWheelPrevent: vi.fn(),
    showSaveBar: vi.fn(),
    hideSaveBar: vi.fn(),
}));

vi.mock('../admin-api-retry.js', () => ({
    createAuthRefresher: vi.fn(() => () => Promise.resolve(true)),
}));

import {
    getSheetParentFolder, getGalleriRaw, updateGalleriRow, addGalleriRow,
    deleteGalleriRowPermanently, setForsideBildeInGalleri, migrateForsideBildeToGalleri,
    getDriveImageBlob, findFileByName
} from '../admin-client.js';
import { showConfirm, showToast } from '../admin-dialog.js';
import { loadGallery, setupUploadHandler } from '../admin-gallery.js';
import { loadGalleriListeModule, reorderGalleriItem } from '../admin-dashboard.js';
import { showDeletionToast, bindSliderStepButtons, bindWheelPrevent, showSaveBar } from '../admin-editor-helpers.js';
import { loadBilderModule } from '../admin-module-bilder.js';

function setupDOM() {
    document.body.innerHTML = `
        <div id="admin-config" data-sheet-id="sid"></div>
        <div id="module-inner"></div>
        <div id="module-actions"></div>
        <dialog id="image-picker-modal"></dialog>
    `;
}

beforeEach(() => {
    setupDOM();
    vi.clearAllMocks();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('loadBilderModule', () => {
    it('should show loading state initially', async () => {
        getSheetParentFolder.mockReturnValue(new Promise(() => {}));
        loadBilderModule(); // don't await
        expect(document.getElementById('module-inner').innerHTML).toContain('Henter bildeinnstillinger');
    });

    it('should show "Legg til bilde" button in actions', async () => {
        getSheetParentFolder.mockReturnValue(new Promise(() => {}));
        loadBilderModule();
        expect(document.getElementById('module-actions').innerHTML).toContain('Legg til bilde');
    });

    it('should show error when parentFolderId is null', async () => {
        getSheetParentFolder.mockResolvedValue(null);
        await loadBilderModule();

        const inner = document.getElementById('module-inner');
        expect(inner.innerHTML).toContain('Kunne ikke bestemme Drive-mappen');
    });

    it('should call migrateForsideBildeToGalleri', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        getGalleriRaw.mockResolvedValue([]);

        await loadBilderModule();

        expect(migrateForsideBildeToGalleri).toHaveBeenCalledWith('test-sheet');
    });

    it('should handle migration failure gracefully', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockRejectedValue(new Error('migration fail'));
        getGalleriRaw.mockResolvedValue([]);

        // Should not throw
        await loadBilderModule();

        const inner = document.getElementById('module-inner');
        expect(inner.innerHTML).toContain('galleri-liste-container');
    });

    it('should call loadGalleriListeModule after setup', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();

        await loadBilderModule();

        expect(loadGalleriListeModule).toHaveBeenCalledWith(
            'test-sheet',
            expect.any(Function), // editGalleriBilde
            expect.any(Function), // deleteGalleriBilde
            expect.any(Function), // handleReorder
            'folder-123',
            expect.any(Function)  // toggleGalleriActive
        );
    });

    it('should show error on complete failure', async () => {
        getSheetParentFolder.mockRejectedValue(new Error('fail'));
        await loadBilderModule();

        const inner = document.getElementById('module-inner');
        expect(inner.innerHTML).toContain('Kunne ikke laste bildemodulen');
    });

    it('should not crash when module-inner is missing', async () => {
        document.body.innerHTML = '';
        await expect(loadBilderModule()).resolves.toBeUndefined();
    });
});

describe('deleteGalleriBilde (via loadBilderModule callback)', () => {
    beforeEach(async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
    });

    it('should do nothing when user cancels', async () => {
        await loadBilderModule();
        showConfirm.mockResolvedValue(false);

        const deleteFn = loadGalleriListeModule.mock.calls[0][2];
        await deleteFn(2, 'Venterom');

        expect(deleteGalleriRowPermanently).not.toHaveBeenCalled();
    });

    it('should delete and show toast when confirmed', async () => {
        await loadBilderModule();
        showConfirm.mockResolvedValue(true);
        deleteGalleriRowPermanently.mockResolvedValue();

        const deleteFn = loadGalleriListeModule.mock.calls[0][2];
        await deleteFn(2, 'Venterom');

        expect(deleteGalleriRowPermanently).toHaveBeenCalledWith('test-sheet', 2);
        expect(showDeletionToast).toHaveBeenCalledWith('Venterom', expect.any(String));
    });

    it('should show error when deletion fails', async () => {
        await loadBilderModule();
        showConfirm.mockResolvedValue(true);
        deleteGalleriRowPermanently.mockRejectedValue(new Error('fail'));

        const deleteFn = loadGalleriListeModule.mock.calls[0][2];
        await deleteFn(2, 'Venterom');

        expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Kunne ikke slette'), 'error');
    });
});

describe('handleReorder (via loadBilderModule callback)', () => {
    it('should fetch items, sort, and call reorderGalleriItem', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        getGalleriRaw.mockResolvedValue([
            { rowIndex: 2, type: 'galleri', order: 2 },
            { rowIndex: 3, type: 'forsidebilde', order: 1 },
        ]);
        reorderGalleriItem.mockResolvedValue();

        const handleReorder = loadGalleriListeModule.mock.calls[0][3];
        await handleReorder(2, 1);

        expect(getGalleriRaw).toHaveBeenCalledWith('test-sheet');
        expect(reorderGalleriItem).toHaveBeenCalledWith('test-sheet', expect.any(Array), 2, 1);
        // Verify forsidebilde sorts first
        const sortedItems = reorderGalleriItem.mock.calls[0][1];
        expect(sortedItems[0].type).toBe('forsidebilde');
    });
});

describe('toggleGalleriActive (via loadBilderModule callback)', () => {
    it('should update row and data on success', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        updateGalleriRow.mockResolvedValue();
        const toggleFn = loadGalleriListeModule.mock.calls[0][5];
        const img = { active: true, title: 'Test' };
        await toggleFn(2, img);

        expect(updateGalleriRow).toHaveBeenCalledWith('test-sheet', 2, expect.objectContaining({ active: false }));
        expect(img.active).toBe(false);
    });

    it('should revert UI on error', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        document.body.innerHTML += `
            <div class="admin-card-interactive">
                <button class="toggle-active-btn" data-row="2" data-active="true">
                    <span class="toggle-label">Aktiv</span>
                </button>
            </div>
        `;

        updateGalleriRow.mockRejectedValue(new Error('fail'));
        const toggleFn = loadGalleriListeModule.mock.calls[0][5];
        const img = { active: true };
        await toggleFn(2, img);

        // Should not change the data
        expect(img.active).toBe(true);
        // Should reload list
        expect(loadGalleriListeModule).toHaveBeenCalledTimes(2);
    });
});

describe('editGalleriBilde (via loadBilderModule callback)', () => {
    it('should render editor for gallery item', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];

        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 2,
                title: 'Venterom',
                image: 'venterom.jpg',
                altText: 'Et fint venterom',
                active: true,
                order: 1,
                scale: 1.2,
                positionX: 40,
                positionY: 60,
                type: 'galleri'
            }
        ]);
        findFileByName.mockResolvedValue({ id: 'img-id' });
        getDriveImageBlob.mockResolvedValue('blob:test');

        await editFn(2);

        const inner = document.getElementById('module-inner');
        expect(inner.querySelector('#galleri-edit-title').value).toBe('Venterom');
        expect(inner.querySelector('#galleri-edit-alt').value).toBe('Et fint venterom');
        expect(inner.querySelector('#galleri-edit-image').value).toBe('venterom.jpg');
        expect(inner.querySelector('#galleri-edit-forsidebilde').checked).toBe(false);
    });

    it('should set forsidebilde checkbox for forsidebilde type', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];

        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 3,
                title: 'Hero',
                image: 'hero.jpg',
                altText: '',
                active: true,
                order: 1,
                scale: 1,
                positionX: 50,
                positionY: 50,
                type: 'forsidebilde'
            }
        ]);

        await editFn(3);

        const inner = document.getElementById('module-inner');
        expect(inner.querySelector('#galleri-edit-forsidebilde').checked).toBe(true);
    });

    it('should do nothing if item not found', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([]);

        await editFn(999);

        // module-inner should still have the original list content (not editor)
        const inner = document.getElementById('module-inner');
        expect(inner.querySelector('#galleri-edit-title')).toBeNull();
    });

    it('should handle back button', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 2, title: 'T', image: '', altText: '',
                active: true, order: 1, scale: 1, positionX: 50, positionY: 50, type: 'galleri'
            }
        ]);

        await editFn(2);

        const backBtn = document.getElementById('btn-back-to-bilder');
        expect(backBtn).not.toBeNull();
    });

    it('should bind slider step buttons and wheel prevent', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 2, title: 'T', image: '', altText: '',
                active: true, order: 1, scale: 1, positionX: 50, positionY: 50, type: 'galleri'
            }
        ]);

        // Reset mocks after loadBilderModule's initial calls
        vi.mocked(bindSliderStepButtons).mockClear();
        vi.mocked(bindWheelPrevent).mockClear();

        await editFn(2);

        expect(bindSliderStepButtons).toHaveBeenCalled();
        expect(bindWheelPrevent).toHaveBeenCalled();
    });

    it('should update preview when scale slider changes', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 2, title: 'Test', image: '', altText: '',
                active: true, order: 1, scale: 1, positionX: 50, positionY: 50, type: 'galleri'
            }
        ]);
        await editFn(2);

        const scaleInp = document.getElementById('galleri-edit-scale');
        scaleInp.value = '2.0';
        scaleInp.dispatchEvent(new Event('input'));

        expect(document.getElementById('galleri-val-scale').textContent).toBe('2.0x');
    });

    it('should auto-save after debounce', async () => {
        vi.useFakeTimers();
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 2, title: 'Old', image: '', altText: '',
                active: true, order: 1, scale: 1, positionX: 50, positionY: 50, type: 'galleri'
            }
        ]);
        await editFn(2);

        updateGalleriRow.mockResolvedValue();
        getGalleriRaw.mockResolvedValue([{ rowIndex: 2, title: '' }]);

        const titleInput = document.getElementById('galleri-edit-title');
        titleInput.value = 'Updated';
        titleInput.dispatchEvent(new Event('change'));

        await vi.advanceTimersByTimeAsync(1500);

        expect(updateGalleriRow).toHaveBeenCalledWith('test-sheet', 2, expect.objectContaining({ title: 'Updated' }));
        vi.useRealTimers();
    });

    it('should show error on auto-save failure', async () => {
        vi.useFakeTimers();
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 2, title: '', image: '', altText: '',
                active: true, order: 1, scale: 1, positionX: 50, positionY: 50, type: 'galleri'
            }
        ]);
        await editFn(2);

        updateGalleriRow.mockRejectedValue(new Error('save fail'));

        const titleInput = document.getElementById('galleri-edit-title');
        titleInput.value = 'X';
        titleInput.dispatchEvent(new Event('change'));

        await vi.advanceTimersByTimeAsync(1500);

        expect(showSaveBar).toHaveBeenCalledWith('error', expect.stringContaining('Feil ved lagring'));
        vi.useRealTimers();
    });

    it('should handle forsidebilde checkbox toggle on', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 2, title: 'Bilde', image: 'img.jpg', altText: '',
                active: true, order: 1, scale: 1, positionX: 50, positionY: 50, type: 'galleri'
            }
        ]);
        await editFn(2);

        setForsideBildeInGalleri.mockResolvedValue();

        const checkbox = document.getElementById('galleri-edit-forsidebilde');
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change'));

        await vi.waitFor(() => {
            expect(setForsideBildeInGalleri).toHaveBeenCalledWith('test-sheet', 2);
        });
    });

    it('should handle forsidebilde checkbox toggle off', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 3, title: 'Hero', image: 'hero.jpg', altText: '',
                active: true, order: 1, scale: 1, positionX: 50, positionY: 50, type: 'forsidebilde'
            }
        ]);
        await editFn(3);

        updateGalleriRow.mockResolvedValue();

        const checkbox = document.getElementById('galleri-edit-forsidebilde');
        checkbox.checked = false;
        checkbox.dispatchEvent(new Event('change'));

        await vi.waitFor(() => {
            expect(updateGalleriRow).toHaveBeenCalledWith('test-sheet', 3, expect.objectContaining({ type: 'galleri' }));
        });
    });

    it('should revert forsidebilde checkbox on error', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 2, title: 'Bilde', image: '', altText: '',
                active: true, order: 1, scale: 1, positionX: 50, positionY: 50, type: 'galleri'
            }
        ]);
        await editFn(2);

        setForsideBildeInGalleri.mockRejectedValue(new Error('fail'));

        const checkbox = document.getElementById('galleri-edit-forsidebilde');
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change'));

        await vi.waitFor(() => {
            expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Kunne ikke sette forsidebilde'), 'error');
        });
        expect(checkbox.checked).toBe(false);
    });

    it('should handle verification mismatch during auto-save', async () => {
        vi.useFakeTimers();
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 2, title: 'Old', image: '', altText: '',
                active: true, order: 1, scale: 1, positionX: 50, positionY: 50, type: 'galleri'
            }
        ]);
        await editFn(2);

        updateGalleriRow.mockResolvedValue();
        // Return mismatched title in verification — triggers a reload
        getGalleriRaw.mockResolvedValue([{ rowIndex: 2, title: 'Different' }]);

        const titleInput = document.getElementById('galleri-edit-title');
        titleInput.value = 'Expected';
        titleInput.dispatchEvent(new Event('change'));

        await vi.advanceTimersByTimeAsync(1500);

        // After mismatch, loadBilderModule is called (reload) — verify it was called again
        expect(loadGalleriListeModule).toHaveBeenCalledTimes(2);
        vi.useRealTimers();
    });

    it('should update X/Y preview labels', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 2, title: '', image: '', altText: '',
                active: true, order: 1, scale: 1, positionX: 50, positionY: 50, type: 'galleri'
            }
        ]);
        await editFn(2);

        const xInput = document.getElementById('galleri-edit-x');
        xInput.value = '30';
        xInput.dispatchEvent(new Event('input'));
        expect(document.getElementById('galleri-val-x').textContent).toBe('30%');
    });

    it('should handle "revert forsidebilde to galleri" error', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 3, title: 'Hero', image: '', altText: '',
                active: true, order: 1, scale: 1, positionX: 50, positionY: 50, type: 'forsidebilde'
            }
        ]);
        await editFn(3);

        updateGalleriRow.mockRejectedValue(new Error('fail'));

        const checkbox = document.getElementById('galleri-edit-forsidebilde');
        checkbox.checked = false;
        checkbox.dispatchEvent(new Event('change'));

        await vi.waitFor(() => {
            expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Kunne ikke endre type'), 'error');
        });
        expect(checkbox.checked).toBe(true);
    });

    it('should open image picker from editor', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 2, title: '', image: '', altText: '',
                active: true, order: 1, scale: 1, positionX: 50, positionY: 50, type: 'galleri'
            }
        ]);
        await editFn(2);

        const dialog = document.getElementById('image-picker-modal');
        dialog.showModal = vi.fn();
        dialog.close = vi.fn();
        getDriveImageBlob.mockResolvedValue('blob:test');

        const btnPick = document.getElementById('btn-galleri-pick-image');
        btnPick.click();

        expect(dialog.showModal).toHaveBeenCalled();
        expect(loadGallery).toHaveBeenCalledWith('folder-123', expect.any(Function));

        // Simulate file selection
        const onSelect = loadGallery.mock.calls[loadGallery.mock.calls.length - 1][1];
        await onSelect('img-id', 'new.jpg');
        expect(document.getElementById('galleri-edit-image').value).toBe('new.jpg');
    });

    it('should handle "add new" button', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const dialog = document.getElementById('image-picker-modal');
        dialog.showModal = vi.fn();
        dialog.close = vi.fn();

        addGalleriRow.mockResolvedValue();
        getGalleriRaw.mockResolvedValue([
            { rowIndex: 5, image: 'new.jpg', title: '', altText: '', active: true, order: 99, scale: 1, positionX: 50, positionY: 50, type: 'galleri' }
        ]);
        findFileByName.mockResolvedValue(null);

        const btnNew = document.getElementById('btn-new-galleribilde');
        btnNew.click();

        expect(dialog.showModal).toHaveBeenCalled();

        // Simulate file selection from gallery
        const onSelect = loadGallery.mock.calls[loadGallery.mock.calls.length - 1][1];
        await onSelect('file-123', 'new.jpg');

        expect(addGalleriRow).toHaveBeenCalledWith('test-sheet', expect.objectContaining({ image: 'new.jpg', type: 'galleri' }));
        expect(dialog.close).toHaveBeenCalled();
    });

    it('should handle "add new" error', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const dialog = document.getElementById('image-picker-modal');
        dialog.showModal = vi.fn();
        dialog.close = vi.fn();

        addGalleriRow.mockRejectedValue(new Error('add fail'));

        document.getElementById('btn-new-galleribilde').click();
        const onSelect = loadGallery.mock.calls[loadGallery.mock.calls.length - 1][1];
        await onSelect('file-123', 'new.jpg');

        expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Kunne ikke legge til'), 'error');
    });

    it('should handle verification OK after auto-save', async () => {
        vi.useFakeTimers();
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 2, title: 'Match', image: '', altText: '',
                active: true, order: 1, scale: 1, positionX: 50, positionY: 50, type: 'galleri'
            }
        ]);
        await editFn(2);

        updateGalleriRow.mockResolvedValue();
        // Matching title = verification OK
        getGalleriRaw.mockResolvedValue([{ rowIndex: 2, title: 'Match' }]);

        const titleInput = document.getElementById('galleri-edit-title');
        titleInput.value = 'Match';
        titleInput.dispatchEvent(new Event('change'));

        await vi.advanceTimersByTimeAsync(1500);

        expect(showSaveBar).toHaveBeenCalledWith('saved', expect.stringContaining('Lagret'));
        vi.useRealTimers();
    });

    it('should handle verification failure gracefully', async () => {
        vi.useFakeTimers();
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 2, title: 'T', image: '', altText: '',
                active: true, order: 1, scale: 1, positionX: 50, positionY: 50, type: 'galleri'
            }
        ]);
        await editFn(2);

        updateGalleriRow.mockResolvedValue();
        getGalleriRaw.mockRejectedValue(new Error('verify fail'));

        const altInput = document.getElementById('galleri-edit-alt');
        altInput.value = 'X';
        altInput.dispatchEvent(new Event('change'));

        await vi.advanceTimersByTimeAsync(1500);

        // Should show success despite verification failure
        expect(showSaveBar).toHaveBeenCalledWith('saved', expect.stringContaining('Lagret'));
        vi.useRealTimers();
    });

    it('should hide active field for forsidebilde', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 3, title: 'Hero', image: '', altText: '',
                active: true, order: 1, scale: 1, positionX: 50, positionY: 50, type: 'forsidebilde'
            }
        ]);
        await editFn(3);

        const activeField = document.getElementById('galleri-active-field');
        expect(activeField.classList.contains('hidden')).toBe(true);
    });

    it('should show active field for gallery (non-forsidebilde)', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 2, title: 'Room', image: '', altText: '',
                active: false, order: 1, scale: 1, positionX: 50, positionY: 50, type: 'galleri'
            }
        ]);
        await editFn(2);

        const activeField = document.getElementById('galleri-active-field');
        expect(activeField.classList.contains('hidden')).toBe(false);
    });

    it('should render editor without image (no preview)', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 2, title: 'No Image', image: '', altText: '',
                active: true, order: 1, scale: 1, positionX: 50, positionY: 50, type: 'galleri'
            }
        ]);
        await editFn(2);

        // Preview image should remain hidden when there's no image
        const previewImg = document.getElementById('galleri-preview-img');
        expect(previewImg.classList.contains('hidden')).toBe(true);
    });

    it('should handle findFileByName returning null for editor preview', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 2, title: 'T', image: 'img.jpg', altText: '',
                active: true, order: 1, scale: 1, positionX: 50, positionY: 50, type: 'galleri'
            }
        ]);
        findFileByName.mockResolvedValue(null);
        await editFn(2);

        // No file found → no preview shown
        const previewImg = document.getElementById('galleri-preview-img');
        expect(previewImg.classList.contains('hidden')).toBe(true);
    });

    it('should handle getDriveImageBlob returning null for editor preview', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 2, title: 'T', image: 'img.jpg', altText: '',
                active: true, order: 1, scale: 1, positionX: 50, positionY: 50, type: 'galleri'
            }
        ]);
        findFileByName.mockResolvedValue({ id: 'file-id' });
        getDriveImageBlob.mockResolvedValue(null);
        await editFn(2);

        // Blob null → no preview
        const previewImg = document.getElementById('galleri-preview-img');
        expect(previewImg.classList.contains('hidden')).toBe(true);
    });

    it('should handle findFileByName error silently', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 2, title: 'T', image: 'broken.jpg', altText: '',
                active: true, order: 1, scale: 1, positionX: 50, positionY: 50, type: 'galleri'
            }
        ]);
        findFileByName.mockRejectedValue(new Error('fail'));
        await editFn(2);

        // Should not crash
        expect(document.getElementById('galleri-edit-title').value).toBe('T');
    });

    it('should set preview image styles when itemPreviewSrc exists', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 2, title: 'T', image: 'room.jpg', altText: '',
                active: true, order: 1, scale: 1.5, positionX: 30, positionY: 70, type: 'galleri'
            }
        ]);
        findFileByName.mockResolvedValue({ id: 'img-id' });
        getDriveImageBlob.mockResolvedValue('blob:preview');
        await editFn(2);

        const previewImg = document.getElementById('galleri-preview-img');
        expect(previewImg.classList.contains('hidden')).toBe(false);
        expect(previewImg.src).toBe('blob:preview');
        expect(previewImg.style.objectPosition).toBe('30% 70%');
        expect(previewImg.style.transform).toBe('scale(1.5)');
    });

    it('should set initial value labels from item data', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 2, title: 'T', image: '', altText: '',
                active: true, order: 1, scale: 2.0, positionX: 25, positionY: 75, type: 'galleri'
            }
        ]);
        await editFn(2);

        expect(document.getElementById('galleri-val-scale').textContent).toBe('2x');
        expect(document.getElementById('galleri-val-x').textContent).toBe('25%');
        expect(document.getElementById('galleri-val-y').textContent).toBe('75%');
    });

    it('should update Y preview label on input', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 2, title: '', image: '', altText: '',
                active: true, order: 1, scale: 1, positionX: 50, positionY: 50, type: 'galleri'
            }
        ]);
        await editFn(2);

        const yInput = document.getElementById('galleri-edit-y');
        yInput.value = '80';
        yInput.dispatchEvent(new Event('input'));
        expect(document.getElementById('galleri-val-y').textContent).toBe('80%');
    });

    it('should update preview image on slider change', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 2, title: 'T', image: 'img.jpg', altText: '',
                active: true, order: 1, scale: 1, positionX: 50, positionY: 50, type: 'galleri'
            }
        ]);
        findFileByName.mockResolvedValue({ id: 'img-id' });
        getDriveImageBlob.mockResolvedValue('blob:test');
        await editFn(2);

        const previewImg = document.getElementById('galleri-preview-img');
        expect(previewImg.src).toBe('blob:test');

        // Change scale
        const scaleInput = document.getElementById('galleri-edit-scale');
        scaleInput.value = '2.5';
        scaleInput.dispatchEvent(new Event('input'));

        expect(previewImg.style.transform).toBe('scale(2.5)');

        // Change X position
        const xInput = document.getElementById('galleri-edit-x');
        xInput.value = '20';
        xInput.dispatchEvent(new Event('input'));
        expect(previewImg.style.objectPosition).toBe('20% 50%');
    });

    it('should handle back button click in editor', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 2, title: 'T', image: '', altText: '',
                active: true, order: 1, scale: 1, positionX: 50, positionY: 50, type: 'galleri'
            }
        ]);
        await editFn(2);

        // Mock loadBilderModule's dependencies for the re-call
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();

        const backBtn = document.getElementById('btn-back-to-bilder');
        backBtn.click();

        // Should trigger loadBilderModule (re-renders the list)
        await vi.waitFor(() => {
            expect(getSheetParentFolder).toHaveBeenCalledTimes(2);
        });
    });

    it('should handle ferdig button click in editor', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 2, title: 'T', image: '', altText: '',
                active: true, order: 1, scale: 1, positionX: 50, positionY: 50, type: 'galleri'
            }
        ]);
        await editFn(2);

        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();

        const ferdigBtn = document.getElementById('btn-ferdig-galleri');
        ferdigBtn.click();

        await vi.waitFor(() => {
            expect(getSheetParentFolder).toHaveBeenCalledTimes(2);
        });
    });

    it('should handle forsidebilde toggle ON with preview container updates', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 2, title: 'Bilde', image: '', altText: '',
                active: true, order: 1, scale: 1, positionX: 50, positionY: 50, type: 'galleri'
            }
        ]);
        await editFn(2);

        setForsideBildeInGalleri.mockResolvedValue();

        const checkbox = document.getElementById('galleri-edit-forsidebilde');
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change'));

        await vi.waitFor(() => {
            expect(setForsideBildeInGalleri).toHaveBeenCalled();
        });

        // Preview container should switch to 16:10
        const container = document.getElementById('galleri-preview-container');
        expect(container.classList.contains('aspect-[16/10]')).toBe(true);
        expect(container.classList.contains('aspect-[4/3]')).toBe(false);

        // Active field should be hidden
        const activeField = document.getElementById('galleri-active-field');
        expect(activeField.classList.contains('hidden')).toBe(true);

        // Preview label should update
        const label = document.getElementById('galleri-preview-label');
        expect(label.textContent).toContain('16:10');
    });

    it('should handle forsidebilde toggle OFF with preview container updates', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 3, title: 'Hero', image: '', altText: '',
                active: true, order: 1, scale: 1, positionX: 50, positionY: 50, type: 'forsidebilde'
            }
        ]);
        await editFn(3);

        updateGalleriRow.mockResolvedValue();

        const checkbox = document.getElementById('galleri-edit-forsidebilde');
        checkbox.checked = false;
        checkbox.dispatchEvent(new Event('change'));

        await vi.waitFor(() => {
            expect(updateGalleriRow).toHaveBeenCalledWith('test-sheet', 3, expect.objectContaining({ type: 'galleri' }));
        });

        // Preview container should switch to 4:3
        const container = document.getElementById('galleri-preview-container');
        expect(container.classList.contains('aspect-[4/3]')).toBe(true);
        expect(container.classList.contains('aspect-[16/10]')).toBe(false);

        // Active field should be visible again
        const activeField = document.getElementById('galleri-active-field');
        expect(activeField.classList.contains('hidden')).toBe(false);

        // Preview label should update
        const label = document.getElementById('galleri-preview-label');
        expect(label.textContent).toContain('4:3');
    });

    it('should handle editor upload handler callback', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 2, title: 'T', image: '', altText: '',
                active: true, order: 1, scale: 1, positionX: 50, positionY: 50, type: 'galleri'
            }
        ]);
        await editFn(2);

        const dialog = document.getElementById('image-picker-modal');
        dialog.close = vi.fn();
        getDriveImageBlob.mockResolvedValue('blob:uploaded');

        // Get the upload handler for the editor (second call to setupUploadHandler)
        const uploadCalls = setupUploadHandler.mock.calls;
        const editorUpload = uploadCalls[uploadCalls.length - 1][1];
        await editorUpload({ id: 'new-id', name: 'uploaded.jpg' });

        expect(document.getElementById('galleri-edit-image').value).toBe('uploaded.jpg');
        expect(dialog.close).toHaveBeenCalled();
    });

    it('should handle editor upload handler with null file', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 2, title: 'T', image: '', altText: '',
                active: true, order: 1, scale: 1, positionX: 50, positionY: 50, type: 'galleri'
            }
        ]);
        await editFn(2);

        const uploadCalls = setupUploadHandler.mock.calls;
        const editorUpload = uploadCalls[uploadCalls.length - 1][1];
        await editorUpload(null);

        // Nothing should change
        expect(document.getElementById('galleri-edit-image').value).toBe('');
    });

    it('should handle editor upload with null blob URL', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 2, title: 'T', image: '', altText: '',
                active: true, order: 1, scale: 1, positionX: 50, positionY: 50, type: 'galleri'
            }
        ]);
        await editFn(2);

        const dialog = document.getElementById('image-picker-modal');
        dialog.close = vi.fn();
        getDriveImageBlob.mockResolvedValue(null);

        const uploadCalls = setupUploadHandler.mock.calls;
        const editorUpload = uploadCalls[uploadCalls.length - 1][1];
        await editorUpload({ id: 'id', name: 'file.jpg' });

        expect(document.getElementById('galleri-edit-image').value).toBe('file.jpg');
        // Preview should remain hidden
        const previewImg = document.getElementById('galleri-preview-img');
        expect(previewImg.classList.contains('hidden')).toBe(true);
    });

    it('should handle image picker select with null blob URL', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 2, title: '', image: '', altText: '',
                active: true, order: 1, scale: 1, positionX: 50, positionY: 50, type: 'galleri'
            }
        ]);
        await editFn(2);

        const dialog = document.getElementById('image-picker-modal');
        dialog.showModal = vi.fn();
        dialog.close = vi.fn();
        getDriveImageBlob.mockResolvedValue(null);

        document.getElementById('btn-galleri-pick-image').click();
        const onSelect = loadGallery.mock.calls[loadGallery.mock.calls.length - 1][1];
        await onSelect('img-id', 'file.jpg');

        expect(document.getElementById('galleri-edit-image').value).toBe('file.jpg');
        // Preview should remain hidden since blob is null
        const previewImg = document.getElementById('galleri-preview-img');
        expect(previewImg.classList.contains('hidden')).toBe(true);
    });

    it('should handle "add new" button with newest not found in results', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const dialog = document.getElementById('image-picker-modal');
        dialog.showModal = vi.fn();
        dialog.close = vi.fn();

        addGalleriRow.mockResolvedValue();
        // Return empty array so newest is not found
        getGalleriRaw.mockResolvedValue([]);

        document.getElementById('btn-new-galleribilde').click();
        const onSelect = loadGallery.mock.calls[loadGallery.mock.calls.length - 1][1];
        await onSelect('file-123', 'unique.jpg');

        expect(addGalleriRow).toHaveBeenCalled();
        // When newest not found, should reload list
        expect(loadGalleriListeModule).toHaveBeenCalledTimes(2);
    });

    it('should handle "add new" upload handler success', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const dialog = document.getElementById('image-picker-modal');
        dialog.showModal = vi.fn();
        dialog.close = vi.fn();

        // Click btn-new to register the upload handler
        document.getElementById('btn-new-galleribilde').click();

        addGalleriRow.mockResolvedValue();
        getGalleriRaw.mockResolvedValue([
            { rowIndex: 10, image: 'uploaded.jpg', title: '', altText: '', active: true, order: 99, scale: 1, positionX: 50, positionY: 50, type: 'galleri' }
        ]);
        findFileByName.mockResolvedValue(null);

        // Get the upload handler from the "add new" flow
        const uploadCalls = setupUploadHandler.mock.calls;
        const addNewUpload = uploadCalls[uploadCalls.length - 1][1];
        await addNewUpload({ id: 'new-upload-id', name: 'uploaded.jpg' });

        expect(addGalleriRow).toHaveBeenCalledWith('test-sheet', expect.objectContaining({ image: 'uploaded.jpg' }));
        expect(dialog.close).toHaveBeenCalled();
    });

    it('should handle "add new" upload handler error', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const dialog = document.getElementById('image-picker-modal');
        dialog.showModal = vi.fn();
        dialog.close = vi.fn();

        document.getElementById('btn-new-galleribilde').click();

        addGalleriRow.mockRejectedValue(new Error('add fail'));

        const uploadCalls = setupUploadHandler.mock.calls;
        const addNewUpload = uploadCalls[uploadCalls.length - 1][1];
        await addNewUpload({ id: 'id', name: 'file.jpg' });

        expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Kunne ikke legge til'), 'error');
        expect(dialog.close).toHaveBeenCalled();
    });

    it('should handle "add new" upload with null file', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const dialog = document.getElementById('image-picker-modal');
        dialog.showModal = vi.fn();
        dialog.close = vi.fn();

        document.getElementById('btn-new-galleribilde').click();

        const uploadCalls = setupUploadHandler.mock.calls;
        const addNewUpload = uploadCalls[uploadCalls.length - 1][1];
        await addNewUpload(null);

        // Nothing should happen
        expect(addGalleriRow).not.toHaveBeenCalled();
    });

    it('should handle "add new" upload with newest not found', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const dialog = document.getElementById('image-picker-modal');
        dialog.showModal = vi.fn();
        dialog.close = vi.fn();

        document.getElementById('btn-new-galleribilde').click();

        addGalleriRow.mockResolvedValue();
        getGalleriRaw.mockResolvedValue([]);

        const uploadCalls = setupUploadHandler.mock.calls;
        const addNewUpload = uploadCalls[uploadCalls.length - 1][1];
        await addNewUpload({ id: 'id', name: 'unique.jpg' });

        expect(addGalleriRow).toHaveBeenCalled();
        // When newest not found, should reload list
        expect(loadGalleriListeModule).toHaveBeenCalledTimes(2);
    });

    it('should handle input events on text inputs in editor', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 2, title: '', image: '', altText: '',
                active: true, order: 1, scale: 1, positionX: 50, positionY: 50, type: 'galleri'
            }
        ]);
        await editFn(2);

        // Test 'input' event on title (text input — has both 'change' and 'input' listeners)
        const titleInput = document.getElementById('galleri-edit-title');
        titleInput.value = 'NewTitle';
        titleInput.dispatchEvent(new Event('input'));

        expect(showSaveBar).toHaveBeenCalledWith('changed', expect.stringContaining('Endringer oppdaget'));

        // Test 'input' event on alt (text input)
        showSaveBar.mockClear();
        const altInput = document.getElementById('galleri-edit-alt');
        altInput.value = 'NewAlt';
        altInput.dispatchEvent(new Event('input'));
        expect(showSaveBar).toHaveBeenCalledWith('changed', expect.stringContaining('Endringer oppdaget'));
    });

    it('should update last-fetched time during verification', async () => {
        vi.useFakeTimers();
        // Add last-fetched element to DOM before loading module
        const fetchedSpan = document.createElement('span');
        fetchedSpan.id = 'galleri-last-fetched';
        document.body.appendChild(fetchedSpan);

        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 2, title: 'T', image: '', altText: '',
                active: true, order: 1, scale: 1, positionX: 50, positionY: 50, type: 'galleri'
            }
        ]);
        await editFn(2);

        updateGalleriRow.mockResolvedValue();
        getGalleriRaw.mockResolvedValue([{ rowIndex: 2, title: 'T' }]);

        const titleInput = document.getElementById('galleri-edit-title');
        titleInput.value = 'T';
        titleInput.dispatchEvent(new Event('change'));
        await vi.advanceTimersByTimeAsync(1500);

        expect(document.getElementById('galleri-last-fetched').textContent).toContain('24. feb');
        vi.useRealTimers();
    });

    it('should use default values for item with null scale/positionX/positionY', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 2, title: 'T', image: '', altText: 'Alt',
                active: true, order: 1,
                scale: null, positionX: undefined, positionY: null,
                type: 'galleri'
            }
        ]);
        await editFn(2);

        // Should fall back to defaults via ??
        expect(document.getElementById('galleri-edit-scale').value).toBe('1');
        expect(document.getElementById('galleri-edit-x').value).toBe('50');
        expect(document.getElementById('galleri-edit-y').value).toBe('50');
        expect(document.getElementById('galleri-val-scale').textContent).toBe('1x');
        expect(document.getElementById('galleri-val-x').textContent).toBe('50%');
        expect(document.getElementById('galleri-val-y').textContent).toBe('50%');
    });

    it('should set preview image with default positions when values are null', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 2, title: 'T', image: 'img.jpg', altText: '',
                active: true, order: 1,
                scale: null, positionX: null, positionY: null,
                type: 'galleri'
            }
        ]);
        findFileByName.mockResolvedValue({ id: 'file-id' });
        getDriveImageBlob.mockResolvedValue('blob:test');
        await editFn(2);

        const previewImg = document.getElementById('galleri-preview-img');
        expect(previewImg.style.objectPosition).toBe('50% 50%');
        expect(previewImg.style.transform).toBe('scale(1)');
    });

    it('should use item fallback values when inputs are empty on forsidebilde toggle off', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 3, title: 'Hero', image: 'hero.jpg', altText: 'Hero alt',
                active: true, order: 1, scale: 1.5, positionX: 30, positionY: 70, type: 'forsidebilde'
            }
        ]);
        await editFn(3);

        // Clear the title/alt/image inputs to empty
        document.getElementById('galleri-edit-title').value = '';
        document.getElementById('galleri-edit-alt').value = '';
        document.getElementById('galleri-edit-image').value = '';

        updateGalleriRow.mockResolvedValue();

        const checkbox = document.getElementById('galleri-edit-forsidebilde');
        checkbox.checked = false;
        checkbox.dispatchEvent(new Event('change'));

        await vi.waitFor(() => {
            expect(updateGalleriRow).toHaveBeenCalledWith('test-sheet', 3, expect.objectContaining({
                // Empty inputs fall back to item values via || operator
                title: 'Hero',
                image: 'hero.jpg',
                altText: 'Hero alt',
                type: 'galleri'
            }));
        });
    });

    it('should show saved bar and schedule hide after successful auto-save', async () => {
        vi.useFakeTimers();
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 2, title: 'T', image: '', altText: '',
                active: true, order: 1, scale: 1, positionX: 50, positionY: 50, type: 'galleri'
            }
        ]);
        await editFn(2);

        updateGalleriRow.mockResolvedValue();
        getGalleriRaw.mockResolvedValue([{ rowIndex: 2, title: 'Changed' }]);

        const titleInput = document.getElementById('galleri-edit-title');
        titleInput.value = 'Changed';
        titleInput.dispatchEvent(new Event('change'));

        await vi.advanceTimersByTimeAsync(1500);

        expect(updateGalleriRow).toHaveBeenCalled();
        expect(showSaveBar).toHaveBeenCalledWith('saved', expect.stringContaining('Lagret'));
        vi.useRealTimers();
    });

    it('should show error bar on auto-save failure', async () => {
        vi.useFakeTimers();
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 2, title: 'T', image: '', altText: '',
                active: true, order: 1, scale: 1, positionX: 50, positionY: 50, type: 'galleri'
            }
        ]);
        await editFn(2);

        updateGalleriRow.mockRejectedValue(new Error('fail'));

        const titleInput = document.getElementById('galleri-edit-title');
        titleInput.value = 'Changed';
        titleInput.dispatchEvent(new Event('change'));

        await vi.advanceTimersByTimeAsync(1500);
        expect(showSaveBar).toHaveBeenCalledWith('error', expect.stringContaining('Feil ved lagring'));
        vi.useRealTimers();
    });

    it('should handle module-inner becoming null during edit', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 2, title: 'T', image: '', altText: '',
                active: true, order: 1, scale: 1, positionX: 50, positionY: 50, type: 'galleri'
            }
        ]);

        // Remove module-inner after the check but during edit
        document.getElementById('module-inner').remove();
        await editFn(2);

        // Should return early without crashing
    });

    it('should include type in auto-save data based on forsidebilde checkbox', async () => {
        vi.useFakeTimers();
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        const editFn = loadGalleriListeModule.mock.calls[0][1];
        getGalleriRaw.mockResolvedValue([
            {
                rowIndex: 3, title: 'Hero', image: '', altText: '',
                active: true, order: 1, scale: 1, positionX: 50, positionY: 50, type: 'forsidebilde'
            }
        ]);
        await editFn(3);

        updateGalleriRow.mockResolvedValue();
        getGalleriRaw.mockResolvedValue([{ rowIndex: 3, title: 'Hero' }]);

        // The forsidebilde checkbox should be checked
        const checkbox = document.getElementById('galleri-edit-forsidebilde');
        expect(checkbox.checked).toBe(true);

        // Trigger auto-save
        const scaleInput = document.getElementById('galleri-edit-scale');
        scaleInput.value = '1.5';
        scaleInput.dispatchEvent(new Event('input'));
        await vi.advanceTimersByTimeAsync(1500);

        expect(updateGalleriRow).toHaveBeenCalledWith('test-sheet', 3, expect.objectContaining({ type: 'forsidebilde' }));
        vi.useRealTimers();
    });
});

describe('handleReorder sort edge cases', () => {
    it('should sort both non-forsidebilde items by order', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        getGalleriRaw.mockResolvedValue([
            { rowIndex: 3, type: 'galleri', order: 2 },
            { rowIndex: 2, type: 'galleri', order: 1 },
        ]);
        reorderGalleriItem.mockResolvedValue();

        const handleReorder = loadGalleriListeModule.mock.calls[0][3];
        await handleReorder(2, 1);

        const sortedItems = reorderGalleriItem.mock.calls[0][1];
        expect(sortedItems[0].order).toBe(1);
        expect(sortedItems[1].order).toBe(2);
    });

    it('should handle items with undefined order', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        getGalleriRaw.mockResolvedValue([
            { rowIndex: 2, type: 'galleri', order: undefined },
            { rowIndex: 3, type: 'galleri', order: 1 },
        ]);
        reorderGalleriItem.mockResolvedValue();

        const handleReorder = loadGalleriListeModule.mock.calls[0][3];
        await handleReorder(2, 1);

        const sortedItems = reorderGalleriItem.mock.calls[0][1];
        // undefined order → 99 (fallback)
        expect(sortedItems[0].order).toBe(1);
    });

    it('should sort forsidebilde before other types (b is forsidebilde)', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        getGalleriRaw.mockResolvedValue([
            { rowIndex: 2, type: 'galleri', order: 1 },
            { rowIndex: 3, type: 'forsidebilde', order: 2 },
        ]);
        reorderGalleriItem.mockResolvedValue();

        const handleReorder = loadGalleriListeModule.mock.calls[0][3];
        await handleReorder(2, 1);

        const sortedItems = reorderGalleriItem.mock.calls[0][1];
        // forsidebilde should be first regardless of order
        expect(sortedItems[0].type).toBe('forsidebilde');
    });
});

describe('"add new" button edge cases', () => {
    it('should return early when modal is missing', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        // Remove the modal
        document.getElementById('image-picker-modal').remove();

        const btnNew = document.getElementById('btn-new-galleribilde');
        btnNew.click();

        // loadGallery should NOT be called since modal is null
        expect(loadGallery).not.toHaveBeenCalled();
    });
});

describe('toggleGalleriActive with DOM elements', () => {
    it('should do optimistic UI update on toggle', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        document.body.innerHTML += `
            <div class="admin-card-interactive">
                <button class="toggle-active-btn" data-row="5" data-active="true">
                    <span class="toggle-label">Aktiv</span>
                </button>
            </div>
        `;

        updateGalleriRow.mockResolvedValue();
        const toggleFn = loadGalleriListeModule.mock.calls[0][5];
        const img = { active: true };
        await toggleFn(5, img);

        const btn = document.querySelector('.toggle-active-btn[data-row="5"]');
        expect(btn.dataset.active).toBe('false');
        expect(btn.querySelector('.toggle-label').textContent).toBe('Inaktiv');
        const card = btn.closest('.admin-card-interactive');
        expect(card.classList.contains('opacity-60')).toBe(true);
    });

    it('should revert UI on toggle error with DOM elements', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        document.body.innerHTML += `
            <div class="admin-card-interactive">
                <button class="toggle-active-btn" data-row="5" data-active="true">
                    <span class="toggle-label">Aktiv</span>
                </button>
            </div>
        `;

        updateGalleriRow.mockRejectedValue(new Error('fail'));
        const toggleFn = loadGalleriListeModule.mock.calls[0][5];
        const img = { active: true };
        await toggleFn(5, img);

        // Should be reverted
        const btn = document.querySelector('.toggle-active-btn[data-row="5"]');
        expect(btn.dataset.active).toBe('true');
        expect(btn.querySelector('.toggle-label').textContent).toBe('Aktiv');
    });

    it('should toggle inactive to active with DOM elements', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        document.body.innerHTML += `
            <div class="admin-card-interactive opacity-60">
                <button class="toggle-active-btn" data-row="6" data-active="false">
                    <span class="toggle-label">Inaktiv</span>
                </button>
            </div>
        `;

        updateGalleriRow.mockResolvedValue();
        const toggleFn = loadGalleriListeModule.mock.calls[0][5];
        const img = { active: false };
        await toggleFn(6, img);

        const btn = document.querySelector('.toggle-active-btn[data-row="6"]');
        expect(btn.dataset.active).toBe('true');
        expect(btn.querySelector('.toggle-label').textContent).toBe('Aktiv');
        expect(img.active).toBe(true);
        const card = btn.closest('.admin-card-interactive');
        expect(card.classList.contains('opacity-60')).toBe(false);
    });

    it('should revert toggle error when originally inactive', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        document.body.innerHTML += `
            <div class="admin-card-interactive opacity-60">
                <button class="toggle-active-btn" data-row="6" data-active="false">
                    <span class="toggle-label">Inaktiv</span>
                </button>
            </div>
        `;

        updateGalleriRow.mockRejectedValue(new Error('fail'));
        const toggleFn = loadGalleriListeModule.mock.calls[0][5];
        const img = { active: false };
        await toggleFn(6, img);

        // Should revert back to inactive
        const btn = document.querySelector('.toggle-active-btn[data-row="6"]');
        expect(btn.dataset.active).toBe('false');
        expect(btn.querySelector('.toggle-label').textContent).toBe('Inaktiv');
        expect(img.active).toBe(false);
    });

    it('should toggle without btn element (no DOM match)', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        // No toggle button in DOM
        updateGalleriRow.mockResolvedValue();
        const toggleFn = loadGalleriListeModule.mock.calls[0][5];
        const img = { active: true };
        await toggleFn(999, img);

        expect(img.active).toBe(false);
    });

    it('should toggle without toggle-label span in button', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        document.body.innerHTML += `
            <div class="admin-card-interactive">
                <button class="toggle-active-btn" data-row="7" data-active="true"></button>
            </div>
        `;

        updateGalleriRow.mockResolvedValue();
        const toggleFn = loadGalleriListeModule.mock.calls[0][5];
        const img = { active: true };
        await toggleFn(7, img);

        expect(img.active).toBe(false);
    });

    it('should revert toggle error without toggle-label span in button', async () => {
        getSheetParentFolder.mockResolvedValue('folder-123');
        migrateForsideBildeToGalleri.mockResolvedValue();
        await loadBilderModule();

        document.body.innerHTML += `
            <div class="admin-card-interactive">
                <button class="toggle-active-btn" data-row="8" data-active="true"></button>
            </div>
        `;

        updateGalleriRow.mockRejectedValue(new Error('fail'));
        const toggleFn = loadGalleriListeModule.mock.calls[0][5];
        const img = { active: true };
        await toggleFn(8, img);

        const btn = document.querySelector('.toggle-active-btn[data-row="8"]');
        expect(btn.dataset.active).toBe('true'); // reverted
    });
});
