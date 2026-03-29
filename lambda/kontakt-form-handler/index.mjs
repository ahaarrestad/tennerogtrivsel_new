import { createHash, timingSafeEqual } from 'node:crypto';
import { DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-west-1' });
const ses    = new SESClient({ region: process.env.SES_REGION || 'eu-west-1' });

const SENDER_EPOST = 'noreply@tennerogtrivsel.no';
const RATE_TABLE   = process.env.RATE_LIMIT_TABLE || 'kontakt-rate-limit';
const MAX_PER_WINDOW = 3;
const WINDOW_SECONDS = 600;

// Eksportert for testing
export function validatePayload({ tema, navn, telefon, epost, melding, website } = {}) {
    if (website) return { ok: false, honeypot: true };

    const navnStr = String(navn || '').trim();
    if (!navnStr) return { ok: false, error: 'Manglende navn' };
    if (navnStr.length > 100) return { ok: false, error: 'Navn er for langt (maks 100 tegn)' };

    const epostStr = String(epost || '').trim();
    if (!epostStr) return { ok: false, error: 'Manglende e-post' };
    if (epostStr.length > 254) return { ok: false, error: 'E-post er for lang' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(epostStr))
        return { ok: false, error: 'Ugyldig e-postformat' };

    if (telefon && String(telefon).length > 30)
        return { ok: false, error: 'Telefonnummer er for langt' };
    if (tema && String(tema).length > 200)
        return { ok: false, error: 'Tema er for langt' };
    if (melding && String(melding).length > 5000)
        return { ok: false, error: 'Melding er for lang (maks 5000 tegn)' };

    return { ok: true };
}

// Fjerner alle ASCII-kontrollkarakterer (inkl. \r\n, null-bytes, DEL) — for enkeltlinje-felt
function sanitize(s, maxLen = 500) {
    return String(s || '').replace(/[\x00-\x1f\x7f]/g, ' ').substring(0, maxLen);
}

// For fritekstfeltet (melding): beholder \n (linjeskift), fjerner alt annet farlig
function sanitizeBody(s, maxLen = 5000) {
    return String(s || '')
        .replace(/\r\n/g, '\n')                      // normaliser Windows-linjeskift
        .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '') // fjern kontrollkarakterer unntatt \t og \n
        .substring(0, maxLen);
}

// Konstant-tid sammenligning — forhindrer timing-angrep på origin-secret
function safeCompare(a, b) {
    const ha = createHash('sha256').update(String(a)).digest();
    const hb = createHash('sha256').update(String(b)).digest();
    return timingSafeEqual(ha, hb);
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

    // 1. Verifiser origin secret (konstant-tid for å unngå timing-angrep)
    const originHeader = event.headers?.['x-origin-verify'];
    const originSecret = process.env.ORIGIN_VERIFY_SECRET;
    if (!originHeader || !originSecret || !safeCompare(originHeader, originSecret)) {
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

    // 3b. Sjekk at mottaker-e-post er konfigurert
    const mottakerEpost = process.env.KONTAKT_MOTTAKER_EPOST;
    if (!mottakerEpost) {
        console.error('KONTAKT_MOTTAKER_EPOST er ikke konfigurert');
        return json(500, { error: 'Tjenesten er ikke riktig konfigurert.' });
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
    const { tema, navn, telefon, melding } = payload;
    const epost = String(payload.epost || '').trim(); // bruk trimmet versjon (validert ovenfor)
    const emailBody = [
        `Tema:    ${sanitize(tema, 200)}`,
        `Navn:    ${sanitize(navn, 100)}`,
        `Telefon: ${sanitize(telefon, 30)}`,
        `E-post:  ${sanitize(epost, 254)}`,
        '',
        sanitizeBody(melding),
    ].join('\n');

    try {
        await ses.send(new SendEmailCommand({
            Source:           SENDER_EPOST,
            Destination:      { ToAddresses: [mottakerEpost] },
            ReplyToAddresses: [sanitize(epost, 254)],
            Message: {
                Subject: { Data: `Kontaktskjema: ${sanitize(tema, 200)}` },
                Body:    { Text: { Data: emailBody } },
            },
        }));
    } catch (err) {
        console.error('SES feil:', err.message);
        return json(500, { error: 'Kunne ikke sende e-post. Prøv igjen.' });
    }

    return json(200, { ok: true });
};
