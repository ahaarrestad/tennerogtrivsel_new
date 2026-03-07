import DOMPurify from 'dompurify';
import {
    getPrislisteRaw, addPrislisteRow, updatePrislisteRow,
    deletePrislisteRowPermanently, backupToSlettetSheet,
} from './admin-client.js';
import { showToast, showConfirm } from './admin-dialog.js';
import { getAdminConfig, escapeHtml, createAutoSaver, verifySave } from './admin-editor-helpers.js';
import { formatTimestamp } from './admin-dashboard.js';

async function deletePrisRad(rowIndex, behandling) {
    const { SHEET_ID } = getAdminConfig();
    if (await showConfirm(`Vil du slette "${behandling}" permanent?`, { destructive: true })) {
        try {
            const allRows = await getPrislisteRaw(SHEET_ID);
            const rowData = allRows.find(r => r.rowIndex === rowIndex);
            if (rowData) {
                await backupToSlettetSheet(SHEET_ID, 'prisliste', rowData.behandling, JSON.stringify(rowData));
            }
            await deletePrislisteRowPermanently(SHEET_ID, rowIndex);
            reloadPrisliste();
            showToast('Prisrad slettet.', 'success');
        } catch (e) {
            showToast('Kunne ikke slette prisraden.', 'error');
        }
    }
}

async function editPrisRad(rowIndex, data = null) {
    const { SHEET_ID } = getAdminConfig();
    const inner = document.getElementById('module-inner');
    const actions = document.getElementById('module-actions');
    if (!inner || !actions) return;

    actions.innerHTML = '';
    window.setBreadcrumbEditor?.('Redigerer prisrad', reloadPrisliste);

    const p = data || { kategori: '', behandling: '', pris: '' };

    inner.innerHTML = DOMPurify.sanitize(`
        <div class="max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h3 class="text-brand font-black uppercase tracking-tighter mb-6">
                ${rowIndex ? 'Rediger prisrad' : 'Ny prisrad'}
            </h3>
            <div class="space-y-4">
                <div class="admin-field-container">
                    <label class="admin-label">Kategori</label>
                    <input type="text" id="edit-pris-kategori" value="" class="admin-input" placeholder="F.eks. Undersokelser">
                </div>
                <div class="admin-field-container">
                    <label class="admin-label">Behandling</label>
                    <input type="text" id="edit-pris-behandling" value="" class="admin-input" placeholder="F.eks. Vanlig undersokelse">
                </div>
                <div class="admin-field-container">
                    <label class="admin-label">Pris</label>
                    <input type="text" id="edit-pris-pris" value="" class="admin-input" placeholder="F.eks. 850 eller Fra 500,-">
                </div>
            </div>
        </div>
    `);

    // Set values programmatically (safe - no HTML parsing)
    const kategoriInput = document.getElementById('edit-pris-kategori');
    const behandlingInput = document.getElementById('edit-pris-behandling');
    const prisInput = document.getElementById('edit-pris-pris');
    if (kategoriInput) kategoriInput.value = p.kategori || '';
    if (behandlingInput) behandlingInput.value = p.behandling || '';
    if (prisInput) prisInput.value = p.pris !== undefined ? String(p.pris) : '';

    const savePris = async () => {
        const kategori = document.getElementById('edit-pris-kategori')?.value || '';
        const behandling = document.getElementById('edit-pris-behandling')?.value || '';
        const prisStr = document.getElementById('edit-pris-pris')?.value || '';
        const prisNum = parseFloat(prisStr);
        const pris = isNaN(prisNum) ? prisStr : prisNum;

        const updateData = { kategori, behandling, pris };

        if (rowIndex) {
            await updatePrislisteRow(SHEET_ID, rowIndex, updateData);
        } else {
            await addPrislisteRow(SHEET_ID, updateData);
            reloadPrisliste();
            return;
        }
        await verifySave({
            fetchFn: () => getPrislisteRaw(SHEET_ID),
            rowIndex,
            compareField: 'behandling',
            expectedValue: updateData.behandling,
            timestampElId: 'prisliste-last-fetched',
            reloadFn: reloadPrisliste,
        });
    };
    const autoSaver = createAutoSaver(savePris);

    ['edit-pris-kategori', 'edit-pris-behandling', 'edit-pris-pris'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => autoSaver.trigger());
    });
}

