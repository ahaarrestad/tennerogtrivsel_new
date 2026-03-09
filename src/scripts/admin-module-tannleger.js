import DOMPurify from 'dompurify';
import {
    updateTannlegeRow, addTannlegeRow, deleteTannlegeRowPermanently,
    backupToSlettetSheet, getTannlegerRaw,
    findFileByName, deleteFile, listImages
} from './admin-client.js';
import { showToast, showConfirm } from './admin-dialog.js';
import { loadGallery, setupUploadHandler } from './admin-gallery.js';
import { loadTannlegerModule, formatTimestamp } from './admin-dashboard.js';
import {
    getAdminConfig, renderToggleHtml, attachToggleClick,
    showDeletionToast, renderImageCropSliders, createAutoSaver,
    bindSliderStepButtons, bindWheelPrevent,
    escapeHtml, resolveImagePreview, handleImageSelected, verifySave
} from './admin-editor-helpers.js';

async function deleteTannlege(rowIndex, name) {
    const { SHEET_ID, TANNLEGER_FOLDER } = getAdminConfig();
    if (await showConfirm(`Vil du slette «${name}» permanent? Dette kan ikke angres.`, { destructive: true })) {
        try {
            const allRows = await getTannlegerRaw(SHEET_ID);
            const rowData = allRows.find(r => r.rowIndex === rowIndex);
            if (rowData) {
                await backupToSlettetSheet(SHEET_ID, 'tannlege', rowData.name, JSON.stringify(rowData));
            }
            await deleteTannlegeRowPermanently(SHEET_ID, rowIndex);

            // Drive-sletting (best-effort)
            const imageName = rowData?.image;
            if (imageName) {
                try {
                    const file = await findFileByName(imageName, TANNLEGER_FOLDER);
                    if (file) await deleteFile(file.id);
                } catch (driveErr) {
                    console.warn('[Admin] Kunne ikke slette Drive-fil:', driveErr);
                }
            }

            reloadTannleger();
            showDeletionToast(name,
                'Profilen er slettet fra regnearket og bildet lagt i Drive-papirkurven. ' +
                'En sikkerhetskopi finnes i «Slettet»-fanen.');
        } catch (e) { showToast("Kunne ikke slette profilen.", "error"); }
    }
}

