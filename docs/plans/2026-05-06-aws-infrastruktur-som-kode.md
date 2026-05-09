# AWS infrastruktur som kode — Implementasjonsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** All AWS-infrastruktur for tennerogtrivsel.no skal ligge i kode slik at oppsettet er reproduserbart fra en tom AWS-konto uten å måtte klikke i konsollen.

**Architecture:** Utvidede Node.js setup-scripts (konsistent med eksisterende `deploy-cloudfront-function.mjs`, `setup-admin-cloudfront-function.mjs`). Ingen CDK/Terraform — ett nytt toolchain å vedlikeholde er ikke proporsjonalt for dette repoet. Hvert script er idempotent: sjekker om ressursen finnes, og oppretter/oppdaterer etter behov.

**Tech Stack:** AWS SDK v3 (`@aws-sdk/client-*`), Node.js scripts i `scripts/`, kjøres manuelt ved nyoppsett eller av CI der relevant.

---

## Audit: Hva er i AWS vs hva er i kode (2026-05-06)

| Ressurs | AWS-state | I kode? |
|---------|-----------|---------|
| S3 bucket `tennerogtrivsel-se` | Prod, OAC-policy for CloudFront | ❌ Bare S3 sync i CI |
| S3 bucket `test2.aarrestad.com-se` | Test | ❌ |
| CloudFront dist `E9Z51DQB2K1G4` | Prod (tennerogtrivsel.no) | ❌ |
| CloudFront dist `E2WXX7ZUR5NNP3` | Test (test2.aarrestad.com) | ❌ |
| CF Function `sitemap_redirect` | LIVE — viewer-request, default behavior | ✅ `cloudfront-trailing-slash.js` + `deploy-cloudfront-function.mjs` |
| CF Function `add-index-html` | LIVE men ikke i noen behavior | ⚠️ Deprecated — i kode men ikke aktiv |
| CF Function `strip-tiles-prefix` | LIVE — viewer-request, `/tiles/*` | ❌ Kode finnes kun i AWS |
| CF Function `tot-admin-noindex` | LIVE — viewer-response, default behavior | ✅ `setup-admin-cloudfront-function.mjs` |
| Response Headers Policy `tot-security-headers` | LIVE | ⚠️ Oppdatering i kode, men oppretting er manuell |
| Lambda `kontakt-form-handler` | nodejs24.x, 128MB, 3s | ✅ `lambda/kontakt-form-handler/` + CI deploy |
| Lambda URL | `4rjjfpoxvferjhkahhwrucrl4u0qipei.lambda-url.eu-north-1.on.aws` | ❌ |
| DynamoDB `kontakt-rate-limit` | eu-north-1 | ❌ |
| IAM role `kontakt-form-handler-role-40w71jir` | service-role | ❌ |
| SES identity `tennerogtrivsel.no` | Verifisert | ❌ |
| SES identity `aarrestad.com` | Verifisert | ❌ |

**Prod CloudFront dist E9Z51DQB2K1G4 — behaviors:**

| Path | Origin | CF Functions | Policy |
|------|--------|-------------|--------|
| `*` (default) | S3 tennerogtrivsel-se (OAC) | `sitemap_redirect` (viewer-req), `tot-admin-noindex` (viewer-resp) | tot-security-headers, CachingOptimized |
| `/api/kontakt` | Lambda URL | — | tot-security-headers, CachingDisabled, alle metoder |
| `/api/*` | S3 | — | — |
| `/tiles/*` | basemaps.cartocdn.com | `strip-tiles-prefix` (viewer-req) | — |

---

## Filer som opprettes

