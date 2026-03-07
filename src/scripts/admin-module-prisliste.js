import DOMPurify from 'dompurify';
import {
    getPrislisteRaw, addPrislisteRow, updatePrislisteRow,
    deletePrislisteRowPermanently, backupToSlettetSheet,
} from './admin-client.js';
import { showToast, showConfirm } from './admin-dialog.js';
import { getAdminConfig, escapeHtml, createAutoSaver, verifySave } from './admin-editor-helpers.js';
import { formatTimestamp, ICON_ADD, renderActionButtons } from './admin-dashboard.js';

function formatSistOppdatert(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
}

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

function setupCategoryDropdown(inputEl, categories) {
    const container = inputEl.parentElement;
    const dropdown = document.createElement('div');
    dropdown.className = 'admin-category-dropdown hidden';
    container.style.position = 'relative';
    container.appendChild(dropdown);

    function renderOptions(filter) {
        const filtered = categories.filter(k =>
            k.toLowerCase().includes((filter || '').toLowerCase())
        );
        const exactMatch = categories.some(k => k.toLowerCase() === (filter || '').toLowerCase());

        let html = filtered.map(k =>
            `<div class="admin-category-option" data-value="${escapeHtml(k)}">${escapeHtml(k)}</div>`
        ).join('');

        if (filter && !exactMatch) {
            html += `<div class="admin-category-option admin-category-new" data-value="${escapeHtml(filter)}">+ Opprett «${escapeHtml(filter)}»</div>`;
        }

        dropdown.innerHTML = DOMPurify.sanitize(html);
        dropdown.classList.toggle('hidden', !html);

        dropdown.querySelectorAll('.admin-category-option').forEach(opt => {
            opt.addEventListener('mousedown', (e) => {
                e.preventDefault();
                inputEl.value = opt.dataset.value;
                dropdown.classList.add('hidden');
                inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            });
        });
    }

    inputEl.addEventListener('focus', () => renderOptions(inputEl.value));
    inputEl.addEventListener('input', () => renderOptions(inputEl.value));
    inputEl.addEventListener('blur', () => dropdown.classList.add('hidden'));

    inputEl.addEventListener('keydown', (e) => {
        const visible = dropdown.querySelectorAll('.admin-category-option');
        const active = dropdown.querySelector('.admin-category-option.active');
        const items = [...visible];
        const idx = active ? items.indexOf(active) : -1;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            active?.classList.remove('active');
            const next = items[idx + 1] || items[0];
            next?.classList.add('active');
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            active?.classList.remove('active');
            const prev = items[idx - 1] || items[items.length - 1];
            prev?.classList.add('active');
        } else if (e.key === 'Enter' && active) {
            e.preventDefault();
            inputEl.value = active.dataset.value;
            dropdown.classList.add('hidden');
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        } else if (e.key === 'Escape') {
            dropdown.classList.add('hidden');
        }
    });
}

