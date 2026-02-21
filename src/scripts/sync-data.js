import 'dotenv/config';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import crypto from 'crypto';

// --- KONFIGURASJON ---
function getConfig() {
    return {
        spreadsheetId: process.env.PUBLIC_GOOGLE_SHEET_ID,
        tannlegerFolderId: process.env.PUBLIC_GOOGLE_DRIVE_TANNLEGER_FOLDER_ID,
        paths: {
            tannlegerAssets: path.join(process.cwd(), 'src/assets/tannleger'),
            tannlegerData: path.join(process.cwd(), 'src/content/tannleger.json'),
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
    return new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly', 'https://www.googleapis.com/auth/drive.readonly'],
    });
}

function getDrive() {
    return google.drive({ version: 'v3', auth: getAuth() });
}

function getSheets() {
    return google.sheets({ version: 'v4', auth: getAuth() });
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

async function downloadFile(fileId, destinationPath) {
    const drive = getDrive();
    const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
    await pipeline(res.data, fs.createWriteStream(destinationPath));
}

async function findFileMetadataByName(name, folderId) {
    const drive = getDrive();
    let q = `name = '${name}' and trashed = false`;
    if (folderId) {
        q = `'${folderId}' in parents and ${q}`;
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
        });

        const rows = res.data.values || [];
        const activeRows = rows.filter(([navn, tittel, beskrivelse, bildeFil, aktiv]) => aktiv?.toLowerCase() === 'ja');
        
        const tannlegeData = await Promise.all(activeRows.map(async ([navn, tittel, beskrivelse, bildeFil, aktiv, skala, posX, posY]) => {
            console.log(`  🔄 Behandler: ${navn}`);
            
            // Pars og valider bilde-justeringer med trygge defaults
            let scale = parseFloat(skala);
            scale = (!isNaN(scale) && scale >= 0.5 && scale <= 2.0) ? scale : 1.0;
            if (!isNaN(parseFloat(skala)) && parseFloat(skala) < 0.5) scale = 0.5; // Clamp min
            if (!isNaN(parseFloat(skala)) && parseFloat(skala) > 2.0) scale = 2.0; // Clamp max
            
            const parsedX = parseInt(posX);
            const positionX = (!isNaN(parsedX) && parsedX >= 0 && parsedX <= 100) ? parsedX : 50;
            
            const parsedY = parseInt(posY);
            const positionY = (!isNaN(parsedY) && parsedY >= 0 && parsedY <= 100) ? parsedY : 50;

            if (bildeFil) {
                try {
                    const destinationPath = path.join(config.paths.tannlegerAssets, bildeFil);
                    const driveFile = await findFileMetadataByName(bildeFil, config.tannlegerFolderId);

                    if (driveFile) {
                                                if (await shouldDownload(driveFile, destinationPath)) {
                                                    console.log(`    ⬇️ Laster ned bilde: ${bildeFil}`);
                                                    await downloadFile(driveFile.id, destinationPath);
                                                } else {
                                                    console.log(`    ⏭️ Skip: ${bildeFil} er uendret`);
                                                }
                                            } else {
                                                logWarning('Missing Asset', `Bilde ikke funnet i Drive: ${bildeFil}`);
                                            }
                                        } catch (imgErr) {
                                            logWarning('Download Error', `Feil ved behandling av bilde ${bildeFil}: ${imgErr.message}`);
                                        }
                                    }
                        
                                    return {
                                        id: navn.toLowerCase().replace(/\s+/g, '-'),
                                        name: navn,
                                        title: tittel,
                                        description: beskrivelse,
                                        image: bildeFil,
                                        imageConfig: {
                                            scale,
                                            positionX,
                                            positionY
                                        }
                                    };
                                }));
                        
                                // Rydding: Slett bilder som ikke lenger er i bruk
                                const localAssets = fs.readdirSync(config.paths.tannlegerAssets);
                                const activeImages = new Set(tannlegeData.map(t => t.image).filter(Boolean));

                                localAssets.forEach(file => {
                                    if (file !== '.gitkeep' && !activeImages.has(file)) {
                                        const pathToDelete = path.join(config.paths.tannlegerAssets, file);
                                        console.log(`  🗑️ Sletter ubrukt bilde: ${file}`);
                                        fs.unlinkSync(pathToDelete);
                                    }
                                });

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
                                q: `'${collection.folderId}' in parents and trashed = false`,
                                fields: 'files(id, name, md5Checksum)',
                                supportsAllDrives: true,
                                includeItemsFromAllDrives: true
                            });
                        
                            const files = (res.data.files || []).filter(f => f.name.endsWith('.md'));
                            
                            // Rydding: Slett lokale filer som ikke lenger finnes i Drive
                            const localFiles = fs.readdirSync(collection.dest);
                            const remoteFileNames = new Set(files.map(f => f.name));

                            localFiles.forEach(localFile => {
                                if (localFile.endsWith('.md') && !remoteFileNames.has(localFile)) {
                                    const pathToDelete = path.join(collection.dest, localFile);
                                    console.log(`  🗑️ Sletter utgått fil: ${collection.name}/${localFile}`);
                                    fs.unlinkSync(pathToDelete);
                                }
                            });

                            if (files.length === 0) {
                                logWarning('Empty Collection', `Ingen filer funnet i samlingen "${collection.name}"`);
                                return;
                            }
                        
                            // Last ned alle filer i denne samlingen i parallell
                            await Promise.all(files.map(async (file) => {
                                const destinationPath = path.join(collection.dest, file.name);
                                
                                if (await shouldDownload(file, destinationPath)) {
                                    await downloadFile(file.id, destinationPath);
                                    console.log(`  ✅ ${collection.name}: ${file.name} (lastet ned)`);
                                } else {
                                    console.log(`    ⏭️ Skip: ${collection.name}/${file.name} er uendret`);
                                }
                            }));
                        }