| Fil | Ansvar |
|-----|--------|
| `scripts/cloudfront-strip-tiles-prefix.js` | Kode for `strip-tiles-prefix` CF Function (reddet fra AWS) |
| `scripts/setup-cloudfront-functions.mjs` | Oppretter/oppdaterer alle 3 aktive CF Functions idempotent |
| `scripts/setup-s3.mjs` | Oppretter S3-buckets + bucket policy (OAC-binding) |
| `scripts/setup-dynamodb.mjs` | Oppretter `kontakt-rate-limit`-tabell med TTL |
| `scripts/setup-response-headers-policy.mjs` | Oppretter `tot-security-headers`-policy om den ikke finnes, returnerer ID |
| `scripts/setup-lambda.mjs` | Oppretter Lambda URL + setter env-variabler (deploy av koden er allerede i CI) |
| `docs/architecture/aws-infrastruktur.md` | Oversikt + manuell oppsettguide for ressurser som ikke scripts (IAM, SES, ACM, dist) |

Eksisterende `update-cloudfront-csp.mjs` beholdes uendret — den oppdaterer CSP-hashes og bruker policy-IDen (som nå kan komme fra `setup-response-headers-policy.mjs`).

---

## Task 1: Redde `strip-tiles-prefix` fra AWS

Koden for denne CF Function finnes kun i AWS. Den må hentes ut og sjekkes inn.

**Files:**
- Create: `scripts/cloudfront-strip-tiles-prefix.js`

- [x] **Steg 1.1: Hent funksjonskode fra AWS**

  ```bash
  aws cloudfront get-function --name strip-tiles-prefix --stage LIVE --outfile /tmp/strip-tiles-prefix.js
  cat /tmp/strip-tiles-prefix.js
  ```

- [x] **Steg 1.2: Lagre som `scripts/cloudfront-strip-tiles-prefix.js`**

  Kopier innholdet til `scripts/cloudfront-strip-tiles-prefix.js`. Legg til kommentar øverst:

  ```js
  // CloudFront Function (viewer-request): stripper /tiles/-prefiks fra URI
  // slik at basemaps.cartocdn.com mottar riktig path.
  // Kjøretid: cloudfront-js-2.0
  ```

  Legg til Node.js-eksport nederst for testing (sjekk om det allerede finnes):
  ```js
  if (typeof module !== 'undefined') {
    module.exports = { handler };
  }
  ```

- [x] **Steg 1.3: Verifiser at koden er korrekt ved å se på `/tiles/*`-logikken**

  Funksjonens oppgave: `/tiles/a/b/c` → omskriver til `/rastertiles/voyager/a/b/c` som sendes til basemaps.cartocdn.com.
  Bekreft at dette stemmer med koden du hentet.

- [x] **Steg 1.4: Commit**

  ```bash
  git add scripts/cloudfront-strip-tiles-prefix.js
  git commit -m "chore(aws): redde strip-tiles-prefix CF Function fra AWS til kode"
  ```

---

## Task 2: Saml alle CF Function-deployscripts i ett idempotent script

I dag er deployscripts spredt: `deploy-cloudfront-function.mjs` deployer `sitemap_redirect`/`add-index-html`, `setup-admin-cloudfront-function.mjs` deployer `tot-admin-noindex`. Lag et felles script som deployer alle tre aktive CF Functions.

**Files:**
- Create: `scripts/setup-cloudfront-functions.mjs`
- Keep: `deploy-cloudfront-function.mjs` og `setup-admin-cloudfront-function.mjs` (brukt i CI — fjernes i egen PR etter migrering)

