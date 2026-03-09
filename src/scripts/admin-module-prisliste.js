import DOMPurify from 'dompurify';
import { formatPris } from '../utils/format-pris.js';
import {
    getPrislisteRaw, addPrislisteRow, updatePrislisteRow,
    deletePrislisteRowPermanently, backupToSlettetSheet,
    getKategoriRekkefølge, addKategoriRekkefølge,
} from './admin-client.js';
import { animateSwap, disableReorderButtons, enableReorderButtons } from './admin-reorder.js';
import { showToast, showConfirm } from './admin-dialog.js';
import { getAdminConfig, escapeHtml, createAutoSaver, verifySave } from './admin-editor-helpers.js';
import { formatTimestamp, ICON_ADD, ICON_UP, ICON_DOWN, ICON_EDIT, ICON_DELETE, reorderPrislisteItem, reorderPrislisteKategori } from './admin-dashboard.js';

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

    // Fetch existing categories for dropdown and order computation
    let existingCategories = [];
    let allRows = [];
    try {
        allRows = await getPrislisteRaw(SHEET_ID);
        existingCategories = [...new Set(allRows.map(r => r.kategori).filter(Boolean))];
    } catch (e) { console.error('[Admin] Kunne ikke hente priskategorier:', e); }

    const originalKategori = p.kategori || '';

    inner.innerHTML = DOMPurify.sanitize(`
        <div class="max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h3 class="text-brand font-black uppercase tracking-tighter mb-6">
                ${isNew ? 'Ny prisrad' : 'Rediger prisrad'}
            </h3>
            <div class="space-y-4">
                <div class="admin-field-container">
                    <label class="admin-label">Kategori</label>
                    <p class="text-xs text-admin-muted-light -mt-0.5">Vises på: Gruppeoverskrift i prislisten</p>
                    <input type="text" id="edit-pris-kategori" value="" class="admin-input" placeholder="Velg eller skriv ny kategori" autocomplete="off">
                </div>
                <div class="admin-field-container">
                    <label class="admin-label">Behandling</label>
                    <p class="text-xs text-admin-muted-light -mt-0.5">Vises på: Rad i prislisten</p>
                    <input type="text" id="edit-pris-behandling" value="" class="admin-input" placeholder="F.eks. Vanlig undersokelse">
                </div>
                <div class="admin-field-container">
                    <label class="admin-label">Pris</label>
                    <p class="text-xs text-admin-muted-light -mt-0.5">Vises på: Rad i prislisten</p>
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
                const kategori = updateData.kategori;
                const maxOrder = allRows
                    .filter(r => r.kategori === kategori)
                    .reduce((max, r) => Math.max(max, r.order ?? 0), 0);
                updateData.order = maxOrder + 1;
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
            if (updateData.kategori !== originalKategori) {
                const maxOrder = allRows
                    .filter(r => r.kategori === updateData.kategori)
                    .reduce((max, r) => Math.max(max, r.order ?? 0), 0);
                updateData.order = maxOrder + 1;
            } else {
                updateData.order = p.order;
            }
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
        'width=1100,height=600,left=100,top=100');
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
        let kategoriOrder = [];
        try {
            kategoriOrder = await getKategoriRekkefølge(sheetId);
        } catch (e) { console.error('[Admin] Kunne ikke hente kategori-rekkefølge:', e); }

        // Ensure all categories from items exist in kategoriOrder
        const existingKategorier = new Set(kategoriOrder.map(k => k.kategori));
        const itemKategorier = [...new Set(items.map(i => i.kategori).filter(Boolean))];
        const newKategorier = itemKategorier.filter(k => !existingKategorier.has(k));
        for (const k of newKategorier) {
            const maxOrder = kategoriOrder.reduce((max, ko) => Math.max(max, ko.order), 0);
            const newOrder = maxOrder + 1;
            try {
                await addKategoriRekkefølge(sheetId, k, newOrder);
                kategoriOrder.push({ rowIndex: -1, kategori: k, order: newOrder });
            } catch (e) { console.error(`[Admin] Kunne ikke legge til kategori "${k}":`, e); }
        }

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
            // Sort each category's rows by order ascending, using original index as tiebreaker
            for (const [, rows] of grouped) {
                rows.sort((a, b) => {
                    const orderDiff = (a.order ?? 0) - (b.order ?? 0);
                    return orderDiff !== 0 ? orderDiff : items.indexOf(a) - items.indexOf(b);
                });
            }

            // Sort categories by kategoriOrder
            const kategoriOrderMap = new Map(kategoriOrder.map(k => [k.kategori, k.order]));
            const sortedKategoriKeys = [...grouped.keys()].sort((a, b) => {
                const orderA = kategoriOrderMap.get(a) ?? Number.MAX_SAFE_INTEGER;
                const orderB = kategoriOrderMap.get(b) ?? Number.MAX_SAFE_INTEGER;
                if (orderA !== orderB) return orderA - orderB;
                return a.localeCompare(b, 'nb');
            });

            let html = `<p class="text-xs text-admin-muted-light mb-3">Sist hentet: <span id="prisliste-last-fetched">${formatTimestamp(new Date())}</span></p>`;
            html += '<div class="space-y-6 max-w-4xl">';

            for (let ki = 0; ki < sortedKategoriKeys.length; ki++) {
                const kategori = sortedKategoriKeys[ki];
                const rows = grouped.get(kategori);
                const isFirstKat = ki === 0;
                const isLastKat = ki === sortedKategoriKeys.length - 1;
                html += `<div class="bg-white rounded-2xl border border-brand-border/60 shadow-sm overflow-hidden">
                    <div class="px-6 py-4 border-b border-brand-border/60 flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <div class="flex flex-col gap-1">
                                <button data-kategori="${escapeHtml(kategori)}" data-dir="-1" class="reorder-kategori-btn admin-icon-btn-reorder ${isFirstKat ? 'invisible' : ''}" title="Flytt kategori opp">${ICON_UP}</button>
                                <button data-kategori="${escapeHtml(kategori)}" data-dir="1" class="reorder-kategori-btn admin-icon-btn-reorder ${isLastKat ? 'invisible' : ''}" title="Flytt kategori ned">${ICON_DOWN}</button>
                            </div>
                            <h3 class="font-heading font-bold text-xl text-brand">${escapeHtml(kategori)}</h3>
                        </div>
                        <button class="add-pris-kategori-btn btn-primary p-1.5 rounded-lg min-w-[32px] min-h-[32px] flex items-center justify-center" data-kategori="${escapeHtml(kategori)}" title="Ny prisrad i ${escapeHtml(kategori)}" aria-label="Ny prisrad i ${escapeHtml(kategori)}">${ICON_ADD}</button>
                    </div>
                    <div class="px-6 py-2">`;
                for (let i = 0; i < rows.length; i++) {
                    const item = rows[i];
                    const isFirst = i === 0;
                    const isLast = i === rows.length - 1;
                    const prisDisplay = escapeHtml(formatPris(item.pris));
                    const oppdatertTekst = formatSistOppdatert(item.sistOppdatert);
                    const borderClass = i < rows.length - 1 ? ' border-b border-brand-border/60' : '';
                    html += `
                        <div class="group flex items-center gap-4 py-3 cursor-pointer hover:bg-brand-light/30 transition-colors -mx-2 px-2 rounded${borderClass}" onclick="this.querySelector('.edit-pris-btn').click()">
                            <div class="flex-grow min-w-0">
                                <span class="text-sm text-brand">${escapeHtml(item.behandling)}</span>
                                ${oppdatertTekst ? `<span class="block text-xs text-admin-muted-light">Oppdatert: ${escapeHtml(oppdatertTekst)}</span>` : ''}
                            </div>
                            <span class="text-sm whitespace-nowrap">${prisDisplay}</span>
                            <div class="flex items-center gap-2 shrink-0" onclick="event.stopPropagation()">
                                <div class="flex flex-col gap-1">
                                    <button data-row="${item.rowIndex}" data-dir="-1" class="reorder-pris-btn admin-icon-btn-reorder ${isFirst ? 'invisible' : ''}" title="Flytt opp">${ICON_UP}</button>
                                    <button data-row="${item.rowIndex}" data-dir="1" class="reorder-pris-btn admin-icon-btn-reorder ${isLast ? 'invisible' : ''}" title="Flytt ned">${ICON_DOWN}</button>
                                </div>
                                <button data-row="${item.rowIndex}" data-name="${escapeHtml(item.behandling)}" class="edit-pris-btn admin-icon-btn group/btn" title="Rediger">${ICON_EDIT}</button>
                                <button data-row="${item.rowIndex}" data-name="${escapeHtml(item.behandling)}" class="delete-pris-btn admin-icon-btn-danger group/btn" title="Slett">${ICON_DELETE}</button>
                            </div>
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
            inner.querySelectorAll('.reorder-pris-btn').forEach(btn => {
                btn.onclick = async (e) => {
                    e.stopPropagation();
                    const rowIndex = parseInt(btn.dataset.row);
                    const direction = parseInt(btn.dataset.dir);
                    const item = items.find(i => i.rowIndex === rowIndex);
                    if (!item) return;
                    const categoryRows = grouped.get(item.kategori) || [];

                    // Finn DOM-elementene for current og neighbor
                    const currentEl = btn.closest('.group');
                    const allRows = [...currentEl.parentNode.children].filter(el => el.classList.contains('group'));
                    const currentIdx = allRows.indexOf(currentEl);
                    const neighborIdx = currentIdx + direction;
                    if (neighborIdx < 0 || neighborIdx >= allRows.length) return;
                    const neighborEl = allRows[neighborIdx];

                    disableReorderButtons(inner, '.reorder-pris-btn');
                    await animateSwap(currentEl, neighborEl);

                    try {
                        await reorderPrislisteItem(sheetId, categoryRows, rowIndex, direction);
                        enableReorderButtons(inner, '.reorder-pris-btn');
                    } catch (err) {
                        await animateSwap(neighborEl, currentEl);
                        enableReorderButtons(inner, '.reorder-pris-btn');
                        showToast('Kunne ikke endre rekkefølge.', 'error');
                    }
                };
            });
            inner.querySelectorAll('.reorder-kategori-btn').forEach(btn => {
                btn.onclick = async (e) => {
                    e.stopPropagation();
                    const kategori = btn.dataset.kategori;
                    const direction = parseInt(btn.dataset.dir);

                    const currentSection = btn.closest('.bg-white');
                    const allSections = [...inner.querySelectorAll('.space-y-6 > .bg-white')];
                    const currentSectionIdx = allSections.indexOf(currentSection);
                    const neighborSectionIdx = currentSectionIdx + direction;
                    if (neighborSectionIdx < 0 || neighborSectionIdx >= allSections.length) return;
                    const neighborSection = allSections[neighborSectionIdx];

                    disableReorderButtons(inner, '.reorder-kategori-btn');
                    await animateSwap(currentSection, neighborSection);

                    try {
                        await reorderPrislisteKategori(sheetId, kategoriOrder, kategori, direction);
                        enableReorderButtons(inner, '.reorder-kategori-btn');
                    } catch (err) {
                        await animateSwap(neighborSection, currentSection);
                        enableReorderButtons(inner, '.reorder-kategori-btn');
                        showToast('Kunne ikke endre rekkefølge.', 'error');
                    }
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
