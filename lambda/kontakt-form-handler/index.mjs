import { DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-west-1' });
const ses    = new SESClient({ region: process.env.SES_REGION || 'eu-west-1' });

const ORIGIN_SECRET  = process.env.ORIGIN_VERIFY_SECRET;
const MOTTAKER_EPOST = process.env.KONTAKT_MOTTAKER_EPOST;
const SENDER_EPOST   = 'noreply@tennerogtrivsel.no';
const RATE_TABLE     = process.env.RATE_LIMIT_TABLE || 'kontakt-rate-limit';
const MAX_PER_WINDOW = 3;
const WINDOW_SECONDS = 600;

// Eksportert for testing
export function validatePayload({ tema, navn, telefon, epost, melding, website } = {}) {
    if (website) return { ok: false, honeypot: true };
    if (!String(navn || '').trim()) return { ok: false, error: 'Manglende navn' };
    if (!String(epost || '').trim()) return { ok: false, error: 'Manglende e-post' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(epost))
        return { ok: false, error: 'Ugyldig e-postformat' };
    if (melding && String(melding).length > 5000)
        return { ok: false, error: 'Melding er for lang (maks 5000 tegn)' };
    return { ok: true };
}

function sanitize(s, maxLen = 500) {
    return String(s || '').replace(/[\r\n]/g, ' ').substring(0, maxLen);
}

async function incrementRateLimit(ip, now, existing) {
    const newCount = existing ? parseInt(existing.count.N, 10) + 1 : 1;
    await dynamo.send(new PutItemCommand({
        TableName: RATE_TABLE,
        Item: {
            ip:    { S: ip },
            count: { N: String(newCount) },
            ttl:   { N: String(now + WINDOW_SECONDS) },
        },
    }));
}

export const handler = async (event) => {
    const json = (status, body) => ({
        statusCode: status,
        headers: { 'Content-Type': 'application/json' },
        body: typeof body === 'string' ? body : JSON.stringify(body),
    });

    // 1. Verifiser origin secret
    const originHeader = event.headers?.['x-origin-verify'];
    if (!originHeader || originHeader !== ORIGIN_SECRET) {
        return { statusCode: 403, body: 'Forbidden' };
    }

    // 2. Parse body
    let payload;
    try {
        payload = JSON.parse(event.body || '{}');
    } catch {
        return json(400, { error: 'Ugyldig JSON' });
    }

    // 3. Valider (inkl. honeypot)
    const validation = validatePayload(payload);
    if (!validation.ok) {
        if (validation.honeypot) return json(200, { ok: true }); // stille avvisning
        return json(400, { error: validation.error });
    }

    // 4. Rate limiting
    const ip  = event.requestContext?.http?.sourceIp
             || event.headers?.['x-forwarded-for']?.split(',')[0]?.trim()
             || 'unknown';
    const now = Math.floor(Date.now() / 1000);

    try {
        const existing = (await dynamo.send(new GetItemCommand({
            TableName: RATE_TABLE,
            Key: { ip: { S: ip } },
        }))).Item;

        const limited = existing
            && parseInt(existing.ttl.N, 10) > now
            && parseInt(existing.count.N, 10) >= MAX_PER_WINDOW;

        if (limited) {
            return json(429, { error: 'For mange forsøk. Vent litt og prøv igjen.' });
        }
        await incrementRateLimit(ip, now, existing);
    } catch (err) {
        console.error('DynamoDB feil (ignorert):', err.message);
    }

    // 5. Send e-post via SES
    const { tema, navn, telefon, epost, melding } = payload;
    const emailBody = [
        `Tema:    ${sanitize(tema)}`,
        `Navn:    ${sanitize(navn)}`,
        `Telefon: ${sanitize(telefon)}`,
        `E-post:  ${sanitize(epost)}`,
        '',
        String(melding || '').substring(0, 5000),
    ].join('\n');

    try {
        await ses.send(new SendEmailCommand({
            Source:           SENDER_EPOST,
            Destination:      { ToAddresses: [MOTTAKER_EPOST] },
            ReplyToAddresses: [sanitize(epost)],
            Message: {
                Subject: { Data: `Kontaktskjema: ${sanitize(tema)}` },
                Body:    { Text: { Data: emailBody } },
            },
        }));
    } catch (err) {
        console.error('SES feil:', err.message);
        return json(500, { error: 'Kunne ikke sende e-post. Prøv igjen.' });
    }

    return json(200, { ok: true });
};
