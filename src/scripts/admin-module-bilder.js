import DOMPurify from 'dompurify';
import {
    getSheetParentFolder, getGalleriRaw, updateGalleriRow, addGalleriRow,
    deleteGalleriRowPermanently, setForsideBildeInGalleri, setFellesBildeInGalleri, migrateForsideBildeToGalleri,
    findFileByName, deleteFile, listImages
} from './admin-client.js';
import { animateSwap, disableReorderButtons, enableReorderButtons, updateReorderButtonVisibility } from './admin-reorder.js';
import { showToast, showConfirm } from './admin-dialog.js';
import { loadGallery, setupUploadHandler } from './admin-gallery.js';
import { loadGalleriListeModule, reorderGalleriItem, formatTimestamp, ICON_ADD } from './admin-dashboard.js';
import {
    getAdminConfig, renderToggleHtml, setToggleState, attachToggleClick,
    showDeletionToast, renderImageCropSliders, createAutoSaver,
    bindSliderStepButtons, bindWheelPrevent,
    showSaveBar, hideSaveBar, resolveImagePreview, handleImageSelected, verifySave,
    checkDriveConsistency
} from './admin-editor-helpers.js';

export async function loadBilderModule() {
    window.clearBreadcrumbEditor?.();
    const { SHEET_ID, BILDER_FOLDER } = getAdminConfig();
    const inner = document.getElementById('module-inner');
    const actions = document.getElementById('module-actions');
    if (!inner || !actions) return;

    actions.innerHTML = `<button id="btn-new-galleribilde" class="btn-primary p-2.5 shadow-md rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center" title="Legg til bilde" aria-label="Legg til bilde">${ICON_ADD}</button>`;
    inner.innerHTML = '<div class="text-admin-muted italic text-sm animate-pulse">Henter bildeinnstillinger...</div>';

    try {
        const parentFolderId = BILDER_FOLDER || await getSheetParentFolder(SHEET_ID);

        if (!parentFolderId) {
            inner.innerHTML = `<div class="admin-alert-error">❌ Kunne ikke bestemme Drive-mappen for regnearket.</div>`;
            return;
        }

        // One-time migrering av forsidebilde fra Innstillinger til galleri
        try {
            await migrateForsideBildeToGalleri(SHEET_ID);
        } catch (migErr) {
            console.warn('[Admin] Migrering av forsidebilde feilet (ikke-kritisk):', migErr);
        }

        inner.innerHTML = `
            <div class="max-w-6xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                <p class="text-xs text-admin-muted-light italic mb-6">Administrer forsidebilde og galleribilder. Bildet merket som «Forsidebilde» brukes på forsiden. De øvrige vises i galleriet.</p>
                <div id="galleri-liste-container">
                    <div class="text-admin-muted italic text-sm animate-pulse">Henter galleribilder...</div>
                </div>
            </div>
        `;

        // --- GALLERI-LISTE ---
        const editGalleriBilde = async (rowIndex) => {
            const galleriItems = await getGalleriRaw(SHEET_ID);
            const item = galleriItems.find(g => g.rowIndex === rowIndex);
            if (!item) return;

            const isForsidebilde = item.type === 'forsidebilde';
            const isFellesbilde = item.type === 'fellesbilde';
            const previewLabel = isForsidebilde ? 'Forhåndsvisning (16:10)' : isFellesbilde ? 'Forhåndsvisning (16:9)' : 'Forhåndsvisning (4:3)';

            const { src: itemPreviewSrc } = await resolveImagePreview(item.image, parentFolderId);

            const inner2 = document.getElementById('module-inner');
            if (!inner2) return;
            inner2.innerHTML = DOMPurify.sanitize(`
                <div class="max-w-4xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                        <div class="space-y-6">
                            <div id="galleri-active-field">
                                ${renderToggleHtml('galleri-edit-active-toggle', true)}
                            </div>
                            <div class="admin-field-container">
                                <label class="admin-label">Tittel</label>
                                <p class="text-xs text-admin-muted-light -mt-0.5">Vises på: Bildetekst i galleriet</p>
                                <input type="text" id="galleri-edit-title" value="" class="admin-input" placeholder="F.eks. Venterom">
                            </div>
                            <div class="admin-field-container">
                                <label class="admin-label">Alt-tekst</label>
                                <p class="text-xs text-admin-muted-light -mt-0.5">Vises på: Skjermlesere og søkemotorer</p>
                                <input type="text" id="galleri-edit-alt" value="" class="admin-input" placeholder="Beskrivelse for tilgjengelighet">
                            </div>
                            <div class="admin-field-container">
                                <label class="admin-label">Bildefil</label>
                                <p class="text-xs text-admin-muted-light -mt-0.5">Vises på: Galleri og forsidebilde</p>
                                <div class="flex items-center gap-3">
                                    <input type="text" id="galleri-edit-image" value="" class="admin-input flex-grow text-xs text-admin-muted font-mono" placeholder="Ingen bilde valgt" readonly>
                                    <button id="btn-galleri-pick-image" class="btn-primary py-3 px-4 text-xs shrink-0 whitespace-nowrap">Velg bilde</button>
                                </div>
                            </div>
                            <div class="admin-field-container flex items-center justify-between gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50/50">
                                <div>
                                    <label class="admin-label !mb-0">Bruk som forsidebilde</label>
                                    <p class="text-[10px] text-admin-muted-light mt-0.5">Kun ett forsidebilde om gangen</p>
                                </div>
                                <input type="checkbox" id="galleri-edit-forsidebilde" class="w-5 h-5 accent-amber-500 cursor-pointer">
                            </div>
                            <div class="admin-field-container flex items-center justify-between gap-3 p-4 rounded-xl border border-sky-200 bg-sky-50/50">
                                <div>
                                    <label class="admin-label !mb-0">Bruk som fellesbilde (tannleger)</label>
                                    <p class="text-[10px] text-admin-muted-light mt-0.5">Vises på forsiden i tannleger-seksjonen</p>
                                </div>
                                <input type="checkbox" id="galleri-edit-fellesbilde" class="w-5 h-5 accent-sky-500 cursor-pointer">
                            </div>
                            ${renderImageCropSliders({ prefix: 'galleri-edit', valPrefix: 'galleri-val' })}
                            <div class="pt-6 border-t border-admin-border">
                                <button id="btn-ferdig-galleri" class="btn-primary w-full py-4 px-8 shadow-xl uppercase font-black tracking-widest text-xs flex items-center justify-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    Lagre og gå tilbake
                                </button>
                            </div>
                        </div>
                        <div class="space-y-4">
                            <h3 id="galleri-preview-label" class="text-brand font-black uppercase tracking-tighter text-center lg:text-left"></h3>
                            <div id="galleri-preview-container" class="rounded-2xl border-4 border-white shadow-md overflow-hidden bg-admin-hover relative">
                                <div id="galleri-no-image" class="absolute inset-0 flex flex-col items-center justify-center text-admin-muted-light">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mb-2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                    <span class="text-xs font-black uppercase tracking-widest mt-2">Velg bilde</span>
                                </div>
                                <img id="galleri-preview-img" src="" class="absolute inset-0 w-full h-full object-cover transition-all duration-75 hidden" style="">
                            </div>
                        </div>
                    </div>
                </div>
            `);

            // Set preview aspect ratio and label
            const previewContainer = document.getElementById('galleri-preview-container');
            const previewLabelEl = document.getElementById('galleri-preview-label');
            if (previewContainer) previewContainer.classList.add(isForsidebilde ? 'aspect-[16/10]' : isFellesbilde ? 'aspect-[16/9]' : 'aspect-[4/3]');
            if (previewLabelEl) previewLabelEl.textContent = previewLabel;

            // Set values programmatically (safe, not in template)
            const titleInput = document.getElementById('galleri-edit-title');
            const altInput = document.getElementById('galleri-edit-alt');
            const imageInput = document.getElementById('galleri-edit-image');
            const activeToggle = document.getElementById('galleri-edit-active-toggle');
            const forsideCheckbox = document.getElementById('galleri-edit-forsidebilde');
            const scaleInput = document.getElementById('galleri-edit-scale');
            const xInput = document.getElementById('galleri-edit-x');
            const yInput = document.getElementById('galleri-edit-y');

            if (titleInput) titleInput.value = item.title || '';
            if (altInput) altInput.value = item.altText || '';
            if (imageInput) imageInput.value = item.image || '';
            setToggleState(activeToggle, !!item.active);
            // Forsidebilde er alltid aktivt — skjul aktiv-feltet
            const activeField = document.getElementById('galleri-active-field');
            if (isForsidebilde) {
                if (activeField) activeField.classList.add('hidden');
                setToggleState(activeToggle, true);
            } else {
                if (activeField) activeField.classList.remove('hidden');
            }
            if (forsideCheckbox) forsideCheckbox.checked = isForsidebilde;
            const fellesbildeCheckbox = document.getElementById('galleri-edit-fellesbilde');
            if (fellesbildeCheckbox) fellesbildeCheckbox.checked = isFellesbilde;
            // Gjem forsidebilde/fellesbilde-avhengig av type
            if (isFellesbilde && forsideCheckbox) forsideCheckbox.closest('.admin-field-container')?.classList.add('hidden');
            if (isForsidebilde && fellesbildeCheckbox) fellesbildeCheckbox.closest('.admin-field-container')?.classList.add('hidden');
            if (scaleInput) scaleInput.value = String(item.scale ?? 1);
            if (xInput) xInput.value = String(item.positionX ?? 50);
            if (yInput) yInput.value = String(item.positionY ?? 50);

            // Set preview image
            const gPreviewImg = document.getElementById('galleri-preview-img');
            const gNoImage = document.getElementById('galleri-no-image');
            if (itemPreviewSrc && gPreviewImg) {
                gPreviewImg.src = itemPreviewSrc;
                gPreviewImg.style.objectPosition = `${item.positionX ?? 50}% ${item.positionY ?? 50}%`;
                gPreviewImg.style.transform = `scale(${item.scale ?? 1})`;
                gPreviewImg.style.transformOrigin = `${item.positionX ?? 50}% ${item.positionY ?? 50}%`;
                gPreviewImg.classList.remove('hidden');
                gNoImage?.classList.add('hidden');
            }

            // Update value labels
            const valScale = document.getElementById('galleri-val-scale');
            const valX = document.getElementById('galleri-val-x');
            const valY = document.getElementById('galleri-val-y');
            if (valScale) valScale.textContent = `${item.scale ?? 1}x`;
            if (valX) valX.textContent = `${item.positionX ?? 50}%`;
            if (valY) valY.textContent = `${item.positionY ?? 50}%`;

            // Breadcrumb editor navigation
            window.setBreadcrumbEditor?.('Redigerer bilde', loadBilderModule);
            // "Lagre og gå tilbake" button
            document.getElementById('btn-ferdig-galleri')?.addEventListener('click', () => loadBilderModule());

            // Forsidebilde toggle
            if (forsideCheckbox) {
                forsideCheckbox.addEventListener('change', async () => {
                    // Skjul/vis aktiv-feltet basert på forsidebilde-status
                    if (forsideCheckbox.checked) {
                        if (activeField) activeField.classList.add('hidden');
                        setToggleState(activeToggle, true);
                    } else {
                        if (activeField) activeField.classList.remove('hidden');
                    }
                    if (forsideCheckbox.checked) {
                        try {
                            await setForsideBildeInGalleri(SHEET_ID, rowIndex);
                            if (previewContainer) {
                                previewContainer.classList.remove('aspect-[4/3]');
                                previewContainer.classList.add('aspect-[16/10]');
                            }
                            if (previewLabelEl) previewLabelEl.textContent = 'Forhåndsvisning (16:10)';
                        } catch (e) {
                            showToast('Kunne ikke sette forsidebilde: ' + e.message, 'error');
                            forsideCheckbox.checked = false;
                            if (activeField) activeField.classList.remove('hidden');
                        }
                    } else {
                        try {
                            await updateGalleriRow(SHEET_ID, rowIndex, getGalleriFormData('galleri'));
                            if (previewContainer) {
                                previewContainer.classList.remove('aspect-[16/10]');
                                previewContainer.classList.add('aspect-[4/3]');
                            }
                            if (previewLabelEl) previewLabelEl.textContent = 'Forhåndsvisning (4:3)';
                        } catch (e) {
                            showToast('Kunne ikke endre type: ' + e.message, 'error');
                            forsideCheckbox.checked = true;
                            if (activeField) activeField.classList.add('hidden');
                            setToggleState(activeToggle, true);
                        }
                    }
                });
            }

            if (fellesbildeCheckbox) {
                fellesbildeCheckbox.addEventListener('change', async () => {
                    if (fellesbildeCheckbox.checked) {
                        if (forsideCheckbox) {
                            forsideCheckbox.checked = false;
                            forsideCheckbox.closest('.admin-field-container')?.classList.add('hidden');
                        }
                        try {
                            await setFellesBildeInGalleri(SHEET_ID, rowIndex);
                            if (previewContainer) {
                                previewContainer.classList.remove('aspect-[4/3]', 'aspect-[16/10]');
                                previewContainer.classList.add('aspect-[16/9]');
                            }
                            if (previewLabelEl) previewLabelEl.textContent = 'Forhåndsvisning (16:9)';
                        } catch (e) {
                            showToast('Kunne ikke sette fellesbilde: ' + e.message, 'error');
                            fellesbildeCheckbox.checked = false;
                            if (forsideCheckbox) forsideCheckbox.closest('.admin-field-container')?.classList.remove('hidden');
                        }
                    } else {
                        if (forsideCheckbox) forsideCheckbox.closest('.admin-field-container')?.classList.remove('hidden');
                        try {
                            await updateGalleriRow(SHEET_ID, rowIndex, getGalleriFormData('galleri'));
                            if (previewContainer) {
                                previewContainer.classList.remove('aspect-[16/9]');
                                previewContainer.classList.add('aspect-[4/3]');
                            }
                            if (previewLabelEl) previewLabelEl.textContent = 'Forhåndsvisning (4:3)';
                        } catch (e) {
                            showToast('Kunne ikke endre type: ' + e.message, 'error');
                            fellesbildeCheckbox.checked = true;
                            if (forsideCheckbox) forsideCheckbox.closest('.admin-field-container')?.classList.add('hidden');
                        }
                    }
                });
            }

            const getGalleriFormData = (typeOverride) => ({
                ...item,
                title: titleInput?.value || item.title,
                image: imageInput?.value || item.image,
                altText: altInput?.value || item.altText,
                active: activeToggle?.dataset.active === 'true',
                scale: parseFloat(scaleInput?.value || '1'),
                positionX: parseInt(xInput?.value || '50'),
                positionY: parseInt(yInput?.value || '50'),
                type: typeOverride ?? (forsideCheckbox?.checked ? 'forsidebilde' : fellesbildeCheckbox?.checked ? 'fellesbilde' : 'galleri')
            });

            // Image picker for gallery item
            const btnPickImage = document.getElementById('btn-galleri-pick-image');
            const modal2 = document.getElementById('image-picker-modal');
            if (btnPickImage && modal2) {
                btnPickImage.addEventListener('click', () => {
                    modal2.showModal();
                    loadGallery(parentFolderId, async (fileId, fileName) => {
                        await handleImageSelected({ fileId, fileName, inputEl: imageInput, previewImgEl: gPreviewImg, placeholderEl: gNoImage });
                        modal2.close();
                    });
                });
            }

            // Auto-select uploaded image
            setupUploadHandler(parentFolderId, async (newFile) => {
                if (newFile) {
                    await handleImageSelected({ fileId: newFile.id, fileName: newFile.name, inputEl: imageInput, previewImgEl: gPreviewImg, placeholderEl: gNoImage });
                    modal2?.close();
                }
            });

            // Auto-save for gallery item
            const saveGalleri = async () => {
                const saveData = { ...getGalleriFormData(), order: item.order };
                await updateGalleriRow(SHEET_ID, rowIndex, saveData);
                await verifySave({
                    fetchFn: () => getGalleriRaw(SHEET_ID),
                    rowIndex,
                    compareField: 'title',
                    expectedValue: saveData.title,
                    timestampElId: 'galleri-last-fetched',
                    reloadFn: loadBilderModule
                });
            };
            const autoSaver = createAutoSaver(saveGalleri);

            const updateGalleriPreview = () => {
                const s = scaleInput?.value || '1';
                const x = xInput?.value || '50';
                const y = yInput?.value || '50';

                if (gPreviewImg && gPreviewImg.src) {
                    gPreviewImg.style.objectPosition = `${x}% ${y}%`;
                    gPreviewImg.style.transform = `scale(${parseFloat(s)})`;
                    gPreviewImg.style.transformOrigin = `${x}% ${y}%`;
                }

                if (valScale) valScale.textContent = `${s}x`;
                if (valX) valX.textContent = `${x}%`;
                if (valY) valY.textContent = `${y}%`;

                autoSaver.trigger();
            };

            attachToggleClick('galleri-edit-active-toggle', updateGalleriPreview);

            ['galleri-edit-title', 'galleri-edit-alt', 'galleri-edit-image', 'galleri-edit-scale', 'galleri-edit-x', 'galleri-edit-y'].forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                el.addEventListener(el instanceof HTMLInputElement && el.type === 'range' ? 'input' : 'change', updateGalleriPreview);
                if (el instanceof HTMLInputElement && (el.type === 'text' || el.type === 'number')) {
                    el.addEventListener('input', updateGalleriPreview);
                }
            });

            bindSliderStepButtons(inner2);
            bindWheelPrevent(inner2);
        };

        const deleteGalleriBilde = async (rowIndex, title) => {
            if (!await showConfirm(`Vil du slette «${title}» permanent? Dette kan ikke angres.`, { destructive: true })) return;
            try {
                const galleriItems = await getGalleriRaw(SHEET_ID);
                const item = galleriItems.find(g => g.rowIndex === rowIndex);
                const imageName = item?.image;

                await deleteGalleriRowPermanently(SHEET_ID, rowIndex);

                if (imageName) {
                    try {
                        const file = await findFileByName(imageName, parentFolderId);
                        if (file) await deleteFile(file.id);
                    } catch (driveErr) {
                        console.warn('[Admin] Kunne ikke slette Drive-fil:', driveErr);
                    }
                }

                showDeletionToast(title, 'Bildet ble slettet fra regnearket og lagt i Drive-papirkurven.');
                reloadGalleriListe();
            } catch (e) {
                showToast('Kunne ikke slette bildet: ' + e.message, 'error');
            }
        };

        const handleReorder = async (rowIndex, direction) => {
            const container = document.getElementById('galleri-liste-container');
            const allCards = container ? [...container.querySelectorAll('.admin-card-interactive')] : [];
            const currentCard = allCards.find(c => c.querySelector(`.reorder-btn[data-row="${rowIndex}"]`));
            const currentCardIdx = allCards.indexOf(currentCard);
            const neighborCard = allCards[currentCardIdx + direction];

            if (container) disableReorderButtons(container, '.reorder-btn');

            if (currentCard && neighborCard) {
                await animateSwap(currentCard, neighborCard);
            }

            try {
                const items = await getGalleriRaw(SHEET_ID);
                items.sort((a, b) => {
                    const aSpecial = a.type === 'forsidebilde' || a.type === 'fellesbilde';
                    const bSpecial = b.type === 'forsidebilde' || b.type === 'fellesbilde';
                    if (aSpecial && !bSpecial) return -1;
                    if (!aSpecial && bSpecial) return 1;
                    if (a.type === 'forsidebilde' && b.type === 'fellesbilde') return -1;
                    if (a.type === 'fellesbilde' && b.type === 'forsidebilde') return 1;
                    return (a.order ?? 99) - (b.order ?? 99);
                });
                const ok = await reorderGalleriItem(SHEET_ID, items, rowIndex, direction);
                if (ok) {
                    const fetchedEl = document.getElementById('galleri-last-fetched');
                    if (fetchedEl) fetchedEl.textContent = formatTimestamp(new Date());
                    if (container) {
                        const updatedCards = [...container.querySelectorAll('.admin-card-interactive')];
                        updateReorderButtonVisibility(updatedCards, '.reorder-btn');
                    }
                } else {
                    if (currentCard && neighborCard) {
                        await animateSwap(neighborCard, currentCard);
                    }
                }
            } catch (err) {
                if (currentCard && neighborCard) {
                    await animateSwap(neighborCard, currentCard);
                }
                showToast('Kunne ikke endre rekkefølge.', 'error');
            } finally {
                if (container) enableReorderButtons(container, '.reorder-btn');
            }
        };

        const toggleGalleriActive = async (rowIndex, img) => {
            const newActive = !img.active;
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
                await updateGalleriRow(SHEET_ID, rowIndex, { ...img, active: newActive });
                img.active = newActive;
            } catch (e) {
                // Reverser ved feil
                if (btn) {
                    btn.dataset.active = String(img.active);
                    const label = btn.querySelector('.toggle-label');
                    if (label) label.textContent = img.active ? 'Aktiv' : 'Inaktiv';
                }
                if (card) card.classList.toggle('opacity-60', !img.active);
                reloadGalleriListe();
            }
        };

        const reloadGalleriListe = () => {
            loadGalleriListeModule(SHEET_ID, editGalleriBilde, deleteGalleriBilde, handleReorder, parentFolderId, toggleGalleriActive);
        };

        reloadGalleriListe();

        // Asynkron konsistenssjekk (best-effort, ikke-blokkerende)
        (async () => {
            try {
                const [sheetItems, driveFiles] = await Promise.all([
                    getGalleriRaw(SHEET_ID),
                    listImages(parentFolderId)
                ]);
                await checkDriveConsistency(sheetItems, driveFiles, {
                    getDisplayName: item => item.title || 'Uten tittel',
                    itemLabel: 'rad'
                });
            } catch {
                // Best-effort — feiler den, vises ingen advarsel
            }
        })();

        // "Legg til bilde" – open image picker directly
        const addNewGalleriBilde = async (imageName, modal) => {
            try {
                await addGalleriRow(SHEET_ID, {
                    title: '',
                    image: imageName,
                    altText: '',
                    active: true,
                    order: 99,
                    scale: 1.0,
                    positionX: 50,
                    positionY: 50,
                    type: 'galleri'
                });
                modal.close();
                const updated = await getGalleriRaw(SHEET_ID);
                const newest = updated.find(r => r.image === imageName) || updated[updated.length - 1];
                if (newest) editGalleriBilde(newest.rowIndex);
                else reloadGalleriListe();
            } catch (e) {
                showToast('Kunne ikke legge til galleribilde: ' + e.message, 'error');
                modal.close();
            }
        };

        document.getElementById('btn-new-galleribilde')?.addEventListener('click', async () => {
            const modal = document.getElementById('image-picker-modal');
            if (!modal) return;
            modal.showModal();
            loadGallery(parentFolderId, async (fileId, fileName) => addNewGalleriBilde(fileName, modal));
            setupUploadHandler(parentFolderId, async (newFile) => {
                if (newFile) await addNewGalleriBilde(newFile.name, modal);
            });
        });

    } catch (e) {
        console.error('Bilder-modul feilet:', e);
        inner.innerHTML = `<div class="admin-alert-error">❌ Kunne ikke laste bildemodulen.</div>`;
    }
}
