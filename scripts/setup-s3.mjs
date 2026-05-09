#!/usr/bin/env node
// Oppretter S3-buckets og setter bucket policy for CloudFront OAC-tilgang.
// Kjøres manuelt ved nyoppsett — ikke en del av CI-deploy.
// NB: put-bucket-policy overskriver eksisterende policy — manuelle tillegg går tapt.
import { execFileSync } from 'node:child_process';
import { writeFileSync, rmSync, mkdtempSync } from 'node:fs';
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

function checkAccount() {
    let output;
    try {
        output = execFileSync('aws', ['sts', 'get-caller-identity', '--output', 'json'], { encoding: 'utf-8' });
    } catch {
        throw new Error('aws sts get-caller-identity feilet — sjekk AWS_PROFILE / SSO-pålogging.');
    }
    let identity;
    try {
        identity = JSON.parse(output);
    } catch {
        throw new Error('Klarte ikke tolke svar fra AWS — sjekk at AWS CLI er installert og logget inn.');
    }
    if (identity.Account !== EXPECTED_ACCOUNT) {
        throw new Error(`Feil AWS-konto: forventet ${EXPECTED_ACCOUNT}, fikk ${identity.Account}. Sjekk AWS_PROFILE.`);
    }
    console.log(`AWS-konto verifisert: ${identity.Account}`);
}

function bucketExists(name) {
    try {
        execFileSync('aws', [
            's3api', 'head-bucket',
            '--bucket', name,
            '--region', REGION,
            '--expected-bucket-owner', EXPECTED_ACCOUNT,
        ], { stdio: 'pipe' });
        return true;
    } catch (err) {
        const msg = ((err.stderr?.toString() ?? '') + (err.stdout?.toString() ?? '')).trim();
        if (msg.includes('(404)') || msg.includes('NoSuchBucket')) return false;
        if (msg.includes('(403)') || msg.includes('Forbidden')) {
            throw new Error(
                `Bucket ${name}: tilgang nektet (403) — enten eies bucketen ikke av konto ${EXPECTED_ACCOUNT}, eller IAM mangler s3:ListBucket.`
            );
        }
        throw new FatalError(`head-bucket ${name} feilet (exit=${err.status ?? '?'}): ${msg || '(ingen output)'}`);
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
            's3api', 'get-bucket-policy', '--bucket', name, '--region', REGION, '--output', 'json',
        ], { encoding: 'utf-8', stdio: 'pipe' });
        const existing = JSON.parse(JSON.parse(output).Policy);
        return JSON.stringify(canonicalize(existing)) === JSON.stringify(canonicalize(desired));
    } catch (err) {
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
        execFileSync('aws', [
            's3api', 'create-bucket',
            '--bucket', name,
            '--region', REGION,
            '--create-bucket-configuration', `LocationConstraint=${REGION}`,
        ], { stdio: 'inherit' });
    }

    // Blokker all offentlig tilgang idempotent — OAC-policy er ikke offentlig og blokkeres ikke av dette.
    // Feil her er fatal: en ny bucket uten BPA skal ikke stå igjen uten sperr.
    try {
        execFileSync('aws', [
            's3api', 'put-public-access-block',
            '--bucket', name,
            '--region', REGION,
            '--public-access-block-configuration',
            'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true',
        ], { stdio: 'inherit' });
    } catch (err) {
        const msg = ((err.stderr?.toString() ?? '') + (err.stdout?.toString() ?? '')).trim();
        throw new FatalError(`put-public-access-block feilet for ${name} (exit=${err.status ?? '?'}): ${msg || '(ingen output)'}`);
    }

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
        const policyPath = join(tmpDir, 'policy.json');
        writeFileSync(policyPath, JSON.stringify(desired), { mode: 0o600 });
        execFileSync('aws', [
            's3api', 'put-bucket-policy',
            '--bucket', name,
            '--region', REGION,
            '--policy', `file://${policyPath}`,
        ], { stdio: 'inherit' });
    } finally {
        rmSync(tmpDir, { recursive: true, force: true });
    }
    console.log(`  Policy satt for ${name}`);
}

try {
    checkAccount();
} catch (err) {
    console.error(err.message);
    process.exit(1);
}

let failed = false;
for (const bucket of BUCKETS) {
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
    console.error('Ein eller fleire buckets feilet — sjekk feilmeldingane over.');
    process.exit(1);
}
console.log('S3-buckets klare.');
