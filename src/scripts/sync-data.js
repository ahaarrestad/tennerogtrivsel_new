try { process.loadEnvFile(); } catch { /* .env not found — env vars set externally (CI) */ }
import { sheets as sheetsFactory } from '@googleapis/sheets';
import { drive as driveFactory } from '@googleapis/drive';
import { GoogleAuth } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import crypto from 'crypto';
import sharp from 'sharp';
import { parseImageConfig } from './image-config.js';

// Nøkler som har hardkodede defaults i getSettings.ts — brukes for å logge oversikt ved sync
const HARD_DEFAULT_KEYS = [
    'phone1', 'phone2', 'email', 'showEmail', 'adresse1', 'adresse2',
    'velkomstTittel1', 'velkomstTittel2', 'sentralbordTekst', 'latitude', 'longitude',
    'siteTitle', 'siteDescription', 'velkomstTekst', 'kontaktTekst',
    'tannlegerTekst', 'tjenesteTekst', 'businessHours1', 'businessHours2',
    'businessHours3', 'businessHours4', 'businessHours5', 'galleriTekst',
    'kontaktTittel', 'galleriTittel', 'tjenesterTittel', 'tannlegerTittel',
    'kontaktBeskrivelse', 'galleriBeskrivelse', 'tjenesterBeskrivelse', 'tannlegerBeskrivelse',
];

// --- KONFIGURASJON ---
function getConfig() {
    return {
        spreadsheetId: process.env.PUBLIC_GOOGLE_SHEET_ID,
        tannlegerFolderId: process.env.PUBLIC_GOOGLE_DRIVE_TANNLEGER_FOLDER_ID,
        bilderFolderId: process.env.PUBLIC_GOOGLE_DRIVE_BILDER_FOLDER_ID,
        paths: {
            tannlegerAssets: path.join(process.cwd(), 'src/assets/tannleger'),
            tannlegerData: path.join(process.cwd(), 'src/content/tannleger.json'),
            galleriAssets: path.join(process.cwd(), 'src/assets/galleri'),
            galleriData: path.join(process.cwd(), 'src/content/galleri.json'),
            innstillingerData: path.join(process.cwd(), 'src/content/innstillinger.json'),
            prislisteData: path.join(process.cwd(), 'src/content/prisliste.json'),
        },
        collections: [
            {
                name: 'tjenester',
                folderId: process.env.PUBLIC_GOOGLE_DRIVE_TJENESTER_FOLDER_ID,
                dest: path.join(process.cwd(), 'src/content/tjenester')
            },
            {
                name: 'meldinger',
                folderId: process.env.PUBLIC_GOOGLE_DRIVE_MELDINGER_FOLDER_ID,
                dest: path.join(process.cwd(), 'src/content/meldinger')
            }
        ]
    };
}

// --- GOOGLE AUTH ---
function getAuth() {
    return new GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly', 'https://www.googleapis.com/auth/drive.readonly'],
    });
}

function getDrive() {
    return driveFactory({ version: 'v3', auth: getAuth() });
}

function getSheets() {
    return sheetsFactory({ version: 'v4', auth: getAuth() });
}

// --- HJELPEFUNKSJONER ---

/**
 * Logger en advarsel som vises som en annotering på GitHub hvis vi kjører i CI
 */
function logWarning(title, message) {
    if (process.env.GITHUB_ACTIONS) {
        console.log(`::warning title=${title}::${message}`);
    } else {
        console.warn(`${title}: ${message}`);
    }
}

// Samler warnings for oppsummering etter sync
const syncWarnings = { galleri: [], tannleger: [] };

/**
 * Beregner MD5-hash for en lokal fil
 */
function getLocalHash(filePath) {
    if (!fs.existsSync(filePath)) return null;
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(fileBuffer).digest('hex');
}

/**
 * Sjekker om en fil må lastes ned (mangler eller endret)
 */
