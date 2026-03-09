import { getSettingsWithNotes, updateSettingByKey, updateSettingOrder } from './admin-client.js';
import { withRetry } from './admin-api-retry.js';
import {
    mergeSettingsWithDefaults, autoResizeTextarea, saveSingleSetting,
    reorderSettingItem, formatTimestamp, updateLastFetchedTime, updateBreadcrumbCount,
    handleModuleError
} from './admin-dashboard.js';
import { getAdminConfig, getRefreshAuth, escapeHtml } from './admin-editor-helpers.js';

const SETTING_HINTS = {
    // Forside (hero)
    velkomstTittel1: 'Forsiden — hero-tittel, linje 1',
    velkomstTittel2: 'Forsiden — hero-tittel, linje 2 (farget)',
    velkomstTekst: 'Forsiden — hero-avsnitt under tittel',
    // Kontakt
    phone1: 'Kontakt, footer, mobilknapp, schema.org',
    phone2: 'Kontakt, footer',
    email: 'Kontakt, footer (kun synlig hvis showEmail = ja)',
    showEmail: 'Styrer om e-post vises i kontakt og footer',
    adresse1: 'Kontakt, footer',
    adresse2: 'Kontakt, footer',
    businessHours1: 'Kontakt, footer — format: «Dag(er): HH:MM - HH:MM»',
    businessHours2: 'Kontakt, footer — format: «Dag(er): HH:MM - HH:MM»',
    businessHours3: 'Kontakt, footer — format: «Dag(er): HH:MM - HH:MM»',
    businessHours4: 'Kontakt, footer — format: «Dag(er): HH:MM - HH:MM»',
    businessHours5: 'Kontakt, footer — format: «Dag(er): HH:MM - HH:MM»',
    sentralbordTekst: 'Kontakt — under telefonkort',
    latitude: 'Kontakt — Google Maps-kart',
    longitude: 'Kontakt — Google Maps-kart',
    // Seksjonstitler (navbar + seksjon)
    kontaktTittel: 'Navbar + kontakt-seksjon (overskrift)',
    galleriTittel: 'Navbar + galleri-seksjon (overskrift)',
    tjenesterTittel: 'Navbar + tjenester-seksjon (overskrift)',
    tannlegerTittel: 'Navbar + tannleger-seksjon (overskrift)',
    // Seksjonstekster
    kontaktTekst: 'Kontakt-seksjon — intro-avsnitt',
    galleriTekst: 'Galleri-seksjon — intro-avsnitt',
    tjenesteTekst: 'Tjenester-seksjon — intro-avsnitt',
    tannlegerTekst: 'Tannleger-seksjon — intro-avsnitt',
    // SEO
    siteTitle: 'Nettleserens tittellinje (fallback alle sider)',
    siteDescription: 'Meta-beskrivelse (fallback alle sider)',
    kontaktBeskrivelse: '/kontakt — meta-beskrivelse (SEO)',
    galleriBeskrivelse: '/galleri — meta-beskrivelse (SEO)',
    tjenesterBeskrivelse: '/tjenester — meta-beskrivelse (SEO)',
    tannlegerBeskrivelse: '/tannleger — meta-beskrivelse (SEO)',
};

let settingsReorderMode = false;

function renderSkeletonSettings(count = 4) {
    const field = `
        <div class="admin-field-container">
            <div class="admin-skeleton-text w-1/4"></div>
            <div class="admin-skeleton w-full rounded-xl mt-2" style="height:2.5rem"></div>
        </div>`;
    return `<div class="space-y-4 max-w-4xl" aria-hidden="true">${Array(count).fill(field).join('')}</div>`;
}

