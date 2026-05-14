# AWS-infrastruktur for tennerogtrivsel.no

Dette dokumentet beskriver den fullstendige AWS-infrastrukturen for tennerogtrivsel.no.
CloudFront-distribusjonene må opprettes manuelt — resten kan settes opp via scripts.
En erfaren utvikler skal kunne gjenskape hele oppsett på ca. 30 minutter.

## Oversikt

| Ressurs | Region | Formål |
|---------|--------|--------|
| S3-buckets | eu-north-1 | Statiske filer |
| CloudFront | us-east-1 (global) | CDN + HTTPS |
| Lambda | eu-north-1 | Kontaktskjema-API |
| DynamoDB | eu-north-1 | Rate limiting |
| SES | eu-north-1 | Utsending av e-post |
| ACM | us-east-1 | TLS-sertifikater |

AWS-konto: `382286755083`

---

## 1. CloudFront-distribusjoner

### Prod — `E9Z51DQB2K1G4`

- **ARN:** `arn:aws:cloudfront::382286755083:distribution/E9Z51DQB2K1G4`
- **CloudFront-domene:** `d19b7g2frcrx6i.cloudfront.net`
- **Aliases:** `tennerogtrivsel.no`, `www.tennerogtrivsel.no`, `tennerogtrivsel.net`, `www.tennerogtrivsel.net`, `tennerogtrivsel.com`, `www.tennerogtrivsel.com`
- **Default root object:** `index.html`
- **SSL:** SNI, TLSv1.1_2016 minimum

### Test — `E2WXX7ZUR5NNP3`

- **ARN:** `arn:aws:cloudfront::382286755083:distribution/E2WXX7ZUR5NNP3`
- **CloudFront-domene:** `dnpjnvcuk7ym7.cloudfront.net`
- **Aliases:** `test2.aarrestad.com`, `test3.aarrestad.com`
- **Default root object:** `index.html`

---

## 2. Origins

### S3-origins

| Distribusjon | Origin-ID | S3-bucket | OAC-ID |
|---|---|---|---|
| Prod | `S3-tennerogtrivsel.no` | `tennerogtrivsel-se.s3.eu-north-1.amazonaws.com` | `E2GYYF9QZ9APXM` |
| Test | `test2.aarrestad.com.s3-website.eu-west-1.amazonaws.com-mm2cmlkhd1j` | `test2.aarrestad.com-se.s3.eu-north-1.amazonaws.com` | `E1A0HZ1O0QIWI5` |

> **Merk:** Test-origin-ID-en inneholder `eu-west-1` — det er en auto-generert CloudFront-label fra da distribusjonen ble opprettet, ikke region for bucketen. `DomainName` (og OAC-tilkoblingen) peker korrekt til `eu-north-1`.

S3 bruker **OAC (Origin Access Control)**, ikke OAI. Ingen `OriginAccessIdentity`.

### Kartfliser — `basemaps.cartocdn.com`

- **Origin-ID:** `tile.openstreetmap.org osm-tiles`
- **Protokoll:** https-only, TLSv1.2
- Ingen OAC (offentlig tredjeparts-API)

### Lambda-URL

- **Origin-ID / DomainName:** `4rjjfpoxvferjhkahhwrucrl4u0qipei.lambda-url.eu-north-1.on.aws`
- **Protokoll:** https-only
- **Custom header:** `X-Origin-Verify: <hemmelighet>` — sendes automatisk av CloudFront til Lambda for å verifisere at forespørsler kommer via CloudFront

---

## 3. Behaviors (prod)

Behaviors sjekkes i rekkefølge — mest spesifikk path vinner.

| Path | Origin | CF Functions | Cache-policy | Respons-headers-policy | HTTP-metoder |
|------|--------|-------------|-------------|----------------------|-------------|
| `/api/kontakt` | Lambda URL | — | `Managed-CachingDisabled` | `tot-security-headers` | Alle (GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS) |
| `/api/*` | S3 | — | `Managed-CachingDisabled` | `tot-security-headers` | GET, HEAD |
| `/tiles/*` | basemaps.cartocdn.com | `strip-tiles-prefix` (viewer-req) | `Managed-CachingOptimized` | `tot-security-headers` | GET, HEAD |
| `*` (default) | S3 | `sitemap_redirect` (viewer-req), `tot-admin-noindex` (viewer-resp) | `Managed-CachingOptimized` | `tot-security-headers` | GET, HEAD |