async function shouldDownload(driveFile, localPath) {
    if (!fs.existsSync(localPath)) return true;
    if (!driveFile.md5Checksum) return true; // Hvis Drive ikke gir hash, last ned for sikkerhets skyld
    
    const localHash = getLocalHash(localPath);
    return localHash !== driveFile.md5Checksum;
}

/**
 * Validerer at en filsti er innenfor forventet basemappe.
 * Beskytter mot path traversal fra filnavn med «..» eller absolutte stier.
 */
function assertSafePath(filePath, baseDir) {
    const resolved = path.resolve(filePath);
    const resolvedBase = path.resolve(baseDir);
    if (!resolved.startsWith(resolvedBase + path.sep) && resolved !== resolvedBase) {
        throw new Error(`Path traversal oppdaget: "${filePath}" er utenfor "${baseDir}"`);
    }
}

async function downloadFile(fileId, destinationPath) {
    const drive = getDrive();
    const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
    await pipeline(res.data, fs.createWriteStream(destinationPath));
}

/**
 * Finner fil i Drive, sjekker hash, og laster ned ved behov.
 * Returnerer true hvis filen ble funnet (uavhengig av om den ble lastet ned).
 */
async function downloadImageIfNeeded(fileName, folderId, destinationPath, label) {
    const driveFile = await findFileMetadataByName(fileName, folderId);
    if (!driveFile) {
        logWarning('Missing Asset', `${label} ikke funnet i Drive: ${fileName}`);
        return false;
    }
    if (await shouldDownload(driveFile, destinationPath)) {
        console.log(`    ⬇️ Laster ned ${label.toLowerCase()}: ${fileName}`);
        await downloadFile(driveFile.id, destinationPath);
    } else {
        console.log(`    ⏭️ Skip: ${fileName} er uendret`);
    }
    return true;
}

/**
 * Sletter lokale filer som ikke lenger er i bruk.
 * Beholder .gitkeep og filer som matcher filterFn (default: alle).
 */
function cleanupUnusedFiles(dirPath, activeNames, label) {
    const localFiles = fs.readdirSync(dirPath);
    localFiles.forEach(file => {
        if (file !== '.gitkeep' && !activeNames.has(file)) {
            console.log(`  🗑️ Sletter ubrukt ${label}: ${file}`);
            fs.unlinkSync(path.join(dirPath, file));
        }
    });
}

/**
 * Henter bilder-mappe-ID, med fallback til regnearkets foreldre-mappe.
 */
async function getImageFolderId(config) {
    if (config.bilderFolderId) return config.bilderFolderId;
    const drive = getDrive();
    const sheetMeta = await drive.files.get({
        fileId: config.spreadsheetId,
        fields: 'parents',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
    });
    return sheetMeta.data.parents?.[0] || null;
}

/**
 * Henter verdier fra et valgfritt Sheets-ark.
 * Returnerer null hvis arket ikke finnes (400 / "Unable to parse range").
 */
async function getOptionalSheetValues(sheets, spreadsheetId, range) {
    try {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
            valueRenderOption: 'UNFORMATTED_VALUE',
        });
        return res.data.values || [];
    } catch (err) {
        if (err.code === 400 || err.message?.includes('Unable to parse range')) {
            return null;
        }
        throw err;
    }
}

