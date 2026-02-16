// src/scripts/admin-client.js

let tokenClient;
let gapiInited = false;
let gisInited = false;

const SCOPES = 'openid profile email https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets';

/**
 * Finner en fil ved navn i en bestemt mappe
 */
export async function findFileByName(name, folderId) {
    try {
        const response = await gapi.client.drive.files.list({
            q: `'${folderId}' in parents and name = '${name}' and trashed = false`,
            fields: 'files(id, name)',
            pageSize: 1,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true
        });
        return response.result.files?.[0] || null;
    } catch (err) {
        console.error("[Admin] Kunne ikke finne fil ved navn:", err);
        return null;
    }
}

/**
 * Lister alle .md filer i en mappe
 */
export async function listFiles(folderId) {
    try {
        const response = await gapi.client.drive.files.list({
            q: `'${folderId}' in parents and trashed = false and name contains '.md'`,
            fields: 'files(id, name, modifiedTime)',
            orderBy: 'name',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true
        });
        return response.result.files || [];
    } catch (err) {
        console.error("[Admin] Kunne ikke liste filer:", err);
        throw err;
    }
}

/**
 * Henter innholdet i en spesifikk fil
 */
export async function getFileContent(fileId) {
    try {
        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });
        return response.body;
    } catch (err) {
        console.error("[Admin] Kunne ikke hente filinnhold:", err);
        throw err;
    }
}

/**
 * Lagrer/Oppdaterer en fil på Drive
 */
export async function saveFile(fileId, name, content) {
    try {
        // 1. Oppdater metadata (navn) hvis nødvendig
        await gapi.client.drive.files.update({
            fileId: fileId,
            resource: { name: name },
            supportsAllDrives: true
        });

        // 2. Oppdater selve innholdet
        await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${gapi.client.getToken().access_token}`,
                'Content-Type': 'text/markdown'
            },
            body: content
        });

        console.log("[Admin] Fil lagret:", name);
        return true;
    } catch (err) {
        console.error("[Admin] Lagring av fil feilet:", err);
        throw err;
    }
}

/**
 * Oppretter en ny Markdown-fil
 */
export async function createFile(folderId, name, content) {
    try {
        const metadata = {
            name: name,
            mimeType: 'text/markdown',
            parents: [folderId]
        };

        const response = await gapi.client.drive.files.create({
            resource: metadata,
            fields: 'id',
            supportsAllDrives: true
        });

        const fileId = response.result.id;
        await saveFile(fileId, name, content);
        return fileId;
    } catch (err) {
        console.error("[Admin] Kunne ikke opprette fil:", err);
        throw err;
    }
}

/**
 * Sletter (legger i søppelkurven) en fil
 */
export async function deleteFile(fileId) {
    try {
        await gapi.client.drive.files.update({
            fileId: fileId,
            resource: { trashed: true },
            supportsAllDrives: true
        });
        return true;
    } catch (err) {
        console.error("[Admin] Kunne ikke slette fil:", err);
        throw err;
    }
}

/**
 * Enkel parser for YAML frontmatter
 */
export function parseMarkdown(content) {
    const regex = /^---\s*([\s\S]*?)\s*---\s*([\s\S]*)$/;
    const match = content.match(regex);
    
    if (!match) return { data: {}, body: content };

    const yaml = match[1];
    const body = match[2].trim();
    const data = {};

    yaml.split('\n').forEach(line => {
        const [key, ...val] = line.split(':');
        if (key && val.length) {
            data[key.trim()] = val.join(':').trim().replace(/^["']|["']$/g, '');
        }
    });

    return { data, body };
}

/**
 * Lager en Markdown-streng med frontmatter
 */
export function stringifyMarkdown(data, body) {
    let yaml = '---\n';
    for (const [key, val] of Object.entries(data)) {
        yaml += `${key}: ${val}\n`;
    }
    yaml += '---\n';
    return yaml + (body || '');
}

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
 * Lister alle bildefiler i en mappe
 */
export async function listImages(folderId) {
    console.log("[Admin] listImages kalles for mappe:", folderId);
    
    if (!gapi.client.drive) {
        console.error("[Admin] Drive API er ikke lastet!");
        throw new Error("Drive API ikke initialisert");
    }

    try {
        // Vi prøver et litt bredere søk først for å se hva som finnes
        const response = await gapi.client.drive.files.list({
            q: `'${folderId}' in parents and trashed = false`,
            fields: 'files(id, name, mimeType, thumbnailLink, webContentLink), nextPageToken',
            pageSize: 100,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true
        });
        
        const allFiles = response.result.files || [];
        console.log(`[Admin] Fant totalt ${allFiles.length} filer i mappen.`);
        
        // LOGG ALT FOR DIAGNOSE
        allFiles.forEach((f, i) => {
            console.log(`[Admin] Fil #${i}: "${f.name}" (Type: ${f.mimeType}, ID: ${f.id})`);
        });

        // Filtrer ut bilder
        const images = allFiles.filter(file => {
            const isImageMime = file.mimeType && file.mimeType.startsWith('image/');
            const isImageExt = /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(file.name);
            return isImageMime || isImageExt;
        });

        console.log(`[Admin] Etter filtrering: ${images.length} bilder.`);
        return images;
    } catch (err) {
        const msg = err.result?.error?.message || err.message || "Ukjent API-feil";
        console.error("[Admin] listImages feilet:", msg, err);
        throw new Error(msg);
    }
}

/**
 * Laster opp et bilde til Drive
 */
