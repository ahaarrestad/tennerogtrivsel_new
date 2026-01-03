import 'dotenv/config';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';

// --- KONFIGURASJON ---
const CONFIG = {
    spreadsheetId: '1XTRkjyJpAk7hMNe4tfhhA3nI0BwmOfrR0dzj5iC_Hoo',
    tjenesterFolderId: '1h_iXI-fFrIpfDfT1yZvkGpbOZKgbd1n6',
    paths: {
        tannlegerAssets: path.join(process.cwd(), 'src/assets/tannleger'),
        tannlegerData: path.join(process.cwd(), 'src/content/tannleger.json'),
        tjenesterContent: path.join(process.cwd(), 'src/content/tjenester'),
    }
};

// --- GOOGLE AUTH ---
const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: [
        'https://www.googleapis.com/auth/spreadsheets.readonly',
        'https://www.googleapis.com/auth/drive.readonly'
    ],
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

// --- HOVEDLOGIKK ---

async function syncTannleger() {
    console.log('🚀 Synkroniserer tannleger...');
    if (!fs.existsSync(CONFIG.paths.tannlegerAssets)) fs.mkdirSync(CONFIG.paths.tannlegerAssets, { recursive: true });

    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: CONFIG.spreadsheetId,
        range: 'tannleger!A2:E',
    });

    const tannlegeData = [];
    for (const [navn, tittel, beskrivelse, bildeFil, aktiv] of res.data.values || []) {
        console.log(` 🔄 Behandler tannlege: ${navn}`);
        if (aktiv?.toLowerCase() !== 'ja') continue;

        if (bildeFil) {
            const fileId = await findFileIdByName(bildeFil);
            if (fileId) {
                await downloadFile(fileId, path.join(CONFIG.paths.tannlegerAssets, bildeFil));
                console.log(`  ✅ Bilde: ${bildeFil}`);
            }
        }
        tannlegeData.push({ navn, tittel, beskrivelse, bildeFil });
    }

    fs.writeFileSync(CONFIG.paths.tannlegerData, JSON.stringify(tannlegeData, null, 2));
}

async function syncTjenester() {
    console.log('🚀 Synkroniserer tjenester (.md)...');

    // Sikre at mappen eksisterer
    if (!fs.existsSync(CONFIG.paths.tjenesterContent)) {
        fs.mkdirSync(CONFIG.paths.tjenesterContent, { recursive: true });
    }

    // Vi søker etter ALLE filer i mappen uten mimeType-filter for å være sikre
    const res = await drive.files.list({
        q: `'${CONFIG.tjenesterFolderId}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType)',
    });

    if (!res.data.files || res.data.files.length === 0) {
        console.warn('  ⚠️ Ingen filer funnet! Sjekk tilgang for Service Account og mappe-ID.');
        return;
    }

    for (const file of res.data.files) {
        // Vi laster kun ned filer som slutter på .md
        if (file.name.endsWith('.md')) {
            const destination = path.join(CONFIG.paths.tjenesterContent, file.name);
            await downloadFile(file.id, destination);
            console.log(`  ✅ Dokument: ${file.name}`);
        } else {
            console.log(`  ⏩ Hopper over (ikke .md): ${file.name}`);
        }
    }
}

// --- KJØRER ALT ---

(async () => {
    try {
        await syncTannleger();
        await syncTjenester();
        console.log('✨ Alt er synkronisert!');
    } catch (err) {
        console.error('❌ Synkronisering feilet:', err.message);
        process.exit(1);
    }
})();