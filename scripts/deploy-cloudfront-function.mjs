import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FUNCTION_NAME = 'tennerogtrivsel-trailing-slash';
const FUNCTION_CONFIG = JSON.stringify({
    Comment: '301-redirect URIer uten avsluttende skråstrek til tilsvarende URI med skråstrek',
    Runtime: 'cloudfront-js-2.0',
});

const functionCode = readFileSync(join(__dirname, 'cloudfront-trailing-slash.js'));
const tmpPath = '/tmp/cf-trailing-slash.js';
writeFileSync(tmpPath, functionCode);

let etag;
try {
    const existing = JSON.parse(
        execSync(`aws cloudfront describe-function --name ${FUNCTION_NAME} --stage DEVELOPMENT`, { encoding: 'utf-8' })
    );
    etag = existing.ETag;
    const updated = JSON.parse(
        execSync(
            `aws cloudfront update-function --name ${FUNCTION_NAME} --if-match "${etag}" --function-config '${FUNCTION_CONFIG}' --function-code fileb://${tmpPath}`,
            { encoding: 'utf-8' }
        )
    );
    etag = updated.ETag;
    console.log('CloudFront-funksjon oppdatert');
} catch {
    const created = JSON.parse(
        execSync(
            `aws cloudfront create-function --name ${FUNCTION_NAME} --function-config '${FUNCTION_CONFIG}' --function-code fileb://${tmpPath}`,
            { encoding: 'utf-8' }
        )
    );
    etag = created.ETag;
    console.log('CloudFront-funksjon opprettet');
}

execSync(
    `aws cloudfront publish-function --name ${FUNCTION_NAME} --if-match "${etag}"`,
    { stdio: 'inherit' }
);
console.log(`CloudFront-funksjon publisert: ${FUNCTION_NAME}`);
