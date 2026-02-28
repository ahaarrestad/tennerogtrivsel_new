import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { createAuthRefresher } from './admin-api-retry.js';
import { silentLogin, findFileByName, getDriveImageBlob } from './admin-client.js';
import { formatTimestamp } from './admin-dashboard.js';

/**
 * Escaper HTML-spesialtegn for sikker innsetting i template literals.
 * Brukes for tekst i lister/preview der programmatisk setting ikke er mulig.
 */
export function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Validerer input-verdier før de sendes til Google Sheets API.
 * @returns {string|null} Feilmelding eller null hvis OK.
 */
export function validateSheetInput(value, { maxLength = 500, type = 'text' } = {}) {
    if (type === 'text' && typeof value === 'string' && value.length > maxLength) {
        return `Maks ${maxLength} tegn (har ${value.length})`;
    }
    if (type === 'number') {
        const n = parseFloat(value);
        if (isNaN(n)) return 'Må være et tall';
    }
    return null;
}

/**
 * Leser admin-konfigurasjonen fra DOM-elementet #admin-config.
 */
export function getAdminConfig() {
    const configEl = document.getElementById('admin-config');
    return {
        TJENESTER_FOLDER: configEl?.dataset.tjenesterFolder,
        TANNLEGER_FOLDER: configEl?.dataset.tannlegerFolder,
        MELDINGER_FOLDER: configEl?.dataset.meldingerFolder,
        BILDER_FOLDER: configEl?.dataset.bilderFolder,
        SHEET_ID: configEl?.dataset.sheetId,
        HARD_DEFAULTS: JSON.parse(configEl?.dataset.defaults || '{}'),
    };
}

let _refreshAuth = null;
export function getRefreshAuth() {
    if (!_refreshAuth) _refreshAuth = createAuthRefresher(silentLogin);
    return _refreshAuth;
}

export function setToggleState(toggleBtn, isActive) {
    if (!toggleBtn) return;
    toggleBtn.dataset.active = String(isActive);
    toggleBtn.setAttribute('aria-checked', String(isActive));
    const lbl = toggleBtn.querySelector('.toggle-label');
    if (lbl) lbl.textContent = isActive ? 'Aktiv' : 'Inaktiv';
}

export function renderToggleHtml(id, isActive) {
    const labelText = isActive ? 'Aktiv' : 'Inaktiv';
    return `<div class="flex items-center justify-between">
        <label class="admin-label !mb-0">Synlighet</label>
        <button id="${id}" type="button" role="switch" aria-checked="${isActive}" class="flex items-center gap-1.5 cursor-pointer group/toggle" data-active="${isActive}">
            <span class="toggle-track"><span class="toggle-dot"></span></span>
            <span class="toggle-label">${labelText}</span>
        </button>
    </div>`;
}

export function attachToggleClick(id, onChange) {
    const toggleBtn = document.getElementById(id);
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const current = toggleBtn.dataset.active === 'true';
            setToggleState(toggleBtn, !current);
            if (onChange) onChange();
        });
    }
}

export function showDeletionToast(deletedName, recoveryText) {
    document.getElementById('deletion-toast')?.remove();
    const toast = document.createElement('div');
    toast.id = 'deletion-toast';
    toast.className = 'fixed bottom-6 right-6 z-50 max-w-sm w-full';
    toast.innerHTML = DOMPurify.sanitize(`
        <div class="bg-white rounded-2xl shadow-2xl border border-admin-hover p-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div class="flex items-start gap-3">
                <div class="shrink-0 w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center text-amber-500">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
                </div>
                <div class="flex-1 min-w-0">
                    <p id="toast-deleted-name" class="font-black text-sm text-brand"></p>
                    <p id="toast-recovery-text" class="text-xs text-admin-muted mt-1 leading-relaxed"></p>
                </div>
                <button class="toast-close shrink-0 p-1 -mr-1 -mt-1 text-admin-muted-light hover:text-admin-muted transition-colors cursor-pointer" aria-label="Lukk">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
        </div>
    `);
    const nameEl = toast.querySelector('#toast-deleted-name');
    const recoveryEl = toast.querySelector('#toast-recovery-text');
    if (nameEl) nameEl.textContent = `«${deletedName}» ble slettet`;
    if (recoveryEl) recoveryEl.textContent = recoveryText;
    document.body.appendChild(toast);
    toast.querySelector('.toast-close')?.addEventListener('click', () => toast.remove());
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 30000);
}

