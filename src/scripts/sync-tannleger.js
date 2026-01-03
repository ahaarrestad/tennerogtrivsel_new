import 'dotenv/config';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';

async function syncTannleger() {
    console.log('--- Starter synkronisering fra Google Drive/Sheets ---');

    // 1. Autentisering med dine spesifikke variabelnavn
    const credentials = {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: [
            'https://www.googleapis.com/auth/spreadsheets.readonly',
            'https://www.googleapis.com/auth/drive.readonly'
        ],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const drive = google.drive({ version: 'v3', auth });

    // Konfigurasjon
    const SPREADSHEET_ID = '1XTRkjyJpAk7hMNe4tfhhA3nI0BwmOfrR0dzj5iC_Hoo'; // Erstatt med ID fra URL-en til arket
    const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const IMAGE_DEST = path.join(process.cwd(), 'src/assets/tannleger');

    // Sjekk at mappen eksisterer
    if (!fs.existsSync(IMAGE_DEST)) {
        fs.mkdirSync(IMAGE_DEST, { recursive: true });
    }

    try {
        // 2. Hent rader fra Google Sheets
        const sheetRes = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'tannleger!A2:E', // Forutsetter Ark-navn "Tannleger" og kolonner A-E
        });

        const rader = sheetRes.data.values || [];
        const tannlegeData = [];

        for (const [navn, tittel, beskrivelse, bildeFil, aktiv] of rader) {
            // Sikkerhetsmekanisme 1: Hopp over hvis ikke aktiv
            if (aktiv?.toLowerCase() !== 'ja') continue;

            console.log(`Behandler: ${navn}...`);

            // Sikkerhetsmekanisme 2: Sjekk om bilde_fil er oppgitt
            if (bildeFil) {
                try {
                    // Vi søker etter filen ved navn i ALLE mapper service-accounten ser
                    const fileSearch = await drive.files.list({
                        q: `name = '${bildeFil}' and trashed = false`,
                        fields: 'files(id, name)',
                    });

                    if (fileSearch.data.files.length > 0) {
                        const fileId = fileSearch.data.files[0].id;

                        // Lagres flatt i IMAGE_DEST (src/assets/tannleger/)
                        const filePath = path.join(IMAGE_DEST, bildeFil);

                        const driveRes = await drive.files.get(
                            { fileId, alt: 'media' },
                            { responseType: 'stream' }
                        );

                        await pipeline(driveRes.data, fs.createWriteStream(filePath));
                        console.log(`  ✅ Hentet: ${bildeFil}`);
                    } else {
                        console.warn(`  ⚠️ Fant ikke "${bildeFil}" på Drive.`);
                    }
                } catch (err) {
                    console.error(`  ❌ Feil ved henting av ${bildeFil}:`, err.message);
                }
            }

            tannlegeData.push({ navn, tittel, beskrivelse, bildeFil });
        }

        // 3. Lagre JSON-fil som Astro bruker som datakilde
        fs.writeFileSync(
            path.join(process.cwd(), 'src/content/tannleger.json'),
            JSON.stringify(tannlegeData, null, 2)
        );

        console.log('--- Synkronisering fullført! ---');

    } catch (error) {
        console.error('Kritisk feil under synkronisering:', error.message);
        process.exit(1); // Stopper build på GitHub hvis vi ikke får kontakt med Google
    }
}

syncTannleger();