function escapeDriveQuery(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function findFileMetadataByName(name, folderId) {
    const drive = getDrive();
    let q = `name = '${escapeDriveQuery(name)}' and trashed = false`;
    if (folderId) {
        q = `'${escapeDriveQuery(folderId)}' in parents and ${q}`;
    }
    const res = await drive.files.list({
        q: q,
        fields: 'files(id, name, md5Checksum)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
    });
    return res.data.files[0];
}

// --- SYNKRONISERINGSLOGIKK ---

// Spesialfunksjon for tannleger (kombinerer Sheets og Bilder)
async function syncTannleger() {
    const config = getConfig();
    const sheets = getSheets();

    console.log('🚀 Synkroniserer tannleger...');
    if (!fs.existsSync(config.paths.tannlegerAssets)) fs.mkdirSync(config.paths.tannlegerAssets, { recursive: true });

    try {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: config.spreadsheetId,
            range: 'tannleger!A2:H',
            valueRenderOption: 'UNFORMATTED_VALUE',
        });

        const rows = res.data.values || [];
        const activeRows = rows.filter(([navn, tittel, beskrivelse, bildeFil, aktiv]) => aktiv?.toLowerCase() === 'ja');
        
        const tannlegeData = await Promise.all(activeRows.map(async ([navn, tittel, beskrivelse, bildeFil, aktiv, skala, posX, posY]) => {
            console.log(`  🔄 Behandler: ${navn}`);
            
            const { scale, positionX, positionY } = parseImageConfig(skala, posX, posY);

            let imageFound = false;
            if (bildeFil) {
                try {
                    const destinationPath = path.join(config.paths.tannlegerAssets, bildeFil);
                    assertSafePath(destinationPath, config.paths.tannlegerAssets);
                    imageFound = await downloadImageIfNeeded(bildeFil, config.tannlegerFolderId, destinationPath, 'Bilde');
                    if (!imageFound) syncWarnings.tannleger.push(bildeFil);
                } catch (imgErr) {
                    logWarning('Download Error', `Feil ved behandling av bilde ${bildeFil}: ${imgErr.message}`);
                }
            }

            return {
                id: navn.toLowerCase().replace(/\s+/g, '-'),
                name: navn,
                title: tittel,
                description: beskrivelse,
                image: imageFound ? bildeFil : '',
                imageConfig: {
                    scale,
                    positionX,
                    positionY
                }
            };
        }));

        // Rydding: Slett bilder som ikke lenger er i bruk
        cleanupUnusedFiles(
            config.paths.tannlegerAssets,
            new Set(tannlegeData.map(t => t.image).filter(Boolean)),
            'bilde'
        );

        fs.writeFileSync(config.paths.tannlegerData, JSON.stringify(tannlegeData, null, 2));
        console.log(`  ✅ Synkroniserte ${tannlegeData.length} tannleger.`);
    } catch (err) {
        console.error('❌ Feil under synkronisering av tannleger:', err.message);
        throw err;
    }
}

// Fellesfunksjon for alle Markdown-samlinger (Tjenester, Meldinger, etc.)
async function syncMarkdownCollection(collection) {
    const drive = getDrive();

    console.log(`🚀 Synkroniserer ${collection.name} (.md)...`);
    if (!fs.existsSync(collection.dest)) fs.mkdirSync(collection.dest, { recursive: true });

    const res = await drive.files.list({
        q: `'${escapeDriveQuery(collection.folderId)}' in parents and trashed = false`,
        fields: 'files(id, name, md5Checksum)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
    });

    const files = (res.data.files || []).filter(f => f.name.endsWith('.md'));

    // Rydding: Slett lokale .md-filer som ikke lenger finnes i Drive
    const localFiles = fs.readdirSync(collection.dest);
    const remoteFileNames = new Set(files.map(f => f.name));
    localFiles.forEach(localFile => {
        if (localFile.endsWith('.md') && !remoteFileNames.has(localFile)) {
            console.log(`  🗑️ Sletter utgått fil: ${collection.name}/${localFile}`);
            fs.unlinkSync(path.join(collection.dest, localFile));
        }
    });

    if (files.length === 0) {
        logWarning('Empty Collection', `Ingen filer funnet i samlingen "${collection.name}"`);
        return;
    }

    // Last ned alle filer i denne samlingen i parallell
    await Promise.all(files.map(async (file) => {
        const destinationPath = path.join(collection.dest, file.name);
        assertSafePath(destinationPath, collection.dest);

        if (await shouldDownload(file, destinationPath)) {
            await downloadFile(file.id, destinationPath);
            console.log(`  ✅ ${collection.name}: ${file.name} (lastet ned)`);
        } else {
            console.log(`    ⏭️ Skip: ${collection.name}/${file.name} er uendret`);
        }
    }));
}

