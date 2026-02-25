import {
    initGapi, initGis, login, logout, tryRestoreSession,
    silentLogin, getStoredUser, setRememberMe
} from './admin-client.js';
import { showConfirm } from './admin-dialog.js';
import { initPwaPrompt, showInstallPromptIfEligible } from './pwa-prompt.js';
import { updateUIWithUser, enforceAccessControl, loadDashboardCounts } from './admin-dashboard.js';
import { getAdminConfig } from './admin-editor-helpers.js';
import { loadSettingsModule } from './admin-module-settings.js';
import { initTjenesterModule, reloadTjenester } from './admin-module-tjenester.js';
import { initMeldingerModule, reloadMeldinger } from './admin-module-meldinger.js';
import { initTannlegerModule, reloadTannleger } from './admin-module-tannleger.js';
import { loadBilderModule } from './admin-module-bilder.js';

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
    if (breadcrumbCount) { breadcrumbCount.textContent = ''; breadcrumbCount.classList.add('hidden'); }

    if (id === 'settings') loadSettingsModule();
    else if (id === 'meldinger') reloadMeldinger();
    else if (id === 'tjenester') reloadTjenester();
    else if (id === 'tannleger') reloadTannleger();
    else if (id === 'bilder') loadBilderModule();
    else {
        const inner = document.getElementById('module-inner');
        if (inner) inner.innerHTML = `<p class="text-admin-muted italic">Denne modulen er under utvikling.</p>`;
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
    const { SHEET_ID, TJENESTER_FOLDER, MELDINGER_FOLDER, TANNLEGER_FOLDER } = getAdminConfig();
    const user = userInfo || getStoredUser();
    if (user) {
        window.scrollTo(0, 0);
        updateUIWithUser(user);
        await enforceAccessControl({
            SHEET_ID,
            TJENESTER_FOLDER,
            MELDINGER_FOLDER,
            TANNLEGER_FOLDER
        });
        loadDashboardCounts({ SHEET_ID, TJENESTER_FOLDER, MELDINGER_FOLDER });
        showInstallPromptIfEligible();
    }
}

const setup = async () => {
    try {
        // Register window globals for HTML onclick handlers
        initTjenesterModule();
        initMeldingerModule();
        initTannlegerModule();

        initPwaPrompt();

        const gapiSuccess = await initGapi();
        if (gapiSuccess) tryRestoreSession();

        initGis(handleAuth);

        const hadRememberMe = !!localStorage.getItem('admin_google_token');
        const user = getStoredUser();
        if (user) {
            await handleAuth(user);
        } else if (hadRememberMe) {
            // Token fantes i localStorage men er utløpt → prøv stille fornyelse
            silentLogin();
        }
        // Ellers: vis innloggingsskjema, ingen automatisk forsøk

        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) loginBtn.onclick = () => {
            setRememberMe(document.getElementById('remember-me')?.checked ?? false);
            login();
        };

        const userPill = document.getElementById('user-pill');
        if (userPill) userPill.onclick = async () => { if (await showConfirm("Logge ut?")) { logout(); location.reload(); } };

        document.getElementById('back-to-dashboard')?.addEventListener('click', () => closeModule());

        const cardModules = [
            ['card-settings',  'settings',  'Innstillinger'],
            ['card-tjenester', 'tjenester', 'Tjenester'],
            ['card-meldinger', 'meldinger', 'Meldinger'],
            ['card-tannleger', 'tannleger', 'Tannleger'],
            ['card-bilder',    'bilder',    'Bilder'],
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
