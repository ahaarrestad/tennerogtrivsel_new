# Plan: Sett opp CloudFront på test-siden

## Bakgrunn

Nettsiden deployes til S3-bucketen `test2.aarrestad.com` (eu-west-1) med `--acl public-read`. S3 serverer filene direkte — ingen CDN, ingen sikkerhetsheadere i produksjon, og ingen cache-invalidering etter deploy. Middleware i `src/middleware.ts` setter CSP og andre headere, men kjører kun i dev/SSR, ikke på statiske S3-filer.

## Mål

1. CloudFront-distribusjon foran S3-bucketen for test2.aarrestad.com
2. SSL-sertifikat (HTTPS)
3. Sikkerhetsheadere via Response Headers Policy
4. Cache-policy som respekterer API-filenes `no-cache`-krav
5. Oppdatert deploy-workflow med cache-invalidering
6. DNS peker til CloudFront i stedet for S3

## Forutsetninger

- AWS-konto med tilgang til CloudFront, ACM, S3, Route 53 (eller ekstern DNS)
- Domenet `test2.aarrestad.com` — DNS-kontroll hos eieren
- GitHub secrets for AWS-tilgang finnes allerede

---

## Steg 1: SSL-sertifikat (ACM)

**Viktig:** Sertifikatet MÅ opprettes i **us-east-1** (N. Virginia) — CloudFront krever dette uavhengig av S3-bucket-region.

1. Gå til **AWS Certificate Manager** → us-east-1
2. «Request a public certificate»
3. Domenenavn: `test2.aarrestad.com`
4. Valideringsmetode: **DNS-validering**
5. Legg til CNAME-posten som ACM genererer i DNS
6. Vent på status «Issued» (vanligvis noen minutter)

**Resultat:** ARN til sertifikatet, f.eks. `arn:aws:acm:us-east-1:ACCOUNT:certificate/UUID`

---

## Steg 2: CloudFront-distribusjon

### Origin-oppsett

| Innstilling | Verdi |
|-------------|-------|
| Origin domain | `test2.aarrestad.com.s3.eu-west-1.amazonaws.com` |
| Origin access | **Origin Access Control (OAC)** (anbefalt over OAI) |
| Origin path | *(tom)* |

> **OAC vs public-read:** Med OAC fjerner vi `--acl public-read` fra deploy og begrenser tilgang til kun via CloudFront. S3-bucketen trenger en bucket policy som gir CloudFront-distribusjonen `s3:GetObject`-tilgang.

### Generelle innstillinger

| Innstilling | Verdi |
|-------------|-------|
| Price class | Use only North America and Europe (billigst, dekker målgruppen) |
| Alternate domain name (CNAME) | `test2.aarrestad.com` |
| Custom SSL certificate | Sertifikatet fra steg 1 |
| Default root object | `index.html` |
| HTTP/2 | Aktivert |
| IPv6 | Aktivert |

### Cache-atferd (behaviors)

**Default behavior (`*`):**

| Innstilling | Verdi |
|-------------|-------|
| Viewer protocol policy | Redirect HTTP to HTTPS |
| Cache policy | `CachingOptimized` (managed policy) |
| Compress objects | Yes (gzip + Brotli) |
| Response headers policy | Egendefinert (se steg 3) |

**Tilleggsregel for `/api/*`:**

| Innstilling | Verdi |
|-------------|-------|
| Path pattern | `/api/*` |
| Cache policy | `CachingDisabled` (managed policy) |
| Response headers policy | Samme som default |

> API-JSON-filene MÅ hentes fersk — klienten filtrerer meldinger etter dato ved runtime.

### Feilsider (custom error responses)

| HTTP-kode | Response page path | Response code | TTL |
|-----------|-------------------|---------------|-----|
| 403 | `/404.html` | 404 | 300 |
| 404 | `/404.html` | 404 | 300 |

> S3 returnerer 403 for ikke-eksisterende filer med OAC. Mapping til 404 gir riktig brukeropplevelse.

---

## Steg 3: Response Headers Policy (sikkerhetsheadere)