- [x] **Steg 2.1: Skriv `scripts/setup-cloudfront-functions.mjs`**

  ```js
  #!/usr/bin/env node
  import { CloudFrontClient, DescribeFunctionCommand, CreateFunctionCommand, UpdateFunctionCommand, PublishFunctionCommand } from '@aws-sdk/client-cloudfront';
  import { readFileSync } from 'fs';
  import { fileURLToPath } from 'url';
  import { dirname, join } from 'path';

  const __dir = dirname(fileURLToPath(import.meta.url));
  const cf = new CloudFrontClient({ region: 'us-east-1' });

  const FUNCTIONS = [
    {
      name: 'sitemap_redirect',
      codePath: join(__dir, 'cloudfront-trailing-slash.js'),
      runtime: 'cloudfront-js-2.0',
      comment: 'sitemap redirect + trailing-slash + index.html for default behavior',
    },
    {
      name: 'strip-tiles-prefix',
      codePath: join(__dir, 'cloudfront-strip-tiles-prefix.js'),
      runtime: 'cloudfront-js-2.0',
      comment: 'Strip /tiles/ prefix for OSM tile proxy',
    },
    {
      name: 'tot-admin-noindex',
      codePath: join(__dir, 'cloudfront-admin-noindex.js'),
      runtime: 'cloudfront-js-2.0',
      comment: 'X-Robots-Tag: noindex for /admin/* paths',
    },
  ];

  async function deployFunction({ name, codePath, runtime, comment }) {
    const code = readFileSync(codePath);
    let etag;
    try {
      const existing = await cf.send(new DescribeFunctionCommand({ Name: name, Stage: 'DEVELOPMENT' }));
      etag = existing.ETag;
      console.log(`Updating ${name}...`);
      const updated = await cf.send(new UpdateFunctionCommand({
        Name: name,
        IfMatch: etag,
        FunctionConfig: { Comment: comment, Runtime: runtime },
        FunctionCode: code,
      }));
      etag = updated.ETag;
    } catch (err) {
      if (err.name !== 'NoSuchFunctionExists') throw err;
      console.log(`Creating ${name}...`);
      const created = await cf.send(new CreateFunctionCommand({
        Name: name,
        FunctionConfig: { Comment: comment, Runtime: runtime },
        FunctionCode: code,
      }));
      etag = created.ETag;
    }
    await cf.send(new PublishFunctionCommand({ Name: name, IfMatch: etag }));
    console.log(`  Published ${name}`);
  }

  for (const fn of FUNCTIONS) {
    await deployFunction(fn);
  }
  console.log('Alle CF Functions er oppdatert og publisert.');
  ```

- [x] **Steg 2.2: Finn riktig filnavn på admin-noindex-funksjonen**

  ```bash
  grep -r "admin-noindex\|noindex" scripts/ --include="*.mjs" --include="*.js" -l
  cat scripts/setup-admin-cloudfront-function.mjs
  ```

  Finn hvilken JS-fil som inneholder koden for `tot-admin-noindex`, og oppdater `codePath` i FUNCTIONS-lista tilsvarende.

- [x] **Steg 2.3: Kjør scriptet manuelt og verifiser**

  ```bash
  node scripts/setup-cloudfront-functions.mjs
  ```

  Forventet: `Alle CF Functions er oppdatert og publisert.` uten feil.

  Verifiser i AWS Console at alle tre er publisert og viser LIVE-status.

- [x] **Steg 2.4: Commit**

  ```bash
  git add scripts/setup-cloudfront-functions.mjs
  git commit -m "feat(aws): samle CF Function-deploy i setup-cloudfront-functions.mjs"
  ```

---

## Task 3: Script for S3-buckets

**Files:**
- Create: `scripts/setup-s3.mjs`

S3-buckets for prod og test opprettes manuelt i dag. Scriptet skal sjekke om bucket finnes og opprette + sette policy om nødvendig.

- [ ] **Steg 3.1: Skriv `scripts/setup-s3.mjs`**

  ```js
  #!/usr/bin/env node
  // Oppretter S3-buckets og setter bucket policy for CloudFront OAC-tilgang.
  // Kjøres manuelt ved nyoppsett.
  import { S3Client, CreateBucketCommand, HeadBucketCommand, PutBucketPolicyCommand } from '@aws-sdk/client-s3';

  const REGION = 'eu-north-1';
  const s3 = new S3Client({ region: REGION });

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

  async function ensureBucket({ name, distributionArn }) {
    try {
      await s3.send(new HeadBucketCommand({ Bucket: name }));
      console.log(`S3 bucket ${name}: finnes allerede`);
    } catch (err) {
      if (err.name !== 'NotFound' && err.$metadata?.httpStatusCode !== 404) throw err;
      console.log(`Oppretter S3 bucket ${name}...`);
      await s3.send(new CreateBucketCommand({
        Bucket: name,
        CreateBucketConfiguration: { LocationConstraint: REGION },
      }));
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
    await s3.send(new PutBucketPolicyCommand({ Bucket: name, Policy: policy }));
    console.log(`  Policy satt for ${name}`);
  }

  for (const bucket of BUCKETS) {
    await ensureBucket(bucket);
  }
  console.log('S3-buckets klare.');
  ```

