#!/usr/bin/env node
// Deployer alle aktive CloudFront Functions idempotent.
// Erstatter deploy-cloudfront-function.mjs og setup-admin-cloudfront-function.mjs.
// Bruk: node scripts/setup-cloudfront-functions.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));

const FUNCTIONS = [
    {
        name: 'sitemap_redirect',
        codePath: join(__dirname, 'cloudfront-trailing-slash.js'),
        comment: 'viewer-request: sitemap.xml-redirect + trailing-slash-redirect',
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

function run(cmd) {
    return JSON.parse(execSync(cmd, { encoding: 'utf-8' }));
}

function deployFunction({ name, codePath, comment, runtime }) {
    const code = readFileSync(codePath);
    const tmpPath = join(tmpdir(), `cf-${name}.js`);
    writeFileSync(tmpPath, code);
    const config = JSON.stringify({ Comment: comment, Runtime: runtime });

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
}

for (const fn of FUNCTIONS) {
    deployFunction(fn);
}
console.log('Alle CF Functions er oppdatert og publisert.');