export function initMarkdownEditor() {
    let easyMDE = null;
    const EasyMDEGlobal = window['EasyMDE'];
    if (typeof EasyMDEGlobal !== 'undefined') {
        easyMDE = new EasyMDEGlobal({
            element: document.getElementById('edit-content'),
            spellChecker: false,
            status: false,
            minHeight: "350px",
            placeholder: "Skriv innholdet her...",
            toolbar: ["bold", "italic", "heading", "|", "quote", "unordered-list", "ordered-list", "|", "link", "image", "|", "preview", "side-by-side", "fullscreen", "|", "guide"],
            previewRender: (plainText) => {
                return `<div class="markdown-content prose">${DOMPurify.sanitize(marked.parse(plainText))}</div>`;
            }
        });
    }
    return easyMDE;
}

export function initEditors(onDateChange) {
    let easyMDE = null;
    const EasyMDEGlobal = window['EasyMDE'];
    if (typeof EasyMDEGlobal !== 'undefined') {
        easyMDE = new EasyMDEGlobal({
            element: document.getElementById('edit-content'),
            spellChecker: false,
            status: false,
            minHeight: "250px",
            placeholder: "Skriv innholdet her...",
            toolbar: ["bold", "italic", "heading", "|", "quote", "unordered-list", "ordered-list", "|", "link", "image", "|", "preview", "side-by-side", "fullscreen", "|", "guide"],
            previewRender: (plainText) => {
                return `<div class="markdown-content prose">${DOMPurify.sanitize(marked.parse(plainText))}</div>`;
            }
        });
    }

    let flatpickrInstances = [];
    const flatpickrGlobal = window['flatpickr'];
    if (typeof flatpickrGlobal !== 'undefined') {
        const fpConfig = {
            dateFormat: "Y-m-d",
            altInput: true,
            altFormat: "d.m.Y",
            allowInput: true,
            onChange: (selectedDates, dateStr, instance) => {
                instance.element.value = dateStr;
                if (onDateChange) onDateChange(selectedDates, dateStr, instance);
            }
        };
        const l10ns = flatpickrGlobal.l10ns;
        const noLocale = l10ns ? (l10ns.no || l10ns.nb || l10ns.Norwegian) : null;
        if (noLocale) fpConfig.locale = noLocale;

        flatpickrInstances = [
            flatpickrGlobal("#edit-start", fpConfig),
            flatpickrGlobal("#edit-end", fpConfig)
        ];
    }

    return { easyMDE, flatpickrInstances };
}

export function renderImageCropSliders({ prefix, valPrefix, scale = 1, posX = 50, posY = 50 }) {
    return `<div class="space-y-6 pt-4 border-t border-admin-border">
        <h4 class="text-brand font-black text-xs uppercase tracking-widest">Bildeutsnitt (Zoom og posisjon)</h4>
        <div class="space-y-4">
            <div>
                <div class="flex justify-between mb-2">
                    <label for="${prefix}-scale" class="admin-label !mb-0">Zoom (Skala)</label>
                    <span id="${valPrefix}-scale" class="text-[10px] font-bold text-brand">${scale}x</span>
                </div>
                <div class="flex items-center gap-2">
                    <button type="button" class="slider-step-btn" data-target="${prefix}-scale" data-step="-0.1">&minus;</button>
                    <input type="range" id="${prefix}-scale" min="1.0" max="3.0" step="0.01" value="${scale}" class="flex-grow h-2 bg-admin-border rounded-lg appearance-none cursor-pointer accent-brand">
                    <button type="button" class="slider-step-btn" data-target="${prefix}-scale" data-step="0.1">+</button>
                </div>
            </div>
            <div>
                <div class="flex justify-between mb-2">
                    <label for="${prefix}-x" class="admin-label !mb-0">Fokuspunkt Horisontalt (X)</label>
                    <span id="${valPrefix}-x" class="text-[10px] font-bold text-brand">${posX}%</span>
                </div>
                <div class="flex items-center gap-2">
                    <button type="button" class="slider-step-btn" data-target="${prefix}-x" data-step="-1">&minus;</button>
                    <input type="range" id="${prefix}-x" min="0" max="100" value="${posX}" class="flex-grow h-2 bg-admin-border rounded-lg appearance-none cursor-pointer accent-brand">
                    <button type="button" class="slider-step-btn" data-target="${prefix}-x" data-step="1">+</button>
                </div>
            </div>
            <div>
                <div class="flex justify-between mb-2">
                    <label for="${prefix}-y" class="admin-label !mb-0">Fokuspunkt Vertikalt (Y)</label>
                    <span id="${valPrefix}-y" class="text-[10px] font-bold text-brand">${posY}%</span>
                </div>
                <div class="flex items-center gap-2">
                    <button type="button" class="slider-step-btn" data-target="${prefix}-y" data-step="-1">&minus;</button>
                    <input type="range" id="${prefix}-y" min="0" max="100" value="${posY}" class="flex-grow h-2 bg-admin-border rounded-lg appearance-none cursor-pointer accent-brand">
                    <button type="button" class="slider-step-btn" data-target="${prefix}-y" data-step="1">+</button>
                </div>
            </div>
        </div>
    </div>`;
}

