// src/scripts/admin-dashboard.js
import { 
    listFiles, getFileContent, saveFile, createFile, deleteFile,
    parseMarkdown, stringifyMarkdown, updateSettings, getSettingsWithNotes,
    checkMultipleAccess, logout, getTannlegerRaw, updateTannlegeRow, 
    addTannlegeRow, deleteTannlegeRow
} from './admin-client.js';
import { formatDate, stripStackEditData, sortMessages, slugify } from './textFormatter.js';
import snarkdown from 'snarkdown';

/**
 * Kontrollerer tilgang til dashboard-moduler og deaktiverer de som ikke er tilgjengelige.
 * Hvis brukeren ikke har tilgang til noe som helst, logges de ut.
 */
export async function enforceAccessControl(config) {
    const ids = [
        config.SHEET_ID,
        config.TJENESTER_FOLDER,
        config.MELDINGER_FOLDER,
        config.TANNLEGER_FOLDER
    ].filter(Boolean);

    const accessMap = await checkMultipleAccess(ids);
    
    const modules = [
        { id: 'settings', resource: config.SHEET_ID, btn: 'btn-open-settings' },
        { id: 'tjenester', resource: config.TJENESTER_FOLDER, btn: 'btn-open-tjenester' },
        { id: 'meldinger', resource: config.MELDINGER_FOLDER, btn: 'btn-open-meldinger' },
        { id: 'tannleger', resource: config.TANNLEGER_FOLDER, btn: 'btn-open-tannleger' }
    ];

    let hasAnyAccess = false;

    modules.forEach(mod => {
        const hasAccess = accessMap[mod.resource];
        const btn = document.getElementById(mod.btn);
        const card = btn?.closest('.admin-card-interactive');

        if (hasAccess) {
            hasAnyAccess = true;
            if (btn) btn.removeAttribute('disabled');
            if (card) card.style.opacity = '1';
        } else {
            if (btn) {
                btn.setAttribute('disabled', 'true');
                btn.textContent = 'Ingen tilgang';
                btn.classList.add('opacity-50', 'cursor-not-allowed');
            }
            if (card) {
                card.style.opacity = '0.5';
                card.classList.remove('hover:shadow-md', 'hover:border-brand-active');
                card.title = 'Du har ikke tilgang til denne modulen i Google Drive.';
            }
        }
    });

    if (!hasAnyAccess && ids.length > 0) {
        console.warn("[Admin] Ingen tilgang funnet for noen moduler. Logger ut.");
        logout();
        window.location.href = '/?access_denied=true';
    }

    return accessMap;
}

/**
 * Oppdaterer UI med brukerinformasjon
 */
export function updateUIWithUser(user) {
    if (!user) return;
    const loginContainer = document.getElementById('login-container');
    const dashboard = document.getElementById('dashboard');
    const noAccess = document.getElementById('no-access');
    const pill = document.getElementById('user-pill');
    const info = document.getElementById('nav-user-info');

    if (loginContainer) loginContainer.classList.add('hidden');
    if (dashboard) dashboard.classList.remove('hidden');
    if (noAccess) noAccess.classList.add('hidden');
    
    if (pill && info) {
        pill.style.display = 'flex';
        info.textContent = user.name || user.email;
    }
}

/**
 * Autoresize for textareas
 */
export function autoResizeTextarea(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
}

/**
 * Lagrer en enkelt innstilling
 */
export async function saveSingleSetting(index, inputEl, currentSettings, sheetId) {
    const statusEl = document.getElementById(`status-${index}`);
    if (!statusEl) return;

    const originalValue = currentSettings[index].value;
    const newValue = inputEl.value;
    if (newValue === originalValue) return;

    statusEl.innerHTML = '<svg class="animate-spin h-4 w-4 text-slate-400" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
    
    try {
        const updatedList = [...currentSettings];
        updatedList[index] = { ...currentSettings[index], value: newValue };
        await updateSettings(sheetId, updatedList);
        currentSettings[index].value = newValue;
        statusEl.innerHTML = '<span class="text-green-600 text-[10px] font-bold">✅</span>';
        setTimeout(() => { statusEl.innerHTML = ''; }, 3000);
    } catch (e) { 
        console.error("Save failed", e);
        statusEl.innerHTML = '<span class="text-red-500 text-[10px] font-bold">❌</span>'; 
    }
}

/**
 * Henter og viser meldinger-listen
 */
