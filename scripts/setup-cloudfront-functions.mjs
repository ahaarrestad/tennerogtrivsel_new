#!/usr/bin/env node
// Deployer alle aktive CloudFront Functions idempotent.
// Erstatter deploy-cloudfront-function.mjs og setup-admin-cloudfront-function.mjs.
// Bruk: CARTO_API_KEY=... node scripts/setup-cloudfront-functions.mjs
import { readFileSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Funksjonskode i git inneholder denne placeholderen framfor den ekte nøkkelen.
export const CARTO_KEY_PLACEHOLDER = '__CARTO_API_KEY__';

const FUNCTIONS = [
    {
        name: 'sitemap_redirect',
        codePath: join(__dirname, 'cloudfront-trailing-slash.js'),
        comment: 'viewer-request: www-redirect + sitemap-redirect + trailing-slash-redirect',
        runtime: 'cloudfront-js-2.0',
    },
    {
        name: 'strip-tiles-prefix',
        codePath: join(__dirname, 'cloudfront-strip-tiles-prefix.js'),
        comment: 'viewer-request: omskriver /tiles/{z}/{x}/{y} til /rastertiles/voyager/{z}/{x}/{y}',
        runtime: 'cloudfront-js-2.0',
    },
    {
        name: 'tot-admin-noindex',
        codePath: join(__dirname, 'cloudfront-admin-noindex.js'),
        comment: 'viewer-response: X-Robots-Tag noindex for /admin paths',
        runtime: 'cloudfront-js-2.0',
    },
];

/**
 * Bytter ut CARTO-nøkkelens placeholder med den ekte verdien.
 * Kode uten placeholder returneres urørt, så de øvrige funksjonene er upåvirket.
 * Mangler nøkkelen når placeholderen finnes, kastes det — en tom `key` ville gitt
 * vannmerkede tiles uten at noe annet feilet.
 */
export function injectCartoKey(code, apiKey) {
    if (!code.includes(CARTO_KEY_PLACEHOLDER)) return code;
    if (!apiKey) {
        throw new Error(
            `${CARTO_KEY_PLACEHOLDER} finnes i funksjonskoden, men miljøvariabelen CARTO_API_KEY er ikke satt. ` +
                'Deploy avbrutt — uten nøkkel leverer CARTO vannmerkede tiles.'
        );
    }
    return code.split(CARTO_KEY_PLACEHOLDER).join(apiKey);
}

/**
 * Leser all funksjonskode og kaster hvis noen av funksjonene trenger CARTO-nøkkelen mens
 * den mangler. Kjøres før deploy-løkka: uten den ville de første funksjonene blitt
 * publisert før den som trenger nøkkelen feilet, og etterlatt en delvis kjørt deploy.
 */
export function assertCartoKeyAvailable(functions, apiKey) {
    for (const fn of functions) {
        injectCartoKey(readFileSync(fn.codePath, 'utf-8'), apiKey);
    }
}

function run(cmd) {
    return JSON.parse(execSync(cmd, { encoding: 'utf-8' }));
}

export function deployFunction({ name, codePath, comment, runtime }, cartoApiKey) {
    const code = injectCartoKey(readFileSync(codePath, 'utf-8'), cartoApiKey);
    const config = JSON.stringify({ Comment: comment, Runtime: runtime });

    // Koden må innom disk fordi `aws ... --function-code fileb://` krever en sti, og den
    // inneholder da CARTO-nøkkelen i klartekst. mkdtempSync gir et uforutsigbart navn i en
    // katalog med 0700 — et fast navn som /tmp/cf-<navn>.js kunne en annen lokal bruker
    // pre-opprette som symlink eller verdensleselig fil og fange nøkkelen. Katalogen
    // slettes uansett utfall.
    const tmpDir = mkdtempSync(join(tmpdir(), 'cf-'));
    const tmpPath = join(tmpDir, `${name}.js`);

    try {
        writeFileSync(tmpPath, code, { mode: 0o600 });
        let etag;
        try {
            const existing = run(`aws cloudfront describe-function --name ${name} --stage DEVELOPMENT`);
            etag = existing.ETag;
            console.log(`Oppdaterer ${name}...`);
            const updated = run(
                `aws cloudfront update-function --name ${name} --if-match "${etag}" --function-config '${config}' --function-code fileb://${tmpPath}`
            );
            etag = updated.ETag;
        } catch (err) {
            if (!err.message.includes('NoSuchFunctionExists')) throw err;
            console.log(`Oppretter ${name}...`);
            const created = run(
                `aws cloudfront create-function --name ${name} --function-config '${config}' --function-code fileb://${tmpPath}`
            );
            etag = created.ETag;
        }

        execSync(`aws cloudfront publish-function --name ${name} --if-match "${etag}"`, { stdio: 'inherit' });
        console.log(`  Publisert: ${name}`);
    } finally {
        rmSync(tmpDir, { recursive: true, force: true });
    }
}

/* v8 ignore start */
if (import.meta.url === `file://${process.argv[1]}`) {
    const cartoApiKey = process.env.CARTO_API_KEY;
    try {
        assertCartoKeyAvailable(FUNCTIONS, cartoApiKey);
        for (const fn of FUNCTIONS) {
            deployFunction(fn, cartoApiKey);
        }
    } catch (err) {
        console.error(`Kritisk feil: ${err.message}`);
        process.exit(1);
    }
    console.log('Alle CF Functions er oppdatert og publisert.');
}
/* v8 ignore stop */