/**
 * Genererer et beskjært OG-bilde (1200×630) som replikerer CSS-en i Forside.astro:
 * object-fit:cover + scale(scale) sentrert på (posX%, posY%).
 */
export async function cropToOG(sourcePath, outputPath, scale = 1, posX = 50, posY = 50) {
    const OG_W = 1200;
    const OG_H = 630;

    const { width: origW, height: origH } = await sharp(sourcePath).metadata();

    // Repliker object-fit:cover: skalér bildet til å dekke OG-rammen
    const coverScale = Math.max(OG_W / origW, OG_H / origH);
    // Legg på brukerzoom oppå cover-skalaen
    const totalScale = coverScale * scale;

    const scaledW = Math.round(origW * totalScale);
    const scaledH = Math.round(origH * totalScale);

    // Fokuspunkt i det skalerte bildet
    const focusX = Math.round(scaledW * posX / 100);
    const focusY = Math.round(scaledH * posY / 100);

    // Klipp ut OG-rammen sentrert på fokuspunktet, begrenset til bildets grenser
    const left = Math.max(0, Math.min(scaledW - OG_W, focusX - Math.round(OG_W / 2)));
    const top  = Math.max(0, Math.min(scaledH - OG_H, focusY - Math.round(OG_H / 2)));

    await sharp(sourcePath)
        .resize(scaledW, scaledH, { fit: 'fill' })
        .extract({ left, top, width: OG_W, height: OG_H })
        .png()
        .toFile(outputPath);
}

// Synkroniserer forsidebilde fra Google Drive.
// Prøver først galleri-arket (type=forsidebilde), deretter fallback til Innstillinger.
async function syncForsideBilde() {
    const config = getConfig();
    const sheets = getSheets();

    console.log('🚀 Synkroniserer forsidebilde...');

    try {
        const forsideFolderId = await getImageFolderId(config);
        if (!forsideFolderId) {
            logWarning('Missing Parent', 'Kunne ikke bestemme foreldre-mappe for regnearket. Hopper over forsidebilde-synkronisering.');
            return;
        }

        let bildeFil = '';
        let scale = 1;
        let posX = 50;
        let posY = 50;

        // Prøv galleri-arket først
        let foundInGalleri = false;
        const galleriRows = await getOptionalSheetValues(sheets, config.spreadsheetId, 'galleri!A2:I');
        if (galleriRows) {
            const forsideRow = galleriRows.find(row =>
                (row[8] || '').toLowerCase() === 'forsidebilde' &&
                (row[3] || '').toLowerCase() === 'ja'
            );
            if (forsideRow) {
                bildeFil = forsideRow[1] || '';
                const parsed = parseImageConfig(forsideRow[5], forsideRow[6], forsideRow[7]);
                scale = parsed.scale;
                posX = parsed.positionX;
                posY = parsed.positionY;
                foundInGalleri = true;
                console.log('  📋 Forsidebilde funnet i galleri-arket.');
            }
        } else {
            console.log('  ℹ️ Galleri-ark ikke tilgjengelig, faller tilbake til Innstillinger.');
        }

        // Fallback: Les fra Innstillinger-arket
        if (!foundInGalleri) {
            const res = await sheets.spreadsheets.values.get({
                spreadsheetId: config.spreadsheetId,
                range: 'Innstillinger!A:B',
                valueRenderOption: 'UNFORMATTED_VALUE',
            });

            const rows = res.data.values || [];
            const getRow = (key, def) => parseFloat(rows.find(r => r[0] === key)?.[1]) || def;

            bildeFil = rows.find(r => r[0] === 'forsideBilde')?.[1] || '';
            scale    = getRow('forsideBildeScale', 1);
            posX     = getRow('forsideBildePosX',  50);
            posY     = getRow('forsideBildePosY',  50);
        }

        if (!bildeFil) {
            console.log('  ℹ️ Ingen forsidebilde konfigurert, hopper over.');
            return;
        }

        const destinationPath = path.join(process.cwd(), 'src/assets/hovedbilde.png');
        const found = await downloadImageIfNeeded(bildeFil, forsideFolderId, destinationPath, 'Forsidebilde');
        if (!found) return;

        // Generer beskjært OG-bilde (1200×630) til public/ med samme utsnitt som forsiden
        const publicPath = path.join(process.cwd(), 'public/hovedbilde.png');
        console.log(`  ✂️ Genererer OG-bilde (scale=${scale}, x=${posX}%, y=${posY}%)...`);
        await cropToOG(destinationPath, publicPath, scale, posX, posY);

        console.log('  ✅ Forsidebilde synkronisert.');
    } catch (err) {
        console.error('❌ Feil under synkronisering av forsidebilde:', err.message);
        throw err;
    }
}