export async function loadMeldingerModule(folderId, onEdit, onDelete) {
    const inner = document.getElementById('module-inner');
    const actions = document.getElementById('module-actions');
    if (!inner || !actions) return;

    actions.innerHTML = `<button id="btn-new-melding" class="btn-primary text-xs py-2 px-4 shadow-md">➕ Ny melding</button>`;
    inner.innerHTML = '<div class="text-slate-500 italic text-sm animate-pulse">Laster meldinger...</div>';

    try {
        const files = await listFiles(folderId);
        
        // Normaliser nåtid til midnatt UTC for sammenligning
        const today = new Date();
        const nowUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());

        if (files.length === 0) {
            inner.innerHTML = `<div class="text-center py-12 text-slate-400 italic">Ingen meldinger funnet.</div>`;
        } else {
            const messages = await Promise.all(files.map(async (f) => {
                const raw = await getFileContent(f.id);
                const { data } = parseMarkdown(raw);
                return { ...f, driveId: f.id, ...data };
            }));

            const sortedMessages = sortMessages(messages);
            let html = `<div class="grid grid-cols-1 gap-4 max-w-5xl">`;

            const parseToUTC = (dateStr) => {
                if (!dateStr) return null;
                const d = new Date(dateStr);
                if (isNaN(d.getTime())) return null;
                return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
            };

            // Finn overlapp for aktive/planlagte meldinger
            const activeOrPlanned = sortedMessages
                .map(m => ({ 
                    ...m, 
                    start: parseToUTC(m.startDate) || 0, 
                    end: parseToUTC(m.endDate || '2099-12-31') || 0 
                }))
                .filter(m => m.end >= nowUTC);

            let lastGroup = null;

            sortedMessages.forEach((msg) => {
                const startTime = parseToUTC(msg.startDate);
                const endTime = parseToUTC(msg.endDate || '2099-12-31');
                
                let statusClass = "bg-slate-100 text-slate-500 border-slate-200";
                let statusText = "Utløpt";
                let dotClass = "admin-status-dot-expired";
                let currentGroup = "Historikk (Utløpte)";

                if (startTime !== null && endTime !== null) {
                    if (nowUTC >= startTime && nowUTC <= endTime) {
                        statusClass = "bg-green-100 text-green-700 border-green-200 ring-4 ring-green-500/5 font-black";
                        statusText = "Aktiv nå";
                        dotClass = "admin-status-dot-active";
                        currentGroup = "Aktive meldinger";
                    } else if (nowUTC < startTime) {
                        statusClass = "bg-blue-100 text-blue-700 border-blue-200";
                        statusText = "Planlagt";
                        dotClass = "admin-status-dot-planned";
                        currentGroup = "Planlagte meldinger";
                    }
                }

                // Sett inn gruppe-skille dersom status endres
                if (currentGroup !== lastGroup) {
                    html += `
                        <div class="col-span-1 mt-8 mb-2 first:mt-0">
                            <h4 class="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-3">
                                ${currentGroup}
                                <span class="flex-grow h-[1px] bg-slate-200"></span>
                            </h4>
                        </div>`;
                    lastGroup = currentGroup;
                }

                // Sjekk om denne meldinger overlapper med andre (kun for aktive/planlagte)
                const hasOverlap = endTime >= nowUTC && activeOrPlanned.some(other => 
                    other.driveId !== msg.driveId && 
                    startTime <= other.end && 
                    endTime >= other.start
                );

                html += `
                    <div class="admin-card-interactive group flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${hasOverlap ? 'border-amber-300 bg-amber-50/30' : ''}">
                        <div class="min-w-0 flex-grow">
                            <div class="flex items-center gap-3 mb-1.5">
                                <span class="admin-status-pill ${statusClass}">
                                    <span class="admin-status-dot ${dotClass}"></span>
                                    ${statusText}
                                </span>
                                <h3 class="font-bold text-brand truncate">${msg.title || msg.name}</h3>
                                ${hasOverlap ? `
                                    <span class="flex items-center gap-1 text-[10px] font-black text-amber-600 uppercase tracking-tighter bg-amber-100 px-2 py-0.5 rounded-md animate-pulse">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                                        Dato-konflikt
                                    </span>
                                ` : ''}
                            </div>
                            <p class="text-xs text-slate-500 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                ${formatDate(msg.startDate)} til ${formatDate(msg.endDate || 'Uendelig')}
                            </p>
                            ${hasOverlap ? `<p class="text-[10px] text-amber-700 mt-1 font-medium">⚠️ Denne meldingen overlapper med en annen aktiv eller planlagt melding. Kun én melding vises av gangen på nettsiden.</p>` : ''}
                        </div>
                        <div class="flex gap-2 shrink-0">
                            <button data-id="${msg.driveId}" data-name="${msg.name}" class="edit-btn p-3 rounded-xl bg-brand-light/30 text-brand hover:bg-brand hover:text-white transition-all group/btn" title="Rediger">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                            <button data-id="${msg.driveId}" data-name="${msg.name}" class="delete-btn p-3 rounded-xl bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all group/btn" title="Slett">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                            </button>
                        </div>
                    </div>`;
            });
            inner.innerHTML = html + `</div>`;

            // Event listeners for dynamiske knapper
            inner.querySelectorAll('.edit-btn').forEach(btn => {
                btn.onclick = () => onEdit(btn.dataset.id, btn.dataset.name);
            });
            inner.querySelectorAll('.delete-btn').forEach(btn => {
                btn.onclick = () => onDelete(btn.dataset.id, btn.dataset.name);
            });
        }
        document.getElementById('btn-new-melding').onclick = () => onEdit(null, null);
    } catch (e) { 
        console.error("Load failed", e);
        inner.innerHTML = `<div class="admin-alert-error">❌ Kunne ikke laste meldinger.</div>`; 
    }
}

