#!/usr/bin/env node
// Oppretter/oppdaterer tot-security-headers Response Headers Policy i CloudFront.
// Printer policy-IDen til stdout (siste linje).
// Bruk: export CLOUDFRONT_POLICY_ID=$(node scripts/setup-response-headers-policy.mjs | tail -1)
import { readFileSync, writeFileSync, rmSync, mkdtempSync, chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));

const EXPECTED_ACCOUNT = '382286755083';
const POLICY_NAME = 'tot-security-headers';

export class FatalError extends Error {
    constructor(m) { super(m); this.name = 'FatalError'; }
}

export function loadHashData(filePath) {
    try {
        return JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch (err) {
        if (err.code === 'ENOENT') {
            throw new FatalError(
                `Feil: ${filePath} finnes ikke.\n` +
                'Kjør "npm run build" for å generere filen før du kjører dette scriptet.'
            );
        }
        throw new FatalError(`Klarte ikke lese eller tolke ${filePath}: ${err.message}`);
    }
}

const GAPI_RUNTIME_HASHES = ["sha256-Ck+oGpSYXC+PJqw/YXnosEZnlS+j6SnLwb3GZZzgTr8="];

export function buildScriptSrc(scriptHashes) {
    if (scriptHashes.length === 0) {
        throw new FatalError(
            'csp-hashes.json inneholder ingen script-hashes. ' +
            'Kjør "npm run build" for å generere dem før du kjører dette scriptet.'
        );
    }
    const allHashes = [...scriptHashes, ...GAPI_RUNTIME_HASHES];
    return `'self' ${allHashes.map(h => `'${h}'`).join(' ')} https://apis.google.com https://accounts.google.com`;
}

export function buildCspString(scriptSrc) {
    return [
        "default-src 'self'",
        `script-src ${scriptSrc}`,
        "style-src 'self' 'unsafe-inline'",
        "font-src 'self'",
        "img-src 'self' data: blob: https://lh3.googleusercontent.com https://drive.google.com https://www.google.com",
        "frame-src https://drive.google.com https://accounts.google.com https://*.googleapis.com",
        "connect-src 'self' blob: https://www.googleapis.com https://content.googleapis.com https://oauth2.googleapis.com https://accounts.google.com https://apis.google.com https://www.google.com",
    ].join('; ');
}

function exitInfo(err) {
    return err.signal ? `signal=${err.signal}` : `exit=${err.status ?? '?'}`;
}

export function checkAccount() {
    let output;
    try {
        output = execFileSync('aws', ['--no-cli-pager', 'sts', 'get-caller-identity', '--output', 'json'], { encoding: 'utf-8', stdio: 'pipe' });
    } catch (err) {
        const msg = ((err.stderr?.toString() ?? '') + (err.stdout?.toString() ?? '')).trim();
        throw new FatalError(`aws sts get-caller-identity feilet (${exitInfo(err)}): ${msg || 'sjekk AWS_PROFILE / SSO-pålogging'}`);
    }
    let identity;
    try {
        identity = JSON.parse(output);
    } catch {
        throw new FatalError('Klarte ikke tolke JSON-svar fra AWS STS — uventet output-format.');
    }
    if (identity.Account !== EXPECTED_ACCOUNT) {
        throw new FatalError(`Feil AWS-konto: forventet ${EXPECTED_ACCOUNT}, fikk ${identity.Account}. Sjekk AWS_PROFILE.`);
    }
    console.log(`AWS-konto verifisert: ${identity.Account}`);
}

export function findExistingPolicy() {
    let output;
    try {
        output = execFileSync('aws', [
            '--no-cli-pager', 'cloudfront', 'list-response-headers-policies',
            '--type', 'custom',
            '--max-items', '1000',
            '--output', 'json',
        ], { encoding: 'utf-8', stdio: 'pipe' });
    } catch (err) {
        const msg = ((err.stderr?.toString() ?? '') + (err.stdout?.toString() ?? '')).trim();
        throw new FatalError(`list-response-headers-policies feilet (${exitInfo(err)}): ${msg || '(ingen output)'}`);
    }
    const list = JSON.parse(output);
    const items = list.ResponseHeadersPolicyList?.Items ?? [];
    const match = items.find(
        i => i.ResponseHeadersPolicy.ResponseHeadersPolicyConfig.Name === POLICY_NAME
    );
    return match ? match.ResponseHeadersPolicy.Id : null;
}

function buildPolicyConfig(cspString) {
    return {
        Name: POLICY_NAME,
        Comment: `${POLICY_NAME} — speiler src/utils/security-headers.ts`,
        SecurityHeadersConfig: {
            StrictTransportSecurity: {
                Override: true,
                IncludeSubdomains: true,
                Preload: true,
                AccessControlMaxAgeSec: 63072000,
            },
            ContentTypeOptions: { Override: true },
            FrameOptions: { Override: true, FrameOption: 'DENY' },
            ReferrerPolicy: { Override: true, ReferrerPolicy: 'strict-origin-when-cross-origin' },
            XSSProtection: { Override: false, Protection: false },
            ContentSecurityPolicy: {
                Override: true,
                ContentSecurityPolicy: cspString,
            },
        },
        CustomHeadersConfig: {
            Quantity: 3,
            Items: [
                { Header: 'Cross-Origin-Opener-Policy', Value: 'same-origin-allow-popups', Override: true },
                { Header: 'Cross-Origin-Resource-Policy', Value: 'same-origin', Override: true },
                { Header: 'Permissions-Policy', Value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()', Override: true },
            ],
        },
    };
}

function runWithTempFile(subcommand, extraArgs, config) {
    const tmpDir = mkdtempSync(join(tmpdir(), 'cf-policy-'));
    try {
        chmodSync(tmpDir, 0o700);
        const configPath = join(tmpDir, 'policy-config.json');
        writeFileSync(configPath, JSON.stringify(config), { mode: 0o600 });
        try {
            return execFileSync('aws', [
                '--no-cli-pager', 'cloudfront', subcommand,
                ...extraArgs,
                '--response-headers-policy-config', `file://${configPath}`,
                '--output', 'json',
            ], { encoding: 'utf-8', stdio: 'pipe' });
        } catch (err) {
            const msg = ((err.stderr?.toString() ?? '') + (err.stdout?.toString() ?? '')).trim();
            throw new FatalError(`${subcommand} feilet (${exitInfo(err)}): ${msg || '(ingen output)'}`);
        }
    } finally {
        rmSync(tmpDir, { recursive: true, force: true });
    }
}

function createPolicy(cspString) {
    const output = runWithTempFile('create-response-headers-policy', [], buildPolicyConfig(cspString));
    return JSON.parse(output).ResponseHeadersPolicy.Id;
}

export function getExistingPolicyConfig(id) {
    let output;
    try {
        output = execFileSync('aws', [
            '--no-cli-pager', 'cloudfront', 'get-response-headers-policy',
            '--id', id,
            '--output', 'json',
        ], { encoding: 'utf-8', stdio: 'pipe' });
    } catch (err) {
        const msg = ((err.stderr?.toString() ?? '') + (err.stdout?.toString() ?? '')).trim();
        throw new FatalError(`get-response-headers-policy feilet (${exitInfo(err)}): ${msg || '(ingen output)'}`);
    }
    const result = JSON.parse(output);
    return {
        etag: result.ETag,
        csp: result.ResponseHeadersPolicy.ResponseHeadersPolicyConfig.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy,
    };
}

function updatePolicy(id, etag, cspString) {
    runWithTempFile('update-response-headers-policy', ['--id', id, '--if-match', etag], buildPolicyConfig(cspString));
}

export function ensurePolicy(cspString) {
    const existingId = findExistingPolicy();
    if (existingId) {
        const { etag, csp } = getExistingPolicyConfig(existingId);
        if (csp === cspString) {
            console.log(`Policy er oppdatert, ingen endring nødvendig: ${existingId}`);
        } else {
            console.log('CSP-streng er endret — oppdaterer policy...');
            updatePolicy(existingId, etag, cspString);
            console.log(`  Policy oppdatert: ${existingId}`);
        }
        return existingId;
    }

    console.log('Oppretter tot-security-headers policy...');
    const id = createPolicy(cspString);
    console.log(`  Opprettet med ID: ${id}`);
    return id;
}

/* v8 ignore start */
if (import.meta.url === `file://${process.argv[1]}`) {
    try {
        checkAccount();
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }

    let hashData;
    try {
        hashData = loadHashData(join(__dirname, '../src/generated/csp-hashes.json'));
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }

    let scriptSrc;
    try {
        scriptSrc = buildScriptSrc(hashData.scriptHashes);
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }

    const cspString = buildCspString(scriptSrc);

    let id;
    try {
        id = ensurePolicy(cspString);
    } catch (err) {
        console.error(`Kritisk feil: ${err.message}`);
        process.exit(1);
    }

    process.stdout.write(id + '\n');
}
/* v8 ignore stop */
