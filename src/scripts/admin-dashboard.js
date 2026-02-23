// src/scripts/admin-dashboard.js
import {
    listFiles, getFileContent, saveFile, createFile, deleteFile,
    parseMarkdown, stringifyMarkdown, updateSettings, getSettingsWithNotes,
    checkMultipleAccess, logout, getTannlegerRaw, updateTannlegeRow,
    addTannlegeRow, getGalleriRaw, updateGalleriRow, findFileByName, getDriveImageBlob,
    updateSettingByKey, silentLogin
} from './admin-client.js';
import { withRetry, createAuthRefresher } from './admin-api-retry.js';
import { formatDate, sortMessages } from './textFormatter.js';
import DOMPurify from 'dompurify';

let _refreshAuth = null;
function getRefreshAuth() {
    if (!_refreshAuth) _refreshAuth = createAuthRefresher(silentLogin);
    return _refreshAuth;
}

/**
 * Slår sammen innstillinger fra Google Sheets med HARD_DEFAULTS.
 * Nøkler som finnes i defaults men ikke i sheetSettings legges til med isVirtual: true.
 */
export function mergeSettingsWithDefaults(sheetSettings, defaults) {
    const existingKeys = new Set(sheetSettings.map(s => s.id));
    const virtualSettings = Object.entries(defaults)
        .filter(([key]) => !existingKeys.has(key))
        .map(([key, value]) => ({ id: key, value, description: '', isVirtual: true }));
    return [...sheetSettings, ...virtualSettings];
}

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
        { id: 'settings', resource: config.SHEET_ID, card: 'card-settings' },
        { id: 'tjenester', resource: config.TJENESTER_FOLDER, card: 'card-tjenester' },
        { id: 'meldinger', resource: config.MELDINGER_FOLDER, card: 'card-meldinger' },
        { id: 'tannleger', resources: [config.TANNLEGER_FOLDER, config.SHEET_ID], card: 'card-tannleger' },
        { id: 'bilder', resource: config.SHEET_ID, card: 'card-bilder' }
    ];

    let hasAnyAccess = false;

    modules.forEach(mod => {
        const hasAccess = mod.resources
            ? mod.resources.every(res => accessMap[res])
            : accessMap[mod.resource];

        const card = document.getElementById(mod.card);

        if (hasAccess) {
            hasAnyAccess = true;
            if (card) {
                card.style.display = 'flex';
                card.style.opacity = '1';
            }
        } else {
            if (card) {
                card.style.display = 'none';
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
    const pill = document.getElementById('user-pill');
    const info = document.getElementById('nav-user-info');

    if (loginContainer) loginContainer.classList.add('hidden');
    if (dashboard) dashboard.classList.remove('hidden');
    
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
 * Formaterer en Date til norsk kort-format: "22. feb kl. 14:32"
 */
export function formatTimestamp(date) {
    const months = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];
    const d = date.getDate();
    const m = months[date.getMonth()];
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${d}. ${m} kl. ${h}:${min}`;
}

/**
 * Oppdaterer "Sist hentet"-tidspunkt i modul-headeren
 */
export function updateLastFetchedTime(date) {
    const el = document.getElementById('settings-last-fetched');
    if (el) el.textContent = formatTimestamp(date);
}

/**
 * Lagrer en enkelt innstilling med stille verifisering mot Google Sheets
 */
export async function saveSingleSetting(index, inputEl, currentSettings, sheetId, onReload) {
    const statusEl = document.getElementById(`status-${index}`);
    if (!statusEl) return;

    const originalValue = currentSettings[index].value;
    const newValue = inputEl.value;
    if (newValue === originalValue) return;

    statusEl.innerHTML = '<svg class="animate-spin h-4 w-4 text-slate-400" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';

    try {
        const setting = currentSettings[index];
        if (setting.isVirtual) {
            await withRetry(() => updateSettingByKey(sheetId, setting.id, newValue), { refreshAuth: getRefreshAuth() });
            setting.isVirtual = false;
        } else {
            const sheetOnly = currentSettings.filter(s => !s.isVirtual);
            const sheetIndex = sheetOnly.indexOf(setting);
            const updatedList = [...sheetOnly];
            updatedList[sheetIndex] = { ...setting, value: newValue };
            await withRetry(() => updateSettings(sheetId, updatedList), { refreshAuth: getRefreshAuth() });
        }
        currentSettings[index].value = newValue;

        // Stille verifisering: hent tilbake fra Sheets og sammenlign
        const savedTime = new Date();
        try {
            const freshSettings = await getSettingsWithNotes(sheetId);
            updateLastFetchedTime(new Date());
            const freshSetting = freshSettings.find(s => s.id === setting.id);
            if (freshSetting && freshSetting.value !== newValue) {
                console.warn(`[Admin] Mismatch etter lagring av "${setting.id}": forventet "${newValue}", fikk "${freshSetting.value}"`);
                statusEl.innerHTML = '<span class="text-amber-600 text-[10px] font-bold">⚠️ Laster på nytt…</span>';
                if (onReload) onReload();
                return;
            }
        } catch (verifyErr) {
            console.warn("[Admin] Verifisering feilet, men lagring gikk OK:", verifyErr);
        }

        const ts = formatTimestamp(savedTime);
        statusEl.innerHTML = `<span class="text-green-600 text-[10px] font-bold" title="Publiseres automatisk om noen minutter">✅ ${ts}</span>`;
        setTimeout(() => { if (statusEl) statusEl.innerHTML = ''; }, 5000);
    } catch (e) {
        console.error("Save failed", e);
        if (statusEl) statusEl.innerHTML = '<span class="text-red-500 text-[10px] font-bold">❌ Lagring feilet</span>';
    }
}

/**
 * Henter og viser meldinger-listen
 */
export async function loadMeldingerModule(folderId, onEdit, onDelete) {
    const inner = document.getElementById('module-inner');
    const actions = document.getElementById('module-actions');
    if (!inner || !actions) return;

    actions.innerHTML = `<button id="btn-new-melding" class="btn-primary text-xs py-2 px-4 shadow-md">➕ Heng opp nytt oppslag</button>`;
    inner.innerHTML = '<div class="text-slate-500 italic text-sm animate-pulse">Henter oppslag...</div>';

    try {
        const files = await withRetry(() => listFiles(folderId), { refreshAuth: getRefreshAuth() });
        const today = new Date();
        const nowUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());

        if (files.length === 0) {
            inner.innerHTML = `<div class="text-center py-12 text-slate-400 italic">Ingen oppslag funnet.</div>`;
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
                        statusClass = "bg-green-100 text-green-700 border-green-200 font-black";
                        statusText = "Aktiv nå";
                        dotClass = "admin-status-dot-active";
                        currentGroup = "Aktive oppslag";
                    } else if (nowUTC < startTime) {
                        statusClass = "bg-blue-100 text-blue-700 border-blue-200";
                        statusText = "Planlagt";
                        dotClass = "admin-status-dot-planned";
                        currentGroup = "Planlagte oppslag";
                    }
                }

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

                const hasOverlap = endTime >= nowUTC && activeOrPlanned.some(other => 
                    other.driveId !== msg.driveId && 
                    startTime <= other.end && 
                    endTime >= other.start
                );

                html += `
                    <div class="admin-card-interactive group flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${hasOverlap ? 'border-amber-300 bg-amber-50/30' : ''}" onclick="this.querySelector('.edit-btn').click()">
                        <div class="min-w-0 flex-grow w-full">
                            <div class="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-3 mb-1.5">
                                <span class="admin-status-pill ${statusClass} shrink-0">
                                    <span class="admin-status-dot ${dotClass}"></span>
                                    ${statusText}
                                </span>
                                <h3 class="font-bold text-brand sm:truncate sm:min-w-0">${msg.title || msg.name}</h3>
                            </div>
                            <p class="text-xs text-slate-500 flex items-center gap-2">
                                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                ${formatDate(msg.startDate)} til ${formatDate(msg.endDate || 'Uendelig')}
                            </p>
                        </div>
                        <div class="flex gap-2 shrink-0" onclick="event.stopPropagation()">
                            <button data-id="${msg.driveId}" data-name="${msg.name}" class="edit-btn p-2.5 rounded-xl bg-brand-light/30 text-brand hover:bg-brand hover:text-white transition-all group/btn" title="Rediger">
                                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                            <button data-id="${msg.driveId}" data-name="${msg.name}" class="delete-btn p-2.5 rounded-xl bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all group/btn" title="Slett">
                                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                            </button>
                        </div>
                    </div>`;
            });
            inner.innerHTML = DOMPurify.sanitize(html + `</div>`);

            inner.querySelectorAll('.edit-btn').forEach(btn => {
                btn.onclick = () => onEdit(btn.dataset.id, btn.dataset.name);
            });
            inner.querySelectorAll('.delete-btn').forEach(btn => {
                btn.onclick = () => onDelete(btn.dataset.id, btn.dataset.name);
            });
            // DOMPurify strips onclick attributes – re-attach card click delegation
            inner.querySelectorAll('.edit-btn, .delete-btn').forEach(btn => {
                btn.addEventListener('click', (e) => e.stopPropagation());
            });
            inner.querySelectorAll('.admin-card-interactive').forEach(card => {
                card.onclick = () => card.querySelector('.edit-btn')?.click();
            });
        }
        document.getElementById('btn-new-melding').onclick = () => onEdit(null, null);
    } catch (e) {
        console.error("Load failed", e);
        inner.innerHTML = `<div class="admin-alert-error">❌ Kunne ikke laste oppslag.</div>
            <button class="retry-btn btn-primary text-xs py-2 px-4 mt-3">Prøv igjen</button>`;
        inner.querySelector('.retry-btn')?.addEventListener('click', () => {
            loadMeldingerModule(folderId, onEdit, onDelete);
        });
    }
}

/**
 * Henter og viser tjenester-listen
 */
export async function loadTjenesterModule(folderId, onEdit, onDelete, onToggleActive) {
    const inner = document.getElementById('module-inner');
    const actions = document.getElementById('module-actions');
    if (!inner || !actions) return;

    actions.innerHTML = `<button id="btn-new-tjeneste" class="btn-primary text-xs py-2 px-4 shadow-md">➕ Legg til behandling</button>`;
    inner.innerHTML = '<div class="text-slate-500 italic text-sm animate-pulse">Henter behandlinger...</div>';

    try {
        const files = await withRetry(() => listFiles(folderId), { refreshAuth: getRefreshAuth() });
        if (files.length === 0) {
            inner.innerHTML = `<div class="text-center py-12 text-slate-400 italic">Ingen behandlinger funnet.</div>`;
        } else {
            const services = await Promise.all(files.map(async (f) => {
                const raw = await getFileContent(f.id);
                const { data } = parseMarkdown(raw);
                return { ...f, driveId: f.id, ...data };
            }));

            services.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'nb'));

            let html = `<div class="grid grid-cols-1 gap-4 max-w-5xl">`;
            services.forEach((s) => {
                const isActive = s.active !== 'false' && s.active !== false;
                const toggleTrackClass = isActive ? "bg-green-500" : "bg-slate-300";
                const toggleDotTransform = isActive ? "translate-x-5" : "translate-x-0";
                const toggleLabel = isActive ? "Aktiv" : "Inaktiv";
                const toggleLabelClass = isActive ? "text-green-700" : "text-slate-500";

                html += `
                    <div class="admin-card-interactive group flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${!isActive ? 'opacity-60' : ''}" onclick="this.querySelector('.edit-btn').click()">
                        <div class="min-w-0 flex-grow">
                            <div class="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-3 mb-1">
                                <button data-id="${s.driveId}" class="toggle-active-btn flex items-center gap-1.5 shrink-0 cursor-pointer group/toggle" title="Klikk for å endre synlighet" type="button">
                                    <span class="toggle-track relative inline-flex h-5 w-10 items-center rounded-full transition-colors duration-200 ${toggleTrackClass}">
                                        <span class="toggle-dot inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ml-0.5 ${toggleDotTransform}"></span>
                                    </span>
                                    <span class="toggle-label text-[10px] font-semibold ${toggleLabelClass}">${toggleLabel}</span>
                                </button>
                                <h3 class="font-bold text-brand sm:truncate sm:min-w-0">${s.title || s.name}</h3>
                            </div>
                            <p class="text-xs text-slate-500 mt-1 line-clamp-1">${s.ingress || ''}</p>
                        </div>
                        <div class="flex gap-2 shrink-0" onclick="event.stopPropagation()">
                            <button data-id="${s.driveId}" data-name="${s.name}" class="edit-btn p-2.5 rounded-xl bg-brand-light/30 text-brand hover:bg-brand hover:text-white transition-all group/btn" title="Rediger">
                                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                            <button data-id="${s.driveId}" data-name="${s.name}" class="delete-btn p-2.5 rounded-xl bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all group/btn" title="Slett">
                                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                            </button>
                        </div>
                    </div>`;
            });
            inner.innerHTML = DOMPurify.sanitize(html + `</div>`);

            inner.querySelectorAll('.edit-btn').forEach(btn => {
                btn.onclick = () => onEdit(btn.dataset.id, btn.dataset.name);
            });
            inner.querySelectorAll('.delete-btn').forEach(btn => {
                btn.onclick = () => onDelete(btn.dataset.id, btn.dataset.name);
            });
            inner.querySelectorAll('.toggle-active-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const driveId = btn.dataset.id;
                    const s = services.find(svc => svc.driveId === driveId);
                    if (s && onToggleActive) onToggleActive(driveId, s.name, s);
                };
            });
            // DOMPurify strips onclick attributes – re-attach card click delegation
            inner.querySelectorAll('.edit-btn, .delete-btn, .toggle-active-btn').forEach(btn => {
                btn.addEventListener('click', (e) => e.stopPropagation());
            });
            inner.querySelectorAll('.admin-card-interactive').forEach(card => {
                card.onclick = () => card.querySelector('.edit-btn')?.click();
            });
        }
        document.getElementById('btn-new-tjeneste').onclick = () => onEdit(null, null);
    } catch (e) {
        console.error("Load failed", e);
        inner.innerHTML = `<div class="admin-alert-error">❌ Kunne ikke laste behandlinger.</div>
            <button class="retry-btn btn-primary text-xs py-2 px-4 mt-3">Prøv igjen</button>`;
        inner.querySelector('.retry-btn')?.addEventListener('click', () => {
            loadTjenesterModule(folderId, onEdit, onDelete, onToggleActive);
        });
    }
}

/**
 * Henter og viser tannleger-listen fra Sheets
 */
export async function loadTannlegerModule(sheetId, onEdit, onDelete, parentFolderId, onToggleActive) {
    const inner = document.getElementById('module-inner');
    const actions = document.getElementById('module-actions');
    if (!inner || !actions) return;

    actions.innerHTML = `<button id="btn-new-tannlege" class="btn-primary text-xs py-2 px-4 shadow-md">➕ Legg til team-medlem</button>`;
    inner.innerHTML = '<div class="text-slate-500 italic text-sm animate-pulse">Henter teamet...</div>';

    try {
        const dentists = await withRetry(() => getTannlegerRaw(sheetId), { refreshAuth: getRefreshAuth() });

        if (dentists.length === 0) {
            inner.innerHTML = `<div class="text-center py-12 text-slate-400 italic">Ingen team-medlemmer funnet.</div>`;
        } else {
            dentists.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'nb'));

            let html = `<p class="text-xs text-slate-400 mb-3">Sist hentet: <span id="tannleger-last-fetched">${formatTimestamp(new Date())}</span></p>`;
            html += `<div class="grid grid-cols-1 gap-4 max-w-5xl">`;
            dentists.forEach((t) => {
                const toggleTrackClass = t.active ? "bg-green-500" : "bg-slate-300";
                const toggleDotTransform = t.active ? "translate-x-5" : "translate-x-0";
                const toggleLabel = t.active ? "Aktiv" : "Inaktiv";
                const toggleLabelClass = t.active ? "text-green-700" : "text-slate-500";

                html += `
                    <div class="admin-card-interactive group flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${!t.active ? 'opacity-60' : ''}" onclick="this.querySelector('.edit-tannlege-btn').click()">
                        <div class="flex items-center gap-3 flex-grow min-w-0 w-full">
                            <div class="shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center" data-thumb-row="${t.rowIndex}">
                                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-slate-300"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                            </div>
                            <div class="min-w-0 flex-grow">
                                <div class="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-3 mb-1">
                                    <button data-row="${t.rowIndex}" class="toggle-active-btn flex items-center gap-1.5 shrink-0 cursor-pointer group/toggle" title="Klikk for å endre synlighet" type="button">
                                        <span class="toggle-track relative inline-flex h-5 w-10 items-center rounded-full transition-colors duration-200 ${toggleTrackClass}">
                                            <span class="toggle-dot inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ml-0.5 ${toggleDotTransform}"></span>
                                        </span>
                                        <span class="toggle-label text-[10px] font-semibold ${toggleLabelClass}">${toggleLabel}</span>
                                    </button>
                                    <h3 class="font-bold text-brand sm:truncate sm:min-w-0">${t.name}</h3>
                                </div>
                                <p class="text-xs text-slate-500 line-clamp-1 italic">${t.title || 'Ingen tittel'}</p>
                            </div>
                        </div>
                        <div class="flex gap-2 shrink-0" onclick="event.stopPropagation()">
                            <button data-row="${t.rowIndex}" data-name="${t.name}" class="edit-tannlege-btn p-2.5 rounded-xl bg-brand-light/30 text-brand hover:bg-brand hover:text-white transition-all group/btn" title="Rediger">
                                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                            <button data-row="${t.rowIndex}" data-name="${t.name}" class="delete-tannlege-btn p-2.5 rounded-xl bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all group/btn" title="Slett">
                                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                            </button>
                        </div>
                    </div>`;
            });
            inner.innerHTML = DOMPurify.sanitize(html + `</div>`);

            inner.querySelectorAll('.edit-tannlege-btn').forEach(btn => {
                btn.onclick = () => onEdit(parseInt(btn.dataset.row), dentists.find(d => d.rowIndex === parseInt(btn.dataset.row)));
            });
            inner.querySelectorAll('.delete-tannlege-btn').forEach(btn => {
                btn.onclick = () => onDelete(parseInt(btn.dataset.row), btn.dataset.name);
            });
            inner.querySelectorAll('.toggle-active-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const row = parseInt(btn.dataset.row);
                    const t = dentists.find(d => d.rowIndex === row);
                    if (t && onToggleActive) onToggleActive(row, t);
                };
            });
            // DOMPurify strips onclick attributes – re-attach card click delegation
            inner.querySelectorAll('.edit-tannlege-btn, .delete-tannlege-btn, .toggle-active-btn').forEach(btn => {
                btn.addEventListener('click', (e) => e.stopPropagation());
            });
            inner.querySelectorAll('.admin-card-interactive').forEach(card => {
                card.onclick = () => card.querySelector('.edit-tannlege-btn')?.click();
            });

            // Asynkron lasting av thumbnails
            if (parentFolderId) {
                dentists.forEach(async (t) => {
                    if (!t.image) return;
                    const thumbContainer = inner.querySelector(`[data-thumb-row="${t.rowIndex}"]`);
                    if (!thumbContainer) return;
                    try {
                        const file = await findFileByName(t.image, parentFolderId);
                        if (file) {
                            const blobUrl = await getDriveImageBlob(file.id);
                            if (blobUrl) {
                                const pX = t.positionX ?? 50;
                                const pY = t.positionY ?? 50;
                                const sc = t.scale ?? 1.0;
                                thumbContainer.innerHTML = `<img src="${blobUrl}" class="w-full h-full object-cover" alt="" style="object-position:${pX}% ${pY}%;transform:scale(${sc});transform-origin:${pX}% ${pY}%">`;
                            }
                        }
                    } catch (_) { /* thumbnail er best-effort */ }
                });
            }
        }
        document.getElementById('btn-new-tannlege').onclick = () => onEdit(null, null);
    } catch (e) {
        console.error("Load failed", e);
        inner.innerHTML = `<div class="admin-alert-error">❌ Kunne ikke laste teamet.</div>
            <button class="retry-btn btn-primary text-xs py-2 px-4 mt-3">Prøv igjen</button>`;
        inner.querySelector('.retry-btn')?.addEventListener('click', () => {
            loadTannlegerModule(sheetId, onEdit, onDelete, parentFolderId, onToggleActive);
        });
    }
}

/**
 * Bytter rekkefølge (order) mellom to galleri-rader.
 * direction: -1 = opp, +1 = ned
 */
export async function reorderGalleriItem(sheetId, items, rowIndex, direction) {
    const currentIdx = items.findIndex(i => i.rowIndex === rowIndex);
    const neighborIdx = currentIdx + direction;
    if (neighborIdx < 0 || neighborIdx >= items.length) return false;

    const current = items[currentIdx];
    const neighbor = items[neighborIdx];

    const tmpOrder = current.order;
    current.order = neighbor.order;
    neighbor.order = tmpOrder;

    // Hvis begge har samme order, tving ulik
    if (current.order === neighbor.order) {
        current.order = currentIdx + direction;
        neighbor.order = currentIdx;
    }

    await Promise.all([
        withRetry(() => updateGalleriRow(sheetId, current.rowIndex, current), { refreshAuth: getRefreshAuth() }),
        withRetry(() => updateGalleriRow(sheetId, neighbor.rowIndex, neighbor), { refreshAuth: getRefreshAuth() })
    ]);
    return true;
}

/**
 * Henter og viser galleri-listen fra Sheets med thumbnails, badges og reorder-knapper.
 */
export async function loadGalleriListeModule(sheetId, onEdit, onDelete, onReorder, parentFolderId, onToggleActive) {
    const container = document.getElementById('galleri-liste-container');
    if (!container) return;

    container.innerHTML = '<div class="text-slate-500 italic text-sm animate-pulse">Henter galleribilder...</div>';

    try {
        const images = await withRetry(() => getGalleriRaw(sheetId), { refreshAuth: getRefreshAuth() });

        if (images.length === 0) {
            container.innerHTML = `<div class="text-center py-8 text-slate-400 italic">Ingen galleribilder funnet.</div>`;
        } else {
            // Forsidebilde først, deretter sortert på order
            images.sort((a, b) => {
                if (a.type === 'forsidebilde' && b.type !== 'forsidebilde') return -1;
                if (a.type !== 'forsidebilde' && b.type === 'forsidebilde') return 1;
                return (a.order ?? 99) - (b.order ?? 99);
            });

            let html = `<p class="text-xs text-slate-400 mb-3">Sist hentet: <span id="galleri-last-fetched">${formatTimestamp(new Date())}</span></p>`;
            html += `<div class="grid grid-cols-1 gap-4">`;
            images.forEach((img, idx) => {
                const isForsidebilde = img.type === 'forsidebilde';
                const toggleTrackClass = img.active
                    ? "bg-green-500"
                    : "bg-slate-300";
                const toggleDotTransform = img.active
                    ? "translate-x-5"
                    : "translate-x-0";
                const toggleLabel = img.active ? "Aktiv" : "Inaktiv";
                const toggleLabelClass = img.active ? "text-green-700" : "text-slate-500";
                const badgeHtml = isForsidebilde
                    ? `<span class="admin-status-pill bg-amber-100 text-amber-700 border-amber-300 text-[8px] shrink-0 font-black">Forsidebilde</span>`
                    : '';
                const toggleHtml = isForsidebilde
                    ? ''
                    : `<button data-row="${img.rowIndex}" class="toggle-active-btn flex items-center gap-1.5 shrink-0 cursor-pointer group/toggle" title="Klikk for å endre synlighet" type="button">
                                        <span class="toggle-track relative inline-flex h-5 w-10 items-center rounded-full transition-colors duration-200 ${toggleTrackClass}">
                                            <span class="toggle-dot inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ml-0.5 ${toggleDotTransform}"></span>
                                        </span>
                                        <span class="toggle-label text-[10px] font-semibold ${toggleLabelClass}">${toggleLabel}</span>
                                    </button>`;
                const isFirst = idx === 0 || (idx === 1 && images[0].type === 'forsidebilde');
                const isLast = idx === images.length - 1;

                const thumbAspect = isForsidebilde ? 'aspect-[16/10]' : 'aspect-[4/3]';

                html += `
                    <div class="admin-card-interactive group flex flex-col sm:flex-row sm:items-center gap-3 ${!img.active ? 'opacity-60' : ''} ${isForsidebilde ? 'border-amber-200 bg-amber-50/30' : ''}">
                        <!-- Thumbnail + tekst -->
                        <div class="flex items-center gap-3 flex-grow min-w-0">
                            <div class="shrink-0 w-20 sm:w-24 ${thumbAspect} rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center" data-thumb-row="${img.rowIndex}">
                                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-slate-300"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                            </div>
                            <div class="min-w-0 flex-grow">
                                <div class="flex flex-wrap items-center gap-1 mb-1">
                                    ${badgeHtml}
                                    ${toggleHtml}
                                </div>
                                <h3 class="font-bold text-brand text-sm truncate">${img.title || img.image || 'Uten tittel'}</h3>
                                <p class="text-xs text-slate-500 truncate italic mt-0.5">${img.image || 'Ingen bilde'}</p>
                            </div>
                        </div>
                        <!-- Knapper: rekkefølge + rediger + slett -->
                        <div class="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                            <div class="flex flex-col gap-1">
                                <button data-row="${img.rowIndex}" data-dir="-1" class="reorder-btn p-1.5 rounded-lg bg-slate-100 text-slate-400 hover:bg-brand hover:text-white transition-all ${isFirst || isForsidebilde ? 'invisible' : ''}" title="Flytt opp">
                                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                                </button>
                                <button data-row="${img.rowIndex}" data-dir="1" class="reorder-btn p-1.5 rounded-lg bg-slate-100 text-slate-400 hover:bg-brand hover:text-white transition-all ${isLast || isForsidebilde ? 'invisible' : ''}" title="Flytt ned">
                                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                </button>
                            </div>
                            <button data-row="${img.rowIndex}" data-title="${img.title}" class="edit-galleri-btn p-2 sm:p-2.5 rounded-xl bg-brand-light/30 text-brand hover:bg-brand hover:text-white transition-all" title="Rediger">
                                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                            <button data-row="${img.rowIndex}" data-title="${img.title}" class="delete-galleri-btn p-2 sm:p-2.5 rounded-xl bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all" title="Slett">
                                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                            </button>
                        </div>
                    </div>`;
            });
            container.innerHTML = DOMPurify.sanitize(html + `</div>`);

            container.querySelectorAll('.edit-galleri-btn').forEach(btn => {
                btn.onclick = () => onEdit(parseInt(btn.dataset.row), images.find(i => i.rowIndex === parseInt(btn.dataset.row)));
            });
            container.querySelectorAll('.delete-galleri-btn').forEach(btn => {
                btn.onclick = () => onDelete(parseInt(btn.dataset.row), btn.dataset.title);
            });
            container.querySelectorAll('.reorder-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    if (onReorder) onReorder(parseInt(btn.dataset.row), parseInt(btn.dataset.dir));
                };
            });
            container.querySelectorAll('.toggle-active-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const row = parseInt(btn.dataset.row);
                    const img = images.find(i => i.rowIndex === row);
                    if (img && onToggleActive) onToggleActive(row, img);
                };
            });
            container.querySelectorAll('.edit-galleri-btn, .delete-galleri-btn, .reorder-btn, .toggle-active-btn').forEach(btn => {
                btn.addEventListener('click', (e) => e.stopPropagation());
            });
            container.querySelectorAll('.admin-card-interactive').forEach(card => {
                card.onclick = () => card.querySelector('.edit-galleri-btn')?.click();
            });

            // Asynkron lasting av thumbnails
            if (parentFolderId) {
                images.forEach(async (img) => {
                    if (!img.image) return;
                    const thumbContainer = container.querySelector(`[data-thumb-row="${img.rowIndex}"]`);
                    if (!thumbContainer) return;
                    try {
                        const file = await findFileByName(img.image, parentFolderId);
                        if (file) {
                            const blobUrl = await getDriveImageBlob(file.id);
                            if (blobUrl) {
                                const pX = img.positionX ?? 50;
                                const pY = img.positionY ?? 50;
                                const sc = img.scale ?? 1.0;
                                thumbContainer.innerHTML = `<img src="${blobUrl}" class="w-full h-full object-cover" alt="" style="object-position:${pX}% ${pY}%;transform:scale(${sc});transform-origin:${pX}% ${pY}%">`;
                            }
                        }
                    } catch (_) { /* thumbnail er best-effort */ }
                });
            }
        }
    } catch (e) {
        console.error("Load galleri failed", e);
        container.innerHTML = `<div class="admin-alert-error">❌ Kunne ikke laste galleribilder.</div>
            <button class="retry-btn btn-primary text-xs py-2 px-4 mt-3">Prøv igjen</button>`;
        container.querySelector('.retry-btn')?.addEventListener('click', () => {
            loadGalleriListeModule(sheetId, onEdit, onDelete, onReorder, parentFolderId, onToggleActive);
        });
    }
}