- [ ] **Steg 3.2: Kjør mot AWS og verifiser (kun test — prod bucket finnes allerede)**

  ```bash
  node scripts/setup-s3.mjs
  ```

  Forventet output:
  ```
  S3 bucket tennerogtrivsel-se: finnes allerede
    Policy satt for tennerogtrivsel-se
  S3 bucket test2.aarrestad.com-se: finnes allerede
    Policy satt for test2.aarrestad.com-se
  S3-buckets klare.
  ```

- [ ] **Steg 3.3: Commit**

  ```bash
  git add scripts/setup-s3.mjs
  git commit -m "feat(aws): script for å opprette/konfigurere S3-buckets (setup-s3.mjs)"
  ```

---

## Task 4: Script for DynamoDB-tabell

**Files:**
- Create: `scripts/setup-dynamodb.mjs`

`kontakt-rate-limit`-tabellen brukes av Lambda for rate limiting. Den er ikke i kode.

- [ ] **Steg 4.1: Hent nåværende tabell-config fra AWS**

  ```bash
  aws dynamodb describe-table --table-name kontakt-rate-limit --region eu-north-1 --output json \
    --query 'Table.{Keys:KeySchema,Attrs:AttributeDefinitions,Billing:BillingModeSummary,TTL:"(sjekk separat)"}'
  aws dynamodb describe-time-to-live --table-name kontakt-rate-limit --region eu-north-1 --output json
  ```

  Noter partition key, billing mode (PAY_PER_REQUEST / PROVISIONED) og TTL-attributt-navn.

- [ ] **Steg 4.2: Skriv `scripts/setup-dynamodb.mjs`**

  Fyll inn verdier fra Steg 4.1 (TTL-attributt og key schema):

  ```js
  #!/usr/bin/env node
  // Oppretter DynamoDB-tabell for rate limiting av Lambda kontaktskjema.
  import { DynamoDBClient, CreateTableCommand, DescribeTableCommand, UpdateTimeToLiveCommand } from '@aws-sdk/client-dynamodb';

  const REGION = 'eu-north-1';
  const client = new DynamoDBClient({ region: REGION });
  const TABLE_NAME = 'kontakt-rate-limit';

  async function ensureTable() {
    try {
      await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
      console.log(`DynamoDB ${TABLE_NAME}: finnes allerede`);
      return;
    } catch (err) {
      if (err.name !== 'ResourceNotFoundException') throw err;
    }

    console.log(`Oppretter DynamoDB ${TABLE_NAME}...`);
    await client.send(new CreateTableCommand({
      TableName: TABLE_NAME,
      AttributeDefinitions: [
        { AttributeName: 'ip', AttributeType: 'S' },   // <-- verifiser mot Steg 4.1
      ],
      KeySchema: [
        { AttributeName: 'ip', KeyType: 'HASH' },       // <-- verifiser mot Steg 4.1
      ],
      BillingMode: 'PAY_PER_REQUEST',                   // <-- verifiser mot Steg 4.1
    }));

    // Vent til tabellen er aktiv
    let active = false;
    while (!active) {
      await new Promise(r => setTimeout(r, 2000));
      const status = await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
      active = status.Table.TableStatus === 'ACTIVE';
    }

    // Aktiver TTL (attributt-navn fra Steg 4.1)
    await client.send(new UpdateTimeToLiveCommand({
      TableName: TABLE_NAME,
      TimeToLiveSpecification: { Enabled: true, AttributeName: 'ttl' }, // <-- verifiser navn
    }));
    console.log(`  ${TABLE_NAME} klar med TTL`);
  }

  await ensureTable();
  ```

