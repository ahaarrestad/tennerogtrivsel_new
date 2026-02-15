// src/scripts/admin-client.js

let tokenClient;
let gapiInited = false;
let gisInited = false;

const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly';

/**
 * Initialiserer GAPI (Google API Client)
 */
export async function initGapi() {
    return new Promise((resolve, reject) => {
        if (typeof gapi === 'undefined') {
            return reject(new Error("Google API (gapi) script ikke lastet."));
        }
        gapi.load('client', async () => {
            try {
                const apiKey = import.meta.env.PUBLIC_GOOGLE_API_KEY;
                if (!apiKey) {
                    return reject(new Error("PUBLIC_GOOGLE_API_KEY mangler i miljøvariabler."));
                }

                await gapi.client.init({
                    apiKey: apiKey,
                    discoveryDocs: [
                        'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
                        'https://sheets.googleapis.com/$discovery/rest?version=v4'
                    ],
                });
                gapiInited = true;
                console.log("[GAPI] Initialisert");
                resolve();
            } catch (err) {
                console.error("[GAPI] Init feilet:", err);
                reject(err);
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
            console.log("[GIS] Token mottatt");
            if (resp.error !== undefined) {
                throw resp;
            }
            
            // Lagre token og utløpstidspunkt (nå + expires_in sekunder)
            const expiry = Date.now() + (resp.expires_in * 1000);
            localStorage.setItem('admin_google_token', JSON.stringify({
                access_token: resp.access_token,
                expiry: expiry
            }));

            callback(resp);
        },
    });
    gisInited = true;
    console.log("[GIS] Initialisert");
}

/**
 * Prøver å gjenopprette pålogging fra localStorage
 */
export function tryRestoreSession() {
    const stored = localStorage.getItem('admin_google_token');
    if (!stored) return false;

    try {
        const { access_token, expiry } = JSON.parse(stored);
        
        // Sjekk om tokenet fortsatt er gyldig (med 1 minutts margin)
        if (Date.now() < (expiry - 60000)) {
            console.log("[Admin] Gjenoppretter sesjon fra localStorage");
            gapi.client.setToken({ access_token });
            return true;
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
    if (!tokenClient) return;
    tokenClient.requestAccessToken({ prompt: '' }); // Tom prompt prøver å gjenbruke sesjon
}

/**
 * Trigger pålogging med popup
 */
export function login() {
    tokenClient.requestAccessToken({ prompt: 'select_account' });
}

/**
 * Logg ut
 */
export function logout() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
    }
    localStorage.removeItem('admin_google_token');
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