Opprett en **custom response headers policy** som repliserer `src/middleware.ts`:

| Header | Verdi |
|--------|-------|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com https://accounts.google.com https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; img-src 'self' data: blob: https://lh3.googleusercontent.com https://drive.google.com https://www.google.com https://maps.gstatic.com; frame-src https://drive.google.com https://accounts.google.com https://www.google.com https://*.googleapis.com; connect-src 'self' blob: https://www.googleapis.com https://content.googleapis.com https://oauth2.googleapis.com https://accounts.google.com https://apis.google.com https://www.google.com` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` (ny — HSTS) |

> **HSTS** legges til her selv om den ikke er i middleware — anbefalt praksis for HTTPS-sider.

---

## Steg 4: S3 Bucket Policy (for OAC)

Erstatt `--acl public-read` med en bucket policy som kun gir CloudFront tilgang:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontOAC",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::test2.aarrestad.com/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::ACCOUNT_ID:distribution/DISTRIBUTION_ID"
        }
      }
    }
  ]
}
```

> CloudFront-konsollen tilbyr å kopiere denne policyen automatisk når du velger OAC.

---

## Steg 5: DNS-oppdatering

Endre DNS for `test2.aarrestad.com`:

- **Hvis Route 53:** Alias A-record → CloudFront-distribusjonens domenenavn (`d1234abcdef.cloudfront.net`)
- **Hvis ekstern DNS:** CNAME `test2.aarrestad.com` → `d1234abcdef.cloudfront.net`

> DNS-propagering kan ta opptil 48 timer, men vanligvis 5–15 minutter.

---

## Steg 6: Oppdater deploy-workflow

Endringer i `.github/workflows/deploy.yml`:

### 6a. Fjern `--acl public-read`

```yaml
# Før:
aws s3 sync dist/ s3://test2.aarrestad.com --acl public-read --delete

# Etter:
aws s3 sync dist/ s3://test2.aarrestad.com --delete
```

### 6b. Fjern separat API-cache-steg

S3-metadata for `no-cache` er ikke lenger nødvendig — CloudFront-behavioren for `/api/*` bruker `CachingDisabled`. S3-steget som setter `cache-control` på API-filer kan fjernes.

### 6c. Legg til cache-invalidering

```yaml
- name: Invalidate CloudFront cache
  run: |
    aws cloudfront create-invalidation \
      --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
      --paths "/*"
```

### 6d. Ny GitHub secret

Legg til `CLOUDFRONT_DISTRIBUTION_ID` som GitHub secret.

> **Merk:** `/*`-invalidering er gratis for de første 1000/måned. Ved hyppige deploys kan man begrense til endrede filer, men for dette prosjektet holder `/*`.

---

## Steg 7: Verifisering

Etter oppsett, sjekk at alt fungerer:

1. **HTTPS:** `curl -I https://test2.aarrestad.com` — skal returnere 200 med CloudFront-headere
2. **Sikkerhetsheadere:** Sjekk at `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` og `Strict-Transport-Security` er til stede
3. **API-filer:** `curl -I https://test2.aarrestad.com/api/active-messages.json` — skal ha `X-Cache: Miss from CloudFront` (ikke cachet)
4. **404-side:** `https://test2.aarrestad.com/ikkeeksisterende` — skal vise 404-siden
5. **Admin-panel:** Test innlogging, bildeopplasting, alle admin-moduler
6. **Cache-invalidering:** Deploy via GitHub Actions og sjekk at endringer er synlige umiddelbart
7. **SecurityHeaders.com:** Skann `https://test2.aarrestad.com` for headervalidering

---

## Knytning til andre oppgaver

- **Sikkerhetssjekk (steg 1):** Denne planen dekker M1 (CSP i produksjon) fra sikkerhetsplanen. Etter oppsett er dette steget løst.
- **CI/CD-forbedringer 2:** Cache-invalidering (steg 6c) dekker den oppgavens første punkt.

## Estimert tid

Manuelt arbeid i AWS-konsollen: ~30–45 minutter. DNS-propagering: minutter til timer. CI/CD-endring: ett lite commit.