// Synkroniserer galleribilder fra Google Drive + Sheets
async function syncGalleri() {
    const config = getConfig();
    const sheets = getSheets();

    console.log('🚀 Synkroniserer galleri...');
    if (!fs.existsSync(config.paths.galleriAssets)) fs.mkdirSync(config.paths.galleriAssets, { recursive: true });

    try {
        const folderId = await getImageFolderId(config);
        if (!folderId) {
            logWarning('Missing Parent', 'Kunne ikke bestemme foreldre-mappe for regnearket. Hopper over galleri-synkronisering.');
            return;
        }

        const rows = await getOptionalSheetValues(sheets, config.spreadsheetId, 'galleri!A2:I');
        if (rows === null) {
            console.log('  ℹ️ Fane "galleri" finnes ikke ennå. Opprett den via admin-panelet.');
            fs.writeFileSync(config.paths.galleriData, JSON.stringify([]));
            console.log('  ✅ Tom galleri.json skrevet.');
            return;
        }
        // Kun aktive rader – forsidebilde inkluderes for metadata (utsnitt), men bildet lastes av syncForsideBilde
        const activeRows = rows.filter(([tittel, bildeFil, altTekst, aktiv]) =>
            aktiv?.toLowerCase() === 'ja'
        );

        const galleriData = await Promise.all(activeRows.map(async ([tittel, bildeFil, altTekst, aktiv, rekkefølge, skala, posX, posY, type]) => {
            const rowType = (type || 'galleri').toLowerCase();
            const isForsidebilde = rowType === 'forsidebilde';
            console.log(`  🔄 Behandler: ${tittel || bildeFil}${isForsidebilde ? ' (forsidebilde)' : ''}`);

            const { scale, positionX, positionY } = parseImageConfig(skala, posX, posY);

            const parsedOrder = parseInt(rekkefølge, 10);
            const order = (!isNaN(parsedOrder)) ? parsedOrder : 99;

            // Forsidebilde-filen lastes ned av syncForsideBilde(), ikke her
            let imageFound = isForsidebilde; // forsidebilde håndteres separat
            if (bildeFil && !isForsidebilde) {
                try {
                    const destinationPath = path.join(config.paths.galleriAssets, bildeFil);
                    assertSafePath(destinationPath, config.paths.galleriAssets);
                    imageFound = await downloadImageIfNeeded(bildeFil, folderId, destinationPath, 'Galleribilde');
                    if (!imageFound) syncWarnings.galleri.push(bildeFil);
                } catch (imgErr) {
                    logWarning('Download Error', `Feil ved behandling av galleribilde ${bildeFil}: ${imgErr.message}`);
                }
            }

            return {
                id: (tittel || bildeFil || 'galleri').toLowerCase().replace(/\s+/g, '-'),
                title: tittel || '',
                image: imageFound ? (bildeFil || '') : '',
                altText: altTekst || '',
                order,
                type: rowType,
                imageConfig: {
                    scale,
                    positionX,
                    positionY
                }
            };
        }));

        // Rydding: Slett bilder som ikke lenger er i bruk
        cleanupUnusedFiles(
            config.paths.galleriAssets,
            new Set(galleriData.map(g => g.image).filter(Boolean)),
            'galleribilde'
        );

        fs.writeFileSync(config.paths.galleriData, JSON.stringify(galleriData, null, 2));
        console.log(`  ✅ Synkroniserte ${galleriData.length} galleribilder.`);
    } catch (err) {
        console.error('❌ Feil under synkronisering av galleri:', err.message);
        throw err;
    }
}