async function editPrisRad(rowIndex, data = null) {
    const { SHEET_ID } = getAdminConfig();
    const inner = document.getElementById('module-inner');
    const actions = document.getElementById('module-actions');
    if (!inner || !actions) return;

    actions.innerHTML = '';
    window.setBreadcrumbEditor?.('Redigerer prisrad', reloadPrisliste);

    const isNew = !rowIndex;
    const p = data || { kategori: '', behandling: '', pris: '' };

    // Fetch existing categories for dropdown
    let existingCategories = [];
    try {
        const allRows = await getPrislisteRaw(SHEET_ID);
        existingCategories = [...new Set(allRows.map(r => r.kategori).filter(Boolean))];
    } catch { /* ignore — dropdown will just be empty */ }

    inner.innerHTML = DOMPurify.sanitize(`
        <div class="max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h3 class="text-brand font-black uppercase tracking-tighter mb-6">
                ${isNew ? 'Ny prisrad' : 'Rediger prisrad'}
            </h3>
            <div class="space-y-4">
                <div class="admin-field-container">
                    <label class="admin-label">Kategori</label>
                    <input type="text" id="edit-pris-kategori" value="" class="admin-input" placeholder="Velg eller skriv ny kategori" autocomplete="off">
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
            ${isNew ? '<div id="new-row-actions" class="flex gap-3 mt-6"></div>' : ''}
        </div>
    `);

    // Set values programmatically (safe - no HTML parsing)
    const kategoriInput = document.getElementById('edit-pris-kategori');
    const behandlingInput = document.getElementById('edit-pris-behandling');
    const prisInput = document.getElementById('edit-pris-pris');
    if (kategoriInput) kategoriInput.value = p.kategori || '';
    if (behandlingInput) behandlingInput.value = p.behandling || '';
    if (prisInput) prisInput.value = p.pris !== undefined ? String(p.pris) : '';

    // Set up custom category dropdown
    if (kategoriInput) {
        setupCategoryDropdown(kategoriInput, existingCategories);
    }

    // Auto-focus behandling when category is pre-filled (e.g. from per-category "+" button)
    if (isNew && p.kategori && behandlingInput) {
        behandlingInput.focus();
    }

    function getFormData() {
        const kategori = document.getElementById('edit-pris-kategori')?.value || '';
        const behandling = document.getElementById('edit-pris-behandling')?.value || '';
        const prisStr = document.getElementById('edit-pris-pris')?.value || '';
        const prisNum = parseFloat(prisStr);
        const pris = isNaN(prisNum) ? prisStr : prisNum;
        return { kategori, behandling, pris };
    }

    if (isNew) {
        // New row: explicit Opprett + Avbryt buttons, no autosave
        const actionsDiv = document.getElementById('new-row-actions');
        if (actionsDiv) {
            const createBtn = document.createElement('button');
            createBtn.className = 'btn-primary';
            createBtn.textContent = 'Opprett';
            createBtn.addEventListener('click', async () => {
                const updateData = getFormData();
                try {
                    await addPrislisteRow(SHEET_ID, updateData);
                    showToast('Prisrad opprettet.', 'success');
                    reloadPrisliste();
                } catch (e) {
                    showToast('Kunne ikke opprette prisraden.', 'error');
                }
            });

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'admin-btn-cancel';
            cancelBtn.textContent = 'Avbryt';
            cancelBtn.addEventListener('click', () => reloadPrisliste());

            actionsDiv.appendChild(createBtn);
            actionsDiv.appendChild(cancelBtn);
        }
    } else {
        // Existing row: autosave on input + back button
        const savePris = async () => {
            const updateData = getFormData();
            await updatePrislisteRow(SHEET_ID, rowIndex, updateData);
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

        const backBtn = document.createElement('button');
        backBtn.className = 'admin-btn-cancel mt-6';
        backBtn.textContent = 'Tilbake til listen';
        backBtn.addEventListener('click', () => reloadPrisliste());
        inner.querySelector('.max-w-2xl')?.appendChild(backBtn);
    }
}

function printPrisliste() {
    const popup = window.open('/prisliste?print=1', 'prisliste-print',
        'width=800,height=600,left=100,top=100');
    if (popup) {
        popup.addEventListener('afterprint', () => popup.close());
    }
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

    actions.innerHTML = `<div class="flex items-center gap-2"><button id="btn-new-pris" class="btn-primary p-2.5 shadow-md rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center" title="Legg til prisrad" aria-label="Legg til prisrad">${ICON_ADD}</button><button id="btn-print-prisliste" class="btn-secondary p-2.5 shadow-md rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center" title="Skriv ut prisliste" aria-label="Skriv ut prisliste"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg></button></div>`;
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
                html += `<div class="bg-white rounded-2xl border border-brand-border/60 shadow-sm overflow-hidden">
                    <div class="px-6 py-4 border-b border-brand-border/60 flex items-center justify-between">
                        <h3 class="font-heading font-bold text-xl text-brand">${escapeHtml(kategori)}</h3>
                        <button class="add-pris-kategori-btn btn-primary p-1.5 rounded-lg min-w-[32px] min-h-[32px] flex items-center justify-center" data-kategori="${escapeHtml(kategori)}" title="Ny prisrad i ${escapeHtml(kategori)}" aria-label="Ny prisrad i ${escapeHtml(kategori)}">${ICON_ADD}</button>
                    </div>
                    <div class="px-6 py-2">`;
                for (let i = 0; i < rows.length; i++) {
                    const item = rows[i];
                    const prisDisplay = typeof item.pris === 'number' ? `kr ${item.pris.toLocaleString('nb-NO')}` : escapeHtml(String(item.pris));
                    const oppdatertTekst = formatSistOppdatert(item.sistOppdatert);
                    const borderClass = i < rows.length - 1 ? ' border-b border-brand-border/60' : '';
                    html += `
                        <div class="group flex items-center gap-4 py-3 cursor-pointer hover:bg-brand-light/30 transition-colors -mx-2 px-2 rounded${borderClass}" onclick="this.querySelector('.edit-pris-btn').click()">
                            <div class="flex-grow min-w-0">
                                <span class="text-base text-brand">${escapeHtml(item.behandling)}</span>
                                ${oppdatertTekst ? `<span class="block text-xs text-admin-muted-light">Oppdatert: ${escapeHtml(oppdatertTekst)}</span>` : ''}
                            </div>
                            <span class="font-semibold text-base whitespace-nowrap">${prisDisplay}</span>
                            ${renderActionButtons('edit-pris-btn', 'delete-pris-btn', `data-row="${item.rowIndex}" data-name="${escapeHtml(item.behandling)}"`)}
                        </div>`;
                }
                html += '</div></div>';
            }
            html += '</div>';

            inner.innerHTML = DOMPurify.sanitize(html);

            inner.querySelectorAll('.add-pris-kategori-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    editPrisRad(null, { kategori: btn.dataset.kategori, behandling: '', pris: '' });
                };
            });
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
        document.getElementById('btn-print-prisliste').onclick = () => printPrisliste();
    } catch (e) {
        console.error('[Admin] Prisliste load failed:', e);
        inner.innerHTML = '<div class="admin-alert-error">Kunne ikke laste prisliste.</div>';
    }
}

export function initPrislisteModule() {
    window.deletePrisRad = deletePrisRad;
    window.editPrisRad = editPrisRad;
    window.openPrislisteModule = reloadPrisliste;
    window.printPrisliste = printPrisliste;
}

export { reloadPrisliste };