async function editTannlege(rowIndex, data = null) {
    const { SHEET_ID, TANNLEGER_FOLDER } = getAdminConfig();
    const inner = document.getElementById('module-inner');
    const actions = document.getElementById('module-actions');
    if (!inner || !actions) return;

    actions.innerHTML = '';
    window.setBreadcrumbEditor?.('Redigerer profil', reloadTannleger);
    inner.innerHTML = '<div class="text-admin-muted italic text-sm animate-pulse">Henter profil og bilde fra Google...</div>';

    const t = data || { name: '', title: '', description: '', image: '', active: true, scale: 1.0, positionX: 50, positionY: 50 };

    const { src: previewSrc } = await resolveImagePreview(t.image, TANNLEGER_FOLDER, { localFallbackDir: '/src/assets/tannleger/' });

    inner.innerHTML = DOMPurify.sanitize(`
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 max-w-6xl animate-in fade-in slide-in-from-bottom-2 duration-300">
            <!-- VENSTRE: Skjema -->
            <div class="space-y-6">
                <h3 class="text-brand font-black uppercase tracking-tighter">Rediger profil</h3>
                ${renderToggleHtml('edit-t-active-toggle', !!t.active)}

                <div class="space-y-4">
                    <div class="admin-field-container">
                        <label class="admin-label">Profilbilde</label>
                        <p class="text-xs text-admin-muted-light -mt-0.5">Vises på: Tannlegekort og detaljside</p>
                        <div class="flex items-center gap-3">
                            <input type="text" id="edit-t-image" value="" class="admin-input flex-grow text-xs text-admin-muted font-mono" placeholder="Ingen bilde valgt" readonly>
                            <button id="btn-open-gallery" class="btn-primary py-3 px-4 text-xs shrink-0 whitespace-nowrap">Velg bilde</button>
                        </div>
                        <p class="text-[10px] text-admin-muted-light mt-1 italic">Lastes fra Google Drive (mappe: tannleger)</p>
                    </div>

                    <div class="admin-field-container">
                        <label class="admin-label">Fullt navn</label>
                        <p class="text-xs text-admin-muted-light -mt-0.5">Vises på: Tannlegekort og detaljside</p>
                        <input type="text" id="edit-t-name" value="" class="admin-input" placeholder="Navn Navnesen">
                    </div>
                    <div class="admin-field-container">
                        <label class="admin-label">Tittel / Rolle</label>
                        <p class="text-xs text-admin-muted-light -mt-0.5">Vises på: Tannlegekort, under navnet</p>
                        <input type="text" id="edit-t-title" value="" class="admin-input" placeholder="Tannlege / Spesialist">
                    </div>
                    <div class="admin-field-container">
                        <label class="admin-label">Kort beskrivelse</label>
                        <p class="text-xs text-admin-muted-light -mt-0.5">Vises på: Tannlegekort og detaljside</p>
                        <textarea id="edit-t-desc" rows="4" class="admin-input resize-none"></textarea>
                    </div>
                </div>

                ${renderImageCropSliders({ prefix: 'edit-t', valPrefix: 'val', scale: t.scale, posX: t.positionX, posY: t.positionY })}

            </div>

            <!-- HØYRE: Preview -->
            <div class="space-y-6">
                <h3 class="text-brand font-black uppercase tracking-tighter text-center lg:text-left">Forhåndsvisning</h3>
                <div class="flex justify-center lg:justify-start">
                    <div class="w-full max-w-[250px]">
                        <div class="max-w-[75%] mx-auto">
                        <div class="relative aspect-[3/4] rounded-xl overflow-hidden bg-admin-surface">
                            <div id="no-image-placeholder" class="absolute inset-0 flex flex-col items-center justify-center text-admin-muted-light ${previewSrc ? 'hidden' : ''}">
                                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mb-2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                <span class="text-[10px] font-black uppercase tracking-widest">Velg bilde</span>
                            </div>
                            <img id="preview-img"
                                 src="${escapeHtml(previewSrc)}"
                                 class="absolute inset-0 w-full h-full object-cover transition-all duration-75 ${previewSrc ? '' : 'hidden'}"
                                 style="object-position: ${t.positionX}% ${t.positionY}%; transform: scale(${t.scale}); transform-origin: ${t.positionX}% ${t.positionY}%;"
                            >
                        </div>
                        </div>
                        <details class="mt-3" ${t.description ? '' : 'hidden'} id="preview-details">
                            <summary class="tannlege-summary w-full text-center cursor-pointer list-none rounded-xl border border-brand-border py-2 px-3 transition-all duration-200 hover:border-brand">
                                <span id="preview-name" class="font-heading font-bold text-sm block">${escapeHtml(t.name) || 'Navn'}</span>
                                <span id="preview-title" class="text-brand-hover text-xs block">${escapeHtml(t.title) || 'Tittel'}</span>
                            </summary>
                            <div class="mt-3 text-sm leading-relaxed text-brand-hover">
                                <span id="preview-desc">${escapeHtml(t.description) || ''}</span>
                            </div>
                        </details>
                        <div class="mt-3 text-center ${t.description ? 'hidden' : ''}" id="preview-no-desc">
                            <span id="preview-name-nodesc" class="font-heading font-bold text-sm block">${escapeHtml(t.name) || 'Navn'}</span>
                            <span id="preview-title-nodesc" class="text-brand-hover text-xs block">${escapeHtml(t.title) || 'Tittel'}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `);

    // Sett form-verdier programmatisk (sikkert — ingen HTML-parsing)
    const imageInput = document.getElementById('edit-t-image');
    const nameInput = document.getElementById('edit-t-name');
    const titleInput = document.getElementById('edit-t-title');
    const descInput = document.getElementById('edit-t-desc');
    if (imageInput) imageInput.value = t.image || '';
    if (nameInput) nameInput.value = t.name || '';
    if (titleInput) titleInput.value = t.title || '';
    if (descInput) descInput.value = t.description || '';

    // --- IMAGE GALLERY LOGIC ---
    const btnGallery = document.getElementById('btn-open-gallery');
    const modal = document.getElementById('image-picker-modal');

    if (btnGallery && modal) {
        btnGallery.onclick = () => {
            modal.showModal();
            loadGallery(TANNLEGER_FOLDER, async (fileId, fileName) => {
                await handleImageSelected({
                    fileId, fileName,
                    inputEl: document.getElementById('edit-t-image'),
                    previewImgEl: document.getElementById('preview-img'),
                    placeholderEl: document.getElementById('no-image-placeholder')
                });
                modal.close();
            });
        };
    }

    setupUploadHandler(TANNLEGER_FOLDER, async (newFile) => {
        if (newFile) {
            await handleImageSelected({
                fileId: newFile.id, fileName: newFile.name,
                inputEl: document.getElementById('edit-t-image'),
                previewImgEl: document.getElementById('preview-img'),
                placeholderEl: document.getElementById('no-image-placeholder')
            });
            modal.close();
        }
    });

    const saveTannlege = async () => {
        const nameInp = document.getElementById('edit-t-name');
        const titleInp = document.getElementById('edit-t-title');
        const descInp = document.getElementById('edit-t-desc');
        const imageInp = document.getElementById('edit-t-image');
        const scaleInp = document.getElementById('edit-t-scale');
        const xInp = document.getElementById('edit-t-x');
        const yInp = document.getElementById('edit-t-y');
        const activeToggle = document.getElementById('edit-t-active-toggle');

        const updateData = {
            name: nameInp.value,
            title: titleInp.value,
            description: descInp.value,
            active: activeToggle?.dataset.active === 'true',
            image: imageInp.value,
            scale: parseFloat(scaleInp.value),
            positionX: parseInt(xInp.value),
            positionY: parseInt(yInp.value)
        };

        if (rowIndex) {
            await updateTannlegeRow(SHEET_ID, rowIndex, updateData);
        } else {
            await addTannlegeRow(SHEET_ID, updateData);
            reloadTannleger();
            return;
        }
        await verifySave({
            fetchFn: () => getTannlegerRaw(SHEET_ID),
            rowIndex,
            compareField: 'name',
            expectedValue: updateData.name,
            timestampElId: 'tannleger-last-fetched',
            reloadFn: reloadTannleger
        });
    };
    const autoSaver = createAutoSaver(saveTannlege);

    const updatePreview = () => {
        const nameInp = document.getElementById('edit-t-name');
        const titleInp = document.getElementById('edit-t-title');
        const descInp = document.getElementById('edit-t-desc');
        const scaleInp = document.getElementById('edit-t-scale');
        const xInp = document.getElementById('edit-t-x');
        const yInp = document.getElementById('edit-t-y');

        const nameEl = document.getElementById('preview-name');
        const titleEl = document.getElementById('preview-title');
        const descEl = document.getElementById('preview-desc');
        const nameNoDesc = document.getElementById('preview-name-nodesc');
        const titleNoDesc = document.getElementById('preview-title-nodesc');
        const detailsEl = document.getElementById('preview-details');
        const noDescEl = document.getElementById('preview-no-desc');
        const nameVal = nameInp.value || 'Navn';
        const titleVal = titleInp.value || 'Tittel';
        const descVal = descInp.value || '';
        if (nameEl) nameEl.textContent = nameVal;
        if (titleEl) titleEl.textContent = titleVal;
        if (descEl) descEl.textContent = descVal;
        if (nameNoDesc) nameNoDesc.textContent = nameVal;
        if (titleNoDesc) titleNoDesc.textContent = titleVal;
        if (detailsEl && noDescEl) {
            if (descVal) {
                detailsEl.hidden = false;
                noDescEl.classList.add('hidden');
            } else {
                detailsEl.hidden = true;
                noDescEl.classList.remove('hidden');
            }
        }

        const img = document.getElementById('preview-img');
        if (img) {
            const posX = xInp.value;
            const posY = yInp.value;
            img.style.objectPosition = `${posX}% ${posY}%`;
            img.style.transform = `scale(${parseFloat(scaleInp.value)})`;
            img.style.transformOrigin = `${posX}% ${posY}%`;
        }

        const valScale = document.getElementById('val-scale');
        const valX = document.getElementById('val-x');
        const valY = document.getElementById('val-y');
        if (valScale) valScale.textContent = `${scaleInp.value}x`;
        if (valX) valX.textContent = `${xInp.value}%`;
        if (valY) valY.textContent = `${yInp.value}%`;

        autoSaver.trigger();
    };

    attachToggleClick('edit-t-active-toggle', updatePreview);

    ['edit-t-name', 'edit-t-title', 'edit-t-desc', 'edit-t-image', 'edit-t-scale', 'edit-t-x', 'edit-t-y'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener(el instanceof HTMLInputElement && el.type === 'range' ? 'input' : 'change', updatePreview);
        if (el instanceof HTMLInputElement && el.type === 'text' || el instanceof HTMLTextAreaElement) {
            el.addEventListener('input', updatePreview);
        }
    });

    bindSliderStepButtons(inner);
    bindWheelPrevent(inner);
}

