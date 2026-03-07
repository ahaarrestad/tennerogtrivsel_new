// src/scripts/admin-sheets.js — Sheets-operasjoner: innstillinger, tannleger, galleri, tilgangskontroll

import { parseImageConfig } from './image-config.js';

/**
 * Henter innstillinger fra Google Sheets.
 * Kolonne A: Teknisk ID
 * Kolonne B: Verdi
 * Kolonne C: Beskrivelse (vises som tittel i Admin)
 * Kolonne D: Rekkefølge (order)
 */
export async function getSettingsWithNotes(spreadsheetId) {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: 'Innstillinger!A:D',
            valueRenderOption: 'UNFORMATTED_VALUE',
        });

        const rows = response.result.values;
        if (!rows || rows.length <= 1) return [];

        // Vi hopper over header-raden (indeks 0)
        return rows.slice(1).map((row, index) => {
            const rawOrder = row[3];
            const order = parseInt(rawOrder);
            const orderMissing = rawOrder === undefined || rawOrder === null || rawOrder === '';
            return {
                row: index + 2,
                id: (row[0] || '') + '',
                value: (row[1] ?? '') + '',
                description: (row[2] || '') + '',
                order: isNaN(order) ? index + 1 : order,
                _orderMissing: orderMissing
            };
        }).filter(item => item.id);

    } catch (err) {
        console.error("[Admin] Kunne ikke hente innstillinger:", err);
        throw err;
    }
}

/**
 * Henter ID-en til foreldremappen for et Google Sheets-regneark.
 * Brukes for å finne Drive-mappen der bilder skal lagres.
 */
export async function getSheetParentFolder(spreadsheetId) {
    try {
        const response = await gapi.client.drive.files.get({
            fileId: spreadsheetId,
            fields: 'parents',
            supportsAllDrives: true
        });
        return response.result.parents?.[0] || null;
    } catch (err) {
        console.error('[Admin] Kunne ikke hente foreldre-mappe for arket:', err);
        return null;
    }
}

/**
 * Oppdaterer en enkelt innstilling i Google Sheets etter nøkkelnavn.
 * Oppdaterer eksisterende rad, eller legger til ny rad hvis nøkkelen mangler.
 */
export async function updateSettingByKey(spreadsheetId, key, value) {
    try {
        const allSettings = await getSettingsWithNotes(spreadsheetId);
        const existing = allSettings.find(s => s.id === key);

        if (existing) {
            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `Innstillinger!B${existing.row}`,
                valueInputOption: 'RAW',
                resource: { values: [[String(value)]] }
            });
        } else {
            const maxOrder = allSettings.reduce((max, s) => Math.max(max, s.order || 0), 0);
            await gapi.client.sheets.spreadsheets.values.append({
                spreadsheetId,
                range: 'Innstillinger!A:D',
                valueInputOption: 'RAW',
                resource: { values: [[key, String(value), '', maxOrder + 1]] }
            });
        }

        console.log(`[Admin] Innstilling "${key}" oppdatert.`);
        return true;
    } catch (err) {
        console.error(`[Admin] Kunne ikke oppdatere innstilling "${key}":`, err);
        throw err;
    }
}

/**
 * Oppdaterer rekkefølge (kolonne D) for én innstilling.
 */
export async function updateSettingOrder(spreadsheetId, rowNumber, order) {
    try {
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `Innstillinger!D${rowNumber}`,
            valueInputOption: 'RAW',
            resource: { values: [[order]] }
        });
        console.log(`[Admin] Rekkefølge for rad ${rowNumber} satt til ${order}.`);
        return true;
    } catch (err) {
        console.error(`[Admin] Kunne ikke oppdatere rekkefølge for rad ${rowNumber}:`, err);
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
        if (import.meta.env.DEV) console.error("[Admin] checkAccess feilet detaljer:", {
            status: err.status,
            message: err.result?.error?.message || err.message,
            reason: err.result?.error?.errors?.[0]?.reason
        });
        return false;
    }
}

/**
 * FELLES SHEETS-HJELPEFUNKSJONER
 */

