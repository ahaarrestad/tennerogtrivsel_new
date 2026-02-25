# Plan: Sett opp CloudFront på produksjon

## Bakgrunn

Samme oppsett som test-siden (test2.aarrestad.com) skal nå gjøres for produksjonsdomenet `www.tennerogtrivsel.no`. Test-oppsettet er verifisert og fungerer — denne planen følger samme steg med produksjonsverdier.

### Erfaringer fra test-oppsettet

- **Husk å tilknytte OAC til originen** — uten dette får CloudFront ikke tilgang til S3 (403 på alt)
- Response Headers Policy må legges til på **begge** behaviors (default + `/api/*`)
- CloudFront Function for URL-rewriting var nødvendig for at Astro-undersider (`/kontakt`, `/tjenester` osv.) skulle fungere

## Mål

1. CloudFront-distribusjon foran S3-bucketen for www.tennerogtrivsel.no
2. SSL-sertifikat (HTTPS)
3. Sikkerhetsheadere via Response Headers Policy
4. Cache-policy som respekterer API-filenes `no-cache`-krav
5. Oppdatert deploy-workflow med cache-invalidering
6. DNS peker til CloudFront i stedet for S3

## Forutsetninger

- AWS-konto med tilgang til CloudFront, ACM, S3, Route 53 (eller ekstern DNS)
- Domenet `www.tennerogtrivsel.no` — DNS-kontroll hos eieren
- GitHub secrets for AWS-tilgang finnes allerede
- S3-bucket for produksjon eksisterer

---

## ~~Steg 1: SSL-sertifikat (ACM)~~ ✅ Allerede fullført

Sertifikat for `www.tennerogtrivsel.no` er opprettet i us-east-1 og har status «Issued». Bruk ARN fra ACM-konsollen i steg 2.

---

## ~~Steg 2: CloudFront-distribusjon~~ ✅ Fullført

### 2.1 Opprett distribusjon

1. Gå til **Services → Networking & Content Delivery → CloudFront**
2. Klikk **«Create distribution»**

### 2.2 Origin-oppsett

Under **Origin**-seksjonen:

1. **Origin domain:** Velg S3-bucketen for produksjon fra nedtrekkslisten (REST API-endpointet, f.eks. `www.tennerogtrivsel.no.s3.eu-west-1.amazonaws.com`)
   - **Ikke** bruk S3 website endpoint (`.s3-website-...`) — dette støtter ikke OAC
2. **Origin path:** La stå tomt
3. **Name:** Genereres automatisk — behold som det er
4. **Origin access:** Velg **«Origin access control settings (recommended)»**
   - ⚠️ **VIKTIG:** Husk å faktisk tilknytte OAC-en — dette ble glemt på test og ga 403 på alt
5. Klikk **«Create new OAC»**:
   - **Name:** `www-tennerogtrivsel-no-oac`
   - **Signing behavior:** `Sign requests (recommended)`
   - **Origin type:** `S3`
   - Klikk **«Create»**

> Et blått banner vil vise at du må oppdatere S3 bucket policy — dette gjør vi i steg 4.

### 2.3 Default cache behavior

Under **Default cache behavior**-seksjonen:

1. **Viewer protocol policy:** Velg **«Redirect HTTP to HTTPS»**
2. **Allowed HTTP methods:** `GET, HEAD`
3. **Cache key and origin requests:**
   - Velg **«Cache policy and origin request policy (recommended)»**
   - **Cache policy:** `CachingOptimized`
   - **Origin request policy:** `CORS-S3Origin` (eller la stå tom)
   - **Response headers policy:** La stå tom foreløpig — legges til i steg 3
4. **Compress objects automatically:** **Yes**

### 2.4 Generelle innstillinger (Settings)

1. **Price class:** Velg **«Use only North America and Europe»**
2. **Alternate domain name (CNAME):** Klikk **«Add item»** og skriv `www.tennerogtrivsel.no`
3. **Custom SSL certificate:** Velg sertifikatet fra steg 1
4. **Supported HTTP versions:** Behold `HTTP/2` aktivert
5. **Default root object:** Skriv `index.html`
6. **IPv6:** Behold aktivert
7. **Description:** `Produksjonsside for Tenner og Trivsel`

### 2.5 Opprett distribusjonen

1. Klikk **«Create distribution»**
2. Status viser **«Deploying»** — tar vanligvis 5–15 minutter
3. **Noter distribution-IDen** (f.eks. `E1A2B3C4D5E6F7`) — trengs for deploy-workflow
4. **Noter domenenavnet** (f.eks. `d1a2b3c4d5e6f7.cloudfront.net`) — trengs for DNS i steg 5

### 2.6 Legg til tilleggsregel for `/api/*`