/**
 * Henter og viser tjenester-listen
 */
export async function loadTjenesterModule(folderId, onEdit, onDelete) {
    const inner = document.getElementById('module-inner');
    const actions = document.getElementById('module-actions');
    if (!inner || !actions) return;

    actions.innerHTML = `<button id="btn-new-tjeneste" class="btn-primary text-xs py-2 px-4 shadow-md">➕ Ny tjeneste</button>`;
    inner.innerHTML = '<div class="text-slate-500 italic text-sm animate-pulse">Laster tjenester...</div>';

    try {
        const files = await listFiles(folderId);
        if (files.length === 0) {
            inner.innerHTML = `<div class="text-center py-12 text-slate-400 italic">Ingen tjenester funnet.</div>`;
        } else {
            const services = await Promise.all(files.map(async (f) => {
                const raw = await getFileContent(f.id);
                const { data } = parseMarkdown(raw);
                return { ...f, driveId: f.id, ...data };
            }));

            // Sorter alfabetisk på tittel
            services.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'nb'));

            let html = `<div class="grid grid-cols-1 gap-4 max-w-5xl">`;
            services.forEach((s) => {
                html += `
                    <div class="admin-card-interactive group flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div class="min-w-0 flex-grow">
                            <h3 class="font-bold text-brand truncate">${s.title || s.name}</h3>
                            <p class="text-xs text-slate-500 mt-1 line-clamp-1">${s.ingress || ''}</p>
                        </div>
                        <div class="flex gap-2 shrink-0">
                            <button data-id="${s.driveId}" data-name="${s.name}" class="edit-btn p-3 rounded-xl bg-brand-light/30 text-brand hover:bg-brand hover:text-white transition-all group/btn" title="Rediger">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                            <button data-id="${s.driveId}" data-name="${s.name}" class="delete-btn p-3 rounded-xl bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all group/btn" title="Slett">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                            </button>
                        </div>
                    </div>`;
            });
            inner.innerHTML = html + `</div>`;

            inner.querySelectorAll('.edit-btn').forEach(btn => {
                btn.onclick = () => onEdit(btn.dataset.id, btn.dataset.name);
            });
            inner.querySelectorAll('.delete-btn').forEach(btn => {
                btn.onclick = () => onDelete(btn.dataset.id, btn.dataset.name);
            });
        }
        document.getElementById('btn-new-tjeneste').onclick = () => onEdit(null, null);
    } catch (e) {
        console.error("Load failed", e);
        inner.innerHTML = `<div class="admin-alert-error">❌ Kunne ikke laste tjenester.</div>`;
    }
}

/**
 * Henter og viser tannleger-listen fra Sheets
 */