export function bindSliderStepButtons(container) {
    container.querySelectorAll('.slider-step-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = document.getElementById(btn.dataset.target);
            if (!target) return;
            const step = parseFloat(btn.dataset.step);
            const min = parseFloat(target.min);
            const max = parseFloat(target.max);
            const current = parseFloat(target.value);
            target.value = String(Math.min(max, Math.max(min, +(current + step).toFixed(2))));
            target.dispatchEvent(new Event('input'));
        });
    });
}

export function bindWheelPrevent(container) {
    container.querySelectorAll('input[type="range"]').forEach(el => {
        el.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
    });
}

export async function resolveImagePreview(imageName, folderId, options = {}) {
    const { localFallbackDir } = options;
    let src = '';
    let imageId = null;

    if (!imageName) return { src, imageId };

    try {
        if (imageName.length > 20 && !imageName.includes('.')) {
            imageId = imageName;
        } else {
            const file = await findFileByName(imageName, folderId);
            if (file) imageId = file.id;
        }
        if (imageId) {
            const blobUrl = await getDriveImageBlob(imageId);
            if (blobUrl) src = blobUrl;
        }
    } catch (err) {
        console.warn("[Admin] Kunne ikke hente bilde-preview fra Drive.");
    }

    if (!src && localFallbackDir && imageName.includes('.')) {
        src = `${localFallbackDir}${imageName}`;
    }

    return { src, imageId };
}

export async function verifySave({ fetchFn, rowIndex, compareField, expectedValue, timestampElId, reloadFn }) {
    try {
        const freshData = await fetchFn();
        const fetchedEl = document.getElementById(timestampElId);
        if (fetchedEl) fetchedEl.textContent = formatTimestamp(new Date());
        const freshRow = freshData.find(r => r.rowIndex === rowIndex);
        if (freshRow && freshRow[compareField] !== expectedValue) {
            console.warn(`[Admin] Mismatch etter lagring: forventet "${expectedValue}", fikk "${freshRow[compareField]}"`);
            reloadFn();
            throw new Error('Mismatch');
        }
    } catch (verifyErr) {
        if (verifyErr.message === 'Mismatch') throw verifyErr;
        console.warn("[Admin] Verifisering feilet, men lagring gikk OK:", verifyErr);
    }
}

export async function handleImageSelected({ fileId, fileName, inputEl, previewImgEl, placeholderEl }) {
    if (!inputEl) return;
    inputEl.value = fileName;
    const blobUrl = await getDriveImageBlob(fileId);
    if (blobUrl && previewImgEl) {
        previewImgEl.src = blobUrl;
        previewImgEl.classList.remove('hidden');
        placeholderEl?.classList.add('hidden');
    }
    inputEl.dispatchEvent(new Event('input'));
}

export function createAutoSaver(saveFn, delay = 1500) {
    let timeout = null;
    return {
        trigger() {
            showSaveBar('changed', '⏳ Endringer oppdaget...');
            clearTimeout(timeout);
            timeout = setTimeout(async () => {
                showSaveBar('saving', '💾 Lagrer…');
                try {
                    await saveFn();
                    const ts = formatTimestamp(new Date());
                    showSaveBar('saved', `✅ Lagret ${ts}`);
                    hideSaveBar(5000);
                } catch (e) {
                    showSaveBar('error', '❌ Feil ved lagring!');
                }
            }, delay);
        },
        cancel() {
            clearTimeout(timeout);
        }
    };
}

let _hideSaveBarTimer = null;

export function showSaveBar(state, message) {
    let bar = document.getElementById('admin-save-bar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'admin-save-bar';
        document.body.appendChild(bar);
    }
    clearTimeout(_hideSaveBarTimer);
    bar.className = `admin-save-bar admin-save-bar-${state}`;
    bar.textContent = message;
}

export function hideSaveBar(delay = 0) {
    if (delay > 0) {
        _hideSaveBarTimer = setTimeout(() => {
            document.getElementById('admin-save-bar')?.remove();
        }, delay);
    } else {
        document.getElementById('admin-save-bar')?.remove();
    }
}
