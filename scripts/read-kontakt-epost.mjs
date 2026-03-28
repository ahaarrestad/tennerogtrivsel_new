/**
 * Leser kontaktEpost fra KontaktSkjema-fanen i Google Sheets.
 * Brukes av GitHub Actions for å oppdatere Lambda-miljøvariabel ved bygg.
 * Output: e-postadresse (tom streng hvis ikke funnet).
 */
try { process.loadEnvFile(); } catch { /* ok — CI setter env vars direkte */ }

import { sheets as sheetsFactory } from '@googleapis/sheets';
import { GoogleAuth } from 'google-auth-library';

const auth = new GoogleAuth({
    credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sh = sheetsFactory({ version: 'v4', auth });

try {
    const res = await sh.spreadsheets.values.get({
        spreadsheetId: process.env.PUBLIC_GOOGLE_SHEET_ID,
        range: 'KontaktSkjema!A:B',
        valueRenderOption: 'UNFORMATTED_VALUE',
    });
    const rows = res.data.values || [];
    const epost = rows.find(r => r[0] === 'kontaktEpost')?.[1] || '';
    process.stdout.write(epost);
} catch {
    process.stdout.write('');
}
