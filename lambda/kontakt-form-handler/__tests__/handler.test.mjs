import { describe, it, expect, vi } from 'vitest';

vi.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: class { send = vi.fn(); },
    GetItemCommand: vi.fn(),
    PutItemCommand: vi.fn(),
}));

vi.mock('@aws-sdk/client-ses', () => ({
    SESClient: class { send = vi.fn(); },
    SendEmailCommand: vi.fn(),
}));

import { validatePayload } from '../index.mjs';

describe('validatePayload', () => {
    const validPayload = {
        tema: 'Timebooking', navn: 'Ola', telefon: '12345678',
        epost: 'ola@example.com', melding: 'Hei', website: ''
    };

    it('returnerer ok:true for gyldig payload', () => {
        expect(validatePayload(validPayload)).toEqual({ ok: true });
    });

    it('returnerer honeypot:true når website er fylt ut', () => {
        expect(validatePayload({ ...validPayload, website: 'spam' }))
            .toEqual({ ok: false, honeypot: true });
    });

    it('returnerer feil ved manglende navn', () => {
        const r = validatePayload({ ...validPayload, navn: '' });
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/navn/i);
    });

    it('returnerer feil ved manglende epost', () => {
        const r = validatePayload({ ...validPayload, epost: '' });
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/e-post/i);
    });

    it('returnerer feil ved ugyldig e-postformat', () => {
        const r = validatePayload({ ...validPayload, epost: 'ikke-en-epost' });
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/e-postformat/i);
    });

    it('returnerer feil når melding overskrider 5000 tegn', () => {
        const r = validatePayload({ ...validPayload, melding: 'x'.repeat(5001) });
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/lang/i);
    });

    it('godtar melding på nøyaktig 5000 tegn', () => {
        expect(validatePayload({ ...validPayload, melding: 'x'.repeat(5000) }))
            .toEqual({ ok: true });
    });
});
