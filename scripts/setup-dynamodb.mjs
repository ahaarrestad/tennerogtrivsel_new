#!/usr/bin/env node
// Oppretter DynamoDB-tabell for rate limiting av Lambda kontaktskjema.
// Kjøres manuelt ved nyoppsett — ikke en del av CI-deploy.
import { execFileSync } from 'node:child_process';

const REGION = 'eu-north-1';
const EXPECTED_ACCOUNT = '382286755083';
const TABLE_NAME = 'kontakt-rate-limit';

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

function tableExists() {
    try {
        execFileSync('aws', [
            '--no-cli-pager', 'dynamodb', 'describe-table',
            '--table-name', TABLE_NAME,
            '--region', REGION,
        ], { stdio: 'pipe' });
        return true;
    } catch (err) {
        const msg = ((err.stderr?.toString() ?? '') + (err.stdout?.toString() ?? '')).trim();
        if (msg.includes('ResourceNotFoundException')) return false;
        throw new FatalError(`describe-table feilet (${exitInfo(err)}): ${msg || '(ingen output)'}`);
    }
}

function sleep(ms) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function waitForActive() {
    console.log(`  Venter på at ${TABLE_NAME} blir aktiv...`);
    for (let i = 0; i < 30; i++) {
        let output;
        try {
            output = execFileSync('aws', [
                '--no-cli-pager', 'dynamodb', 'describe-table',
                '--table-name', TABLE_NAME,
                '--region', REGION,
                '--output', 'text',
                '--query', 'Table.TableStatus',
            ], { encoding: 'utf-8', stdio: 'pipe' });
        } catch (err) {
            const msg = ((err.stderr?.toString() ?? '') + (err.stdout?.toString() ?? '')).trim();
            throw new FatalError(`describe-table under vent feilet (${exitInfo(err)}): ${msg || '(ingen output)'}`);
        }
        if (output.trim() === 'ACTIVE') return;
        sleep(2000);
    }
    throw new FatalError(`${TABLE_NAME} ble ikke aktiv etter 60 sekunder.`);
}

function ensureTable() {
    if (tableExists()) {
        console.log(`DynamoDB ${TABLE_NAME}: finnes allerede`);
        return;
    }

    console.log(`Oppretter DynamoDB ${TABLE_NAME}...`);
    try {
        execFileSync('aws', [
            '--no-cli-pager', 'dynamodb', 'create-table',
            '--table-name', TABLE_NAME,
            '--region', REGION,
            '--attribute-definitions', 'AttributeName=ip,AttributeType=S',
            '--key-schema', 'AttributeName=ip,KeyType=HASH',
            '--billing-mode', 'PAY_PER_REQUEST',
        ], { stdio: 'pipe' });
    } catch (err) {
        const msg = ((err.stderr?.toString() ?? '') + (err.stdout?.toString() ?? '')).trim();
        throw new FatalError(`create-table feilet (${exitInfo(err)}): ${msg || '(ingen output)'}`);
    }

    waitForActive();

    try {
        execFileSync('aws', [
            '--no-cli-pager', 'dynamodb', 'update-time-to-live',
            '--table-name', TABLE_NAME,
            '--region', REGION,
            '--time-to-live-specification', 'Enabled=true,AttributeName=ttl',
        ], { stdio: 'pipe' });
    } catch (err) {
        const msg = ((err.stderr?.toString() ?? '') + (err.stdout?.toString() ?? '')).trim();
        throw new FatalError(`update-time-to-live feilet (${exitInfo(err)}): ${msg || '(ingen output)'}`);
    }

    console.log(`  ${TABLE_NAME} klar med TTL`);
}

try {
    checkAccount();
} catch (err) {
    console.error(err.message);
    process.exit(1);
}

try {
    ensureTable();
} catch (err) {
    console.error(`Kritisk feil: ${err instanceof FatalError ? err.message : err.message}`);
    process.exit(1);
}

console.log('DynamoDB-tabell klar.');
