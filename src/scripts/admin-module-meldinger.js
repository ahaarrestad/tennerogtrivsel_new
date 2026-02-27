import {
    deleteFile, getFileContent, parseMarkdown, stringifyMarkdown,
    saveFile, createFile
} from './admin-client.js';
import { showToast, showConfirm } from './admin-dialog.js';
import { classifyError } from './admin-api-retry.js';
import { formatDate, stripStackEditData, slugify } from './textFormatter.js';
import { loadMeldingerModule } from './admin-dashboard.js';
import {
    getAdminConfig, showDeletionToast, initEditors,
    createAutoSaver, showSaveBar
} from './admin-editor-helpers.js';

async function deleteMelding(id, name) {
    if (await showConfirm(`Vil du slette «${name}»?`, { destructive: true })) {
        try {
            await deleteFile(id);
            reloadMeldinger();
            showDeletionToast(name,
                'Filen er lagt i Google Drive-papirkurven og kan gjenopprettes derfra innen 30 dager. ' +
                'Gå til drive.google.com → Papirkurv for å gjenopprette.');
        } catch (e) {
            const kind = classifyError(e);
            showToast(
                kind === 'auth' ? 'Økten din er utløpt. Last siden på nytt.'
                : kind === 'retryable' ? 'Nettverksfeil — prøv igjen.'
                : 'Kunne ikke slette oppslaget.',
                'error'
            );
        }
    }
}

function areDatesValid() {
    const startInp = document.getElementById('edit-start');
    const endInp = document.getElementById('edit-end');
    const startVal = startInp?.value;
    const endVal = endInp?.value;
    if (startVal && endVal && new Date(endVal) < new Date(startVal)) {
        return false;
    }
    return true;
}