// Synkroniserer forsidebilde fra Google Drive basert på innstillingen i Sheets
async function syncForsideBilde() {
    const config = getConfig();
    const drive = getDrive();
    const sheets = getSheets();

    console.log('🚀 Synkroniserer forsidebilde...');

    try {
        // Hent foreldre-mappen til regnearket – bilder lagres der
        const sheetMeta = await drive.files.get({
            fileId: config.spreadsheetId,
            fields: 'parents',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true
        });
        const forsideFolderId = sheetMeta.data.parents?.[0];

        if (!forsideFolderId) {
            logWarning('Missing Parent', 'Kunne ikke bestemme foreldre-mappe for regnearket. Hopper over forsidebilde-synkronisering.');
            return;
        }

        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: config.spreadsheetId,
            range: 'Innstillinger!A:B',
        });

        const rows = res.data.values || [];
        const forsideRow = rows.find(row => row[0] === 'forsideBilde');
        const bildeFil = forsideRow?.[1] || '';

        if (!bildeFil) {
            console.log('  ℹ️ Ingen forsidebilde konfigurert, hopper over.');
            return;
        }

        const destinationPath = path.join(process.cwd(), 'src/assets/hovedbilde.png');
        const driveFile = await findFileMetadataByName(bildeFil, forsideFolderId);

        if (!driveFile) {
            logWarning('Missing Asset', `Forsidebilde ikke funnet i Drive: ${bildeFil}`);
            return;
        }

        if (await shouldDownload(driveFile, destinationPath)) {
            console.log(`  ⬇️ Laster ned forsidebilde: ${bildeFil}`);
            await downloadFile(driveFile.id, destinationPath);
        } else {
            console.log(`  ⏭️ Skip: forsidebilde er uendret`);
        }

        // Kopier til public/ slik at OG-meta-taggen alltid peker på admin-valgt bilde
        const publicPath = path.join(process.cwd(), 'public/hovedbilde.png');
        await fs.promises.copyFile(destinationPath, publicPath);

        console.log('  ✅ Forsidebilde synkronisert.');
    } catch (err) {
        console.error('❌ Feil under synkronisering av forsidebilde:', err.message);
        throw err;
    }
}

// --- KJØRER ALT ---

async function runSync() {
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
        // 1. Synkroniser tannleger fra ark
        await syncTannleger();

        // 2. Synkroniser forsidebilde (valgfritt – hopper over hvis mappe-ID mangler)
        await syncForsideBilde();

        // 3. Synkroniser alle markdown-samlinger fra mapper
        for (const col of config.collections) {
            await syncMarkdownCollection(col);
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

export { syncTannleger, syncMarkdownCollection, syncForsideBilde, runSync, getConfig, getLocalHash, shouldDownload };