- [ ] **Steg 4.3: Kjør mot AWS (read-only verify — tabellen finnes allerede)**

  ```bash
  node scripts/setup-dynamodb.mjs
  ```

  Forventet: `DynamoDB kontakt-rate-limit: finnes allerede`

- [ ] **Steg 4.4: Commit**

  ```bash
  git add scripts/setup-dynamodb.mjs
  git commit -m "feat(aws): script for å opprette DynamoDB rate-limit-tabell"
  ```

---

## Task 5: Script for Response Headers Policy (oppretting)

`update-cloudfront-csp.mjs` oppdaterer CSP-hashes i en eksisterende policy. Men selve opprettingen av `tot-security-headers`-policyen er manuell. Lag et script som oppretter policyen om den ikke finnes.

**Files:**
- Create: `scripts/setup-response-headers-policy.mjs`

- [ ] **Steg 5.1: Skriv `scripts/setup-response-headers-policy.mjs`**

  ```js
  #!/usr/bin/env node
  // Oppretter tot-security-headers Response Headers Policy i CloudFront om den ikke finnes.
  // Printer policy-IDen til stdout — brukes av update-cloudfront-csp.mjs.
  import { CloudFrontClient, ListResponseHeadersPoliciesCommand, CreateResponseHeadersPolicyCommand } from '@aws-sdk/client-cloudfront';
  import { SECURITY_HEADERS } from '../src/utils/security-headers.js';

  const cf = new CloudFrontClient({ region: 'us-east-1' });
  const POLICY_NAME = 'tot-security-headers';

  async function ensurePolicy() {
    const list = await cf.send(new ListResponseHeadersPoliciesCommand({ Type: 'custom' }));
    const existing = list.ResponseHeadersPolicyList?.Items?.find(
      i => i.ResponseHeadersPolicy.ResponseHeadersPolicyConfig.Name === POLICY_NAME
    );
    if (existing) {
      const id = existing.ResponseHeadersPolicy.Id;
      console.log(`Policy finnes: ${id}`);
      return id;
    }

    console.log('Oppretter tot-security-headers policy...');
    const result = await cf.send(new CreateResponseHeadersPolicyCommand({
      ResponseHeadersPolicyConfig: {
        Name: POLICY_NAME,
        Comment: `${POLICY_NAME} — speiler src/utils/security-headers.ts`,
        SecurityHeadersConfig: {
          StrictTransportSecurity: {
            Override: true,
            IncludeSubdomains: true,
            Preload: true,
            AccessControlMaxAgeSec: 63072000,
          },
          ContentTypeOptions: { Override: true },
          FrameOptions: { Override: true, FrameOption: 'DENY' },
          ReferrerPolicy: { Override: true, ReferrerPolicy: 'strict-origin-when-cross-origin' },
          XSSProtection: { Override: false, Protection: false },
          ContentSecurityPolicy: {
            Override: true,
            ContentSecurityPolicy: SECURITY_HEADERS.csp,
          },
        },
        CustomHeadersConfig: {
          Quantity: 3,
          Items: [
            { Header: 'Cross-Origin-Opener-Policy', Value: 'same-origin-allow-popups', Override: true },
            { Header: 'Cross-Origin-Resource-Policy', Value: 'same-origin', Override: true },
            { Header: 'Permissions-Policy', Value: "camera=(), microphone=(), geolocation=(), interest-cohort=()", Override: true },
          ],
        },
      },
    }));
    const id = result.ResponseHeadersPolicy.Id;
    console.log(`  Opprettet med ID: ${id}`);
    return id;
  }

  const id = await ensurePolicy();
  process.stdout.write(id + '\n');
  ```

  **Merk:** `security-headers.ts` eksporterer muligens ikke `csp` direkte til CommonJS. Sjekk at importen fungerer, eller hardkod CSP-strengen med en kommentar om at den speiler filen.