async function editMelding(id, name) {
    const { MELDINGER_FOLDER } = getAdminConfig();
    const inner = document.getElementById('module-inner');
    const actions = document.getElementById('module-actions');
    if (!inner || !actions) return;

    actions.innerHTML = '';
    inner.innerHTML = '<div class="text-admin-muted italic text-sm animate-pulse">Laster editor...</div>';

    try {
        let msgData = { title: '', startDate: new Date().toISOString().split('T')[0], endDate: '', content: '' };

        if (id) {
            const raw = await getFileContent(id);
            const { data, body } = parseMarkdown(raw);
            msgData = { ...data, content: stripStackEditData(body) };
        }

        const buttonHtml = id
            ? ''
            : `<button id="btn-save-melding" class="btn-primary py-4 px-8 shadow-xl uppercase font-black tracking-widest text-xs">Opprett melding</button>
                    <button onclick="window.loadMeldingerModule()" class="admin-btn-cancel">Avbryt</button>`;

        inner.innerHTML = `
            <div class="space-y-6 max-w-3xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div class="grid grid-cols-1 gap-6">
                    <div class="flex flex-col gap-2">
                        <label class="admin-label">Tittel</label>
                        <input type="text" id="edit-title" value="" placeholder="Skriv en tittel..." class="admin-input">
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div class="flex flex-col gap-2">
                            <div class="flex justify-between items-center">
                                <label class="admin-label">Fra og med</label>
                                <span id="preview-start" class="text-[10px] text-admin-muted-light font-bold">${formatDate(msgData.startDate)}</span>
                            </div>
                            <input type="text" id="edit-start" value="" placeholder="Velg dato..." class="admin-input cursor-pointer bg-white">
                        </div>
                        <div class="flex flex-col gap-2">
                            <div class="flex justify-between items-center">
                                <label class="admin-label">Til og med</label>
                                <span id="preview-end" class="text-[10px] text-admin-muted-light font-bold">${formatDate(msgData.endDate)}</span>
                            </div>
                            <input type="text" id="edit-end" value="" placeholder="Velg dato..." class="admin-input cursor-pointer bg-white">
                        </div>
                    </div>
                    <div class="flex flex-col gap-2 editor-container">
                        <label class="admin-label">Innhold</label>
                        <textarea id="edit-content" placeholder="Skriv meldingen her..."></textarea>
                    </div>

                    <!-- DYNAMISK FEILMELDING -->
                    <div id="date-error" class="hidden animate-in fade-in slide-in-from-top-1">
                        <div class="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                            <span class="text-sm font-black uppercase tracking-tight">Sluttdato må være etter startdato.</span>
                        </div>
                    </div>
                </div>
                <div class="flex flex-col sm:flex-row gap-3 pt-4 border-t border-admin-border">
                    ${buttonHtml}
                </div>
            </div>`;

        // Sett form-verdier programmatisk (sikkert — ingen HTML-parsing)
        document.getElementById('edit-title').value = msgData.title || '';
        document.getElementById('edit-start').value = msgData.startDate || '';
        document.getElementById('edit-end').value = msgData.endDate || '';
        document.getElementById('edit-content').value = msgData.content || '';

        const onDateChange = () => {
            const startInp = document.getElementById('edit-start');
            const endInp = document.getElementById('edit-end');
            const startEl = document.getElementById('preview-start');
            const endEl = document.getElementById('preview-end');
            const errorBox = document.getElementById('date-error');

            if (startEl && startInp) startEl.textContent = formatDate(startInp.value);
            if (endEl && endInp) endEl.textContent = formatDate(endInp.value);

            const startVal = startInp.value;
            const endVal = endInp.value;

            if (startVal && endVal && new Date(endVal) < new Date(startVal)) {
                errorBox?.classList.remove('hidden');
                // For new meldinger, also disable the save button
                const saveBtn = document.getElementById('btn-save-melding');
                if (saveBtn) {
                    saveBtn.disabled = true;
                    saveBtn.classList.add('opacity-50', 'cursor-not-allowed');
                }
                return false;
            } else {
                errorBox?.classList.add('hidden');
                const saveBtn = document.getElementById('btn-save-melding');
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                }
                return true;
            }
        };

        const { easyMDE } = initEditors(onDateChange);

        if (id) {
            window.setBreadcrumbEditor?.('Redigerer melding', reloadMeldinger);
        }

        const buildMeldingPayload = () => {
            const title = document.getElementById('edit-title').value;
            const startDate = document.getElementById('edit-start').value;
            const endDate = document.getElementById('edit-end').value;
            const safeTitle = slugify(title) || 'u-navnet';
            const newFileName = `${safeTitle}-${Date.now()}.md`;
            const data = { title, startDate, endDate };
            const body = easyMDE ? easyMDE.value() : document.getElementById('edit-content').value;
            return { newFileName, data, body };
        };

        const handleSaveError = (e) => {
            console.error("Lagring feilet:", e);
            const kind = classifyError(e);
            showToast(
                kind === 'auth' ? 'Økten din er utløpt. Last siden på nytt.'
                : kind === 'retryable' ? 'Nettverksfeil — prøv igjen.'
                : 'Kunne ikke lagre endringene.',
                'error'
            );
        };

        if (id) {
            // Auto-save for existing meldinger
            const saveMelding = async () => {
                const { newFileName, data, body } = buildMeldingPayload();
                try {
                    await saveFile(id, newFileName, stringifyMarkdown(data, body));
                } catch (e) {
                    handleSaveError(e);
                    throw e;
                }
            };
            const autoSaver = createAutoSaver(saveMelding);

            const triggerAutoSave = () => {
                if (!areDatesValid()) return;
                autoSaver.trigger();
            };

            document.getElementById('edit-title')?.addEventListener('input', triggerAutoSave);
            if (easyMDE) easyMDE.codemirror.on('change', triggerAutoSave);

            // Override onDateChange for existing to also trigger auto-save
            const originalOnDateChange = onDateChange;
            const onDateChangeWithAutoSave = () => {
                const valid = originalOnDateChange();
                if (valid) triggerAutoSave();
            };

            document.getElementById('edit-start')?.addEventListener('change', onDateChangeWithAutoSave);
            document.getElementById('edit-end')?.addEventListener('change', onDateChangeWithAutoSave);
        } else {
            // Manual create for new meldinger
            const saveBtn = document.getElementById('btn-save-melding');
            if (saveBtn) {
                saveBtn.onclick = async () => {
                    if (saveBtn.disabled) return;
                    saveBtn.disabled = true;
                    saveBtn.textContent = "Oppretter...";
                    const { newFileName, data, body } = buildMeldingPayload();
                    try {
                        await createFile(MELDINGER_FOLDER, newFileName, stringifyMarkdown(data, body));
                        reloadMeldinger();
                    } catch (e) {
                        handleSaveError(e);
                        saveBtn.disabled = false;
                        saveBtn.textContent = "Opprett melding";
                    }
                };
            }

            document.getElementById('edit-start')?.addEventListener('change', () => onDateChange());
            document.getElementById('edit-end')?.addEventListener('change', () => onDateChange());
        }
    } catch (e) {
        console.error("Klarte ikke laste editor:", e);
        inner.innerHTML = `<div class="admin-alert-error">❌ En feil oppstod under lasting av editoren. Sjekk konsollen for detaljer.</div>`;
    }
}

function reloadMeldinger() {
    window.clearBreadcrumbEditor?.();
    const { MELDINGER_FOLDER } = getAdminConfig();
    loadMeldingerModule(MELDINGER_FOLDER, editMelding, deleteMelding);
}

export function initMeldingerModule() {
    window.deleteMelding = deleteMelding;
    window.editMelding = editMelding;
    window.loadMeldingerModule = reloadMeldinger;
}

export { reloadMeldinger };
