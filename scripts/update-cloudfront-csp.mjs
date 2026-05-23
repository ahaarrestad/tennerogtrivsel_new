import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const hashData = JSON.parse(
    readFileSync(join(__dirname, '../src/generated/csp-hashes.json'), 'utf-8')
);

const policyId = process.env.CLOUDFRONT_POLICY_ID;
if (!policyId) {
    console.error('Error: CLOUDFRONT_POLICY_ID environment variable is required');
    process.exit(1);
}

const policyResponse = JSON.parse(
    execSync(`aws cloudfront get-response-headers-policy --id ${policyId}`, { encoding: 'utf-8' })
);
const etag = policyResponse.ETag;
const config = policyResponse.ResponseHeadersPolicy.ResponseHeadersPolicyConfig;

// Runtime-injisert av apis.google.com/js/api.js. Oppdater også i
// src/utils/security-headers.ts og scripts/setup-response-headers-policy.mjs ved endring.
const GAPI_RUNTIME_HASHES = ["sha256-Ck+oGpSYXC+PJqw/YXnosEZnlS+j6SnLwb3GZZzgTr8="];
const allScriptHashes = [...hashData.scriptHashes, ...GAPI_RUNTIME_HASHES];

const scriptSrc = hashData.scriptHashes.length > 0
    ? `'self' ${allScriptHashes.map(h => `'${h}'`).join(' ')} https://apis.google.com https://accounts.google.com`
    : `'self' 'unsafe-inline' https://apis.google.com https://accounts.google.com`;

if (!config.SecurityHeadersConfig?.ContentSecurityPolicy) {
    console.error('Error: SecurityHeadersConfig.ContentSecurityPolicy not found in CloudFront policy');
    process.exit(1);
}

// NB: kun script-src oppdateres automatisk. Endringer i andre direktiver (frame-src m.fl.)
// krever manuell oppdatering via setup-response-headers-policy.mjs eller AWS Console.
config.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy =
    config.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy
        .replace(/script-src [^;]+/, `script-src ${scriptSrc}`);

const tmpPath = '/tmp/cfn-policy-update.json';
writeFileSync(tmpPath, JSON.stringify(config));

execSync(
    `aws cloudfront update-response-headers-policy --id ${policyId} --if-match "${etag}" --response-headers-policy-config file://${tmpPath}`,
    { stdio: 'inherit' }
);

const hashCount = hashData.scriptHashes.length;
console.log(`CloudFront CSP oppdatert: ${hashCount > 0 ? `${hashCount} hash(er)` : "'unsafe-inline' (fallback — kjør build + generate-csp-hashes for å aktivere hashes)"}`);