export async function loadTannlegerModule(sheetId, onEdit, onDelete) {
    const inner = document.getElementById('module-inner');
    const actions = document.getElementById('module-actions');
    if (!inner || !actions) return;

    actions.innerHTML = `<button id="btn-new-tannlege" class="btn-primary text-xs py-2 px-4 shadow-md">➕ Legg til tannlege</button>`;
    inner.innerHTML = '<div class="text-slate-500 italic text-sm animate-pulse">Henter tannleger fra Sheets...</div>';

    try {
        const dentists = await getTannlegerRaw(sheetId);
        
        if (dentists.length === 0) {
            inner.innerHTML = `<div class="text-center py-12 text-slate-400 italic">Ingen tannleger funnet i arket.</div>`;
        } else {
            // Sorter alfabetisk på navn
            dentists.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'nb'));

            let html = `<div class="grid grid-cols-1 gap-4 max-w-5xl">`;
            dentists.forEach((t) => {
                const statusClass = t.active ? "bg-green-100 text-green-700 border-green-200" : "bg-slate-100 text-slate-500 border-slate-200";
                const statusText = t.active ? "Aktiv" : "Inaktiv";

                html += `
                    <div class="admin-card-interactive group flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${!t.active ? 'opacity-60' : ''}">
                        <div class="min-w-0 flex-grow">
                            <div class="flex items-center gap-3 mb-1">
                                <h3 class="font-bold text-brand truncate">${t.name}</h3>
                                <span class="admin-status-pill ${statusClass} text-[8px]">${statusText}</span>
                            </div>
                            <p class="text-xs text-slate-500 line-clamp-1 italic">${t.title || 'Ingen tittel'}</p>
                        </div>
                        <div class="flex gap-2 shrink-0">
                            <button data-row="${t.rowIndex}" data-name="${t.name}" class="edit-tannlege-btn p-3 rounded-xl bg-brand-light/30 text-brand hover:bg-brand hover:text-white transition-all group/btn" title="Rediger">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                            <button data-row="${t.rowIndex}" data-name="${t.name}" class="delete-tannlege-btn p-3 rounded-xl bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all group/btn" title="Slett">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                            </button>
                        </div>
                    </div>`;
            });
            inner.innerHTML = html + `</div>`;

            inner.querySelectorAll('.edit-tannlege-btn').forEach(btn => {
                btn.onclick = () => onEdit(parseInt(btn.dataset.row), dentists.find(d => d.rowIndex === parseInt(btn.dataset.row)));
            });
            inner.querySelectorAll('.delete-tannlege-btn').forEach(btn => {
                btn.onclick = () => onDelete(parseInt(btn.dataset.row), btn.dataset.name);
            });
        }
        document.getElementById('btn-new-tannlege').onclick = () => onEdit(null, null);
    } catch (e) {
        console.error("Load failed", e);
        inner.innerHTML = `<div class="admin-alert-error">❌ Kunne ikke laste tannleger fra Google Sheets.</div>`;
    }
}

/**
 * Initialiserer kun Markdown-editor (for tjenester)
 */
export function initMarkdownEditor(onSave) {
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
                return `<div class="markdown-content prose">${snarkdown(plainText)}</div>`;
            }
        });
    }

    const saveBtn = document.getElementById('btn-save-tjeneste');
    if (saveBtn) {
        saveBtn.onclick = () => onSave(easyMDE);
    }

    return easyMDE;
}

/**
 * Initialiserer Flatpickr og EasyMDE
 */
export function initEditors(onDateChange, onSave) {
    // Initialiser EasyMDE
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
                return `<div class="markdown-content prose">${snarkdown(plainText)}</div>`;
            }
        });
    }

    // Initialiser Flatpickr
    const flatpickrGlobal = window['flatpickr'];
    if (typeof flatpickrGlobal !== 'undefined') {
        const l10ns = flatpickrGlobal.l10ns;
        // Finn den beste tilgjengelige norske lokalen, eller null hvis ingen finnes
        const noLocale = l10ns ? (l10ns.no || l10ns.nb || l10ns.Norwegian) : null;
        
        const fpConfig = {
            dateFormat: "Y-m-d",
            altInput: true,
            altFormat: "d.m.Y",
            allowInput: true,
            onChange: (selectedDates, dateStr, instance) => {
                // Oppdater det underliggende input-feltet manuelt for å sikre at 'change' event trigges riktig
                instance.element.value = dateStr;
                if (onDateChange) onDateChange(selectedDates, dateStr, instance);
            }
        };

        // Kun legg til locale hvis vi faktisk fant et objekt (unngår "invalid locale" string feil)
        if (noLocale) {
            fpConfig.locale = noLocale;
        }
        
        flatpickrGlobal("#edit-start", fpConfig);
        flatpickrGlobal("#edit-end", fpConfig);
    }

    const saveBtn = document.getElementById('btn-save-melding');
    if (saveBtn) {
        saveBtn.onclick = () => onSave(easyMDE);
    }

    return easyMDE;
}
