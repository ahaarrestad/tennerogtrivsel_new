import { describe, it, expect, vi, beforeEach } from 'vitest';

// Delt send-mock som handler-instansene bruker
const { dynamoSend, sesSend } = vi.hoisted(() => ({
    dynamoSend: vi.fn(),
    sesSend:    vi.fn(),
}));

vi.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: class { send = dynamoSend; },
    GetItemCommand: vi.fn(),
    PutItemCommand: vi.fn(),
}));

vi.mock('@aws-sdk/client-ses', () => ({
    SESClient: class { send = sesSend; },
    SendEmailCommand: vi.fn(),
}));

import { validatePayload, handler } from '../index.mjs';

const validPayload = {
    tema: 'Timebooking', navn: 'Ola', telefon: '12345678',
    epost: 'ola@example.com', melding: 'Hei', website: '',
};

const makeEvent = (body, secret = 'test-secret') => ({
    headers: { 'x-origin-verify': secret },
    body: JSON.stringify(body),
    requestContext: { http: { sourceIp: '127.0.0.1' } },
});

describe('validatePayload', () => {
    it('returnerer ok:true for gyldig payload', () => {
        expect(validatePayload(validPayload)).toEqual({ ok: true });
    });

    it('returnerer honeypot:true nar website er fylt ut', () => {
        expect(validatePayload({ ...validPayload, website: 'spam' }))
            .toEqual({ ok: false, honeypot: true });
    });

    it('returnerer feil ved manglende navn', () => {
        const r = validatePayload({ ...validPayload, navn: '' });
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/navn/i);
    });

    it('returnerer feil nar navn overskrider 100 tegn', () => {
        const r = validatePayload({ ...validPayload, navn: 'a'.repeat(101) });
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/navn/i);
    });

    it('returnerer feil ved manglende epost', () => {
        const r = validatePayload({ ...validPayload, epost: '' });
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/e-post/i);
    });

    it('returnerer feil nar epost overskrider 254 tegn', () => {
        const r = validatePayload({ ...validPayload, epost: 'a'.repeat(250) + '@x.no' });
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/e-post/i);
    });

    it('returnerer feil ved ugyldig e-postformat', () => {
        const r = validatePayload({ ...validPayload, epost: 'ikke-en-epost' });
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/e-postformat/i);
    });

    it('returnerer feil nar telefon overskrider 30 tegn', () => {
        const r = validatePayload({ ...validPayload, telefon: '1'.repeat(31) });
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/telefon/i);
    });

    it('returnerer feil nar tema overskrider 200 tegn', () => {
        const r = validatePayload({ ...validPayload, tema: 'x'.repeat(201) });
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/tema/i);
    });

    it('returnerer feil nar melding overskrider 5000 tegn', () => {
        const r = validatePayload({ ...validPayload, melding: 'x'.repeat(5001) });
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/lang/i);
    });

    it('godtar melding pa noyaktig 5000 tegn', () => {
        expect(validatePayload({ ...validPayload, melding: 'x'.repeat(5000) }))
            .toEqual({ ok: true });
    });
});

describe('handler', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.stubEnv('ORIGIN_VERIFY_SECRET',    'test-secret');
        vi.stubEnv('KONTAKT_MOTTAKER_EPOST',  'mottaker@example.com');
        dynamoSend.mockResolvedValue({ Item: null });
        sesSend.mockResolvedValue({});
    });

    it('returnerer 403 ved feil origin secret', async () => {
        const result = await handler(makeEvent(validPayload, 'feil-secret'));
        expect(result.statusCode).toBe(403);
    });

    it('returnerer 400 ved ugyldig JSON', async () => {
        const result = await handler({
            headers: { 'x-origin-verify': 'test-secret' },
            body: 'ikke json',
        });
        expect(result.statusCode).toBe(400);
    });

    it('returnerer 400 ved validerings-feil', async () => {
        const result = await handler(makeEvent({ ...validPayload, navn: '' }));
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).error).toMatch(/navn/i);
    });

    it('returnerer 200 stille for honeypot', async () => {
        const result = await handler(makeEvent({ ...validPayload, website: 'spam' }));
        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({ ok: true });
    });

    it('returnerer 500 nar MOTTAKER_EPOST ikke er konfigurert', async () => {
        vi.stubEnv('KONTAKT_MOTTAKER_EPOST', '');
        const result = await handler(makeEvent(validPayload));
        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body).error).toMatch(/konfigurert/i);
    });

    it('returnerer 200 ved vellykket innsending', async () => {
        const result = await handler(makeEvent(validPayload));
        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({ ok: true });
    });

    it('returnerer 500 nar SES feiler', async () => {
        sesSend.mockRejectedValue(new Error('SES nede'));
        const result = await handler(makeEvent(validPayload));
        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body).error).toMatch(/e-post/i);
    });

    it('returnerer 429 nar rate limit er naadd', async () => {
        dynamoSend.mockResolvedValue({
            Item: {
                ip:    { S: '127.0.0.1' },
                count: { N: '3' },
                ttl:   { N: String(Math.floor(Date.now() / 1000) + 600) },
            },
        });
        const result = await handler(makeEvent(validPayload));
        expect(result.statusCode).toBe(429);
    });

    it('fortsetter nar DynamoDB feiler (rate limit ignorert)', async () => {
        dynamoSend.mockRejectedValue(new Error('DynamoDB nede'));
        const result = await handler(makeEvent(validPayload));
        expect(result.statusCode).toBe(200);
    });
});
