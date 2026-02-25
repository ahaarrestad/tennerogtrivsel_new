import {
    updateTannlegeRow, addTannlegeRow, deleteTannlegeRowPermanently,
    getDriveImageBlob, findFileByName, backupToSlettetSheet, getTannlegerRaw
} from './admin-client.js';
import { showToast, showConfirm } from './admin-dialog.js';
import { loadGallery, setupUploadHandler } from './admin-gallery.js';
import { loadTannlegerModule, formatTimestamp } from './admin-dashboard.js';
import {
    getAdminConfig, renderToggleHtml, attachToggleClick,
    showDeletionToast, bindSliderStepButtons, bindWheelPrevent,
    showSaveBar, hideSaveBar
} from './admin-editor-helpers.js';

let tannlegeSaveTimeout = null;

async function deleteTannlege(rowIndex, name) {
    const { SHEET_ID } = getAdminConfig();
    if (await showConfirm(`Vil du slette «${name}» permanent? Dette kan ikke angres.`, { destructive: true })) {
        try {
            const allRows = await getTannlegerRaw(SHEET_ID);
            const rowData = allRows.find(r => r.rowIndex === rowIndex);
            if (rowData) {
                await backupToSlettetSheet(SHEET_ID, 'tannlege', rowData.name, JSON.stringify(rowData));
            }
            await deleteTannlegeRowPermanently(SHEET_ID, rowIndex);
            reloadTannleger();
            showDeletionToast(name,
                'Raden er permanent fjernet fra tannleger-arket. En sikkerhetskopi finnes i «Slettet»-fanen i Google Sheets ' +
                'og kan kopieres tilbake manuelt ved behov.');
        } catch (e) { showToast("Kunne ikke slette profilen.", "error"); }
    }
}

