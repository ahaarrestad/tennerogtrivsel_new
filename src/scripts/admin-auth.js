// src/scripts/admin-auth.js — Autentisering: token, GIS, login/logout, sesjonshåndtering

let tokenClient;
let gapiInited = false;
let gisInited = false;
let _rememberMe = false;

export function setRememberMe(val) {
    _rememberMe = !!val;
}

const SCOPES = 'openid profile email https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets';

/**
 * Henter brukerinfo fra Google
 */
async function fetchUserInfo(accessToken) {
    try {
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        return await response.json();
    } catch (err) {
        console.error("[Admin] Kunne ikke hente brukerinfo:", err);
        return null;
    }
}

/**
 * Initialiserer GAPI (Google API Client)
 */
export async function initGapi() {
    return new Promise((resolve) => {
        if (typeof gapi === 'undefined') {
            console.error("[GAPI] Script ikke lastet.");
            return resolve(false);
        }
        gapi.load('client', async () => {
            try {
                const apiKey = import.meta.env.PUBLIC_GOOGLE_API_KEY;

                // Initialiser basis-klienten uten discoveryDocs for å unngå 400-feil
                await gapi.client.init({ apiKey: apiKey });

                // Prøv å laste APIene manuelt, men ikke stopp hvis de feiler
                const loadApi = async (name, version) => {
                    try {
                        await gapi.client.load(name, version);
                        console.log(`[GAPI] ${name} API lastet`);
                        return true;
                    } catch (e) {
                        console.warn(`[GAPI] Kunne ikke laste ${name} API:`, e);
                        return false;
                    }
                };

                await Promise.all([
                    loadApi('drive', 'v3'),
                    loadApi('sheets', 'v4')
                ]);

                gapiInited = true;
                resolve(true);
            } catch (err) {
                console.error("[GAPI] Init kritisk feil:", err);
                resolve(false); // Resolve uansett for å ikke blokkere UI
            }
        });
    });
}

/**
 * Initialiserer GIS (Google Identity Services)
 */
export function initGis(callback) {
    if (typeof google === 'undefined') {
        throw new Error("Google Identity Services (google) script ikke lastet.");
    }
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: import.meta.env.PUBLIC_GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: async (resp) => {
            if (import.meta.env.DEV) console.log("[GIS] Callback mottatt", resp);
            if (resp.error !== undefined) {
                console.warn("[GIS] Autorisasjonsfeil:", resp.error);
                window.dispatchEvent(new Event('admin-auth-failed'));
                return;
            }

            // Hent full brukerinfo når vi får nytt token
            const userInfo = await fetchUserInfo(resp.access_token);
            if (import.meta.env.DEV) console.log("[GIS] Brukerinfo mottatt:", userInfo);

            // Lagre token og utløpstidspunkt
            const expiry = Date.now() + (resp.expires_in * 1000);
            const storage    = _rememberMe ? localStorage  : sessionStorage;
            const otherStore = _rememberMe ? sessionStorage : localStorage;
            storage.setItem('admin_google_token', JSON.stringify({
                access_token: resp.access_token,
                expiry: expiry,
                user: userInfo
            }));
            otherStore.removeItem('admin_google_token');

            callback(userInfo);
            window.dispatchEvent(new Event('admin-auth-refreshed'));
        },
    });
    gisInited = true;
    console.log("[GIS] Initialisert");
}

/**
 * Henter lagret brukerinfo fra localStorage eller sessionStorage uten å røre GAPI
 */
export function getStoredUser() {
    for (const storage of [localStorage, sessionStorage]) {
        const stored = storage.getItem('admin_google_token');
        if (!stored) continue;
        try {
            const { expiry, user } = JSON.parse(stored);
            if (Date.now() < expiry - 60000) return user;
        } catch { /* fall through */ }
        storage.removeItem('admin_google_token');
    }
    return null;
}

/**
 * Prøver å gjenopprette pålogging fra localStorage eller sessionStorage inn i GAPI
 */
export function tryRestoreSession() {
    for (const storage of [localStorage, sessionStorage]) {
        const stored = storage.getItem('admin_google_token');
        if (!stored) continue;
        try {
            const { access_token, expiry } = JSON.parse(stored);
            if (Date.now() < expiry - 60000) {
                if (!gapi.client) {
                    console.warn("[Admin] gapi.client ikke klar for setToken");
                    return false;
                }
                console.log("[Admin] Gjenoppretter sesjon i GAPI");
                gapi.client.setToken({ access_token });
                return true;
            }
        } catch (e) {
            console.error("[Admin] Feil ved lesing av lagret sesjon:", e);
        }
        storage.removeItem('admin_google_token');
    }
    return false;
}

let _silentLoginPending = false;

/**
 * Prøver å hente token uten popup hvis brukeren allerede er autentisert.
 * Debounced: ignorerer kall mens en forespørsel allerede pågår.
 */
export function silentLogin() {
    if (!tokenClient) {
        console.warn("[Admin] silentLogin avbrutt: tokenClient ikke klar.");
        return;
    }
    if (_silentLoginPending) {
        console.log("[Admin] silentLogin allerede pågår, ignorerer.");
        return;
    }
    _silentLoginPending = true;
    console.log("[Admin] Forsøker silent login...");

    const fallbackTimeout = setTimeout(() => {
        _silentLoginPending = false;
    }, 15000);

    const resetPending = () => {
        clearTimeout(fallbackTimeout);
        _silentLoginPending = false;
    };
    window.addEventListener('admin-auth-refreshed', resetPending, { once: true });
    window.addEventListener('admin-auth-failed', resetPending, { once: true });

    tokenClient.requestAccessToken({ prompt: 'none' });
}

/**
 * Trigger pålogging med popup
 */
export function login() {
    if (!tokenClient) {
        console.error("[Admin] login feilet: tokenClient er ikke initialisert.");
        return;
    }
    console.log("[Admin] Åpner login-popup...");
    tokenClient.requestAccessToken({ prompt: 'select_account' });
}

/**
 * Logg ut
 */
export function logout() {
    if (typeof gapi !== 'undefined' && gapi.client) {
        const token = gapi.client.getToken();
        if (token !== null) {
            google.accounts.oauth2.revoke(token.access_token);
            gapi.client.setToken('');
        }
    }
    localStorage.removeItem('admin_google_token');
    sessionStorage.removeItem('admin_google_token');
}
