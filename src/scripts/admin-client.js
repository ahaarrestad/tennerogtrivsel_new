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
            callback(resp);
        },
    });
    gisInited = true;
    console.log("[GIS] Initialisert");
}

/**
 * Trigger pålogging
 */
export function login() {
    tokenClient.requestAccessToken({ prompt: 'consent' });
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
