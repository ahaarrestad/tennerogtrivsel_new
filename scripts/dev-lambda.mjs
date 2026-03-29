/**
 * Lokal mock-server for Lambda-endepunktet.
 * Kjorer validering og rate limiting i minne, men sender ingen ekte e-post.
 *
 * Start: npm run dev:lambda
 * Astro-proxy ruter /api/kontakt hit automatisk nar npm run dev kjoer.
 */
import http from 'node:http';
import { validatePayload } from '../lambda/kontakt-form-handler/index.mjs';

const PORT = process.env.DEV_LAMBDA_PORT || 3001;

// In-memory rate limiting (nullstilles ved omstart)
const rateLimitStore = new Map();
const MAX_PER_WINDOW = 3;
const WINDOW_MS = 600_000; // 10 min

function checkRateLimit(ip) {
    const now = Date.now();
    const entry = rateLimitStore.get(ip);
    if (entry && entry.resetAt > now && entry.count >= MAX_PER_WINDOW) return true;
    if (!entry || entry.resetAt <= now) {
        rateLimitStore.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    } else {
        entry.count++;
    }
    return false;
}

const respond = (res, status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
};

const server = http.createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/api/kontakt') {
        res.writeHead(404);
        res.end('Not found');
        return;
    }

    let rawBody = '';
    for await (const chunk of req) rawBody += chunk;

    let payload;
    try {
        payload = JSON.parse(rawBody || '{}');
    } catch {
        return respond(res, 400, { error: 'Ugyldig JSON' });
    }

    const validation = validatePayload(payload);
    if (!validation.ok) {
        if (validation.honeypot) return respond(res, 200, { ok: true });
        return respond(res, 400, { error: validation.error });
    }

    const ip = req.socket.remoteAddress || '127.0.0.1';
    if (checkRateLimit(ip)) {
        return respond(res, 429, { error: 'For mange forsok. Vent litt og prov igjen.' });
    }

    const { tema, navn, telefon, epost, melding } = payload;
    console.log('\n[dev-lambda] Kontaktskjema mottatt:');
    console.log(`  Tema:    ${tema || '(ikke oppgitt)'}`);
    console.log(`  Navn:    ${navn}`);
    console.log(`  Telefon: ${telefon || '(ikke oppgitt)'}`);
    console.log(`  E-post:  ${epost}`);
    if (melding) {
        const preview = melding.length > 120 ? melding.substring(0, 120) + '...' : melding;
        console.log(`  Melding: ${preview}`);
    }
    console.log('  (ingen e-post sendt i dev-modus)\n');

    return respond(res, 200, { ok: true });
});

server.listen(PORT, () => {
    console.log(`Dev Lambda-server kjorer pa http://localhost:${PORT}`);
    console.log('POST /api/kontakt -> validering + logg, ingen e-post sendes\n');
});