1. Gå til distribusjonen → fanen **«Behaviors»**
2. Klikk **«Create behavior»**
3. **Path pattern:** `/api/*`
4. **Origin and origin groups:** Velg S3-originen fra steg 2.2
5. **Viewer protocol policy:** `Redirect HTTP to HTTPS`
6. **Cache key and origin requests:**
   - **Cache policy:** `CachingDisabled`
   - **Response headers policy:** Legges til i steg 3
7. **Compress objects automatically:** `Yes`
8. Klikk **«Create behavior»**

### 2.7 Konfigurer feilsider

1. Gå til distribusjonen → fanen **«Error pages»**
2. Opprett to regler:

**Regel 1 — 403:**

| Felt | Verdi |
|------|-------|
| HTTP error code | `403: Forbidden` |
| Customize error response | `Yes` |
| Response page path | `/404.html` |
| HTTP response code | `404` |
| Error caching minimum TTL | `300` |

**Regel 2 — 404:**

| Felt | Verdi |
|------|-------|
| HTTP error code | `404: Not Found` |
| Customize error response | `Yes` |
| Response page path | `/404.html` |
| HTTP response code | `404` |
| Error caching minimum TTL | `300` |

### 2.8 CloudFront Function for URL-rewriting

Astro genererer rene URLer (`/kontakt/index.html` servert som `/kontakt`). CloudFront med OAC trenger en funksjon for dette.

> **Merk:** Hvis du allerede opprettet `url-rewrite-index` for test-siden, kan du gjenbruke samme funksjon — bare tilknytt den til denne distribusjonen også.

Hvis ikke:

1. Gå til **CloudFront → Functions** → **Create function**
2. Navn: `url-rewrite-index`
3. Lim inn:

```javascript
function handler(event) {
    var request = event.request;
    var uri = request.uri;

    if (uri.endsWith('/')) {
        request.uri += 'index.html';
    } else if (!uri.includes('.')) {
        request.uri += '/index.html';
    }

    return request;
}
```

4. Publiser funksjonen (**Publish**)
5. Gå til distribusjonen → **Behaviors** → default behavior → **Edit**
6. Under **Function associations**, legg til funksjonen som **Viewer request**
7. Lagre

---

## Steg 3: Response Headers Policy (sikkerhetsheadere) — ⚠️ Delvis fullført

> **Merk:** Du kan gjenbruke policyen `tenner-og-trivsel-security-headers` fra test-oppsettet — den er ikke bundet til en spesifikk distribusjon. Hopp i så fall direkte til steg 3.3.

Hvis du oppretter en ny:

### 3.1 Opprett policyen

1. Gå til **CloudFront → Policies** → fanen **«Response headers»**
2. Klikk **«Create response headers policy»**
3. **Name:** `tenner-og-trivsel-security-headers-prod`
4. **Description:** `Sikkerhetsheadere for Tenner og Trivsel produksjon`

### 3.2 Security headers

**Content-Security-Policy:**
1. Slå på **Content-Security-Policy**
2. Lim inn (én sammenhengende streng):

```
default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com https://accounts.google.com https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; img-src 'self' data: blob: https://lh3.googleusercontent.com https://drive.google.com https://www.google.com https://maps.gstatic.com; frame-src https://drive.google.com https://accounts.google.com https://www.google.com https://*.googleapis.com; connect-src 'self' blob: https://www.googleapis.com https://content.googleapis.com https://oauth2.googleapis.com https://accounts.google.com https://apis.google.com https://www.google.com
```

3. **Override origin:** `Yes`

**X-Frame-Options:** DENY, Override: Yes

**X-Content-Type-Options:** nosniff, Override: Yes

**Referrer-Policy:** strict-origin-when-cross-origin, Override: Yes

**Strict-Transport-Security (HSTS):**
- **Maximum age:** `31536000` (1 år)
- **Include subdomains:** `Yes`
- **Preload:** Vurder `Yes` for produksjon (krever at domenet registreres på hstspreload.org)
- **Override origin:** `Yes`

### 3.3 Tilknytt policyen

1. Gå til CloudFront-distribusjonen → **Behaviors**
2. Rediger **Default (`*`)** behavior → legg til response headers policy → **Save**
3. Rediger **`/api/*`** behavior → legg til samme policy → **Save**

---

## ~~Steg 4: S3 Bucket Policy (for OAC)~~ ✅ Fullført

### 4.1 Kopier policyen fra CloudFront

1. Gå til CloudFront-distribusjonen → fanen **«Origins»** → klikk på S3-originen
2. Klikk **«Copy policy»** fra det blå banneret

