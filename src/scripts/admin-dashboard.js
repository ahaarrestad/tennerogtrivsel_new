// src/scripts/admin-dashboard.js
import { 
    listFiles, getFileContent, saveFile, createFile, deleteFile,
    parseMarkdown, stringifyMarkdown, updateSettings, getSettingsWithNotes,
    checkMultipleAccess, logout
} from './admin-client.js';
import { formatDate, stripStackEditData, sortMessages, slugify } from './textFormatter.js';

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
        const now = new Date();
        now.setHours(0,0,0,0);

        if (files.length === 0) {
            inner.innerHTML = `<div class="text-center py-12 text-slate-400 italic">Ingen meldinger funnet.</div>`;
        } else {
            const messages = await Promise.all(files.map(async (f) => {
                const raw = await getFileContent(f.id);
                const { data } = parseMarkdown(raw);
                return { ...f, ...data };
            }));

            const sortedMessages = sortMessages(messages);
            let html = `<div class="grid grid-cols-1 gap-4 max-w-5xl">`;

            sortedMessages.forEach((msg) => {
                const start = new Date(msg.startDate);
                const end = new Date(msg.endDate);
                let statusClass = "bg-slate-100 text-slate-500 border-slate-200";
                let statusText = "Utløpt";
                let dotClass = "admin-status-dot-expired";

                if (now >= start && now <= end) {
                    statusClass = "bg-green-100 text-green-700 border-green-200 ring-4 ring-green-500/5 font-black";
                    statusText = "Aktiv nå";
                    dotClass = "admin-status-dot-active";
                } else if (now < start) {
                    statusClass = "bg-blue-100 text-blue-700 border-blue-200";
                    statusText = "Planlagt";
                    dotClass = "admin-status-dot-planned";
                }

                html += `
                    <div class="admin-card-interactive group flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div class="min-w-0 flex-grow">
                            <div class="flex items-center gap-3 mb-1.5">
                                <span class="admin-status-pill ${statusClass}">
                                    <span class="admin-status-dot ${dotClass}"></span>
                                    ${statusText}
                                </span>
                                <h3 class="font-bold text-brand truncate">${msg.title || msg.name}</h3>
                            </div>
                            <p class="text-xs text-slate-500 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                ${formatDate(start)} til ${formatDate(end)}
                            </p>
                        </div>
                        <div class="flex gap-2 shrink-0 w-full sm:w-auto">
                            <button data-id="${msg.id}" class="edit-btn flex-grow sm:flex-grow-0 admin-btn-secondary">Rediger</button>
                            <button data-id="${msg.id}" data-name="${msg.name}" class="delete-btn admin-btn-danger">Slett</button>
                        </div>
                    </div>`;
            });
            inner.innerHTML = html + `</div>`;

            // Event listeners for dynamiske knapper
            inner.querySelectorAll('.edit-btn').forEach(btn => {
                btn.onclick = () => onEdit(btn.dataset.id);
            });
            inner.querySelectorAll('.delete-btn').forEach(btn => {
                btn.onclick = () => onDelete(btn.dataset.id, btn.dataset.name);
            });
        }
        document.getElementById('btn-new-melding').onclick = () => onEdit(null);
    } catch (e) { 
        console.error("Load failed", e);
        inner.innerHTML = `<div class="text-red-500 p-4 bg-red-50 rounded-2xl font-bold">❌ Kunne ikke laste meldinger.</div>`; 
    }
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
            toolbar: ["bold", "italic", "heading", "|", "quote", "unordered-list", "ordered-list", "|", "link", "image", "|", "preview", "side-by-side", "fullscreen", "|", "guide"]
        });
    }

    // Initialiser Flatpickr
    const flatpickrGlobal = window['flatpickr'];
    if (typeof flatpickrGlobal !== 'undefined') {
        const fpConfig = {
            locale: (flatpickrGlobal.l10ns && flatpickrGlobal.l10ns.no) ? flatpickrGlobal.l10ns.no : "no",
            dateFormat: "Y-m-d",
            altInput: true,
            altFormat: "d.m.Y",
            allowInput: true,
            onChange: onDateChange
        };
        flatpickrGlobal("#edit-start", fpConfig);
        flatpickrGlobal("#edit-end", fpConfig);
    }

    const saveBtn = document.getElementById('btn-save-melding');
    if (saveBtn) {
        saveBtn.onclick = () => onSave(easyMDE);
    }

    return easyMDE;
}
