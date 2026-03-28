import {
    initGapi, initGis, login, logout, tryRestoreSession,
    silentLogin, getStoredUser, setRememberMe
} from './admin-client.js';
import { showConfirm } from './admin-dialog.js';
import { initPwaPrompt, showInstallPromptIfEligible } from './pwa-prompt.js';
import { updateUIWithUser, enforceAccessControl, loadDashboardCounts, showState } from './admin-dashboard.js';
import { getAdminConfig } from './admin-editor-helpers.js';
import { loadSettingsModule } from './admin-module-settings.js';
import { initTjenesterModule, reloadTjenester } from './admin-module-tjenester.js';
import { initMeldingerModule, reloadMeldinger } from './admin-module-meldinger.js';
import { initTannlegerModule, reloadTannleger } from './admin-module-tannleger.js';
import { loadBilderModule } from './admin-module-bilder.js';
import { initPrislisteModule, reloadPrisliste } from './admin-module-prisliste.js';
import { initKontaktSkjemaModule, reloadKontaktSkjema } from './admin-module-kontaktskjema.js';

function openModule(id, title) {
    window.scrollTo(0, 0);
    document.getElementById('dashboard')?.classList.add('hidden');
    const moduleContainer = document.getElementById('module-container');
    moduleContainer?.classList.remove('hidden');
    moduleContainer?.classList.add('admin-view-enter');
    const titleEl = document.getElementById('module-title');
    if (titleEl) titleEl.textContent = title;
    const actionsEl = document.getElementById('module-actions');
    if (actionsEl) actionsEl.innerHTML = '';
    const breadcrumbModule = document.getElementById('breadcrumb-module');
    if (breadcrumbModule) breadcrumbModule.textContent = title;
    const breadcrumbCount = document.getElementById('breadcrumb-count');
    if (breadcrumbCount) { breadcrumbCount.textContent = ''; breadcrumbCount.classList.remove('visible'); }
    clearBreadcrumbEditor();

    if (id === 'settings') loadSettingsModule();
    else if (id === 'meldinger') reloadMeldinger();
    else if (id === 'tjenester') reloadTjenester();
    else if (id === 'tannleger') reloadTannleger();
    else if (id === 'bilder') loadBilderModule();
    else if (id === 'prisliste') reloadPrisliste();
    else if (id === 'kontaktskjema') reloadKontaktSkjema();
    else {
        const inner = document.getElementById('module-inner');
        if (inner) inner.innerHTML = `<p class="text-admin-muted italic">Denne modulen er under utvikling.</p>`;
    }
}

function setBreadcrumbEditor(label, onBackToList) {
    const sep = document.getElementById('breadcrumb-editor-sep');
    const editorEl = document.getElementById('breadcrumb-editor');
    const moduleBtn = document.getElementById('breadcrumb-module');
    if (sep) { sep.classList.remove('hidden'); }
    if (editorEl) { editorEl.textContent = label; editorEl.classList.remove('hidden'); }
    if (moduleBtn) {
        moduleBtn.dataset.clickable = 'true';
        moduleBtn._onBackToList = onBackToList;
        moduleBtn.onclick = () => { if (moduleBtn._onBackToList) moduleBtn._onBackToList(); };
    }
}

function clearBreadcrumbEditor() {
    const sep = document.getElementById('breadcrumb-editor-sep');
    const editorEl = document.getElementById('breadcrumb-editor');
    const moduleBtn = document.getElementById('breadcrumb-module');
    if (sep) sep.classList.add('hidden');
    if (editorEl) { editorEl.textContent = ''; editorEl.classList.add('hidden'); }
    if (moduleBtn) {
        delete moduleBtn.dataset.clickable;
        moduleBtn.onclick = null;
        delete moduleBtn._onBackToList;
    }
}

function closeModule() {
    window.scrollTo(0, 0);
    document.getElementById('module-container')?.classList.add('hidden');
    const dashboard = document.getElementById('dashboard');
    dashboard?.classList.remove('hidden');
    dashboard?.classList.add('admin-view-enter');
}

async function handleAuth(userInfo = null) {
    const { SHEET_ID, TJENESTER_FOLDER, MELDINGER_FOLDER, TANNLEGER_FOLDER, BILDER_FOLDER } = getAdminConfig();
    const user = userInfo || getStoredUser();
    if (!user) return;

    const dashboardVisible = !document.getElementById('dashboard')?.classList.contains('hidden');
    if (!dashboardVisible) showState('loading');

    try {
        const result = await enforceAccessControl({
            SHEET_ID, TJENESTER_FOLDER, MELDINGER_FOLDER, TANNLEGER_FOLDER, BILDER_FOLDER
        });
        if (result === false) {
            const emailEl = document.getElementById('no-access-email');
            if (emailEl) emailEl.textContent = user.email || user.name || '';
            showState('no-access');
        } else {
            showState('dashboard');
            window.scrollTo(0, 0);
            updateUIWithUser(user);
            loadDashboardCounts({ SHEET_ID, TJENESTER_FOLDER, MELDINGER_FOLDER });
            showInstallPromptIfEligible();
        }
    } catch (err) {
        console.error("[Admin] Feil under tilgangskontroll:", err);
        showState('no-access');
    }
}

const setup = async () => {
    try {
        // Register window globals for HTML onclick handlers
        window.setBreadcrumbEditor = setBreadcrumbEditor;
        window.clearBreadcrumbEditor = clearBreadcrumbEditor;
        initTjenesterModule();
        initMeldingerModule();
        initTannlegerModule();
        initPrislisteModule();
        initKontaktSkjemaModule();

        initPwaPrompt();

        const hadRememberMe = !!localStorage.getItem('admin_google_token');

        const gapiSuccess = await initGapi();
        if (gapiSuccess) tryRestoreSession();

        initGis(handleAuth);
        const user = getStoredUser();
        if (user) {
            await handleAuth(user);
        } else if (hadRememberMe) {
            // Token fantes i localStorage men er utløpt → prøv stille fornyelse
            setRememberMe(true);
            showState('loading');
            window.addEventListener('admin-auth-failed', () => showState('login'), { once: true });
            silentLogin();
        } else {
            showState('login');
        }

        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) loginBtn.onclick = () => {
            setRememberMe(document.getElementById('remember-me')?.checked ?? false);
            login();
        };

        const userPill = document.getElementById('user-pill');
        if (userPill) userPill.onclick = async () => { if (await showConfirm("Logge ut?")) { logout(); location.reload(); } };

        document.getElementById('no-access-switch-btn')?.addEventListener('click', () => {
            logout();
            login();
        });

        document.getElementById('back-to-dashboard')?.addEventListener('click', () => closeModule());

        const cardModules = [
            ['card-settings',  'settings',  'Rutinesjekken'],
            ['card-tjenester', 'tjenester', 'Finpussen'],
            ['card-meldinger', 'meldinger', 'Oppslagstavla'],
            ['card-tannleger', 'tannleger', 'Tannlegekrakken'],
            ['card-bilder',    'bilder',    'Røntgenbildene'],
            ['card-prisliste', 'prisliste', 'Takstlista'],
            ['card-kontaktskjema', 'kontaktskjema', 'Kontaktskjemaet'],
        ];
        for (const [cardId, moduleId, title] of cardModules) {
            const card = document.getElementById(cardId);
            card?.addEventListener('click', () => openModule(moduleId, title));
            card?.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openModule(moduleId, title);
                }
            });
        }
    } catch (err) { console.error("[Admin] Kritisk feil under oppstart:", err); }
};
if (document.readyState === 'complete') setup();
else window.addEventListener('load', setup);