**Origin Request Policy for `/api/kontakt`:** `Managed-AllViewerExceptHostHeader`
(`Host`-headeren er reservert i CloudFront og kan ikke videresendes til custom origins.)

**Viewer Protocol Policy:**
- `/api/kontakt`: `https-only`
- Alle andre: `redirect-to-https`

### CloudFront Functions

| Funksjon | EventType | Tilknyttet path | Formål |
|----------|-----------|----------------|--------|
| `sitemap_redirect` | viewer-request | `*` (default) | www-redirect, sitemap-redirect, trailing-slash-redirect |
| `tot-admin-noindex` | viewer-response | `*` (default) | Setter `X-Robots-Tag: noindex` på `/admin`-paths |
| `strip-tiles-prefix` | viewer-request | `/tiles/*` | Omskriver `/tiles/{z}/{x}/{y}` → `/rastertiles/voyager/{z}/{x}/{y}` |

---

## 4. Origin Access Control (OAC)

Begge distribusjonene bruker separate OAC-er:

| OAC-ID | Navn | Type | Signing |
|--------|------|------|---------|
| `E2GYYF9QZ9APXM` | `tennerogtrivsel-se.s3.eu-north-1.amazonaws.com` | s3 | sigv4, always |
| `E1A0HZ1O0QIWI5` | `test2.aarrestad.com-se.s3.eu-north-1.amazonaws.com` | s3 | sigv4, always |

### S3 Bucket Policy

Bucket-policyen gir CloudFront-distribusjonen lesetilgang via `AWS:SourceArn`:

```json
{
  "Version": "2008-10-17",
  "Id": "PolicyForCloudFrontPrivateContent",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipal",
      "Effect": "Allow",
      "Principal": { "Service": "cloudfront.amazonaws.com" },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::BUCKET-NAVN/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::382286755083:distribution/DIST-ID"
        }
      }
    }
  ]
}
```

Erstatt `BUCKET-NAVN` og `DIST-ID` med riktige verdier for prod / test.
`setup-s3.mjs` gjør dette automatisk.

---

## 5. IAM — Lambda-rolle

**Rollenavn:** `kontakt-form-handler-role-40w71jir`
**ARN:** `arn:aws:iam::382286755083:role/service-role/kontakt-form-handler-role-40w71jir`
**Principal:** `lambda.amazonaws.com`

### Tilknyttede policies

| Type | Navn | Formål |
|------|------|--------|
| AWS-administrert | `AWSLambdaBasicExecutionRole-c71b8a2e-0893-43b1-8a1a-26a7e1365e5a` | CloudWatch Logs (skrive loggoppføringer) |
| Inline | `kontakt-form-dynamodb-ses` | DynamoDB rate-limit + SES e-postutsending |

### Inline policy `kontakt-form-dynamodb-ses`

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["dynamodb:GetItem", "dynamodb:PutItem"],
      "Resource": "arn:aws:dynamodb:*:*:table/kontakt-rate-limit"
    },
    {
      "Effect": "Allow",
      "Action": "ses:SendEmail",
      "Resource": "*"
    }
  ]
}
```

---

## 6. Lambda

**Funksjonsnavn:** `kontakt-form-handler`
**ARN:** `arn:aws:lambda:eu-north-1:382286755083:function:kontakt-form-handler`
**Region:** eu-north-1

### Lambda URL

- **URL:** `https://4rjjfpoxvferjhkahhwrucrl4u0qipei.lambda-url.eu-north-1.on.aws/`
- **Auth type:** `NONE` — autentisering skjer i Lambda-koden via `X-Origin-Verify`-headeren som CloudFront legger til automatisk
- **Invoke mode:** `BUFFERED`