/**
 * Oppdaterer en rad i et Google Sheets-ark.
 */
export async function updateSheetRow(spreadsheetId, sheetName, rowIndex, endCol, values, label) {
    try {
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${sheetName}!A${rowIndex}:${endCol}${rowIndex}`,
            valueInputOption: 'RAW',
            resource: { values: [values] }
        });
        console.log(`[Admin] ${label} rad ${rowIndex} oppdatert.`);
        return true;
    } catch (err) {
        console.error(`[Admin] Kunne ikke oppdatere ${label.toLowerCase()}:`, err);
        throw err;
    }
}

/**
 * Sletter en rad permanent fra et Google Sheets-ark (fysisk fjerning).
 */
export async function deleteSheetRow(spreadsheetId, sheetName, rowIndex) {
    try {
        const sheetResp = await gapi.client.sheets.spreadsheets.get({
            spreadsheetId,
            fields: 'sheets.properties'
        });
        const sheet = (sheetResp.result.sheets || []).find(
            s => s.properties.title === sheetName
        );
        if (!sheet) {
            throw new Error(`Fant ikke '${sheetName}'-arket i regnearket.`);
        }
        const sheetId = sheet.properties.sheetId;

        await gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: {
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId,
                            dimension: 'ROWS',
                            startIndex: rowIndex - 1,
                            endIndex: rowIndex
                        }
                    }
                }]
            }
        });
        console.log(`[Admin] ${sheetName} rad ${rowIndex} permanent slettet.`);
        return true;
    } catch (err) {
        console.error(`[Admin] Kunne ikke slette rad ${rowIndex} fra ${sheetName}:`, err);
        throw err;
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
            valueRenderOption: 'UNFORMATTED_VALUE',
        });

        const rows = response.result.values;
        if (!rows || rows.length <= 1) return [];

        return rows.slice(1).map((row, index) => {
            const { scale, positionX, positionY } = parseImageConfig(row[5], row[6], row[7]);

            return {
                rowIndex: index + 2, // 1-basert + 1 for header
                name: row[0] || '',
                title: row[1] || '',
                description: row[2] || '',
                image: row[3] || '',
                active: (row[4] || 'nei').toLowerCase() === 'ja',
                scale,
                positionX,
                positionY
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
    const values = [
        data.name, data.title, data.description, data.image,
        data.active ? 'ja' : 'nei', data.scale, data.positionX, data.positionY
    ];
    return updateSheetRow(spreadsheetId, 'tannleger', rowIndex, 'H', values, 'Tannlege');
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
 * Sikrer at «Slettet»-arket finnes i regnearket.
 * Oppretter arket og header-rad hvis det mangler.
 */
export async function ensureSlettetSheet(spreadsheetId) {
    const resp = await gapi.client.sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties.title'
    });
    const exists = (resp.result.sheets || []).some(
        s => s.properties.title === 'Slettet'
    );
    if (!exists) {
        await gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: { requests: [{ addSheet: { properties: { title: 'Slettet' } } }] }
        });
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId,
            range: 'Slettet!A1:D1',
            valueInputOption: 'RAW',
            resource: { values: [['Type', 'Tittel/Navn', 'Dato slettet', 'Data']] }
        });
    }
}

/**
 * Tar backup av slettet innhold til «Slettet»-arket.
 */
export async function backupToSlettetSheet(spreadsheetId, type, title, data) {
    await ensureSlettetSheet(spreadsheetId);
    const date = new Date().toISOString().split('T')[0];
    await gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Slettet!A:D',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: { values: [[type, title, date, data]] }
    });
}

/**
 * Permanent sletting av en tannlege-rad fra arket (fysisk fjerning).
 */
export async function deleteTannlegeRowPermanently(spreadsheetId, rowIndex) {
    return deleteSheetRow(spreadsheetId, 'tannleger', rowIndex);
}

// --- GALLERI ---

export async function ensureGalleriSheet(spreadsheetId) {
    const resp = await gapi.client.sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties.title'
    });
    const exists = (resp.result.sheets || []).some(
        s => s.properties.title === 'galleri'
    );
    if (!exists) {
        await gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: { requests: [{ addSheet: { properties: { title: 'galleri' } } }] }
        });
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId,
            range: 'galleri!A1:I1',
            valueInputOption: 'RAW',
            resource: { values: [['Tittel', 'Bildefil', 'AltTekst', 'Aktiv', 'Rekkefølge', 'Skala', 'PosX', 'PosY', 'Type']] }
        });
        console.log("[Admin] Galleri-ark opprettet med overskrifter.");
    }
}

export async function getGalleriRaw(spreadsheetId) {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: 'galleri!A:I',
            valueRenderOption: 'UNFORMATTED_VALUE',
        });

        const rows = response.result.values;
        if (!rows || rows.length <= 1) return [];

        return rows.slice(1).map((row, index) => {
            const { scale, positionX, positionY } = parseImageConfig(row[5], row[6], row[7]);
            const order = parseInt(row[4]);

            return {
                rowIndex: index + 2,
                title: row[0] || '',
                image: row[1] || '',
                altText: row[2] || '',
                active: (row[3] || 'nei').toLowerCase() === 'ja',
                order: isNaN(order) ? 99 : order,
                scale,
                positionX,
                positionY,
                type: row[8] || 'galleri'
            };
        });
    } catch (err) {
        console.error("[Admin] Kunne ikke hente galleri:", err);
        throw err;
    }
}

export async function updateGalleriRow(spreadsheetId, rowIndex, data) {
    const values = [
        data.title, data.image, data.altText, data.active ? 'ja' : 'nei',
        data.order, data.scale, data.positionX, data.positionY, data.type || 'galleri'
    ];
    return updateSheetRow(spreadsheetId, 'galleri', rowIndex, 'I', values, 'Galleri');
}

export async function addGalleriRow(spreadsheetId, data) {
    try {
        await ensureGalleriSheet(spreadsheetId);

        const values = [[
            data.title || 'Nytt bilde',
            data.image || '',
            data.altText || '',
            'ja',
            data.order || 99,
            1.0,
            50,
            50,
            data.type || 'galleri'
        ]];

        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: spreadsheetId,
            range: 'galleri!A:I',
            valueInputOption: 'RAW',
            resource: { values }
        });

        console.log("[Admin] Nytt galleribilde lagt til i Sheets.");
        return true;
    } catch (err) {
        console.error("[Admin] Kunne ikke legge til galleribilde:", err);
        throw err;
    }
}

/**
 * Setter en galleri-rad som en spesiell type og nedgraderer evt. eksisterende rad med samme type.
 * Kun én rad kan ha en gitt spesialtype om gangen.
 */
async function setGalleriSpecialType(spreadsheetId, rowIndex, targetType) {
    try {
        const allRows = await getGalleriRaw(spreadsheetId);
        const existing = allRows.find(r => r.type === targetType && r.rowIndex !== rowIndex);
        if (existing) {
            await updateGalleriRow(spreadsheetId, existing.rowIndex, { ...existing, type: 'galleri' });
        }
        const target = allRows.find(r => r.rowIndex === rowIndex);
        if (target) {
            await updateGalleriRow(spreadsheetId, rowIndex, { ...target, type: targetType });
        }
        console.log(`[Admin] Rad ${rowIndex} satt som ${targetType}.`);
        return true;
    } catch (err) {
        console.error(`[Admin] Kunne ikke sette ${targetType}:`, err);
        throw err;
    }
}

export function setForsideBildeInGalleri(spreadsheetId, rowIndex) {
    return setGalleriSpecialType(spreadsheetId, rowIndex, 'forsidebilde');
}

export function setFellesBildeInGalleri(spreadsheetId, rowIndex) {
    return setGalleriSpecialType(spreadsheetId, rowIndex, 'fellesbilde');
}

/**
 * Migrerer forsidebilde fra Innstillinger-arket til galleri-arket (one-time).
 * Avbryter hvis galleri allerede har en forsidebilde-rad.
 */
export async function migrateForsideBildeToGalleri(spreadsheetId) {
    try {
        const allRows = await getGalleriRaw(spreadsheetId);
        if (allRows.some(r => r.type === 'forsidebilde')) {
            console.log("[Admin] Migrering unødvendig – forsidebilde finnes allerede i galleri.");
            return false;
        }

        const settings = await getSettingsWithNotes(spreadsheetId);
        const getSetting = (key) => settings.find(s => s.id === key)?.value || '';

        const bildeFil = getSetting('forsideBilde');
        if (!bildeFil) {
            console.log("[Admin] Ingen forsidebilde i Innstillinger å migrere.");
            return false;
        }

        const scale = parseFloat(getSetting('forsideBildeScale')) || 1.0;
        const posX = parseInt(getSetting('forsideBildePosX')) || 50;
        const posY = parseInt(getSetting('forsideBildePosY')) || 50;

        await addGalleriRow(spreadsheetId, {
            title: 'Forsidebilde',
            image: bildeFil,
            altText: 'Forsidebilde',
            active: true,
            order: 0,
            scale: scale,
            positionX: posX,
            positionY: posY,
            type: 'forsidebilde'
        });

        console.log("[Admin] Forsidebilde migrert fra Innstillinger til galleri-arket.");
        return true;
    } catch (err) {
        console.error("[Admin] Migrering av forsidebilde feilet:", err);
        throw err;
    }
}

export async function deleteGalleriRowPermanently(spreadsheetId, rowIndex) {
    return deleteSheetRow(spreadsheetId, 'galleri', rowIndex);
}

// --- PRISLISTE CRUD ---

export async function ensurePrislisteSheet(spreadsheetId) {
    const resp = await gapi.client.sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties.title'
    });
    const exists = (resp.result.sheets || []).some(
        s => s.properties.title === 'Prisliste'
    );
    if (!exists) {
        await gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: { requests: [{ addSheet: { properties: { title: 'Prisliste' } } }] }
        });
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId,
            range: 'Prisliste!A1:D1',
            valueInputOption: 'RAW',
            resource: { values: [['Kategori', 'Behandling', 'Pris', 'SistOppdatert']] }
        });
        console.log("[Admin] Prisliste-ark opprettet med overskrifter.");
    }
}

export async function getPrislisteRaw(spreadsheetId) {
    try {
        await ensurePrislisteSheet(spreadsheetId);
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Prisliste!A:D',
            valueRenderOption: 'UNFORMATTED_VALUE',
        });

        const rows = response.result.values;
        if (!rows || rows.length <= 1) return [];

        return rows.slice(1).map((row, index) => ({
            rowIndex: index + 2,
            kategori: (row[0] || '') + '',
            behandling: (row[1] || '') + '',
            pris: row[2] ?? '',
            sistOppdatert: (row[3] || '') + '',
        }));
    } catch (err) {
        console.error("[Admin] Kunne ikke hente prisliste:", err);
        throw err;
    }
}

export async function updatePrislisteRow(spreadsheetId, rowIndex, data) {
    const values = [data.kategori, data.behandling, data.pris, new Date().toISOString()];
    return updateSheetRow(spreadsheetId, 'Prisliste', rowIndex, 'D', values, 'Prisliste');
}

export async function addPrislisteRow(spreadsheetId, data) {
    try {
        await ensurePrislisteSheet(spreadsheetId);

        const values = [[
            data.kategori || '',
            data.behandling || 'Ny behandling',
            data.pris ?? '',
            new Date().toISOString(),
        ]];

        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId,
            range: 'Prisliste!A:C',
            valueInputOption: 'RAW',
            resource: { values }
        });

        console.log("[Admin] Ny prisrad lagt til i Sheets.");
        return true;
    } catch (err) {
        console.error("[Admin] Kunne ikke legge til prisrad:", err);
        throw err;
    }
}

export async function deletePrislisteRowPermanently(spreadsheetId, rowIndex) {
    return deleteSheetRow(spreadsheetId, 'Prisliste', rowIndex);
}
