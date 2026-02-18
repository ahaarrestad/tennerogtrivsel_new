// src/scripts/admin-gallery.js
import { checkAccess, listImages, uploadImage } from './admin-client.js';

/**
 * Laster bildegalleri fra Google Drive og rendrer thumbnails i grid-elementet.
 * @param {string} folderId
 * @param {(id: string, name: string) => void} onSelect
 */
export async function loadGallery(folderId, onSelect) {
    const grid = document.getElementById('image-gallery-grid');
    if (!grid) return;

    grid.innerHTML = '<div class="col-span-full text-center py-12 text-slate-400 italic animate-pulse">Laster bilder...</div>';

    try {
        if (!folderId) throw new Error("Mappe-ID mangler");

        const hasAccess = await checkAccess(folderId);
        if (!hasAccess) {
            grid.innerHTML = '<div class="col-span-full text-center py-12 text-amber-500 font-bold italic">⚠️ Du har ikke lesetilgang til denne mappen på Google Drive.</div>';
            return;
        }

        const images = await listImages(folderId);

        if (images.length === 0) {
            grid.innerHTML = '<div class="col-span-full text-center py-12 text-slate-400 italic">Ingen bilder funnet i mappen.</div>';
            return;
        }

        grid.innerHTML = '';
        images.forEach(img => {
            const el = document.createElement('div');
            el.className = 'group relative aspect-square bg-slate-100 rounded-lg overflow-hidden cursor-pointer hover:ring-4 ring-brand transition-all flex items-center justify-center';

            if (img.thumbnailLink) {
                el.innerHTML = `
                    <img src="${img.thumbnailLink}" referrerpolicy="no-referrer" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" loading="lazy">
                    <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2 text-center">
                        <span class="text-white text-[10px] font-bold break-all line-clamp-2">${img.name}</span>
                    </div>
                `;
            } else {
                el.innerHTML = `
                    <div class="flex flex-col items-center justify-center text-slate-400 p-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mb-1"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                        <span class="text-[8px] font-bold break-all line-clamp-2 text-center">${img.name}</span>
                    </div>
                `;
            }
            el.onclick = () => onSelect(img.id, img.name);
            grid.appendChild(el);
        });
    } catch (e) {
        console.error("[Admin] Galleri feilet:", e);
        grid.innerHTML = `<div class="col-span-full text-center py-12 text-red-400 italic">Kunne ikke laste bilder.</div>`;
    }
}

/**
 * Setter opp filopplasting for bildevalg-dialogen.
 * Kloner input-elementet for å rydde eventuelle gamle lyttere, og håndterer
 * upload-spinner og onUploaded-callback.
 * @param {string} folderId
 * @param {(file: {id: string, name: string}) => void} onUploaded
 */
export function setupUploadHandler(folderId, onUploaded) {
    const input = document.getElementById('upload-image-input');
    if (!input) return;

    // Clone to remove stale event listeners from previous calls
    const newInput = input.cloneNode(true);
    input.parentNode?.replaceChild(newInput, input);

    newInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const preview = document.getElementById('upload-preview');
        const spinner = document.getElementById('upload-spinner');

        if (preview) preview.classList.add('opacity-0');
        if (spinner) spinner.classList.remove('hidden');

        try {
            const result = await uploadImage(folderId, file);
            if (onUploaded) onUploaded(result);
        } catch (err) {
            alert("Opplasting feilet!");
            console.error(err);
        } finally {
            if (preview) preview.classList.remove('opacity-0');
            if (spinner) spinner.classList.add('hidden');
            newInput.value = '';
        }
    });
}
