import { describe, it, expect } from 'vitest';
import { drive } from '@googleapis/drive';
import { sheets } from '@googleapis/sheets';
import { GoogleAuth } from 'google-auth-library';

// Røyktest mot de ekte Google-pakkene (sync-data.test.js mocker dem helt).
// Fanger major-oppdateringer som fjerner fabrikker eller metoder sync-data.js bruker.
// Ingen nettverk: klientene bygges, men ingen kall gjøres.
describe('Google API-klienter brukt av sync-data.js', () => {
    const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/drive.readonly'] });

    it('drive v3 har files.get og files.list', () => {
        const client = drive({ version: 'v3', auth });
        expect(client.files.get).toBeTypeOf('function');
        expect(client.files.list).toBeTypeOf('function');
    });

    it('sheets v4 har spreadsheets.values.get', () => {
        const client = sheets({ version: 'v4', auth });
        expect(client.spreadsheets.values.get).toBeTypeOf('function');
    });
});
