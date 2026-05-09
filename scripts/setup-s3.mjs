#!/usr/bin/env node
// Oppretter S3-buckets og setter bucket policy for CloudFront OAC-tilgang.
// Kjøres manuelt ved nyoppsett.
import { execSync } from 'node:child_process';

const REGION = 'eu-north-1';

const BUCKETS = [
  {
    name: 'tennerogtrivsel-se',
    distributionArn: 'arn:aws:cloudfront::382286755083:distribution/E9Z51DQB2K1G4',
  },
  {
    name: 'test2.aarrestad.com-se',
    distributionArn: 'arn:aws:cloudfront::382286755083:distribution/E2WXX7ZUR5NNP3',
  },
];

function run(cmd) {
  return execSync(cmd, { encoding: 'utf-8' });
}

function bucketExists(name) {
  try {
    run(`aws s3api head-bucket --bucket ${name} --region ${REGION}`);
    return true;
  } catch {
    return false;
  }
}

function ensureBucket({ name, distributionArn }) {
  if (bucketExists(name)) {
    console.log(`S3 bucket ${name}: finnes allerede`);
  } else {
    console.log(`Oppretter S3 bucket ${name}...`);
    run(`aws s3api create-bucket --bucket ${name} --region ${REGION} --create-bucket-configuration LocationConstraint=${REGION}`);
  }

  const policy = JSON.stringify({
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
  });
  run(`aws s3api put-bucket-policy --bucket ${name} --policy '${policy}'`);
  console.log(`  Policy satt for ${name}`);
}

for (const bucket of BUCKETS) {
  ensureBucket(bucket);
}
console.log('S3-buckets klare.');
