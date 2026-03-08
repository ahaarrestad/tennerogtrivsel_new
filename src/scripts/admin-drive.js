// src/scripts/admin-drive.js — Drive-operasjoner: filer, bilder, markdown

/**
 * Escaper spesialtegn for Drive API query-strenger.
 * Drive API bruker enkle anførselstegn som streng-delimiter og backslash som escape-tegn.
 */
export function escapeDriveQuery(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Finner en fil ved navn i en bestemt mappe
 */
export async function findFileByName(name, folderId) {
    try {
        const response = await gapi.client.drive.files.list({
            q: `'${escapeDriveQuery(folderId)}' in parents and name = '${escapeDriveQuery(name)}' and trashed = false`,
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
            q: `'${escapeDriveQuery(folderId)}' in parents and trashed = false and name contains '.md'`,
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
 * Lister alle bildefiler i en mappe
 */
export async function listImages(folderId) {
    if (!gapi.client.drive) {
        throw new Error("Drive API ikke initialisert");
    }

    try {
        const response = await gapi.client.drive.files.list({
            q: `'${escapeDriveQuery(folderId)}' in parents and trashed = false`,
            fields: 'files(id, name, mimeType, thumbnailLink, webContentLink), nextPageToken',
            pageSize: 100,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true
        });

        const allFiles = response.result.files || [];

        // Filtrer ut kun bilder basert på mimeType eller vanlige filendelser
        return allFiles.filter(file => {
            const isImageMime = file.mimeType && file.mimeType.startsWith('image/');
            const isImageExt = /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(file.name);
            return isImageMime || isImageExt;
        });
    } catch (err) {
        const msg = err.result?.error?.message || err.message || "Ukjent API-feil";
        console.error("[Admin] listImages feilet:", msg);
        throw new Error(msg);
    }
}

/**
 * Laster opp et bilde til Drive
 */
export async function uploadImage(folderId, file) {
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
    const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

    if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error(`Ugyldig filtype: ${file.type}. Kun JPEG, PNG og WebP er tillatt.`);
    }
    if (file.size > MAX_SIZE) {
        throw new Error(`Filen er for stor (${(file.size / 1024 / 1024).toFixed(1)} MB). Maks 10 MB.`);
    }

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