export async function loadSettingsModule() {
    const { SHEET_ID, HARD_DEFAULTS } = getAdminConfig();
    const inner = document.getElementById('module-inner');
    if (!inner) return;
    inner.innerHTML = renderSkeletonSettings();
    try {
        const sheetSettings = await withRetry(() => getSettingsWithNotes(SHEET_ID), { refreshAuth: getRefreshAuth() });
        const allSettings = mergeSettingsWithDefaults(sheetSettings, HARD_DEFAULTS);
        updateBreadcrumbCount(allSettings.length);

        // Skriv manglende nøkler til Google Sheets med en gang
        const virtualSettings = allSettings.filter(s => s.isVirtual);
        if (virtualSettings.length > 0) {
            await Promise.all(virtualSettings.map(s =>
                updateSettingByKey(SHEET_ID, s.id, s.value)
                    .then(() => { s.isVirtual = false; })
                    .catch(err => console.warn(`Kunne ikke skrive ${s.id} til arket:`, err))
            ));
        }

        // Migrer order-verdier for rader som mangler kolonne D
        const needsOrderMigration = sheetSettings.filter(s => s._orderMissing);
        if (needsOrderMigration.length > 0) {
            await Promise.all(needsOrderMigration.map(s =>
                updateSettingOrder(SHEET_ID, s.row, s.order)
                    .then(() => { s._orderMissing = false; })
                    .catch(err => console.warn(`Kunne ikke migrere order for ${s.id}:`, err))
            ));
        }

        // Sorter etter order
        allSettings.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

        const fetchedAt = formatTimestamp(new Date());
        let html = `<div class="space-y-4 max-w-4xl">`;
        html += `<div class="flex items-center justify-between">`;
        html += `<p class="text-xs text-admin-muted-light">Sist hentet: <span id="settings-last-fetched">${fetchedAt}</span></p>`;
        html += `<button id="settings-reorder-toggle" class="text-xs px-3 py-1 rounded border border-admin-border hover:bg-admin-hover transition-colors ${settingsReorderMode ? 'bg-admin-hover font-bold' : ''}" type="button">Endre rekkefølge</button>`;
        html += `</div>`;
        allSettings.forEach((setting, i) => {
            const label = setting.description || setting.id;
            const isLong = (setting.value && setting.value.length > 60) || setting.id.toLowerCase().includes('tekst');
            const hint = SETTING_HINTS[setting.id] || '';
            const isFirst = i === 0;
            const isLast = i === allSettings.length - 1;
            html += `
                <div class="admin-field-container ${settingsReorderMode ? '' : 'cursor-pointer'}" id="setting-container-${i}">
                    <div class="flex justify-between items-start gap-4">
                        <div class="flex items-center gap-2">
                            ${settingsReorderMode ? `
                            <div class="flex flex-col gap-1">
                                <button data-idx="${i}" data-dir="-1" class="settings-reorder-btn admin-icon-btn-reorder ${isFirst ? 'invisible' : ''}" title="Flytt opp">
                                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                                </button>
                                <button data-idx="${i}" data-dir="1" class="settings-reorder-btn admin-icon-btn-reorder ${isLast ? 'invisible' : ''}" title="Flytt ned">
                                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                </button>
                            </div>` : ''}
                            <label class="admin-label !mb-0 ${settingsReorderMode ? '' : 'cursor-pointer'}">${escapeHtml(label)}</label>
                        </div>
                        <div id="status-${i}" class="shrink-0 h-5"></div>
                    </div>
                    ${hint ? `<p class="text-xs text-admin-muted-light -mt-0.5">${settingsReorderMode ? '' : 'Vises på: '}${hint}</p>` : ''}
                    ${settingsReorderMode ? '' : (isLong ?
                        `<textarea id="setting-input-${i}" data-index="${i}" class="setting-field admin-input resize-none overflow-hidden"></textarea>` :
                        `<input type="text" id="setting-input-${i}" data-index="${i}" value="" class="setting-field admin-input">`
                    )}
                </div>`;
        });
        inner.innerHTML = html + `</div>`;

        // Sett form-verdier programmatisk (sikkert — ingen HTML-parsing)
        if (!settingsReorderMode) {
            allSettings.forEach((setting, i) => {
                const el = document.getElementById(`setting-input-${i}`);
                if (el) el.value = setting.value;
            });
        }

        // Toggle reorder-modus
        document.getElementById('settings-reorder-toggle')?.addEventListener('click', () => {
            settingsReorderMode = !settingsReorderMode;
            loadSettingsModule();
        });

        if (settingsReorderMode) {
            inner.querySelectorAll('.settings-reorder-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const idx = parseInt(btn.dataset.idx);
                    const dir = parseInt(btn.dataset.dir);
                    const ok = await reorderSettingItem(SHEET_ID, allSettings, idx, dir);
                    if (ok) {
                        updateLastFetchedTime(new Date());
                        loadSettingsModule();
                    }
                });
            });
        } else {
            document.querySelectorAll('.setting-field').forEach(input => {
                if (input.tagName === 'TEXTAREA') {
                    autoResizeTextarea(input);
                    input.addEventListener('input', (e) => autoResizeTextarea(e.target));
                }
                input.addEventListener('blur', (e) => saveSingleSetting(parseInt(e.target.dataset.index), e.target, allSettings, SHEET_ID, loadSettingsModule));
            });
            allSettings.forEach((_, i) => {
                document.getElementById(`setting-container-${i}`)?.addEventListener('click', () => {
                    document.getElementById(`setting-input-${i}`)?.focus();
                });
            });
        }
    } catch (e) {
        console.error("Settings load failed", e);
        handleModuleError(e, 'innstillinger', inner, () => loadSettingsModule());
    }
}
