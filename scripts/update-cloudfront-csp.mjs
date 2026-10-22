#!/usr/bin/env node
// Oppdaterer script-src i CloudFront-CSP-en (tot-security-headers) fra src/generated/csp-hashes.json.
// Kjøres i deploy i to faser rundt S3-sync, se docs/architecture/sikkerhet.md:
//   --merge           fase 1: gamle + nye hasher, før ny HTML lastes opp
//   --wait-for <url>  venter til CSP-en med de nye hashene er ute på edge
//   (ingen flagg)     fase 2: bare nye hasher, etter fullført invalidering
import { writeFileSync, rmSync, mkdtempSync, chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { parseArgs } from 'node:util';
import {
    FatalError,
    GAPI_RUNTIME_HASHES,
    buildCspString,
    buildScriptSrc,
    loadHashData,
} from './setup-response-headers-policy.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const MAX_CSP_LENGTH = 1783; // CloudFront-grense for ContentSecurityPolicy-feltet
const HASH_TOKEN = /^'(sha256-[A-Za-z0-9+/]{43}=)'$/;

// sha256-hashene fra det FØRSTE script-src-direktivet (slik nettleseren gjør).
// Direktivnavn sammenlignes uten hensyn til store/små bokstaver. Bare tokens som er en
// hash i anførselstegn tas med, alt annet ignoreres.
export function extractScriptHashes(csp) {
    for (const directive of csp.split(';')) {
        const [name, ...values] = directive.trim().split(/[ \t]+/);
        if (name.toLowerCase() !== 'script-src') continue;
        return values.map(v => HASH_TOKEN.exec(v)?.[1]).filter(Boolean);
    }
    return [];
}

// Union, sortert, uten duplikater og uten GAPI (buildScriptSrc legger den til selv).
export function mergeHashes(current, next) {
    return [...new Set([...current, ...next])]
        .filter(h => !GAPI_RUNTIME_HASHES.includes(h))
        .sort();
}

// → { csp, hashes, stale } eller null (merge og ingenting nytt).
// stale = hasher som bare er med fordi gammel HTML trenger dem.
export function planCspUpdate({ currentCsp, buildHashes, merge }) {
    buildScriptSrc(buildHashes); // validerer: kaster FatalError ved tom eller ugyldig liste

    let hashes = buildHashes;
    let stale = [];
    if (merge) {
        const current = extractScriptHashes(currentCsp).filter(h => !GAPI_RUNTIME_HASHES.includes(h));
        if (buildHashes.every(h => current.includes(h))) return null;
        hashes = mergeHashes(current, buildHashes);
        stale = current.filter(h => !buildHashes.includes(h));
    }

    let csp = buildCspString(buildScriptSrc(hashes));
    // Gamle hasher hoper seg opp hvis deploys feiler mellom fasene. Heller et kort vindu med
    // blokkerte gamle inline-script enn at fase 1 kaster og alle senere deploys låses.
    let droppedStale = false;
    if (stale.length > 0 && csp.length > MAX_CSP_LENGTH) {
        hashes = buildHashes;
        droppedStale = true;
        csp = buildCspString(buildScriptSrc(hashes));
    }
    if (csp.length > MAX_CSP_LENGTH) {
        throw new FatalError(
            `CSP-en blir ${csp.length} tegn, over CloudFront-grensen på ${MAX_CSP_LENGTH}. ` +
            `script-src har ${hashes.length} hasher fra bygget` +
            (droppedStale ? ` (${stale.length} gamle er allerede droppet).` : '.')
        );
    }
    return { csp, hashes, stale, droppedStale };
}

export function cspHasAllHashes(csp, hashes) {
    if (!csp) return false;
    const present = extractScriptHashes(csp);
    return hashes.every(h => present.includes(h));
}

// Poller url med HEAD. Hvert forsøk har AbortSignal.timeout(requestTimeoutMs).
// Fetch-feil logges og regnes som et mislykket forsøk. reason gjelder siste forsøk.
export async function waitForCsp({ fetchFn, url, hashes, intervalMs, timeoutMs, requestTimeoutMs, sleep, now }) {
    const start = now();
    for (let attempt = 1; ; attempt++) {
        let reason = 'timeout';
        try {
            const res = await fetchFn(url, { method: 'HEAD', signal: AbortSignal.timeout(requestTimeoutMs) });
            const csp = res.headers.get('content-security-policy');
            if (cspHasAllHashes(csp, hashes)) {
                console.log(`Forsøk ${attempt}: CSP med alle nye hasher er ute på edge`);
                return { ok: true };
            }
            if (!csp) reason = 'missing-header';
            console.log(`Forsøk ${attempt}: ${csp ? 'nye hasher ikke ute ennå' : 'CSP-header mangler'} (HTTP ${res.status})`);
        } catch (err) {
            console.log(`Forsøk ${attempt}: forespørselen feilet (${err.message})`);
        }
        if (now() - start + intervalMs > timeoutMs) return { ok: false, reason };
        await sleep(intervalMs);
    }
}

function awsError(subcommand, err) {
    const msg = ((err.stderr?.toString() ?? '') + (err.stdout?.toString() ?? '')).trim();
    return new FatalError(`${subcommand} feilet: ${msg || err.message}`);
}

// → { etag, config } der config er hele ResponseHeadersPolicyConfig (alt annet enn CSP beholdes).
export function fetchPolicy(policyId) {
    let output;
    try {
        output = execFileSync('aws', [
            '--no-cli-pager', 'cloudfront', 'get-response-headers-policy',
            '--id', policyId,
            '--output', 'json',
        ], { encoding: 'utf-8', stdio: 'pipe' });
    } catch (err) {
        throw awsError('get-response-headers-policy', err);
    }
    const result = JSON.parse(output);
    const config = result.ResponseHeadersPolicy.ResponseHeadersPolicyConfig;
    if (typeof config.SecurityHeadersConfig?.ContentSecurityPolicy?.ContentSecurityPolicy !== 'string') {
        throw new FatalError('SecurityHeadersConfig.ContentSecurityPolicy finnes ikke i CloudFront-policyen');
    }
    return { etag: result.ETag, config };
}

export function writePolicy(policyId, etag, config) {
    const tmpDir = mkdtempSync(join(tmpdir(), 'cf-csp-'));
    try {
        chmodSync(tmpDir, 0o700);
        const configPath = join(tmpDir, 'policy-config.json');
        writeFileSync(configPath, JSON.stringify(config), { mode: 0o600 });
        execFileSync('aws', [
            '--no-cli-pager', 'cloudfront', 'update-response-headers-policy',
            '--id', policyId,
            '--if-match', etag,
            '--response-headers-policy-config', `file://${configPath}`,
            '--output', 'json',
        ], { encoding: 'utf-8', stdio: 'pipe' });
    } catch (err) {
        throw awsError('update-response-headers-policy', err);
    } finally {
        rmSync(tmpDir, { recursive: true, force: true });
    }
}

/* v8 ignore start */
if (import.meta.url === `file://${process.argv[1]}`) {
    try {
        const { values } = parseArgs({
            options: { merge: { type: 'boolean' }, 'wait-for': { type: 'string' } },
            strict: true,
        });
        const { scriptHashes } = loadHashData(join(__dirname, '../src/generated/csp-hashes.json'));

        if (values['wait-for']) {
            const url = values['wait-for'];
            const result = await waitForCsp({
                fetchFn: fetch,
                url,
                hashes: scriptHashes,
                intervalMs: 15_000,
                timeoutMs: 5 * 60_000,
                requestTimeoutMs: 10_000,
                sleep: ms => new Promise(r => setTimeout(r, ms)),
                now: Date.now,
            });
            if (!result.ok && result.reason === 'missing-header') {
                console.log(`::error::CSP-header mangler på ${url} — sjekk response headers policy på distribusjonen`);
            } else if (!result.ok) {
                console.log(`::warning::Ny CSP ikke bekreftet på ${url} innen 5 min — deploy fortsetter`);
            }
            process.exit(0);
        }

        const policyId = process.env.CLOUDFRONT_POLICY_ID;
        if (!policyId) throw new FatalError('Error: CLOUDFRONT_POLICY_ID environment variable is required');

        const { etag, config } = fetchPolicy(policyId);
        const csp = config.SecurityHeadersConfig.ContentSecurityPolicy;
        const before = extractScriptHashes(csp.ContentSecurityPolicy).length;
        const plan = planCspUpdate({ currentCsp: csp.ContentSecurityPolicy, buildHashes: scriptHashes, merge: !!values.merge });
        if (!plan) {
            console.log('CSP har allerede alle nye hasher — ingen oppdatering');
            process.exit(0);
        }

        if (plan.droppedStale) {
            console.log(
                `::warning::Gamle + nye hasher går over ${MAX_CSP_LENGTH} tegn — ${plan.stale.length} gamle ` +
                'hasher droppes allerede i fase 1. Gamle sider i cache kan få blokkerte inline-script til invalideringen er ferdig.'
            );
        }
        csp.ContentSecurityPolicy = plan.csp;
        writePolicy(policyId, etag, config);

        const after = extractScriptHashes(plan.csp).length;
        const fase = values.merge ? 'fase 1 (gamle + nye)' : 'fase 2 (bare nye)';
        console.log(
            `CloudFront CSP oppdatert, ${fase}: ${before} → ${after} hasher i script-src ` +
            `(${scriptHashes.length} fra build, ${plan.stale.length} gamle, ${GAPI_RUNTIME_HASHES.length} GAPI), ` +
            `${plan.csp.length}/${MAX_CSP_LENGTH} tegn`
        );
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
}
/* v8 ignore stop */