async function editTannlege(rowIndex, data = null) {
    const { SHEET_ID, TANNLEGER_FOLDER } = getAdminConfig();
    const inner = document.getElementById('module-inner');
    const actions = document.getElementById('module-actions');
    if (!inner || !actions) return;

    actions.innerHTML = `
        <button onclick="window.openTannlegerModule()" class="admin-btn-secondary text-xs py-2 px-4 shadow-md flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Tilbake til oversikten
        </button>
    `;
    inner.innerHTML = '<div class="text-admin-muted italic text-sm animate-pulse">Henter profil og bilde fra Google...</div>';

    const t = data || { name: '', title: '', description: '', image: '', active: true, scale: 1.0, positionX: 50, positionY: 50 };

    let previewSrc = '';
    let currentImageId = null;

    if (t.image) {
        try {
            if (t.image.length > 20 && !t.image.includes('.')) {
                currentImageId = t.image;
            } else {
                const file = await findFileByName(t.image, TANNLEGER_FOLDER);
                if (file) currentImageId = file.id;
            }

            if (currentImageId) {
                const blobUrl = await getDriveImageBlob(currentImageId);
                if (blobUrl) previewSrc = blobUrl;
            }
        } catch (err) {
            console.warn("[Admin] Kunne ikke hente bilde-preview fra Drive.");
        }

        if (!previewSrc && t.image && t.image.includes('.')) {
            previewSrc = `/src/assets/tannleger/${t.image}`;
        }
    }

    inner.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 max-w-6xl animate-in fade-in slide-in-from-bottom-2 duration-300">
            <!-- VENSTRE: Skjema -->
            <div class="space-y-6">
                <h3 class="text-brand font-black uppercase tracking-tighter">Rediger profil</h3>
                ${renderToggleHtml('edit-t-active-toggle', !!t.active)}

                <div class="space-y-4">
                    <div class="admin-field-container">
                        <label class="admin-label">Profilbilde</label>
                        <div class="flex items-center gap-3">
                            <input type="text" id="edit-t-image" value="${t.image}" class="admin-input flex-grow text-xs text-admin-muted font-mono" placeholder="Ingen bilde valgt" readonly>
                            <button id="btn-open-gallery" class="btn-primary py-3 px-4 text-xs shrink-0 whitespace-nowrap">Velg bilde</button>
                        </div>
                        <p class="text-[10px] text-admin-muted-light mt-1 italic">Lastes fra Google Drive (mappe: tannleger)</p>
                    </div>

                    <div class="admin-field-container">
                        <label class="admin-label">Fullt navn</label>
                        <input type="text" id="edit-t-name" value="${t.name}" class="admin-input" placeholder="Navn Navnesen">
                    </div>
                    <div class="admin-field-container">
                        <label class="admin-label">Tittel / Rolle</label>
                        <input type="text" id="edit-t-title" value="${t.title}" class="admin-input" placeholder="Tannlege / Spesialist">
                    </div>
                    <div class="admin-field-container">
                        <label class="admin-label">Kort beskrivelse</label>
                        <textarea id="edit-t-desc" rows="4" class="admin-input resize-none">${t.description}</textarea>
                    </div>
                </div>

                <div class="space-y-6 pt-4 border-t border-admin-border">
                    <h4 class="text-brand font-black text-xs uppercase tracking-widest">Bildeutsnitt (Zoom og posisjon)</h4>

                    <div class="space-y-4">
                        <div>
                            <div class="flex justify-between mb-2">
                                <label for="edit-t-scale" class="admin-label !mb-0">Zoom (Skala)</label>
                                <span id="val-scale" class="text-[10px] font-bold text-brand">${t.scale}x</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <button type="button" class="slider-step-btn" data-target="edit-t-scale" data-step="-0.1">&minus;</button>
                                <input type="range" id="edit-t-scale" min="1.0" max="3.0" step="0.01" value="${t.scale}" class="flex-grow h-2 bg-admin-border rounded-lg appearance-none cursor-pointer accent-brand">
                                <button type="button" class="slider-step-btn" data-target="edit-t-scale" data-step="0.1">+</button>
                            </div>
                        </div>

                        <div>
                            <div class="flex justify-between mb-2">
                                <label for="edit-t-x" class="admin-label !mb-0">Fokuspunkt Horisontalt (X)</label>
                                <span id="val-x" class="text-[10px] font-bold text-brand">${t.positionX}%</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <button type="button" class="slider-step-btn" data-target="edit-t-x" data-step="-1">&minus;</button>
                                <input type="range" id="edit-t-x" min="0" max="100" value="${t.positionX}" class="flex-grow h-2 bg-admin-border rounded-lg appearance-none cursor-pointer accent-brand">
                                <button type="button" class="slider-step-btn" data-target="edit-t-x" data-step="1">+</button>
                            </div>
                        </div>

                        <div>
                            <div class="flex justify-between mb-2">
                                <label for="edit-t-y" class="admin-label !mb-0">Fokuspunkt Vertikalt (Y)</label>
                                <span id="val-y" class="text-[10px] font-bold text-brand">${t.positionY}%</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <button type="button" class="slider-step-btn" data-target="edit-t-y" data-step="-1">&minus;</button>
                                <input type="range" id="edit-t-y" min="0" max="100" value="${t.positionY}" class="flex-grow h-2 bg-admin-border rounded-lg appearance-none cursor-pointer accent-brand">
                                <button type="button" class="slider-step-btn" data-target="edit-t-y" data-step="1">+</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="pt-6 border-t border-admin-border">
                    <button onclick="window.openTannlegerModule()" class="btn-primary w-full py-4 px-8 shadow-xl uppercase font-black tracking-widest text-xs flex items-center justify-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        Lagre og gå tilbake
                    </button>
                </div>
            </div>

            <!-- HØYRE: Preview -->
            <div class="space-y-6">
                <h3 class="text-brand font-black uppercase tracking-tighter text-center lg:text-left">Forhåndsvisning</h3>
                <div class="flex justify-center lg:justify-start">
                    <div class="card-base w-full max-w-[350px] min-h-[320px] sm:min-h-[450px] items-center text-center justify-center">
                        <div class="card-accent-corner"></div>

                        <div class="relative z-10 mb-6 w-36 sm:w-48 h-36 sm:h-48 mx-auto">
                            <div class="relative overflow-hidden z-10 h-full w-full rounded-2xl border-4 border-white shadow-md bg-admin-surface flex items-center justify-center">
                                <div id="no-image-placeholder" class="flex flex-col items-center justify-center text-admin-muted-light ${previewSrc ? 'hidden' : ''}">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mb-2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                    <span class="text-[10px] font-black uppercase tracking-widest">Velg bilde</span>
                                </div>
                                <img id="preview-img"
                                     src="${previewSrc}"
                                     class="absolute inset-0 w-full h-full object-cover transition-all duration-75 ${previewSrc ? '' : 'hidden'}"
                                     style="object-position: ${t.positionX}% ${t.positionY}%; transform: scale(${t.scale}); transform-origin: ${t.positionX}% ${t.positionY}%;"
                                >
                            </div>
                        </div>

                        <div class="relative z-10 w-full flex flex-col grow">
                            <h3 id="preview-name" class="h3 mb-1">${t.name || 'Navn'}</h3>
                            <div class="card-text space-y-1 grow">
                                <p id="preview-title" class="card-subtitle">${t.title || 'Tittel'}</p>
                                <p id="preview-desc" class="line-clamp-6">${t.description || 'Beskrivelse kommer her...'}</p>
                            </div>
                        </div>

                        <div class="card-progress-bar !w-full"></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // --- IMAGE GALLERY LOGIC ---
    const btnGallery = document.getElementById('btn-open-gallery');
    const modal = document.getElementById('image-picker-modal');

    if (btnGallery && modal) {
        btnGallery.onclick = () => {
            modal.showModal();
            loadGallery(TANNLEGER_FOLDER, async (fileId, fileName) => {
                const imgInput = document.getElementById('edit-t-image');
                const previewImg = document.getElementById('preview-img');
                const placeholder = document.getElementById('no-image-placeholder');

                if (imgInput) {
                    imgInput.value = fileName;

                    if (previewImg) {
                        const blobUrl = await getDriveImageBlob(fileId);
                        if (blobUrl) {
                            previewImg.src = blobUrl;
                            previewImg.classList.remove('hidden');
                            placeholder?.classList.add('hidden');
                        }
                    }

                    imgInput.dispatchEvent(new Event('input'));
                }
                modal.close();
            });
        };
    }

    setupUploadHandler(TANNLEGER_FOLDER, async (newFile) => {
        if (newFile) {
             const imgInput = document.getElementById('edit-t-image');
             const previewImg = document.getElementById('preview-img');
             const placeholder = document.getElementById('no-image-placeholder');

             if (imgInput) {
                 imgInput.value = newFile.name;

                 if (previewImg) {
                     const blobUrl = await getDriveImageBlob(newFile.id);
                     if (blobUrl) {
                         previewImg.src = blobUrl;
                         previewImg.classList.remove('hidden');
                         placeholder?.classList.add('hidden');
                     }
                 }

                 imgInput.dispatchEvent(new Event('input'));
             }
             modal.close();
        }
    });

    const updatePreview = () => {
        const nameInp = document.getElementById('edit-t-name');
        const titleInp = document.getElementById('edit-t-title');
        const descInp = document.getElementById('edit-t-desc');
        const imageInp = document.getElementById('edit-t-image');
        const scaleInp = document.getElementById('edit-t-scale');
        const xInp = document.getElementById('edit-t-x');
        const yInp = document.getElementById('edit-t-y');
        const activeToggle = document.getElementById('edit-t-active-toggle');

        const name = nameInp.value;
        const title = titleInp.value;
        const desc = descInp.value;
        const image = imageInp.value;
        const scale = scaleInp.value;
        const posX = xInp.value;
        const posY = yInp.value;
        const active = activeToggle?.dataset.active === 'true';

        const nameEl = document.getElementById('preview-name');
        const titleEl = document.getElementById('preview-title');
        const descEl = document.getElementById('preview-desc');
        if (nameEl) nameEl.textContent = name || 'Navn';
        if (titleEl) titleEl.textContent = title || 'Tittel';
        if (descEl) descEl.textContent = desc || 'Beskrivelse kommer her...';

        const img = document.getElementById('preview-img');
        if (img) {
            img.style.objectPosition = `${posX}% ${posY}%`;
            img.style.transform = `scale(${parseFloat(scale)})`;
            img.style.transformOrigin = `${posX}% ${posY}%`;
        }

        const valScale = document.getElementById('val-scale');
        const valX = document.getElementById('val-x');
        const valY = document.getElementById('val-y');
        if (valScale) valScale.textContent = `${scale}x`;
        if (valX) valX.textContent = `${posX}%`;
        if (valY) valY.textContent = `${posY}%`;

        showSaveBar('changed', '⏳ Endringer oppdaget...');

        clearTimeout(tannlegeSaveTimeout);
        tannlegeSaveTimeout = setTimeout(async () => {
            showSaveBar('saving', '💾 Lagrer til Google Sheets...');
            const updateData = {
                name, title, description: desc, active,
                image: image,
                scale: parseFloat(scale),
                positionX: parseInt(posX),
                positionY: parseInt(posY)
            };

            try {
                if (rowIndex) {
                    await updateTannlegeRow(SHEET_ID, rowIndex, updateData);
                } else {
                    await addTannlegeRow(SHEET_ID, updateData);
                    return reloadTannleger();
                }
                // Stille verifisering
                const savedTime = new Date();
                try {
                    const freshData = await getTannlegerRaw(SHEET_ID);
                    const fetchedEl = document.getElementById('tannleger-last-fetched');
                    if (fetchedEl) fetchedEl.textContent = formatTimestamp(new Date());
                    const freshRow = freshData.find(d => d.rowIndex === rowIndex);
                    if (freshRow && freshRow.name !== name) {
                        console.warn(`[Admin] Tannlege-mismatch etter lagring: forventet "${name}", fikk "${freshRow.name}"`);
                        showSaveBar('error', '⚠️ Laster på nytt…');
                        reloadTannleger();
                        return;
                    }
                } catch (verifyErr) {
                    console.warn("[Admin] Tannlege-verifisering feilet, men lagring gikk OK:", verifyErr);
                }
                const ts = formatTimestamp(savedTime);
                showSaveBar('saved', `✅ Lagret ${ts}`);
                hideSaveBar(5000);
            } catch (e) {
                showSaveBar('error', '❌ Feil ved lagring!');
            }
        }, 1500);
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
    const { SHEET_ID, TANNLEGER_FOLDER } = getAdminConfig();
    loadTannlegerModule(SHEET_ID, editTannlege, deleteTannlege, TANNLEGER_FOLDER, toggleTannlegeActive);
}

export function initTannlegerModule() {
    window.deleteTannlege = deleteTannlege;
    window.editTannlege = editTannlege;
    window.openTannlegerModule = reloadTannleger;
}

export { reloadTannleger };