// Synkroniserer innstillinger fra Google Sheets til lokal JSON
async function syncInnstillinger() {
    const config = getConfig();
    const sheets = getSheets();

    console.log('🚀 Synkroniserer innstillinger...');

    try {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: config.spreadsheetId,
            range: 'Innstillinger!A:B',
            valueRenderOption: 'UNFORMATTED_VALUE',
        });

        const rows = res.data.values || [];
        // Hopp over header-rad, mapper til {id, value}
        const innstillingerData = rows.slice(1)
            .filter(row => row[0])
            .map(row => ({
                id: String(row[0]).trim(),
                value: row[1] != null ? String(row[1]).trim() : ''
            }));

        fs.writeFileSync(config.paths.innstillingerData, JSON.stringify(innstillingerData, null, 2));

        // Logg oversikt: hva kommer fra Sheets vs. hva bruker hardkodet default
        const sheetKeys = new Set(innstillingerData.map(d => d.id));
        const fromSheet = HARD_DEFAULT_KEYS.filter(k => sheetKeys.has(k));
        const fromDefault = HARD_DEFAULT_KEYS.filter(k => !sheetKeys.has(k));
        const unknown = innstillingerData.filter(d => !HARD_DEFAULT_KEYS.includes(d.id)).map(d => d.id);

        console.log(`  ✅ Synkroniserte ${innstillingerData.length} innstillinger (${fromSheet.length} fra Sheets, ${fromDefault.length} bruker default${unknown.length ? `, ${unknown.length} ukjente` : ''}).`);
        if (fromDefault.length > 0) {
            console.log(`  ℹ️  Default: ${fromDefault.join(', ')}`);
        }
        if (unknown.length > 0) {
            unknown.forEach(key => logWarning('Ukjent innstilling', `Nøkkel "${key}" i Sheets finnes ikke i HARD_DEFAULTS (ignorert)`));
        }
    } catch (err) {
        console.error('❌ Feil under synkronisering av innstillinger:', err.message);
        throw err;
    }
}

// Synkroniserer prisliste fra Google Sheets til lokal JSON
async function syncPrisliste() {
    const config = getConfig();
    const sheets = getSheets();

    console.log('Synkroniserer prisliste...');

    try {
        const rows = await getOptionalSheetValues(sheets, config.spreadsheetId, 'Prisliste!A2:E');
        if (rows === null) {
            console.log('  Fane "Prisliste" finnes ikke enda. Skriver tom fil.');
            fs.writeFileSync(config.paths.prislisteData, JSON.stringify([]));
            return;
        }
        const prislisteData = rows
            .filter(row => row[0] && row[1])
            .map(([kategori, behandling, pris, sistOppdatert, orderRaw]) => {
                const orderParsed = parseInt(orderRaw, 10);
                return {
                    kategori: String(kategori).trim(),
                    behandling: String(behandling).trim(),
                    pris: pris ?? '',
                    sistOppdatert: sistOppdatert ? String(sistOppdatert).trim() : '',
                    order: isNaN(orderParsed) ? 0 : orderParsed,
                };
            });

        // Hent kategori-rekkefølge fra eget ark
        let kategoriOrder = [];
        const katRows = await getOptionalSheetValues(sheets, config.spreadsheetId, 'KategoriRekkefølge!A2:B');
        if (katRows) {
            kategoriOrder = katRows.map(([kategori, order]) => ({
                kategori: String(kategori).trim(),
                order: parseInt(order, 10) || 0,
            }));
        } else {
            console.log('  Fane "KategoriRekkefølge" finnes ikke enda. Bruker alfabetisk sortering.');
        }

        // Finn nyeste sistOppdatert-dato blant alle rader
        let sistOppdatert = '';
        for (const row of prislisteData) {
            if (row.sistOppdatert && row.sistOppdatert > sistOppdatert) {
                sistOppdatert = row.sistOppdatert;
            }
        }

        const output = { sistOppdatert, kategoriOrder, items: prislisteData };
        fs.writeFileSync(config.paths.prislisteData, JSON.stringify(output, null, 2));
        console.log(`  Synkroniserte ${prislisteData.length} prisrader.`);
    } catch (err) {
        console.error('Feil under synkronisering av prisliste:', err.message);
        throw err;
    }
}

