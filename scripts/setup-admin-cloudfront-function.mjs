#!/usr/bin/env node
// One-shot script: oppretter CloudFront Function som setter X-Robots-Tag: noindex på /admin-paths
// og kobler den til distribusjonen sin default behavior (viewer-response).
// Idempotent: trygt å kjøre flere ganger.
//
// Bruk: CLOUDFRONT_DISTRIBUTION_ID=<id> node scripts/setup-admin-cloudfront-function.mjs

import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DISTRIBUTION_ID = process.env.CLOUDFRONT_DISTRIBUTION_ID;
if (!DISTRIBUTION_ID) {
    console.error('Feil: CLOUDFRONT_DISTRIBUTION_ID miljøvariabel mangler.');
    console.error('Bruk: CLOUDFRONT_DISTRIBUTION_ID=<id> node scripts/setup-admin-cloudfront-function.mjs');
    process.exit(1);
}

const FUNCTION_NAME = 'tot-admin-noindex';
const FUNCTION_CODE = `function handler(event) {
    var response = event.response;
    var request = event.request;
    if (request.uri.startsWith('/admin')) {
        response.headers['x-robots-tag'] = { value: 'noindex' };
    }
    return response;
}`;

function run(cmd) {
    return JSON.parse(execSync(cmd, { encoding: 'utf-8' }));
}

// Steg 1: Sjekk om funksjonen allerede finnes
console.log(`Sjekker om ${FUNCTION_NAME} allerede finnes...`);
let functionArn;
const listResult = run('aws cloudfront list-functions');
const existing = listResult.FunctionList?.Items?.find(f => f.Name === FUNCTION_NAME);

if (existing) {
    functionArn = existing.FunctionMetadata.FunctionARN;
    console.log(`Funksjon finnes allerede: ${functionArn}`);
} else {
    // Steg 2: Opprett funksjonen
    console.log('Oppretter ny CloudFront Function...');
    const codeFile = join(tmpdir(), 'tot-admin-fn.js');
    writeFileSync(codeFile, FUNCTION_CODE, 'utf-8');

    const configFile = join(tmpdir(), 'tot-admin-fn-config.json');
    writeFileSync(configFile, JSON.stringify({
        Comment: 'X-Robots-Tag noindex for /admin paths',
        Runtime: 'cloudfront-js-2.0'
    }), 'utf-8');

    const createResult = run(
        `aws cloudfront create-function` +
        ` --name ${FUNCTION_NAME}` +
        ` --function-config file://${configFile}` +
        ` --function-code fileb://${codeFile}`
    );
    const devEtag = createResult.ETag;
    unlinkSync(codeFile);
    unlinkSync(configFile);

    // Steg 3: Publiser funksjonen (DEVELOPMENT → LIVE)
    console.log('Publiserer funksjonen...');
    const publishResult = run(
        `aws cloudfront publish-function --name ${FUNCTION_NAME} --if-match ${devEtag}`
    );
    functionArn = publishResult.FunctionSummary.FunctionMetadata.FunctionARN;
    console.log(`Funksjon publisert: ${functionArn}`);
}

// Steg 4: Hent gjeldende distribusjonskonfig
console.log(`Henter distribusjonskonfig for ${DISTRIBUTION_ID}...`);
const distResult = run(`aws cloudfront get-distribution-config --id ${DISTRIBUTION_ID}`);
const etag = distResult.ETag;
const config = distResult.DistributionConfig;

// Steg 5: Sjekk om funksjon allerede er koblet til
const fa = config.DefaultCacheBehavior.FunctionAssociations;
const alreadyAssociated = fa?.Items?.some(
    f => f.FunctionARN === functionArn && f.EventType === 'viewer-response'
);

if (alreadyAssociated) {
    console.log('Funksjon er allerede koblet til distribusjonen. Ingen endring nødvendig.');
    process.exit(0);
}

// Steg 6: Legg til FunctionAssociation
if (!config.DefaultCacheBehavior.FunctionAssociations) {
    config.DefaultCacheBehavior.FunctionAssociations = { Quantity: 0, Items: [] };
}
config.DefaultCacheBehavior.FunctionAssociations.Items.push({
    FunctionARN: functionArn,
    EventType: 'viewer-response'
});
config.DefaultCacheBehavior.FunctionAssociations.Quantity =
    config.DefaultCacheBehavior.FunctionAssociations.Items.length;

// Steg 7: Oppdater distribusjonen
const configFile = join(tmpdir(), 'cf-dist-config.json');
writeFileSync(configFile, JSON.stringify(config), 'utf-8');
console.log('Oppdaterer CloudFront-distribusjon...');
execSync(
    `aws cloudfront update-distribution` +
    ` --id ${DISTRIBUTION_ID}` +
    ` --if-match ${etag}` +
    ` --distribution-config file://${configFile}`,
    { stdio: 'inherit' }
);
unlinkSync(configFile);
console.log('Ferdig! CloudFront deployer endringen (typisk 5–15 min).');
console.log(`Verifiser med: curl -sI https://tennerogtrivsel.no/admin | grep x-robots-tag`);
