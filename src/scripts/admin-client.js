// src/scripts/admin-client.js

let tokenClient;
let gapiInited = false;
let gisInited = false;

const SCOPES = 'openid profile email https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly';

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
            console.log("[GIS] Callback mottatt", resp);
            if (resp.error !== undefined) {
                console.warn("[GIS] Autorisasjonsfeil:", resp.error);
                return;
            }
            
            // Hent full brukerinfo når vi får nytt token
            const userInfo = await fetchUserInfo(resp.access_token);
            console.log("[GIS] Brukerinfo mottatt:", userInfo);

            // Lagre token og utløpstidspunkt
            const expiry = Date.now() + (resp.expires_in * 1000);
            localStorage.setItem('admin_google_token', JSON.stringify({
                access_token: resp.access_token,
                expiry: expiry,
                user: userInfo
            }));

            callback(userInfo);
        },
    });
    gisInited = true;
    console.log("[GIS] Initialisert");
}

/**
 * Henter lagret brukerinfo fra localStorage uten å røre GAPI
 */
export function getStoredUser() {
    const stored = localStorage.getItem('admin_google_token');
    if (!stored) return null;
    try {
        const { expiry, user } = JSON.parse(stored);
        if (Date.now() < (expiry - 60000)) return user;
    } catch (e) {
        localStorage.removeItem('admin_google_token');
    }
    return null;
}

/**
 * Prøver å gjenopprette pålogging fra localStorage inn i GAPI
 */
export function tryRestoreSession() {
    const stored = localStorage.getItem('admin_google_token');
    if (!stored) return false;

    try {
        const { access_token, expiry } = JSON.parse(stored);
        
        // Sjekk om tokenet fortsatt er gyldig (med 1 minutts margin)
        if (Date.now() < (expiry - 60000)) {
            console.log("[Admin] Gjenoppretter sesjon i GAPI");
            if (gapi.client) {
                gapi.client.setToken({ access_token });
                return true;
            } else {
                console.warn("[Admin] gapi.client ikke klar for setToken");
            }
        } else {
            console.log("[Admin] Lagret token er utløpt");
            localStorage.removeItem('admin_google_token');
        }
    } catch (e) {
        console.error("[Admin] Feil ved lesing av lagret sesjon:", e);
        localStorage.removeItem('admin_google_token');
    }
    return false;
}

/**
 * Prøver å hente token uten popup hvis brukeren allerede er autentisert
 */
export function silentLogin() {
    if (!tokenClient) {
        console.warn("[Admin] silentLogin avbrutt: tokenClient ikke klar.");
        return;
    }
    console.log("[Admin] Forsøker silent login...");
    // Bruk 'prompt: none' for ekte silent auth, men det krever at vi håndterer feil hvis sesjon mangler
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
}

/**
 * Henter innstillinger fra Google Sheets, inkludert noter fra kolonne A som forklaring.
 */
export async function getSettingsWithNotes(spreadsheetId) {
    try {
        const response = await gapi.client.sheets.spreadsheets.get({
            spreadsheetId: spreadsheetId,
            ranges: ['Innstillinger!A:B'],
            includeGridData: true,
            fields: 'sheets.data.rowData.values(formattedValue,note)'
        });

        const rows = response.result.sheets[0].data[0].rowData;
        if (!rows) return [];

        // Vi hopper over header-raden (indeks 0)
        return rows.slice(1).map((row, index) => {
            const cells = row.values || [];
            const keyCell = cells[0] || {};
            const valueCell = cells[1] || {};

            return {
                row: index + 2, // Excel/Sheets radnummer
                id: keyCell.formattedValue || '',
                value: valueCell.formattedValue || '',
                description: keyCell.note || '' // Bruker noten fra kolonne A som forklaring
            };
        }).filter(item => item.id); // Fjern tomme rader

    } catch (err) {
        console.error("[Admin] Kunne ikke hente innstillinger:", err);
        throw err;
    }
}

/**
 * Oppdaterer innstillinger i Google Sheets (kun kolonne B).
 */
export async function updateSettings(spreadsheetId, settings) {
    try {
        // Vi må mappe verdiene tilbake til riktig rad i kolonne B
        // Her antar vi at rekkefølgen i 'settings' matcher radene i arket
        const values = settings.map(s => [s.value]);
        
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: `Innstillinger!B2:B${settings.length + 1}`,
            valueInputOption: 'RAW',
            resource: { values }
        });
        
        console.log("[Admin] Innstillinger lagret!");
        return true;
    } catch (err) {
        console.error("[Admin] Lagring av innstillinger feilet:", err);
        throw err;
    }
}

/**
 * Sjekker om brukeren har tilgang ved å prøve å hente info om en mappe
 */
export async function checkAccess(folderId) {
    if (!folderId) {
        console.error("[Admin] checkAccess feilet: Ingen folderId oppgitt.");
        return false;
    }
    
    try {
        console.log(`[Admin] Prøver å hente metadata for mappe: ${folderId}...`);
        const response = await gapi.client.drive.files.get({
            fileId: folderId,
            fields: 'id, name, capabilities(canEdit)'
        });
        console.log("[Admin] Metadata mottatt:", response.result.name);
        return true;
    } catch (err) {
        console.error("[Admin] checkAccess feilet detaljer:", {
            status: err.status,
            message: err.result?.error?.message || err.message,
            reason: err.result?.error?.errors?.[0]?.reason
        });
        return false;
    }
}
