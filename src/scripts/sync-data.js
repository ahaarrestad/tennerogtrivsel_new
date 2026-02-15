import 'dotenv/config';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';

// --- KONFIGURASJON ---
function getConfig() {
    return {
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        paths: {
            tannlegerAssets: path.join(process.cwd(), 'src/assets/tannleger'),
            tannlegerData: path.join(process.cwd(), 'src/content/tannleger.json'),
        },
        collections: [
            {
                name: 'tjenester',
                folderId: process.env.GOOGLE_DRIVE_TJENESTER_FOLDER_ID,
                dest: path.join(process.cwd(), 'src/content/tjenester')
            },
            {
                name: 'meldinger',
                folderId: process.env.GOOGLE_DRIVE_MELDINGER_FOLDER_ID,
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

async function downloadFile(fileId, destinationPath) {
    const drive = getDrive();
    const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
    await pipeline(res.data, fs.createWriteStream(destinationPath));
}

async function findFileIdByName(name) {
    const drive = getDrive();
    const res = await drive.files.list({
        q: `name = '${name}' and trashed = false`,
        fields: 'files(id)',
    });
    return res.data.files[0]?.id;
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
            range: 'tannleger!A2:E',
        });

        const rows = res.data.values || [];
        const activeRows = rows.filter(([navn, tittel, beskrivelse, bildeFil, aktiv]) => aktiv?.toLowerCase() === 'ja');
        
        // Optimalisering: Hvis vi hadde en bilde-mappe-ID kunne vi brukt getFileMapInFolder her.
        // Siden vi ikke har det ennå, kjører vi søk og nedlasting i kontrollerte grupper eller parallelt.
        
        const tannlegeData = await Promise.all(activeRows.map(async ([navn, tittel, beskrivelse, bildeFil]) => {
            console.log(`  🔄 Behandler: ${navn}`);
            
            if (bildeFil) {
                try {
                    const destinationPath = path.join(config.paths.tannlegerAssets, bildeFil);
                    
                    // Optimalisering: Sjekk om filen allerede finnes
                    if (fs.existsSync(destinationPath)) {
                        console.log(`    ⏭️ Gjenbruker eksisterende bilde: ${bildeFil}`);
                    } else {
                        const fileId = await findFileIdByName(bildeFil);
                        if (fileId) {
                            console.log(`    ⬇️ Laster ned bilde: ${bildeFil}`);
                            await downloadFile(fileId, destinationPath);
                        } else {
                            console.warn(`    ⚠️ Bilde ikke funnet i Drive: ${bildeFil}`);
                        }
                    }
                } catch (imgErr) {
                    console.error(`    ❌ Feil ved nedlasting av bilde ${bildeFil}:`, imgErr.message);
                }
            }

            return {
                id: navn.toLowerCase().replace(/\s+/g, '-'),
                name: navn,
                title: tittel,
                description: beskrivelse,
                image: bildeFil
            };
        }));

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
        fields: 'files(id, name)',
    });

    const files = (res.data.files || []).filter(f => f.name.endsWith('.md'));
    if (files.length === 0) {
        console.warn(`  ⚠️ Ingen filer funnet i ${collection.name}`);
        return;
    }

    // Last ned alle filer i denne samlingen i parallell
    await Promise.all(files.map(async (file) => {
        await downloadFile(file.id, path.join(collection.dest, file.name));
        console.log(`  ✅ ${collection.name}: ${file.name}`);
    }));
}

// --- KJØRER ALT ---

async function runSync() {
    const config = getConfig();

    // Sjekk for påkrevde miljøvariabler
    const requiredEnv = [
        'GOOGLE_SERVICE_ACCOUNT_EMAIL',
        'GOOGLE_PRIVATE_KEY',
        'GOOGLE_SHEET_ID',
        'GOOGLE_DRIVE_TJENESTER_FOLDER_ID',
        'GOOGLE_DRIVE_MELDINGER_FOLDER_ID'
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

        // 2. Synkroniser alle markdown-samlinger fra mapper
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

export { syncTannleger, syncMarkdownCollection, runSync, getConfig };