import { showToast, showConfirm } from './admin-dialog.js';
import {
    getKontaktSkjemaRaw, updateKontaktSkjemaField,
    addKontaktTemaRow, ensureKontaktSkjemaSheet, deleteSheetRow,
} from './admin-sheets.js';
import {
    getAdminConfig, escapeHtml, createAutoSaver,
    renderToggleHtml, attachToggleClick, setToggleState, handleSaveError,
} from './admin-editor-helpers.js';
import {
    animateSwap, disableReorderButtons, enableReorderButtons,
    updateReorderButtonVisibility,
} from './admin-reorder.js';
import { ICON_ADD, ICON_UP, ICON_DOWN, ICON_DELETE } from './admin-dashboard.js';
import { createAuthRefresher } from './admin-api-retry.js';
import { silentLogin } from './admin-client.js';

const refreshAuth = createAuthRefresher(silentLogin);

let _raw = null;

export async function reloadKontaktSkjema() {
    const inner = document.getElementById('module-inner');
    if (!inner) return;
    inner.innerHTML = '<div class="text-admin-muted italic text-sm animate-pulse">Laster...</div>';

    const { SHEET_ID } = getAdminConfig();
    try {
        await ensureKontaktSkjemaSheet(SHEET_ID);
        _raw = await getKontaktSkjemaRaw(SHEET_ID);
        renderKontaktSkjemaModule(_raw);
    } catch (err) {
        inner.innerHTML = `<p class="text-red-600 text-sm">Feil ved lasting: ${escapeHtml(err.message)}</p>`;
    }
}

function renderKontaktSkjemaModule(raw) {
    const inner = document.getElementById('module-inner');
    const { SHEET_ID } = getAdminConfig();

    const temaHtml = raw.tema.map((t, i) => `
        <div class="admin-list-row flex items-center gap-3" data-tema-row data-row-index="${t.rowIndex}">
            <input type="text" class="admin-input flex-1" value="${escapeHtml(t.value)}" data-tema-input data-row-index="${t.rowIndex}">
            <div class="flex gap-1 shrink-0">
                <button class="admin-reorder-btn" data-direction="up" aria-label="Flytt opp" ${i === 0 ? 'hidden' : ''}>${ICON_UP}</button>
                <button class="admin-reorder-btn" data-direction="down" aria-label="Flytt ned" ${i === raw.tema.length - 1 ? 'hidden' : ''}>${ICON_DOWN}</button>
                <button class="admin-delete-btn" data-delete-tema data-row-index="${t.rowIndex}" aria-label="Slett tema">${ICON_DELETE}</button>
            </div>
        </div>
    `).join('');

    inner.innerHTML = `
        <div class="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div class="admin-card space-y-4">
                <h2 class="admin-subtitle">Modal-innhold</h2>
                ${renderToggleHtml('toggle-kontaktskjema-aktiv', raw.aktiv.value === 'ja')}
                <div class="flex flex-col gap-1.5">
                    <label class="admin-label" for="ks-tittel">Tittel</label>
                    <input id="ks-tittel" type="text" class="admin-input"
                           value="${escapeHtml(raw.tittel.value)}" data-row-index="${raw.tittel.rowIndex}">
                </div>
                <div class="flex flex-col gap-1.5">
                    <label class="admin-label" for="ks-tekst">Tekst / ingress</label>
                    <textarea id="ks-tekst" class="admin-input" rows="2"
                              data-row-index="${raw.tekst.rowIndex}">${escapeHtml(raw.tekst.value)}</textarea>
                </div>
                <div class="flex flex-col gap-1.5">
                    <label class="admin-label" for="ks-epost">Mottaker-e-post</label>
                    <input id="ks-epost" type="email" class="admin-input"
                           value="${escapeHtml(raw.kontaktEpost.value)}" data-row-index="${raw.kontaktEpost.rowIndex}">
                    <p class="text-xs text-admin-muted-light">
                        Sendes ikke til nettsiden — synkroniseres til Lambda ved neste bygg.
                    </p>
                </div>
            </div>

            <div class="admin-card space-y-3">
                <h2 class="admin-subtitle">Tema-alternativer</h2>
                <div id="tema-list" class="space-y-2">${temaHtml}</div>
                <div id="new-tema-form" hidden class="flex gap-2 mt-2">
                    <input id="new-tema-input" type="text" class="admin-input flex-1" placeholder="Nytt tema...">
                    <button id="btn-save-new-tema" class="btn-primary px-4 py-2 text-xs">Opprett</button>
                    <button id="btn-cancel-new-tema" class="admin-btn-cancel">Avbryt</button>
                </div>
                <button id="btn-add-tema" class="btn-secondary flex items-center gap-2 px-4 py-2 text-sm mt-1">
                    ${ICON_ADD} Legg til tema
                </button>
            </div>
        </div>
    `;

    attachEventListeners(SHEET_ID, raw);
}

