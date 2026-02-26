import {
    deleteFile, getFileContent, parseMarkdown, stringifyMarkdown,
    saveFile, createFile
} from './admin-client.js';
import { showToast, showConfirm } from './admin-dialog.js';
import { classifyError } from './admin-api-retry.js';
import { stripStackEditData, slugify } from './textFormatter.js';
import { loadTjenesterModule, formatTimestamp } from './admin-dashboard.js';
import {
    getAdminConfig, renderToggleHtml, attachToggleClick,
    showDeletionToast, initMarkdownEditor, showSaveBar, hideSaveBar
} from './admin-editor-helpers.js';

let tjenesteSaveTimeout = null;

async function deleteTjeneste(id, name) {
    if (await showConfirm(`Vil du slette «${name}»?`, { destructive: true })) {
        try {
            await deleteFile(id);
            reloadTjenester();
            showDeletionToast(name,
                'Filen er lagt i Google Drive-papirkurven og kan gjenopprettes derfra innen 30 dager. ' +
                'Gå til drive.google.com → Papirkurv for å gjenopprette.');
        } catch (e) {
            const kind = classifyError(e);
            showToast(
                kind === 'auth' ? 'Økten din er utløpt. Last siden på nytt.'
                : kind === 'retryable' ? 'Nettverksfeil — prøv igjen.'
                : 'Kunne ikke slette tjenesten.',
                'error'
            );
        }
    }
}

async function editTjeneste(id, name) {
    const { TJENESTER_FOLDER } = getAdminConfig();
    const inner = document.getElementById('module-inner');
    const actions = document.getElementById('module-actions');
    if (!inner || !actions) return;

    actions.innerHTML = '';
    inner.innerHTML = '<div class="text-admin-muted italic text-sm animate-pulse">Laster editor...</div>';

    try {
        let data = { title: '', ingress: '', id: '' };
        let body = '';

        if (id) {
            const raw = await getFileContent(id);
            const parsed = parseMarkdown(raw);
            data = parsed.data;
            body = stripStackEditData(parsed.body);
        }

        const isActive = data.active !== false && data.active !== 'false';

        const buttonHtml = id
            ? `<button onclick="window.loadTjenesterModule()" class="admin-btn-cancel">Tilbake til listen</button>`
            : `<button id="btn-save-tjeneste" class="btn-primary py-4 px-8 shadow-xl uppercase font-black tracking-widest text-xs">Opprett tjeneste</button>
                    <button onclick="window.loadTjenesterModule()" class="admin-btn-cancel">Avbryt</button>`;

        inner.innerHTML = `
            <div class="space-y-6 max-w-3xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div class="grid grid-cols-1 gap-6">
                    ${renderToggleHtml('edit-active-toggle', isActive)}
                    <div class="flex flex-col gap-2">
                        <label class="admin-label">Tittel</label>
                        <input type="text" id="edit-title" value="${data.title || ''}" placeholder="Navn på tjenesten..." class="admin-input">
                    </div>
                    <div class="flex flex-col gap-2">
                        <label class="admin-label">Ingress (kort sammendrag)</label>
                        <textarea id="edit-ingress" rows="3" class="admin-input resize-none">${data.ingress || ''}</textarea>
                    </div>
                    <div class="flex flex-col gap-2 editor-container">
                        <label class="admin-label">Beskrivelse (Innhold)</label>
                        <textarea id="edit-content" placeholder="Full beskrivelse her...">${body}</textarea>
                    </div>
                </div>
                <div class="flex flex-col sm:flex-row gap-3 pt-4 border-t border-admin-border">
                    ${buttonHtml}
                </div>
            </div>`;

        const easyMDE = initMarkdownEditor();

        const doSave = async () => {
            const title = document.getElementById('edit-title').value;
            const safeTitle = slugify(title) || 'u-navngitt-tjeneste';
            const entryId = data.id || safeTitle;
            const newFileName = `${safeTitle}-${Date.now()}.md`;

            const toggleBtn = document.getElementById('edit-active-toggle');
            const activeVal = toggleBtn?.dataset.active === 'true';
            const frontmatter = {
                id: entryId,
                title: title,
                ingress: document.getElementById('edit-ingress').value,
                active: activeVal
            };

            const content = easyMDE ? easyMDE.value() : document.getElementById('edit-content').value;

            try {
                if (id) {
                    showSaveBar('saving', '💾 Lagrer til Google Drive...');
                    await saveFile(id, newFileName, stringifyMarkdown(frontmatter, content));
                    const ts = formatTimestamp(new Date());
                    showSaveBar('saved', `✅ Lagret ${ts}`);
                    hideSaveBar(5000);
                } else {
                    await createFile(TJENESTER_FOLDER, newFileName, stringifyMarkdown(frontmatter, content));
                    reloadTjenester();
                }
            } catch (e) {
                console.error("Lagring feilet:", e);
                const kind = classifyError(e);
                showToast(
                    kind === 'auth' ? 'Økten din er utløpt. Last siden på nytt.'
                    : kind === 'retryable' ? 'Nettverksfeil — prøv igjen.'
                    : 'Kunne ikke lagre endringene.',
                    'error'
                );
                if (id) {
                    showSaveBar('error', '❌ Feil ved lagring!');
                } else {
                    const saveBtn = document.getElementById('btn-save-tjeneste');
                    if (saveBtn) {
                        saveBtn.disabled = false;
                        saveBtn.textContent = "Opprett tjeneste";
                    }
                }
            }
        };

        if (id) {
            // Auto-save for existing tjenester
            const triggerAutoSave = () => {
                showSaveBar('changed', '⏳ Endringer oppdaget...');
                clearTimeout(tjenesteSaveTimeout);
                tjenesteSaveTimeout = setTimeout(() => doSave(), 1500);
            };

            document.getElementById('edit-title')?.addEventListener('input', triggerAutoSave);
            document.getElementById('edit-ingress')?.addEventListener('input', triggerAutoSave);
            if (easyMDE) easyMDE.codemirror.on('change', triggerAutoSave);
            attachToggleClick('edit-active-toggle', triggerAutoSave);
        } else {
            // Manual create for new tjenester
            attachToggleClick('edit-active-toggle');
            const saveBtn = document.getElementById('btn-save-tjeneste');
            if (saveBtn) {
                saveBtn.onclick = async () => {
                    saveBtn.disabled = true;
                    saveBtn.textContent = "Oppretter...";
                    await doSave();
                };
            }
        }
    } catch (e) {
        console.error("Klarte ikke laste editor:", e);
        inner.innerHTML = `<div class="admin-alert-error">❌ En feil oppstod under lasting av editoren. Sjekk konsollen for detaljer.</div>`;
    }
}