export async function uploadImage(folderId, file) {
    try {
        const metadata = {
            name: file.name,
            parents: [folderId]
        };

        const accessToken = gapi.client.getToken().access_token;
        const form = new FormData();
        
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true', {
            method: 'POST',
            headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
            body: form
        });

        if (!response.ok) throw new Error('Upload failed: ' + response.statusText);

        const json = await response.json();
        console.log("[Admin] Bilde lastet opp:", json);
        return json;
    } catch (err) {
        console.error("[Admin] Bildeopplasting feilet:", err);
        throw err;
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
 * Henter innstillinger fra Google Sheets.
 * Kolonne A: Teknisk ID
 * Kolonne B: Verdi
 * Kolonne C: Beskrivelse (vises som tittel i Admin)
 */
export async function getSettingsWithNotes(spreadsheetId) {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: 'Innstillinger!A:C',
        });

        const rows = response.result.values;
        if (!rows || rows.length <= 1) return [];

        // Vi hopper over header-raden (indeks 0)
        return rows.slice(1).map((row, index) => {
            return {
                row: index + 2,
                id: row[0] || '',
                value: row[1] || '',
                description: row[2] || '' // Bruker kolonne C som forklaring/tittel
            };
        }).filter(item => item.id);

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
 * Sjekker tilgang til flere ressurser samtidig
 * @param {Array<string>} ids 
 * @returns {Promise<Object>} Kart over id -> boolean
 */
export async function checkMultipleAccess(ids) {
    const results = {};
    await Promise.all(ids.map(async (id) => {
        results[id] = await checkAccess(id);
    }));
    return results;
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
            fields: 'id, name, capabilities(canEdit)',
            supportsAllDrives: true
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

/**
 * Henter et bilde fra Google Drive som en Blob-URL.
 * Brukes for live preview i admin-panelet.
 */
export async function getDriveImageBlob(fileId) {
    if (!fileId) return null;
    try {
        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });
        
        // GAPI returnerer media som en streng/arraybuffer avhengig av konfigurasjon
        // Men vi kan også bruke den direkte webContentLink hvis den er offentlig, 
        // eller fetch med token for best resultat.
        const token = gapi.client.getToken().access_token;
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const blob = await res.blob();
        return URL.createObjectURL(blob);
    } catch (err) {
        console.error("[Admin] Kunne ikke hente bilde-blob:", err);
        return null;
    }
}

/**
 * TANNLEGER CRUD (GOOGLE SHEETS)
 */

/**
 * Henter alle rader fra tannleger-arket.
 * Kolonne A-H: Navn, Tittel, Beskrivelse, Bilde, Aktiv, Skala, X, Y
 */
export async function getTannlegerRaw(spreadsheetId) {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: 'tannleger!A:H',
        });

        const rows = response.result.values;
        if (!rows || rows.length <= 1) return [];

        return rows.slice(1).map((row, index) => {
            const scale = parseFloat(row[5]);
            const pX = parseInt(row[6]);
            const pY = parseInt(row[7]);
            
            return {
                rowIndex: index + 2, // 1-basert + 1 for header
                name: row[0] || '',
                title: row[1] || '',
                description: row[2] || '',
                image: row[3] || '',
                active: (row[4] || 'nei').toLowerCase() === 'ja',
                scale: isNaN(scale) ? 1.0 : scale,
                positionX: isNaN(pX) ? 50 : pX,
                positionY: isNaN(pY) ? 50 : pY
            };
        });
    } catch (err) {
        console.error("[Admin] Kunne ikke hente tannleger:", err);
        throw err;
    }
}

/**
 * Oppdaterer en spesifikk rad i tannleger-arket.
 */
export async function updateTannlegeRow(spreadsheetId, rowIndex, data) {
    try {
        const values = [[
            data.name,
            data.title,
            data.description,
            data.image,
            data.active ? 'ja' : 'nei',
            data.scale,
            data.positionX,
            data.positionY
        ]];

        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: `tannleger!A${rowIndex}:H${rowIndex}`,
            valueInputOption: 'RAW',
            resource: { values }
        });

        console.log(`[Admin] Tannlege rad ${rowIndex} oppdatert.`);
        return true;
    } catch (err) {
        console.error("[Admin] Kunne ikke oppdatere tannlege:", err);
        throw err;
    }
}

/**
 * Legger til en ny tannlege-rad nederst i arket.
 */
export async function addTannlegeRow(spreadsheetId, data) {
    try {
        const values = [[
            data.name || 'Ny tannlege',
            data.title || '',
            data.description || '',
            data.image || '',
            'ja', // Alltid aktiv som default ved opprettelse
            1.0,
            50,
            50
        ]];

        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: spreadsheetId,
            range: 'tannleger!A:H',
            valueInputOption: 'RAW',
            resource: { values }
        });

        console.log("[Admin] Ny tannlege lagt til i Sheets.");
        return true;
    } catch (err) {
        console.error("[Admin] Kunne ikke legge til tannlege:", err);
        throw err;
    }
}

/**
 * Logisk sletting av en tannlege (setter Aktiv til 'nei').
 */
export async function deleteTannlegeRow(spreadsheetId, rowIndex) {
    try {
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: `tannleger!E${rowIndex}`, // Kolonne E er 'Aktiv'
            valueInputOption: 'RAW',
            resource: { values: [['nei']] }
        });
        console.log(`[Admin] Tannlege rad ${rowIndex} deaktivert.`);
        return true;
    } catch (err) {
        console.error("[Admin] Kunne ikke slette tannlege:", err);
        throw err;
    }
}