function attachEventListeners(SHEET_ID, raw) {
    // Toggle aktiv
    attachToggleClick('toggle-kontaktskjema-aktiv', async () => {
        const btn = document.getElementById('toggle-kontaktskjema-aktiv');
        const aktiv = btn.dataset.active === 'true';
        try {
            await refreshAuth();
            await updateKontaktSkjemaField(SHEET_ID, raw.aktiv.rowIndex, aktiv ? 'ja' : 'nei');
            showToast(aktiv ? 'Kontaktskjema aktivert' : 'Kontaktskjema deaktivert');
        } catch (err) {
            handleSaveError(err, 'aktiv');
            setToggleState(btn, !aktiv);
        }
    });

    // Autosave på tekstfelt
    for (const field of [
        { id: 'ks-tittel', label: 'Tittel' },
        { id: 'ks-tekst',  label: 'Tekst' },
        { id: 'ks-epost',  label: 'Mottaker-e-post' },
    ]) {
        const el = document.getElementById(field.id);
        if (!el) continue;
        const saver = createAutoSaver(async () => {
            const rowIndex = parseInt(el.dataset.rowIndex, 10);
            await refreshAuth();
            await updateKontaktSkjemaField(SHEET_ID, rowIndex, el.value);
            showToast(`${field.label} lagret`);
        });
        el.addEventListener('input', () => saver.trigger());
        el.addEventListener('blur', () => saver.trigger());
    }

    // Autosave på tema-input-felter
    document.querySelectorAll('[data-tema-input]').forEach(input => {
        const saver = createAutoSaver(async () => {
            const rowIndex = parseInt(input.dataset.rowIndex, 10);
            await refreshAuth();
            await updateKontaktSkjemaField(SHEET_ID, rowIndex, input.value);
            showToast('Tema lagret');
        });
        input.addEventListener('input', () => saver.trigger());
        input.addEventListener('blur', () => saver.trigger());
    });

    // Slett tema
    document.querySelectorAll('[data-delete-tema]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const rowIndex = parseInt(btn.dataset.rowIndex, 10);
            const temaVerdi = document.querySelector(
                `[data-tema-input][data-row-index="${rowIndex}"]`
            )?.value || 'dette temaet';
            if (await showConfirm(`Slett «${temaVerdi}»?`, { destructive: true })) {
                try {
                    await refreshAuth();
                    await deleteSheetRow(SHEET_ID, 'KontaktSkjema', rowIndex);
                    showToast(`«${temaVerdi}» slettet`);
                    reloadKontaktSkjema();
                } catch (err) {
                    handleSaveError(err, 'temaet');
                }
            }
        });
    });

    // Reorder-knapper
    document.querySelectorAll('[data-tema-row]').forEach(row => {
        row.querySelectorAll('[data-direction]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const direction = btn.dataset.direction;
                const currentRow = btn.closest('[data-tema-row]');
                const neighborRow = direction === 'up'
                    ? currentRow.previousElementSibling
                    : currentRow.nextElementSibling;
                if (!neighborRow) return;

                const currentInput   = currentRow.querySelector('[data-tema-input]');
                const neighborInput  = neighborRow.querySelector('[data-tema-input]');
                const currentRowIdx  = parseInt(currentInput.dataset.rowIndex, 10);
                const neighborRowIdx = parseInt(neighborInput.dataset.rowIndex, 10);
                const currentVal     = currentInput.value;
                const neighborVal    = neighborInput.value;

                disableReorderButtons(document.getElementById('tema-list'));
                try {
                    await refreshAuth();
                    await animateSwap(currentRow, neighborRow);
                    await updateKontaktSkjemaField(SHEET_ID, currentRowIdx, neighborVal);
                    await updateKontaktSkjemaField(SHEET_ID, neighborRowIdx, currentVal);
                    reloadKontaktSkjema();
                } catch (err) {
                    handleSaveError(err, 'rekkefølge');
                    enableReorderButtons(document.getElementById('tema-list'));
                }
            });
        });
    });

    // Legg til tema
    document.getElementById('btn-add-tema')?.addEventListener('click', () => {
        document.getElementById('new-tema-form').hidden = false;
        document.getElementById('btn-add-tema').hidden = true;
        document.getElementById('new-tema-input').focus();
    });

    document.getElementById('btn-cancel-new-tema')?.addEventListener('click', () => {
        document.getElementById('new-tema-form').hidden = true;
        document.getElementById('btn-add-tema').hidden = false;
        document.getElementById('new-tema-input').value = '';
    });

    document.getElementById('btn-save-new-tema')?.addEventListener('click', async () => {
        const input = document.getElementById('new-tema-input');
        const val = input.value.trim();
        if (!val) return;
        try {
            await refreshAuth();
            await addKontaktTemaRow(SHEET_ID, val);
            showToast(`«${val}» lagt til`);
            reloadKontaktSkjema();
        } catch (err) {
            handleSaveError(err, 'tema');
        }
    });
}

export function initKontaktSkjemaModule() {
    // Ingen global init nødvendig — alt startes via reloadKontaktSkjema()
}
