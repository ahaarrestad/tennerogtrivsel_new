import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCspString, buildScriptSrc } from './setup-response-headers-policy.mjs';

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

if (!config.SecurityHeadersConfig?.ContentSecurityPolicy) {
    console.error('Error: SecurityHeadersConfig.ContentSecurityPolicy not found in CloudFront policy');
    process.exit(1);
}

let scriptSrc;
try {
    scriptSrc = buildScriptSrc(hashData.scriptHashes);
} catch (err) {
    console.error(err.message);
    process.exit(1);
}
config.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy = buildCspString(scriptSrc);

const tmpPath = '/tmp/cfn-policy-update.json';
writeFileSync(tmpPath, JSON.stringify(config));

execSync(
    `aws cloudfront update-response-headers-policy --id ${policyId} --if-match "${etag}" --response-headers-policy-config file://${tmpPath}`,
    { stdio: 'inherit' }
);

console.log(`CloudFront CSP oppdatert (alle direktiver): ${hashData.scriptHashes.length} build-hash(er) + GAPI runtime-hash`);