Hvis banneret er borte, bruk denne malen (erstatt `DISTRIBUTION_ID`):

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
      "Resource": "arn:aws:s3:::PROD_BUCKET_NAME/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::382286755083:distribution/DISTRIBUTION_ID"
        }
      }
    }
  ]
}
```

### 4.2 Oppdater S3 bucket policy

1. Gå til **S3** → produksjonsbucketen → **Permissions** → **Bucket policy** → **Edit**
2. Lim inn policyen
3. Klikk **«Save changes»**

### 4.3 Fjern offentlig tilgang

1. Under **Permissions** → **Block public access** → **Edit**
2. Huk av **«Block all public access»**
3. **Save** → skriv `confirm`

### 4.4 Verifiser

```bash
curl -I http://PROD_BUCKET_NAME.s3.eu-west-1.amazonaws.com/index.html
# Forventet: 403 Forbidden
```

---

## ~~Steg 5: DNS-oppdatering~~ ✅ Fullført

### 5.1 Finn CloudFront-domenenavnet

Kopier **Distribution domain name** fra CloudFront-distribusjonen.

### 5.2 Oppdater DNS

Endre DNS-posten for `www.tennerogtrivsel.no` til å peke til CloudFront:

**Route 53:**
- **Record type:** `A`, **Alias:** Yes, **Route traffic to:** CloudFront distribution

**Ekstern DNS:**
- **Type:** `CNAME`
- **Name:** `www`
- **Value:** `dXXXXXXX.cloudfront.net`
- **TTL:** `300`

### 5.3 Verifiser DNS-propagering

```bash
dig www.tennerogtrivsel.no
# Forventet: resolver til cloudfront.net-adresser
```

---

## Steg 6: Oppdater deploy-workflow

Deploy-workflowen trenger en prod-deploy-jobb eller oppdatert S3-bucket. Endringer:

### 6a. S3 sync uten ACL

```yaml
aws s3 sync dist/ s3://PROD_BUCKET_NAME --delete
```

### 6b. Cache-invalidering med prod distribution ID

```yaml
- name: Invalidate CloudFront cache
  run: |
    aws cloudfront create-invalidation \
      --distribution-id ${{ secrets.CLOUDFRONT_PROD_DISTRIBUTION_ID }} \
      --paths "/*"
```

### 6c. GitHub secret

Legg til `CLOUDFRONT_PROD_DISTRIBUTION_ID` som GitHub secret (eller gjenbruk `CLOUDFRONT_DISTRIBUTION_ID` hvis du kun har én deploy-target).

---

## Steg 7: Verifisering

### 7.1 HTTPS fungerer

```bash
curl -I https://www.tennerogtrivsel.no
# Forventet: HTTP/2 200, via cloudfront
```

### 7.2 Sikkerhetsheadere

```bash
curl -sI https://www.tennerogtrivsel.no | grep -iE '(content-security|x-frame|x-content-type|referrer-policy|strict-transport)'
# Forventet: alle 5 headere
```

### 7.3 API-filer caches ikke

```bash
curl -sI https://www.tennerogtrivsel.no/api/active-messages.json | grep -i x-cache
sleep 2
curl -sI https://www.tennerogtrivsel.no/api/active-messages.json | grep -i x-cache
# Forventet: Miss from cloudfront begge ganger
```

### 7.4 404-side fungerer

```bash
curl -sI https://www.tennerogtrivsel.no/denne-siden-finnes-ikke
# Forventet: HTTP/2 404
```

### 7.5 Direkte S3-tilgang er blokkert

```bash
curl -I http://PROD_BUCKET_NAME.s3.eu-west-1.amazonaws.com/index.html
# Forventet: 403 Forbidden
```

### 7.6 Astro-undersider fungerer

```bash
curl -sI https://www.tennerogtrivsel.no/kontakt | head -1
curl -sI https://www.tennerogtrivsel.no/tjenester | head -1
curl -sI https://www.tennerogtrivsel.no/admin | head -1
# Forventet: HTTP/2 200 for alle
```

### 7.7 Admin-panel

1. Gå til `https://www.tennerogtrivsel.no/admin`
2. Logg inn med Google OAuth — verifiser at CSP ikke blokkerer
3. Sjekk konsollen for CSP-feil
4. Test bildeopplasting og lagring

### 7.8 SecurityHeaders.com

1. Skann `https://www.tennerogtrivsel.no` på [securityheaders.com](https://securityheaders.com)
2. **Forventet:** Minimum karakter **B**

### 7.9 Cache-invalidering via deploy

1. Trigger en deploy
2. Verifiser at endringer er synlige umiddelbart

---

## Forskjeller fra test-oppsettet

| | Test | Produksjon |
|---|------|-----------|
| Domene | `test2.aarrestad.com` | `www.tennerogtrivsel.no` |
| HSTS Preload | Nei | Vurder Ja |
| CloudFront Function | Opprettet ny | Gjenbruk fra test |
| Response Headers Policy | Opprettet ny | Kan gjenbruke fra test |
