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

const scriptSrc = hashData.scriptHashes.length > 0
    ? `'self' ${hashData.scriptHashes.map(h => `'${h}'`).join(' ')} https://apis.google.com https://accounts.google.com`
    : `'self' 'unsafe-inline' https://apis.google.com https://accounts.google.com`;

const items = config.CustomHeadersConfig.Items;
const cspItem = items.find(item => item.Header === 'Content-Security-Policy');
if (!cspItem) {
    console.error('Error: Content-Security-Policy header not found in CloudFront policy');
    process.exit(1);
}

cspItem.Value = cspItem.Value.replace(/script-src [^;]+/, `script-src ${scriptSrc}`);

const tmpPath = '/tmp/cfn-policy-update.json';
writeFileSync(tmpPath, JSON.stringify(config));

execSync(
    `aws cloudfront update-response-headers-policy --id ${policyId} --if-match "${etag}" --response-headers-policy-config file://${tmpPath}`,
    { stdio: 'inherit' }
);

const hashCount = hashData.scriptHashes.length;
console.log(`CloudFront CSP oppdatert: ${hashCount > 0 ? `${hashCount} hash(er)` : "'unsafe-inline' (fallback — kjør build + generate-csp-hashes for å aktivere hashes)"}`);