async function toggleTjenesteActive(driveId, fileName, service) {
    const currentActive = service.active !== 'false' && service.active !== false;
    const newActive = !currentActive;

    const btn = document.querySelector(`.toggle-active-btn[data-id="${driveId}"]`);
    const card = btn?.closest('.admin-card-interactive');
    if (btn) {
        btn.dataset.active = String(newActive);
        const label = btn.querySelector('.toggle-label');
        if (label) label.textContent = newActive ? 'Aktiv' : 'Inaktiv';
    }
    if (card) card.classList.toggle('opacity-60', !newActive);

    try {
        const raw = await getFileContent(driveId);
        const { data, body } = parseMarkdown(raw);
        const updatedFrontmatter = { ...data, active: newActive };
        await saveFile(driveId, fileName, stringifyMarkdown(updatedFrontmatter, body));
        service.active = newActive;
    } catch (e) {
        if (btn) {
            btn.dataset.active = String(currentActive);
            const label = btn.querySelector('.toggle-label');
            if (label) label.textContent = currentActive ? 'Aktiv' : 'Inaktiv';
        }
        if (card) card.classList.toggle('opacity-60', !currentActive);
        showToast("Kunne ikke oppdatere synlighet.", "error");
        reloadTjenester();
    }
}

function reloadTjenester() {
    const { TJENESTER_FOLDER } = getAdminConfig();
    loadTjenesterModule(TJENESTER_FOLDER, editTjeneste, deleteTjeneste, toggleTjenesteActive);
}

export function initTjenesterModule() {
    window.deleteTjeneste = deleteTjeneste;
    window.editTjeneste = editTjeneste;
    window.loadTjenesterModule = reloadTjenester;
}

export { reloadTjenester };