- [ ] **Steg 5.2: Kjør og verifiser**

  ```bash
  node scripts/setup-response-headers-policy.mjs
  ```

  Forventet: `Policy finnes: b0de82e9-73e5-45de-abe2-3d236375b674`

- [ ] **Steg 5.3: Commit**

  ```bash
  git add scripts/setup-response-headers-policy.mjs
  git commit -m "feat(aws): script for å opprette CloudFront Response Headers Policy"
  ```

---

## Task 6: Dokumenter CloudFront distribusjoner og manuelle ressurser

CloudFront distribution-oppsett er komplekst (behaviors, origins, OAC, cache policies, SSL-sert). Et idempotent script for hele distribusjonen er mye arbeid for lite gevinst — i stedet dokumenterer vi oppsettet så detaljert at en ny distribusjon kan gjenskapes manuelt i løpet av ~30 minutter.

**Files:**
- Create: `docs/architecture/aws-infrastruktur.md`

- [ ] **Steg 6.1: Skriv `docs/architecture/aws-infrastruktur.md`**

  Dokumentet skal inneholde:

  **Distribusjonsoversikt:**
  - ID og aliases for prod (E9Z51DQB2K1G4) og test (E2WXX7ZUR5NNP3)
  - Origins: S3 (OAC, ikke OAI), basemaps.cartocdn.com, Lambda URL

  **Behaviors (prod):**
  | Path | Origin | CF Functions | Policy |
  |------|--------|-------------|--------|
  | `*` | S3 | sitemap_redirect (viewer-req), tot-admin-noindex (viewer-resp) | tot-security-headers, CachingOptimized |
  | `/api/kontakt` | Lambda URL | — | tot-security-headers, CachingDisabled, alle HTTP-metoder |
  | `/api/*` | S3 | — | — |
  | `/tiles/*` | basemaps.cartocdn.com | strip-tiles-prefix (viewer-req) | — |

  **Origin Access Control (OAC):**
  - Type: S3, Signing: sigv4, Override: always
  - Bucket policy: `AllowCloudFrontServicePrincipal` med `AWS:SourceArn: <dist-ARN>`

  **IAM — Lambda-rolle `kontakt-form-handler-role-40w71jir`:**
  - Policies: AWSLambdaBasicExecutionRole + inline for DynamoDB (PutItem, GetItem på `kontakt-rate-limit`) + SES SendEmail

  **SES:**
  - Identities: `tennerogtrivsel.no`, `aarrestad.com` (verifisert via DNS)
  - Sender-adresse brukt av Lambda: `noreply@tennerogtrivsel.no`

  **ACM-sertifikat:**
  - `*.tennerogtrivsel.no` og bare-domain + test-domener (sjekk i AWS Console → Certificate Manager → us-east-1)

  **Lambda URL:**
  - Auth type: NONE (autentisering via HMAC `Origin-Verify-Secret` i Lambda-koden)

  **Setup-scripts:**
  - `setup-s3.mjs` — S3-buckets
  - `setup-dynamodb.mjs` — rate-limit-tabell
  - `setup-cloudfront-functions.mjs` — CF Functions
  - `setup-response-headers-policy.mjs` — Response Headers Policy
  - Distribusjonene må opprettes manuelt (se AWS Console-steg nedenfor)

  **Steg-for-steg: Opprett ny CloudFront distribusjon:**
  1. Kjør alle setup-scripts i rekkefølge
  2. AWS Console → CloudFront → Create distribution
  3. Origin: S3-bucket, bruk OAC (Create new OAC)
  4. Legg til origins for cartocdn og Lambda URL
  5. Default behavior: redirect-to-HTTPS, CachingOptimized, velg functions og policy
  6. Legg til behaviors for `/api/kontakt`, `/api/*`, `/tiles/*`
  7. SSL: velg ACM-sertifikat for domenet
  8. Alternativt domenenavn: alle aliases
  9. Oppdater S3 bucket policy med ny dist-ARN

- [ ] **Steg 6.2: Commit**

  ```bash
  git add docs/architecture/aws-infrastruktur.md
  git commit -m "docs(aws): dokumenter CloudFront-distribusjoner, IAM, SES og oppsettssteg"
  ```

