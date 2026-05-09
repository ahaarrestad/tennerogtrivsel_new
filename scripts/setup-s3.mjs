#!/usr/bin/env node
// Oppretter S3-buckets og setter bucket policy for CloudFront OAC-tilgang.
// Kjøres manuelt ved nyoppsett — ikke en del av CI-deploy.
// NB: put-bucket-policy overskriver eksisterende policy — manuelle tillegg går tapt.
import { execFileSync } from 'node:child_process';
import { writeFileSync, rmSync, mkdtempSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REGION = 'eu-north-1';
const EXPECTED_ACCOUNT = '382286755083';

const BUCKETS = [
    {
        name: 'tennerogtrivsel-se',
        distributionArn: `arn:aws:cloudfront::${EXPECTED_ACCOUNT}:distribution/E9Z51DQB2K1G4`,
    },
    {
        name: 'test2.aarrestad.com-se',
        distributionArn: `arn:aws:cloudfront::${EXPECTED_ACCOUNT}:distribution/E2WXX7ZUR5NNP3`,
    },
];

// Skiller credential-/transport-feil (abort alt) fra bucket-spesifikke feil (fortsett)
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

function bucketExists(name) {
    try {
        execFileSync('aws', [
            '--no-cli-pager', 's3api', 'head-bucket',
            '--bucket', name,
            '--region', REGION,
            '--expected-bucket-owner', EXPECTED_ACCOUNT,
        ], { stdio: 'pipe' });
        return true;
    } catch (err) {
        const msg = ((err.stderr?.toString() ?? '') + (err.stdout?.toString() ?? '')).trim();
        if (msg.includes('(404)') || msg.includes('NoSuchBucket')) return false;
        if (msg.includes('(403)') || msg.includes('Forbidden')) {
            throw new FatalError(
                `Bucket ${name}: tilgang nektet (403) — enten eies bucketen ikke av konto ${EXPECTED_ACCOUNT}, eller IAM mangler s3:ListBucket.`
            );
        }
        throw new FatalError(`head-bucket ${name} feilet (${exitInfo(err)}): ${msg || '(ingen output)'}`);
    }
}

// Kanoniserer et objekt ved å sortere nøkler rekursivt — ikke arrays,
// da array-rekkefølge er semantisk i IAM-policies.
function canonicalize(v) {
    if (Array.isArray(v)) return v.map(canonicalize);
    if (v && typeof v === 'object') {
        return Object.keys(v).sort().reduce((o, k) => { o[k] = canonicalize(v[k]); return o; }, {});
    }
    return v;
}

function policyIsUpToDate(name, desired) {
    try {
        const output = execFileSync('aws', [
            '--no-cli-pager', 's3api', 'get-bucket-policy',
            '--bucket', name,
            '--region', REGION,
            '--expected-bucket-owner', EXPECTED_ACCOUNT,
            '--output', 'json',
        ], { encoding: 'utf-8', stdio: 'pipe' });
        const parsed = JSON.parse(output);
        if (parsed.Policy == null) {
            throw new FatalError(`get-bucket-policy for ${name} returnerte JSON uten Policy-felt — uventet svar-format.`);
        }
        const existing = JSON.parse(parsed.Policy);
        return JSON.stringify(canonicalize(existing)) === JSON.stringify(canonicalize(desired));
    } catch (err) {
        if (err instanceof FatalError) throw err;
        if (err instanceof SyntaxError) {
            throw new FatalError(`Ugyldig JSON-svar fra get-bucket-policy for ${name}: ${err.message}`);
        }
        const msg = ((err.stderr?.toString() ?? '') + (err.stdout?.toString() ?? '')).trim();
        if (msg.includes('NoSuchBucketPolicy')) return false;
        // 403 fra s3:GetBucketPolicy → mangler rettighet, men put kan fortsatt fungere
        if (msg.includes('(403)') || msg.includes('AccessDenied')) {
            console.warn(`  Advarsel: mangler s3:GetBucketPolicy på ${name} — kan ikke sjekke, setter policy likevel.`);
            return false;
        }
        throw new FatalError(`Klarte ikke hente eksisterende policy for ${name}: ${msg || '(ingen output)'}`);
    }
}

function ensureBucket({ name, distributionArn }) {
    if (bucketExists(name)) {
        console.log(`S3 bucket ${name}: finnes allerede`);
    } else {
        console.log(`Oppretter S3 bucket ${name}...`);
        try {
            execFileSync('aws', [
                '--no-cli-pager', 's3api', 'create-bucket',
                '--bucket', name,
                '--region', REGION,
                '--create-bucket-configuration', `LocationConstraint=${REGION}`,
            ], { stdio: 'pipe' });
        } catch (err) {
            const msg = ((err.stderr?.toString() ?? '') + (err.stdout?.toString() ?? '')).trim();
            throw new FatalError(`create-bucket ${name} feilet (${exitInfo(err)}): ${msg || '(ingen output)'}`);
        }
    }

    // Blokker all offentlig tilgang idempotent — OAC-policy er ikke offentlig og blokkeres ikke av dette.
    // Feil her er fatal: en ny bucket uten BPA skal ikke stå igjen uten sperr.
    try {
        execFileSync('aws', [
            '--no-cli-pager', 's3api', 'put-public-access-block',
            '--bucket', name,
            '--region', REGION,
            '--expected-bucket-owner', EXPECTED_ACCOUNT,
            '--public-access-block-configuration',
            'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true',
        ], { stdio: 'pipe' });
    } catch (err) {
        const msg = ((err.stderr?.toString() ?? '') + (err.stdout?.toString() ?? '')).trim();
        throw new FatalError(`put-public-access-block feilet for ${name} (${exitInfo(err)}): ${msg || '(ingen output)'}`);
    }
    console.log(`  Offentlig tilgang blokkert for ${name}`);

    const desired = {
        Version: '2008-10-17',
        Id: 'PolicyForCloudFrontPrivateContent',
        Statement: [{
            Sid: 'AllowCloudFrontServicePrincipal',
            Effect: 'Allow',
            Principal: { Service: 'cloudfront.amazonaws.com' },
            Action: 's3:GetObject',
            Resource: `arn:aws:s3:::${name}/*`,
            Condition: { StringEquals: { 'AWS:SourceArn': distributionArn } },
        }],
    };

    if (policyIsUpToDate(name, desired)) {
        console.log(`  Policy uendret for ${name}`);
        return;
    }

    console.log(`  Setter policy for ${name}...`);
    const tmpDir = mkdtempSync(join(tmpdir(), 'bucket-policy-'));
    try {
        chmodSync(tmpDir, 0o700);
        const policyPath = join(tmpDir, 'policy.json');
        writeFileSync(policyPath, JSON.stringify(desired), { mode: 0o600 });
        try {
            execFileSync('aws', [
                '--no-cli-pager', 's3api', 'put-bucket-policy',
                '--bucket', name,
                '--region', REGION,
                '--expected-bucket-owner', EXPECTED_ACCOUNT,
                '--policy', `file://${policyPath}`,
            ], { stdio: 'pipe' });
        } catch (err) {
            const msg = ((err.stderr?.toString() ?? '') + (err.stdout?.toString() ?? '')).trim();
            throw new FatalError(`put-bucket-policy feilet for ${name} (${exitInfo(err)}): ${msg || '(ingen output)'}`);
        }
    } finally {
        rmSync(tmpDir, { recursive: true, force: true });
    }
    console.log(`  Policy satt for ${name}`);
}

const bucketArg = process.argv[2];
const bucketsToProcess = bucketArg
    ? BUCKETS.filter(b => b.name === bucketArg)
    : BUCKETS;

if (bucketArg && bucketsToProcess.length === 0) {
    console.error(`Ukjent bucket: "${bucketArg}". Tilgjengelige: ${BUCKETS.map(b => b.name).join(', ')}`);
    process.exit(1);
}

try {
    checkAccount();
} catch (err) {
    console.error(err.message);
    process.exit(1);
}

let failed = false;
for (const bucket of bucketsToProcess) {
    try {
        ensureBucket(bucket);
    } catch (err) {
        if (err instanceof FatalError) {
            console.error(`Kritisk feil: ${err.message}`);
            process.exit(1);
        }
        console.error(`FEIL for ${bucket.name}: ${err.message}`);
        failed = true;
    }
}

if (failed) {
    console.error('Én eller flere buckets feilet — sjekk feilmeldingene over.');
    process.exit(1);
}
console.log('S3-buckets klare.');
