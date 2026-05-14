#!/usr/bin/env node
// Oppretter tot-security-headers Response Headers Policy i CloudFront om den ikke finnes.
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

const hashData = JSON.parse(
    readFileSync(join(__dirname, '../src/generated/csp-hashes.json'), 'utf-8')
);

const scriptSrc = hashData.scriptHashes.length > 0
    ? `'self' ${hashData.scriptHashes.map(h => `'${h}'`).join(' ')} https://apis.google.com https://accounts.google.com`
    : `'self' 'unsafe-inline' https://apis.google.com https://accounts.google.com`;

const CSP_STRING = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: blob: https://lh3.googleusercontent.com https://drive.google.com https://www.google.com",
    "frame-src https://drive.google.com https://accounts.google.com https://www.google.com https://*.googleapis.com",
    "connect-src 'self' blob: https://www.googleapis.com https://content.googleapis.com https://oauth2.googleapis.com https://accounts.google.com https://apis.google.com https://www.google.com",
].join('; ');

class FatalError extends Error {
    constructor(m) { super(m); this.name = 'FatalError'; }
}

function exitInfo(err) {
    return err.signal ? `signal=${err.signal}` : `exit=${err.status ?? '?'}`;
}

function checkAccount() {
    let output;
    try {
        output = execFileSync('aws', ['--no-cli-pager', 'sts', 'get-caller-identity', '--output', 'json'], { encoding: 'utf-8', stdio: 'pipe' });
    } catch (err) {
        const detail = err.stderr?.toString().trim();
        throw new Error(`aws sts get-caller-identity feilet — sjekk AWS_PROFILE / SSO-pålogging.${detail ? `\n${detail}` : ''}`);
    }
    let identity;
    try {
        identity = JSON.parse(output);
    } catch {
        throw new Error('Klarte ikke tolke JSON-svar fra AWS STS — uventet output-format.');
    }
    if (identity.Account !== EXPECTED_ACCOUNT) {
        throw new Error(`Feil AWS-konto: forventet ${EXPECTED_ACCOUNT}, fikk ${identity.Account}. Sjekk AWS_PROFILE.`);
    }
    console.log(`AWS-konto verifisert: ${identity.Account}`);
}

function findExistingPolicy() {
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

function createPolicy() {
    const config = {
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
                ContentSecurityPolicy: CSP_STRING,
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

    const tmpDir = mkdtempSync(join(tmpdir(), 'cf-policy-'));
    try {
        chmodSync(tmpDir, 0o700);
        const configPath = join(tmpDir, 'policy-config.json');
        writeFileSync(configPath, JSON.stringify(config), { mode: 0o600 });
        let output;
        try {
            output = execFileSync('aws', [
                '--no-cli-pager', 'cloudfront', 'create-response-headers-policy',
                '--response-headers-policy-config', `file://${configPath}`,
                '--output', 'json',
            ], { encoding: 'utf-8', stdio: 'pipe' });
        } catch (err) {
            const msg = ((err.stderr?.toString() ?? '') + (err.stdout?.toString() ?? '')).trim();
            throw new FatalError(`create-response-headers-policy feilet (${exitInfo(err)}): ${msg || '(ingen output)'}`);
        }
        const result = JSON.parse(output);
        return result.ResponseHeadersPolicy.Id;
    } finally {
        rmSync(tmpDir, { recursive: true, force: true });
    }
}

function ensurePolicy() {
    const existingId = findExistingPolicy();
    if (existingId) {
        console.log(`Policy finnes: ${existingId}`);
        return existingId;
    }

    console.log('Oppretter tot-security-headers policy...');
    const id = createPolicy();
    console.log(`  Opprettet med ID: ${id}`);
    return id;
}

try {
    checkAccount();
} catch (err) {
    console.error(err.message);
    process.exit(1);
}

let id;
try {
    id = ensurePolicy();
} catch (err) {
    console.error(`Kritisk feil: ${err.message}`);
    process.exit(1);
}

process.stdout.write(id + '\n');
