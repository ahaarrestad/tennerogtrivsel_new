import 'dotenv/config';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';

// --- KONFIGURASJON ---
const CONFIG = {
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

// --- GOOGLE AUTH ---
const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly', 'https://www.googleapis.com/auth/drive.readonly'],
});

const drive = google.drive({ version: 'v3', auth });
const sheets = google.sheets({ version: 'v4', auth });

// --- HJELPEFUNKSJONER ---

async function downloadFile(fileId, destinationPath) {
    const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
    await pipeline(res.data, fs.createWriteStream(destinationPath));
}

async function findFileIdByName(name) {
    const res = await drive.files.list({
        q: `name = '${name}' and trashed = false`,
        fields: 'files(id)',
    });
    return res.data.files[0]?.id;
}

// --- SYNKRONISERINGSLOGIKK ---

// Spesialfunksjon for tannleger (kombinerer Sheets og Bilder)
async function syncTannleger() {
    console.log('🚀 Synkroniserer tannleger...');
    if (!fs.existsSync(CONFIG.paths.tannlegerAssets)) fs.mkdirSync(CONFIG.paths.tannlegerAssets, { recursive: true });

    try {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: CONFIG.spreadsheetId,
            range: 'tannleger!A2:E',
        });

        const tannlegeData = [];
        const rows = res.data.values || [];
        
        for (const [navn, tittel, beskrivelse, bildeFil, aktiv] of rows) {
            if (aktiv?.toLowerCase() !== 'ja') continue;
            console.log(`  🔄 Behandler: ${navn}`);

            if (bildeFil) {
                try {
                    const fileId = await findFileIdByName(bildeFil);
                    if (fileId) {
                        console.log(`    ⬇️ Laster ned bilde: ${bildeFil}`);
                        await downloadFile(fileId, path.join(CONFIG.paths.tannlegerAssets, bildeFil));
                    } else {
                        console.warn(`    ⚠️ Bilde ikke funnet i Drive: ${bildeFil}`);
                    }
                } catch (imgErr) {
                    console.error(`    ❌ Feil ved nedlasting av bilde ${bildeFil}:`, imgErr.message);
                }
            }
            
            tannlegeData.push({
                id: navn.toLowerCase().replace(/\s+/g, '-'), // Enkel ID-generering
                name: navn,
                title: tittel,
                description: beskrivelse,
                image: bildeFil
            });
        }
        fs.writeFileSync(CONFIG.paths.tannlegerData, JSON.stringify(tannlegeData, null, 2));
        console.log(`  ✅ Synkroniserte ${tannlegeData.length} tannleger.`);
    } catch (err) {
        console.error('❌ Feil under synkronisering av tannleger:', err.message);
        throw err;
    }
}

// Fellesfunksjon for alle Markdown-samlinger (Tjenester, Meldinger, etc.)
async function syncMarkdownCollection(collection) {
    console.log(`🚀 Synkroniserer ${collection.name} (.md)...`);
    if (!fs.existsSync(collection.dest)) fs.mkdirSync(collection.dest, { recursive: true });

    const res = await drive.files.list({
        q: `'${collection.folderId}' in parents and trashed = false`,
        fields: 'files(id, name)',
    });

    const files = res.data.files || [];
    if (files.length === 0) console.warn(`  ⚠️ Ingen filer funnet i ${collection.name}`);

    for (const file of files) {
        if (file.name.endsWith('.md')) {
            await downloadFile(file.id, path.join(collection.dest, file.name));
            console.log(`  ✅ ${collection.name}: ${file.name}`);
        }
    }
}

// --- KJØRER ALT ---

(async () => {
    try {
        // 1. Synkroniser tannleger fra ark
        await syncTannleger();

        // 2. Synkroniser alle markdown-samlinger fra mapper
        for (const col of CONFIG.collections) {
            await syncMarkdownCollection(col);
        }

        console.log('✨ Alt er synkronisert!');
    } catch (err) {
        console.error('❌ Synkronisering feilet:', err.message);
        process.exit(1);
    }
})();