function reloadPrisliste() {
    window.clearBreadcrumbEditor?.();
    const { SHEET_ID } = getAdminConfig();
    loadPrislisteList(SHEET_ID);
}

async function loadPrislisteList(sheetId) {
    const inner = document.getElementById('module-inner');
    const actions = document.getElementById('module-actions');
    if (!inner || !actions) return;

    actions.innerHTML = `<button id="btn-new-pris" class="btn-primary text-xs py-2 px-4 shadow-md">+ Legg til prisrad</button>`;
    inner.innerHTML = '<div class="text-admin-muted italic text-sm animate-pulse">Henter prisliste...</div>';

    try {
        const items = await getPrislisteRaw(sheetId);

        const countEl = document.getElementById('breadcrumb-count');
        if (countEl) {
            countEl.textContent = `(${items.length})`;
            countEl.classList.remove('hidden');
        }

        if (items.length === 0) {
            inner.innerHTML = '<div class="text-center py-12 text-admin-muted-light italic">Ingen prisrader funnet.</div>';
        } else {
            const grouped = new Map();
            for (const item of items) {
                if (!grouped.has(item.kategori)) grouped.set(item.kategori, []);
                grouped.get(item.kategori).push(item);
            }

            let html = `<p class="text-xs text-admin-muted-light mb-3">Sist hentet: <span id="prisliste-last-fetched">${formatTimestamp(new Date())}</span></p>`;
            html += '<div class="space-y-6 max-w-4xl">';

            for (const [kategori, rows] of grouped) {
                html += `<div>
                    <h3 class="font-bold text-brand text-sm uppercase tracking-wider mb-2">${escapeHtml(kategori)}</h3>
                    <div class="space-y-2">`;
                for (const item of rows) {
                    const prisDisplay = typeof item.pris === 'number' ? `kr ${item.pris.toLocaleString('nb-NO')}` : escapeHtml(String(item.pris));
                    html += `
                        <div class="admin-card-interactive group flex justify-between items-center gap-4" onclick="this.querySelector('.edit-pris-btn').click()">
                            <div class="flex-grow min-w-0">
                                <span class="font-medium text-brand">${escapeHtml(item.behandling)}</span>
                                <span class="text-admin-muted ml-2">${prisDisplay}</span>
                            </div>
                            <div class="flex gap-2 shrink-0">
                                <button class="edit-pris-btn admin-icon-btn" data-row="${item.rowIndex}" title="Rediger">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                </button>
                                <button class="delete-pris-btn admin-icon-btn" data-row="${item.rowIndex}" data-name="${escapeHtml(item.behandling)}" title="Slett">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                </button>
                            </div>
                        </div>`;
                }
                html += '</div></div>';
            }
            html += '</div>';

            inner.innerHTML = DOMPurify.sanitize(html);

            inner.querySelectorAll('.edit-pris-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const row = parseInt(btn.dataset.row);
                    editPrisRad(row, items.find(i => i.rowIndex === row));
                };
            });
            inner.querySelectorAll('.delete-pris-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    deletePrisRad(parseInt(btn.dataset.row), btn.dataset.name);
                };
            });
        }

        document.getElementById('btn-new-pris').onclick = () => editPrisRad(null, null);
    } catch (e) {
        console.error('[Admin] Prisliste load failed:', e);
        inner.innerHTML = '<div class="admin-alert-error">Kunne ikke laste prisliste.</div>';
    }
}

export function initPrislisteModule() {
    window.deletePrisRad = deletePrisRad;
    window.editPrisRad = editPrisRad;
    window.openPrislisteModule = reloadPrisliste;
}

export { reloadPrisliste };