Siden Lambda URL er offentlig (`NONE`), er sikringen todelt:
1. CloudFront legger alltid til `X-Origin-Verify`-headeren med en hemmelighet
2. Lambda avviser forespørsler uten korrekt header

---

## 7. DynamoDB

**Tabellnavn:** `kontakt-rate-limit`
**Region:** eu-north-1
**Billing mode:** PAY_PER_REQUEST
**Partition key:** `ip` (String)
**TTL-attributt:** `ttl`

Tabellen brukes av Lambda til å begrense antall kontaktskjema-innsendinger per IP-adresse.

---

## 8. SES

**Region:** eu-north-1

| Identitet | Verifikasjonsstatus | Metode |
|-----------|-------------------|--------|
| `tennerogtrivsel.no` | Success | DNS (TXT-record) |
| `aarrestad.com` | Success | DNS (TXT-record) |

**Sender-adresse brukt av Lambda:** `noreply@tennerogtrivsel.no`

SES er i production-modus (ikke sandkasse). E-post kan sendes til alle adresser.

---

## 9. ACM-sertifikater

Sertifikater må ligge i `us-east-1` for å brukes av CloudFront.

### Prod-sertifikat

- **ARN:** `arn:aws:acm:us-east-1:382286755083:certificate/6fc9164f-7cb3-4b15-975e-5ff8538cf2e5`
- **Primært domene:** `tennerogtrivsel.no`
- **SANs:** `tennerogtrivsel.no`, `www.tennerogtrivsel.no`, `tennerogtrivsel.net`, `www.tennerogtrivsel.net`, `tennerogtrivsel.com`, `www.tennerogtrivsel.com`
- **Utstedelse:** AWS Certificate Manager (DNS-validert)
- **Status:** ISSUED

### Test-sertifikat

- **ARN:** `arn:aws:acm:us-east-1:382286755083:certificate/65ba2599-286a-4360-a3e6-7dcbf238e1fe`
- **Primært domene:** `test2.aarrestad.com`
- **SANs:** `test2.aarrestad.com`, `test3.aarrestad.com`
- **Status:** ISSUED

---

## 10. Setup-scripts

Alle scripts kjøres fra prosjektets rot med `node scripts/<script>`. De er idempotente og trygge å kjøre flere ganger.

| Script | Formål |
|--------|--------|
| `scripts/setup-s3.mjs` | Oppretter S3-buckets og setter bucket policy for OAC-tilgang |
| `scripts/setup-dynamodb.mjs` | Oppretter DynamoDB rate-limit-tabell med TTL |
| `scripts/setup-cloudfront-functions.mjs` | Deployer CloudFront Functions (`sitemap_redirect`, `strip-tiles-prefix`, `tot-admin-noindex`) |
| `scripts/setup-response-headers-policy.mjs` | Oppretter/oppdaterer `tot-security-headers` Response Headers Policy med CSP-hashes |

**NB:** CloudFront-distribusjonene selv må opprettes manuelt (se steg-for-steg under).
`setup-s3.mjs` krever at distribusjons-ARN er kjent på forhånd — kjør det etter distribusjonene er opprettet.

---

## 11. Steg-for-steg: Opprett ny CloudFront-distribusjon

Bruk dette når du skal sette opp prod eller test fra bunnen av.

### Forberedelser

1. Sørg for at AWS-profilen er satt: `aws sts get-caller-identity --output json`
2. Sertifikater må finnes i `us-east-1` — opprett via ACM-konsollen om nødvendig
3. Kjør scripts i rekkefølge (S3 kan vente til etter distribusjon er opprettet):

```bash
node scripts/setup-dynamodb.mjs
node scripts/setup-cloudfront-functions.mjs
node scripts/setup-response-headers-policy.mjs
```

### Opprett distribusjon i AWS-konsollen

1. Gå til **CloudFront → Distributions → Create distribution**

2. **Origin (S3):**
   - Origin domain: velg S3-bucketen (f.eks. `tennerogtrivsel-se.s3.eu-north-1.amazonaws.com`)
   - Origin access: velg **Origin access control settings (recommended)**
   - Klikk **Create new OAC** — bruk standardinnstillinger (sigv4, always sign)
   - Husk å kopiere bucket policy og oppdater bucketen etterpå