---

## Task 7: Rydd opp `add-index-html` CF Function

`add-index-html` er deployert men ikke knyttet til noen behavior i prod. Scriptet `deploy-cloudfront-function.mjs` ser ut til å deploye begge `add-index-html` og `sitemap_redirect` — avklar hvilken som faktisk er i bruk.

**Files:**
- Modify: `scripts/deploy-cloudfront-function.mjs` (evt. slett)

- [ ] **Steg 7.1: Sjekk hvilken function som er knyttet til test-distribusjonen**

  ```bash
  aws cloudfront get-distribution-config --id E2WXX7ZUR5NNP3 \
    --output json \
    --query 'DistributionConfig.DefaultCacheBehavior.FunctionAssociations.Items[*].{ARN:FunctionARN,Event:EventType}'
  ```

  Finn ut om `add-index-html` er aktiv i test. Hvis nei: den er deprecated.

- [ ] **Steg 7.2: Avklar hva `deploy-cloudfront-function.mjs` deployer**

  ```bash
  cat scripts/deploy-cloudfront-function.mjs | grep -E "name|FunctionName|function"
  ```

  Finn funksjonsnavnet som deployes. Hvis det er `add-index-html` og den er deprecated: oppdater scriptet til å deploye `sitemap_redirect` (eller fjern scriptet og bruk `setup-cloudfront-functions.mjs` fremover).

- [ ] **Steg 7.3: Oppdater CI-referanser**

  Sjekk om `deploy-cloudfront-function.mjs` brukes i `deploy.yml`. Erstatt eventuelt med `setup-cloudfront-functions.mjs` eller behold begge i overgangsfasen.

- [ ] **Steg 7.4: Commit eventuelle endringer**

  ```bash
  git add scripts/ .github/workflows/deploy.yml
  git commit -m "chore(aws): rydd opp deprecated add-index-html CF Function"
  ```

---

---

## Kandidater for fjerning

Gjennomgås og besluttes i Task 7 eller som egne oppfølgings-PRer.

| Kandidat | Type | Status | Vurdering |
|----------|------|--------|-----------|
| CF Function `add-index-html` i AWS | AWS-ressurs | LIVE men ikke knyttet til noen behavior | Sannsynligvis deprecated — erstattet av `sitemap_redirect`. **Slett** om Steg 7.1 bekrefter at den ikke er i bruk i test heller. |
| `scripts/cloudfront-trailing-slash.mjs` | Fil | Eksisterer ved siden av `.js`-versjonen | Dobbel kilde — sjekk om de er identiske (`diff scripts/cloudfront-trailing-slash.js scripts/cloudfront-trailing-slash.mjs`). Hvis ja: behold `.js` (brukt av `deploy-cloudfront-function.mjs`), slett `.mjs`. |
| `scripts/deploy-cloudfront-function.mjs` | Script | Brukes i CI (`deploy.yml`) | Kan erstattes av `setup-cloudfront-functions.mjs` når det er på plass. Fjern etter at CI er oppdatert. |
| `scripts/setup-admin-cloudfront-function.mjs` | Script | One-shot setup, trolig ikke i CI | Kan erstattes av `setup-cloudfront-functions.mjs`. Fjern etter verifisering. |
| Dobbel `function handler` i `sitemap_redirect` i AWS | CF Function-kode | Mulig bug fra deploy | Hent koden (`aws cloudfront get-function --name sitemap_redirect --stage LIVE --outfile /tmp/cf.js`) og sjekk om det er to `handler`-definisjoner. Hvis ja: deploy én gang fra `cloudfront-trailing-slash.js` via `setup-cloudfront-functions.mjs` for å rydde opp. |

---

## Task 8: Oppdater TODO og arkiver plan

- [ ] **Steg 8.1: Marker oppgaven som fullført i TODO.md og flytt til arkiv**

  Oppdater TODO.md og flytt planfilen til `docs/plans/archive/`.