async function toggleTannlegeActive(rowIndex, t) {
    const { SHEET_ID } = getAdminConfig();
    const newActive = !t.active;
    // Optimistisk UI-oppdatering
    const btn = document.querySelector(`.toggle-active-btn[data-row="${rowIndex}"]`);
    const card = btn?.closest('.admin-card-interactive');
    if (btn) {
        btn.dataset.active = String(newActive);
        const label = btn.querySelector('.toggle-label');
        if (label) label.textContent = newActive ? 'Aktiv' : 'Inaktiv';
    }
    if (card) card.classList.toggle('opacity-60', !newActive);

    try {
        await updateTannlegeRow(SHEET_ID, rowIndex, { ...t, active: newActive });
        t.active = newActive;
    } catch (e) {
        // Reverser ved feil
        if (btn) {
            btn.dataset.active = String(t.active);
            const label = btn.querySelector('.toggle-label');
            if (label) label.textContent = t.active ? 'Aktiv' : 'Inaktiv';
        }
        if (card) card.classList.toggle('opacity-60', !t.active);
        reloadTannleger();
    }
}

function reloadTannleger() {
    window.clearBreadcrumbEditor?.();
    const { SHEET_ID, TANNLEGER_FOLDER } = getAdminConfig();
    loadTannlegerModule(SHEET_ID, editTannlege, deleteTannlege, TANNLEGER_FOLDER, toggleTannlegeActive);

    // Asynkron konsistenssjekk (best-effort, ikke-blokkerende)
    if (TANNLEGER_FOLDER) {
        (async () => {
            try {
                const [sheetItems, driveFiles] = await Promise.all([
                    getTannlegerRaw(SHEET_ID),
                    listImages(TANNLEGER_FOLDER)
                ]);
                const driveFileNames = new Set(driveFiles.map(f => f.name));
                const sheetFileNames = new Set(sheetItems.map(item => item.image).filter(Boolean));

                const orphanedInDrive = driveFiles.filter(f => !sheetFileNames.has(f.name));
                const missingFromDrive = sheetItems.filter(item => item.image && !driveFileNames.has(item.image));

                if (missingFromDrive.length > 0) {
                    const names = missingFromDrive.map(item => `«${item.name || 'Uten navn'}» → ${item.image}`).join(', ');
                    showToast(`⚠ ${missingFromDrive.length} profil(er) refererer bilder som ikke finnes i Drive: ${names}`, 'warning');
                }
                if (orphanedInDrive.length > 0) {
                    const names = orphanedInDrive.map(f => f.name).join(', ');
                    showToast(`ℹ ${orphanedInDrive.length} bilde(r) i Drive-mappen er ikke koblet til noen profil: ${names}`, 'info');
                }
            } catch {
                // Best-effort — feiler den, vises ingen advarsel
            }
        })();
    }
}

export function initTannlegerModule() {
    window.deleteTannlege = deleteTannlege;
    window.editTannlege = editTannlege;
    window.openTannlegerModule = reloadTannleger;
}

export { reloadTannleger };
