import {
    deleteFile, getFileContent, parseMarkdown, stringifyMarkdown,
    saveFile, createFile, listFiles
} from './admin-client.js';
import { animateSwap, disableReorderButtons, enableReorderButtons, updateReorderButtonVisibility } from './admin-reorder.js';
import { showToast, showConfirm } from './admin-dialog.js';
import { withRetry } from './admin-api-retry.js';
import { stripStackEditData, slugify } from './textFormatter.js';
import { loadTjenesterModule } from './admin-dashboard.js';
import {
    getAdminConfig, getRefreshAuth, renderToggleHtml, attachToggleClick,
    showDeletionToast, initMarkdownEditor, createAutoSaver, showSaveBar,
    handleSaveError, handleDeleteError
} from './admin-editor-helpers.js';

async function deleteTjeneste(id, name) {
    if (await showConfirm(`Vil du slette «${name}»?`, { destructive: true })) {
        try {
            await deleteFile(id);
            reloadTjenester();
            showDeletionToast(name,
                'Filen er lagt i Google Drive-papirkurven og kan gjenopprettes derfra innen 30 dager. ' +
                'Gå til drive.google.com → Papirkurv for å gjenopprette.');
        } catch (e) {
            handleDeleteError(e, 'tjenesten');
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
        let nextPriority = 99;

        if (id) {
            const raw = await getFileContent(id);
            const parsed = parseMarkdown(raw);
            data = parsed.data;
            body = stripStackEditData(parsed.body);
        } else {
            try {
                const existing = await loadAllServices();
                const maxPriority = existing.reduce((max, s) => Math.max(max, s.priority ?? 0), 0);
                nextPriority = maxPriority + 1;
            } catch (e) { console.error('[Tjenester] Kunne ikke beregne neste prioritet:', e); }
        }

        const isActive = data.active !== false && data.active !== 'false';

        const buttonHtml = id
            ? ''
            : `<button id="btn-save-tjeneste" class="btn-primary py-4 px-8 shadow-xl uppercase font-black tracking-widest text-xs">Opprett tjeneste</button>
                    <button onclick="window.loadTjenesterModule()" class="admin-btn-cancel">Avbryt</button>`;

        inner.innerHTML = `
            <div class="space-y-6 max-w-3xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div class="grid grid-cols-1 gap-6">
                    ${renderToggleHtml('edit-active-toggle', isActive)}
                    <div class="flex flex-col gap-2">
                        <label class="admin-label">Tittel</label>
                        <p class="text-xs text-admin-muted-light -mt-0.5">Vises på: Tjenestesiden, navigasjon</p>
                        <input type="text" id="edit-title" value="" placeholder="Navn på tjenesten..." class="admin-input">
                    </div>
                    <div class="flex flex-col gap-2">
                        <label class="admin-label">Ingress (kort sammendrag)</label>
                        <p class="text-xs text-admin-muted-light -mt-0.5">Vises på: Tjenestekort på forsiden og tjenestesiden</p>
                        <textarea id="edit-ingress" rows="3" class="admin-input resize-none"></textarea>
                    </div>
                    <div class="flex flex-col gap-2 editor-container">
                        <label class="admin-label">Beskrivelse (Innhold)</label>
                        <p class="text-xs text-admin-muted-light -mt-0.5">Vises på: Tjenestens detaljside</p>
                        <textarea id="edit-content" placeholder="Full beskrivelse her..."></textarea>
                    </div>
                </div>
                <div class="flex flex-col sm:flex-row gap-3 pt-4 border-t border-admin-border">
                    ${buttonHtml}
                </div>
            </div>`;

        // Sett form-verdier programmatisk (sikkert — ingen HTML-parsing)
        document.getElementById('edit-title').value = data.title || '';
        document.getElementById('edit-ingress').value = data.ingress || '';
        document.getElementById('edit-content').value = body || '';

        const easyMDE = initMarkdownEditor();

        if (id) {
            window.setBreadcrumbEditor?.('Redigerer tjeneste', reloadTjenester);
        }

        const buildTjenestePayload = () => {
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
                active: activeVal,
                priority: data.priority ?? nextPriority
            };
            const content = easyMDE ? easyMDE.value() : document.getElementById('edit-content').value;
            return { newFileName, frontmatter, content };
        };

        if (id) {
            // Auto-save for existing tjenester
            const saveTjeneste = async () => {
                const { newFileName, frontmatter, content } = buildTjenestePayload();
                try {
                    await saveFile(id, newFileName, stringifyMarkdown(frontmatter, content));
                } catch (e) {
                    handleSaveError(e);
                    throw e;
                }
            };
            const autoSaver = createAutoSaver(saveTjeneste);

            document.getElementById('edit-title')?.addEventListener('input', () => autoSaver.trigger());
            document.getElementById('edit-ingress')?.addEventListener('input', () => autoSaver.trigger());
            if (easyMDE) easyMDE.codemirror.on('change', () => autoSaver.trigger());
            attachToggleClick('edit-active-toggle', () => autoSaver.trigger());
        } else {
            // Manual create for new tjenester
            attachToggleClick('edit-active-toggle');
            const saveBtn = document.getElementById('btn-save-tjeneste');
            if (saveBtn) {
                saveBtn.onclick = async () => {
                    saveBtn.disabled = true;
                    saveBtn.textContent = "Oppretter...";
                    const { newFileName, frontmatter, content } = buildTjenestePayload();
                    try {
                        await createFile(TJENESTER_FOLDER, newFileName, stringifyMarkdown(frontmatter, content));
                        reloadTjenester();
                    } catch (e) {
                        handleSaveError(e);
                        saveBtn.disabled = false;
                        saveBtn.textContent = "Opprett tjeneste";
                    }
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

async function loadAllServices() {
    const { TJENESTER_FOLDER } = getAdminConfig();
    const retryOpts = { refreshAuth: getRefreshAuth() };
    const files = await withRetry(() => listFiles(TJENESTER_FOLDER), retryOpts);
    const services = await Promise.all(files.map(async (f) => {
        const raw = await withRetry(() => getFileContent(f.id), retryOpts);
        const { data, body } = parseMarkdown(raw);
        return { driveId: f.id, name: f.name, ...data, body };
    }));
    services.sort((a, b) => ((a.priority ?? 99) - (b.priority ?? 99)) || (a.title || '').localeCompare(b.title || '', 'nb'));
    return services;
}

async function handleReorder(driveId, direction) {
    const container = document.getElementById('module-inner');
    const allCards = container ? [...container.querySelectorAll('.admin-card-interactive')] : [];
    const currentCard = allCards.find(c => c.querySelector(`.reorder-tjeneste-btn[data-id="${driveId}"]`));
    const currentCardIdx = allCards.indexOf(currentCard);
    const neighborCard = allCards[currentCardIdx + direction];

    if (container) disableReorderButtons(container, '.reorder-tjeneste-btn');

    if (currentCard && neighborCard) {
        await animateSwap(currentCard, neighborCard);
    }

    try {
        const services = await loadAllServices();

        const currentIdx = services.findIndex(s => s.driveId === driveId);
        const neighborIdx = currentIdx + direction;
        if (currentIdx < 0 || neighborIdx < 0 || neighborIdx >= services.length) {
            if (currentCard && neighborCard) await animateSwap(neighborCard, currentCard);
            if (container) enableReorderButtons(container, '.reorder-tjeneste-btn');
            return;
        }

        const [moved] = services.splice(currentIdx, 1);
        services.splice(neighborIdx, 0, moved);

        await Promise.all(services.map((s, idx) => {
            const frontmatter = { ...s };
            delete frontmatter.driveId;
            delete frontmatter.name;
            delete frontmatter.body;
            frontmatter.priority = idx + 1;
            return saveFile(s.driveId, s.name, stringifyMarkdown(frontmatter, s.body));
        }));

        if (container) {
            enableReorderButtons(container, '.reorder-tjeneste-btn');
            const updatedCards = [...container.querySelectorAll('.admin-card-interactive')];
            updateReorderButtonVisibility(updatedCards, '.reorder-tjeneste-btn');
        }
    } catch (e) {
        console.error('Reorder failed:', e);
        if (currentCard && neighborCard) {
            await animateSwap(neighborCard, currentCard);
        }
        if (container) enableReorderButtons(container, '.reorder-tjeneste-btn');
        showToast('Kunne ikke sortere tjenesten.', 'error');
    }
}

function reloadTjenester() {
    window.clearBreadcrumbEditor?.();
    const { TJENESTER_FOLDER } = getAdminConfig();
    loadTjenesterModule(TJENESTER_FOLDER, editTjeneste, deleteTjeneste, toggleTjenesteActive, handleReorder);
}

export function initTjenesterModule() {
    window.deleteTjeneste = deleteTjeneste;
    window.editTjeneste = editTjeneste;
    window.loadTjenesterModule = reloadTjenester;
}

export { reloadTjenester };
