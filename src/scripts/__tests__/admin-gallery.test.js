/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../admin-client', () => ({
    checkAccess: vi.fn(),
    listImages: vi.fn(),
    uploadImage: vi.fn(),
}));

import { loadGallery, setupUploadHandler } from '../admin-gallery';
import { checkAccess, listImages, uploadImage } from '../admin-client';

describe('admin-gallery.js', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ---------------------------------------------------------------------------
    // loadGallery
    // ---------------------------------------------------------------------------
    describe('loadGallery', () => {
        let grid;

        beforeEach(() => {
            grid = document.createElement('div');
            grid.id = 'image-gallery-grid';
            document.body.appendChild(grid);
        });

        it('skal vise tilgangsadvarsel når checkAccess returnerer false', async () => {
            checkAccess.mockResolvedValueOnce(false);

            await loadGallery('folder-123', vi.fn());

            expect(grid.textContent).toContain('ikke lesetilgang');
        });

        it('skal vise tom-melding når listImages returnerer tom liste', async () => {
            checkAccess.mockResolvedValueOnce(true);
            listImages.mockResolvedValueOnce([]);

            await loadGallery('folder-123', vi.fn());

            expect(grid.textContent).toContain('Ingen bilder');
        });

        it('skal rendre <img> med thumbnail-URL for bilder med thumbnailLink', async () => {
            checkAccess.mockResolvedValueOnce(true);
            listImages.mockResolvedValueOnce([
                { id: '1', name: 'foto.jpg', thumbnailLink: 'https://example.com/thumb.jpg' }
            ]);

            await loadGallery('folder-123', vi.fn());

            const img = grid.querySelector('img');
            expect(img).not.toBeNull();
            expect(img.getAttribute('src')).toBe('https://example.com/thumb.jpg');
        });

        it('skal rendre ikon-fallback (SVG) for bilder uten thumbnailLink', async () => {
            checkAccess.mockResolvedValueOnce(true);
            listImages.mockResolvedValueOnce([
                { id: '2', name: 'uten-thumbnail.png' }
            ]);

            await loadGallery('folder-123', vi.fn());

            expect(grid.querySelector('img')).toBeNull();
            expect(grid.querySelector('svg')).not.toBeNull();
        });

        it('skal kalle onSelect med (id, name) ved klikk på bilde', async () => {
            const onSelect = vi.fn();
            checkAccess.mockResolvedValueOnce(true);
            listImages.mockResolvedValueOnce([
                { id: 'img-42', name: 'portrett.jpg', thumbnailLink: 'https://example.com/t.jpg' }
            ]);

            await loadGallery('folder-123', onSelect);

            grid.firstElementChild.click();

            expect(onSelect).toHaveBeenCalledWith('img-42', 'portrett.jpg');
        });

        it('skal vise feilmelding og ikke krasje ved API-feil i listImages', async () => {
            checkAccess.mockResolvedValueOnce(true);
            listImages.mockRejectedValueOnce(new Error('Drive API-feil'));
            vi.spyOn(console, 'error').mockImplementation(() => {});

            await loadGallery('folder-123', vi.fn());

            expect(grid.textContent).toContain('Kunne ikke laste bilder');
        });

        it('skal returnere tidlig uten feil når grid-elementet mangler i DOM', async () => {
            // Remove grid before calling loadGallery
            document.body.removeChild(grid);

            // Should return without throwing (early return when !grid)
            await expect(loadGallery('folder-123', vi.fn())).resolves.toBeUndefined();
            expect(checkAccess).not.toHaveBeenCalled();
        });

        it('skal vise feilmelding når folderId er null (kastes i catch)', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => {});

            await loadGallery(null, vi.fn());

            expect(grid.textContent).toContain('Kunne ikke laste bilder');
        });
    });

    // ---------------------------------------------------------------------------
    // setupUploadHandler
    // ---------------------------------------------------------------------------
    describe('setupUploadHandler', () => {
        let spinner, preview;

        beforeEach(() => {
            const input = document.createElement('input');
            input.id = 'upload-image-input';
            input.type = 'file';

            preview = document.createElement('div');
            preview.id = 'upload-preview';

            spinner = document.createElement('div');
            spinner.id = 'upload-spinner';
            spinner.classList.add('hidden');

            document.body.appendChild(input);
            document.body.appendChild(preview);
            document.body.appendChild(spinner);
        });

        /**
         * Capture the `change` event handler registered by setupUploadHandler.
         * This avoids the jsdom limitation with setting files on file inputs.
         */
        function captureChangeHandler(folderId, onUploaded) {
            const spy = vi.spyOn(EventTarget.prototype, 'addEventListener');
            setupUploadHandler(folderId, onUploaded);
            const call = spy.mock.calls.find(c => c[0] === 'change');
            spy.mockRestore();
            return call?.[1];
        }

        it('skal vise spinner og kalle uploadImage ved filopplasting', async () => {
            let resolveUpload;
            uploadImage.mockReturnValueOnce(new Promise(r => { resolveUpload = r; }));

            const mockFile = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
            const handler = captureChangeHandler('folder-123', vi.fn());

            // Call the handler with a plain event-like object (bypasses jsdom file input quirks)
            const handlerPromise = handler({ target: { files: [mockFile] } });

            // Async handler suspends at `await uploadImage(...)` — spinner is already visible
            expect(spinner.classList.contains('hidden')).toBe(false);
            expect(uploadImage).toHaveBeenCalledWith('folder-123', mockFile);

            // Resolve the upload so the handler can finish cleanly
            resolveUpload({ id: 'new-id', name: 'test.jpg' });
            await handlerPromise;
        });

        it('skal kalle onUploaded med resultatet ved vellykket opplasting', async () => {
            const mockResult = { id: 'file-999', name: 'portrett.jpg' };
            uploadImage.mockResolvedValueOnce(mockResult);
            const onUploaded = vi.fn();

            const mockFile = new File(['data'], 'portrett.jpg', { type: 'image/jpeg' });
            const handler = captureChangeHandler('folder-123', onUploaded);
            await handler({ target: { files: [mockFile] } });

            expect(onUploaded).toHaveBeenCalledWith(mockResult);
            expect(spinner.classList.contains('hidden')).toBe(true);
        });

        it('skal vise alert og skjule spinner ved feil under opplasting', async () => {
            uploadImage.mockRejectedValueOnce(new Error('Nettverksfeil'));
            const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
            vi.spyOn(console, 'error').mockImplementation(() => {});

            const mockFile = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
            const handler = captureChangeHandler('folder-123', vi.fn());
            await handler({ target: { files: [mockFile] } });

            expect(alertSpy).toHaveBeenCalledWith('Opplasting feilet!');
            expect(spinner.classList.contains('hidden')).toBe(true);
        });

        it('skal returnere tidlig uten feil når input-elementet mangler i DOM', () => {
            // Remove input before calling setupUploadHandler
            document.getElementById('upload-image-input').remove();

            // Should return without throwing (early return when !input)
            expect(() => setupUploadHandler('folder-123', vi.fn())).not.toThrow();
        });

        it('skal returnere tidlig fra handler når ingen fil er valgt', async () => {
            const handler = captureChangeHandler('folder-123', vi.fn());

            // Call with empty files array – file is undefined, handler returns early
            await handler({ target: { files: [] } });

            expect(uploadImage).not.toHaveBeenCalled();
        });

        it('skal fungere uten preview og spinner i DOM', async () => {
            // Remove optional UI elements
            document.getElementById('upload-preview').remove();
            document.getElementById('upload-spinner').remove();

            uploadImage.mockResolvedValueOnce({ id: 'x', name: 'x.jpg' });
            const onUploaded = vi.fn();
            const mockFile = new File(['data'], 'x.jpg', { type: 'image/jpeg' });
            const handler = captureChangeHandler('folder-123', onUploaded);

            // Should not throw even when preview/spinner are missing
            await handler({ target: { files: [mockFile] } });

            expect(onUploaded).toHaveBeenCalled();
        });

        it('skal fungere uten onUploaded-callback', async () => {
            uploadImage.mockResolvedValueOnce({ id: 'y', name: 'y.jpg' });
            const mockFile = new File(['data'], 'y.jpg', { type: 'image/jpeg' });
            const handler = captureChangeHandler('folder-123', null);

            // Should not throw even when onUploaded is null
            await handler({ target: { files: [mockFile] } });
        });
    });
});