// --- KJØRER ALT ---

async function runSync() {
    syncWarnings.galleri = [];
    syncWarnings.tannleger = [];
    const config = getConfig();

    // Sjekk for påkrevde miljøvariabler
    const requiredEnv = [
        'GOOGLE_SERVICE_ACCOUNT_EMAIL',
        'GOOGLE_PRIVATE_KEY',
        'PUBLIC_GOOGLE_SHEET_ID',
        'PUBLIC_GOOGLE_DRIVE_TJENESTER_FOLDER_ID',
        'PUBLIC_GOOGLE_DRIVE_MELDINGER_FOLDER_ID',
        'PUBLIC_GOOGLE_DRIVE_TANNLEGER_FOLDER_ID'
    ];

    const missing = requiredEnv.filter(key => !process.env[key]);

    if (missing.length > 0) {
        console.error('⚠️  Manglende miljøvariabler for synkronisering:');
        missing.forEach(key => console.error(`   - ${key}`));
        
        if (process.env.GITHUB_ACTIONS) {
            console.error('   💡 Hvis dette er et Dependabot-bygg, må du legge til disse i "Dependabot secrets".');
            process.exit(0); 
        }
        if (process.env.NODE_ENV !== 'test') {
            process.exit(1);
        }
    }

    try {
        // 1. Synkroniser innstillinger fra Sheets
        await syncInnstillinger();

        // 1b. Synkroniser prisliste fra Sheets
        await syncPrisliste();

        // 2. Synkroniser tannleger fra ark
        await syncTannleger();

        // 3. Synkroniser forsidebilde (valgfritt – hopper over hvis mappe-ID mangler)
        await syncForsideBilde();

        // 4. Synkroniser galleribilder
        await syncGalleri();

        // 5. Synkroniser alle markdown-samlinger fra mapper
        for (const col of config.collections) {
            await syncMarkdownCollection(col);
        }

        // Samlet konsistensrapport
        const hasWarnings = syncWarnings.galleri.length > 0 || syncWarnings.tannleger.length > 0;
        if (hasWarnings) {
            const lines = ['Konsistenssjekk:'];
            lines.push(`  Galleri: ${syncWarnings.galleri.length} bilde(r) i Sheet mangler i Drive${syncWarnings.galleri.length > 0 ? ` (${syncWarnings.galleri.join(', ')})` : ''}`);
            lines.push(`  Tannleger: ${syncWarnings.tannleger.length} manglende bilde(r)${syncWarnings.tannleger.length > 0 ? ` (${syncWarnings.tannleger.join(', ')})` : ''}`);
            logWarning('Konsistenssjekk', lines.join(' | '));
        }

        console.log('✨ Alt er synkronisert!');
    } catch (err) {
        console.error('❌ Synkronisering feilet:', err.message);
        if (process.env.NODE_ENV !== 'test') {
            process.exit(1);
        }
        throw err;
    }
}

/* v8 ignore start */
if (process.env.NODE_ENV !== 'test') {
    (async () => {
        await runSync();
    })();
}
/* v8 ignore stop */

export { syncTannleger, syncMarkdownCollection, syncForsideBilde, syncGalleri, syncPrisliste, syncInnstillinger, runSync, getConfig, getLocalHash, shouldDownload, downloadImageIfNeeded, HARD_DEFAULT_KEYS, escapeDriveQuery, assertSafePath, cleanupUnusedFiles, getImageFolderId, getOptionalSheetValues };