3. **Legg til origin for kartfliser:**
   - Origin domain: `basemaps.cartocdn.com`
   - Protocol: HTTPS only
   - Origin ID: `tile.openstreetmap.org osm-tiles`

4. **Legg til origin for Lambda URL:**
   - Origin domain: `4rjjfpoxvferjhkahhwrucrl4u0qipei.lambda-url.eu-north-1.on.aws`
   - Protocol: HTTPS only
   - Legg til custom header: `X-Origin-Verify` = `<hemmelighet fra Lambda-koden>`

5. **Default behavior (`*`):**
   - Origin: S3
   - Viewer protocol: Redirect HTTP to HTTPS
   - Allowed HTTP methods: GET, HEAD
   - Cache policy: `CachingOptimized`
   - Response headers policy: `tot-security-headers`
   - Function associations:
     - Viewer request: `sitemap_redirect`
     - Viewer response: `tot-admin-noindex`

6. **Legg til behavior for `/api/kontakt`:**
   - Path pattern: `/api/kontakt`
   - Origin: Lambda URL
   - Viewer protocol: HTTPS only
   - Allowed HTTP methods: Alle (GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE)
   - Cache policy: `CachingDisabled`
   - Origin request policy: `AllViewerExceptHostHeader`
   - Response headers policy: `tot-security-headers`

7. **Legg til behavior for `/api/*`:**
   - Path pattern: `/api/*`
   - Origin: S3
   - Viewer protocol: Redirect HTTP to HTTPS
   - Allowed HTTP methods: GET, HEAD
   - Cache policy: `CachingDisabled`
   - Response headers policy: `tot-security-headers`

8. **Legg til behavior for `/tiles/*`:**
   - Path pattern: `/tiles/*`
   - Origin: `tile.openstreetmap.org osm-tiles`
   - Viewer protocol: Redirect HTTP to HTTPS
   - Allowed HTTP methods: GET, HEAD
   - Cache policy: `CachingOptimized`
   - Response headers policy: `tot-security-headers`
   - Function associations:
     - Viewer request: `strip-tiles-prefix`

9. **Settings:**
   - Default root object: `index.html`
   - Alternate domain names (CNAMEs): alle domener som skal peke hit
   - SSL certificate: velg ACM-sertifikat for domenet (us-east-1)
   - Security policy: TLSv1.1_2016 eller nyere

10. Klikk **Create distribution** og vent på status `Deployed`

### Etter opprettelse

11. Oppdater S3 bucket policy med ny distribusjons-ARN:

```bash
# Rediger scripts/setup-s3.mjs med korrekt dist-ARN, deretter:
node scripts/setup-s3.mjs
```

12. Pek DNS til CloudFront-domenet (CNAME eller ALIAS-record).

---

## 12. Deprecated / opprydding

### CF Function `add-index-html`

- **Status:** Fortsatt aktiv i test-distribusjonen (`E2WXX7ZUR5NNP3`, DefaultCacheBehavior, viewer-request). Ikke lenger i bruk i prod.
- **Erstattet av:** `sitemap_redirect` (deployes av `setup-cloudfront-functions.mjs`)
- **Opprydding:** Når test-distribusjonen er oppdatert til å bruke `sitemap_redirect` i stedet for `add-index-html`, kan CF Function `add-index-html` slettes manuelt via AWS-konsollen (CloudFront → Functions → `add-index-html` → Delete). Kan ikke slettes via CLI mens den er tilknyttet en behavior.

### Slettede scripts

Følgende scripts er fjernet fordi de er erstattet av `setup-cloudfront-functions.mjs`:

| Script | Fjernet | Erstattet av |
|--------|---------|-------------|
| `scripts/deploy-cloudfront-function.mjs` | 2026-05-14 | `setup-cloudfront-functions.mjs` |
| `scripts/setup-admin-cloudfront-function.mjs` | 2026-05-14 | `setup-cloudfront-functions.mjs` |
