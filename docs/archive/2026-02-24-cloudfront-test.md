# Plan: Sett opp CloudFront på test-siden

> **Status: FULLFØRT**

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

### 1.1 Åpne ACM i riktig region

1. Logg inn på [AWS Console](https://console.aws.amazon.com/)
2. Velg region **US East (N. Virginia) / us-east-1** i region-velgeren øverst til høyre
3. Søk etter «Certificate Manager» i tjeneste-søket, eller gå til **Services → Security, Identity, & Compliance → Certificate Manager**

### 1.2 Be om sertifikat

1. Klikk **«Request a certificate»** (oransje knapp)
2. Velg **«Request a public certificate»** → **Next**
3. Under **Domain names**:
   - Skriv inn `test2.aarrestad.com`
   - (Ikke legg til wildcard — vi trenger kun dette ene domenet)
4. Under **Validation method**:
   - Velg **«DNS validation»** (anbefalt — automatisk fornyelse)
5. Under **Key algorithm**:
   - Behold standard **RSA 2048** (bred kompatibilitet)
6. Klikk **«Request»**

### 1.3 DNS-validering

Etter at forespørselen er opprettet, vises sertifikatet med status «Pending validation»:

1. Klikk på sertifikat-IDen for å se detaljene
2. Under **Domains** vises en CNAME-post som må legges til i DNS:
   - **CNAME name:** `_abc123.test2.aarrestad.com` (generert av AWS)
   - **CNAME value:** `_xyz789.acm-validations.aws` (generert av AWS)
3. Gå til DNS-leverandøren for `aarrestad.com` og legg til denne CNAME-posten
4. Vent på at status endres til **«Issued»** (vanligvis 5–30 minutter)

> **Tips:** Hvis du bruker Route 53 for domenet, kan du klikke «Create records in Route 53» direkte fra ACM-grensesnittet — da slipper du manuell DNS-oppdatering.

### 1.4 Bekreft at sertifikatet er klart

- Status skal vise **«Issued»** med grønt ikon
- Kopier **ARN** fra sertifikatdetaljene — denne trengs i steg 2
  - Format: `arn:aws:acm:us-east-1:123456789012:certificate/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

---

## Steg 2: CloudFront-distribusjon

### 2.1 Opprett distribusjon

1. Gå til **Services → Networking & Content Delivery → CloudFront**
2. Klikk **«Create distribution»**

### 2.2 Origin-oppsett

Under **Origin**-seksjonen:

1. **Origin domain:** Klikk i feltet og velg S3-bucketen `test2.aarrestad.com.s3.eu-west-1.amazonaws.com` fra nedtrekkslisten
   - **Ikke** bruk S3 website endpoint (`.s3-website-eu-west-1.amazonaws.com`) — dette støtter ikke OAC
2. **Origin path:** La stå tomt
3. **Name:** Genereres automatisk fra origin domain — behold som det er
4. **Origin access:** Velg **«Origin access control settings (recommended)»**
5. Klikk **«Create new OAC»**:
   - **Name:** `test2-aarrestad-com-oac` (eller behold foreslått navn)
   - **Signing behavior:** `Sign requests (recommended)`
   - **Origin type:** `S3`
   - Klikk **«Create»**

> Et blått banner vil vise at du må oppdatere S3 bucket policy etter at distribusjonen er opprettet — dette gjør vi i steg 4.

### 2.3 Default cache behavior

Under **Default cache behavior**-seksjonen:

1. **Viewer protocol policy:** Velg **«Redirect HTTP to HTTPS»**
2. **Allowed HTTP methods:** `GET, HEAD` (standard — vi serverer kun statiske filer)
3. **Cache key and origin requests:**
   - Velg **«Cache policy and origin request policy (recommended)»**
   - **Cache policy:** Velg `CachingOptimized` fra nedtrekkslisten
     - Denne managed-policyen cacher basert på URL, med gzip/Brotli-komprimering
   - **Origin request policy:** Velg `CORS-S3Origin` (eller la stå tom)
   - **Response headers policy:** La stå tom foreløpig — vi oppretter denne i steg 3 og legger den til etterpå
4. **Compress objects automatically:** **Yes**

### 2.4 Generelle innstillinger (Settings)

Lenger ned på siden, under **Settings**:

1. **Price class:** Velg **«Use only North America and Europe»**
   - Billigst, og dekker Norges målgruppe fullstendig
2. **Alternate domain name (CNAME):** Klikk **«Add item»** og skriv `test2.aarrestad.com`
3. **Custom SSL certificate:** Velg sertifikatet fra steg 1 i nedtrekkslisten
   - Hvis det ikke vises, sjekk at sertifikatet er i us-east-1 og har status «Issued»
4. **Supported HTTP versions:** Behold `HTTP/2` aktivert (standard)
5. **Default root object:** Skriv `index.html`
6. **IPv6:** Behold aktivert (standard)
7. **Description:** Valgfritt, f.eks. `Test-side for Tenner og Trivsel`

### 2.5 Opprett distribusjonen

1. Klikk **«Create distribution»**
2. Status viser **«Deploying»** — dette tar vanligvis 5–15 minutter
3. **Noter distribution-IDen** (f.eks. `E1A2B3C4D5E6F7`) — trengs for deploy-workflow og bucket policy
4. **Noter domenenavnet** (f.eks. `d1a2b3c4d5e6f7.cloudfront.net`) — trengs for DNS i steg 5

> **Viktig:** Ikke vent på at status blir «Deployed» før du går videre med neste steg — du kan konfigurere bucket policy, feilsider og tilleggsregler parallelt.

### 2.6 Legg til tilleggsregel for `/api/*`

API-JSON-filene (som `active-messages.json`) MÅ aldri caches — klienten filtrerer meldinger etter dato ved runtime. Uten denne regelen vil CloudFront cache API-filene, og utløpte meldinger forblir synlige.

1. Gå til distribusjonen → fanen **«Behaviors»**
2. Klikk **«Create behavior»**
3. **Path pattern:** `/api/*`
4. **Origin and origin groups:** Velg S3-originen fra steg 2.2
5. **Viewer protocol policy:** `Redirect HTTP to HTTPS`
6. **Cache key and origin requests:**
   - **Cache policy:** Velg `CachingDisabled` fra nedtrekkslisten
   - **Response headers policy:** Samme egendefinerte policy som default (legges til i steg 3)
7. **Compress objects automatically:** `Yes`
8. Klikk **«Create behavior»**

### 2.7 Konfigurer feilsider

S3 med OAC returnerer **403 Forbidden** for filer som ikke finnes (ikke 404). Vi mapper dette til en pen 404-side.

1. Gå til distribusjonen → fanen **«Error pages»**
2. Klikk **«Create custom error response»** og opprett to regler:

**Regel 1 — 403:**

| Felt | Verdi |
|------|-------|
| HTTP error code | `403: Forbidden` |
| Customize error response | `Yes` |
| Response page path | `/404.html` |
| HTTP response code | `404` |
| Error caching minimum TTL | `300` (5 minutter) |

**Regel 2 — 404:**

| Felt | Verdi |
|------|-------|
| HTTP error code | `404: Not Found` |
| Customize error response | `Yes` |
| Response page path | `/404.html` |
| HTTP response code | `404` |
| Error caching minimum TTL | `300` |

> TTL på 300 sekunder betyr at en 404 caches i 5 minutter. Hvis du deployer ny innhold og det returnerer 404 umiddelbart, vil cache-invalideringen (steg 6c) rydde opp.

---

## Steg 3: Response Headers Policy (sikkerhetsheadere)

Denne policyen repliserer headerne fra `src/middleware.ts` (som kun kjører i dev/SSR) slik at de også gjelder i produksjon. I tillegg legger vi til HSTS som anbefalt praksis for HTTPS-sider.

### 3.1 Opprett policyen

1. Gå til **CloudFront → Policies** i venstre meny
2. Velg fanen **«Response headers»**
3. Klikk **«Create response headers policy»**
4. **Name:** `tenner-og-trivsel-security-headers`
5. **Description:** `Sikkerhetsheadere for Tenner og Trivsel (CSP, HSTS, X-Frame-Options)`

### 3.2 Security headers

Under **Security headers**-seksjonen, aktiver og konfigurer hver header:

**Content-Security-Policy:**
1. Slå på **Content-Security-Policy**
2. Lim inn følgende som verdi (én sammenhengende streng):

```
default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com https://accounts.google.com https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; img-src 'self' data: blob: https://lh3.googleusercontent.com https://drive.google.com https://www.google.com https://maps.gstatic.com; frame-src https://drive.google.com https://accounts.google.com https://www.google.com https://*.googleapis.com; connect-src 'self' blob: https://www.googleapis.com https://content.googleapis.com https://oauth2.googleapis.com https://accounts.google.com https://apis.google.com https://www.google.com
```

3. **Override origin:** `Yes` (vi vil at CloudFront-headeren alltid gjelder)

**X-Frame-Options:**
1. Slå på **X-Frame-Options**
2. Velg **DENY**
3. **Override origin:** `Yes`

**X-Content-Type-Options:**
1. Slå på **X-Content-Type-Options**
2. Verdien er alltid `nosniff` (ingen valg)
3. **Override origin:** `Yes`

**Referrer-Policy:**
1. Slå på **Referrer-Policy**
2. Velg **strict-origin-when-cross-origin**
3. **Override origin:** `Yes`

**Strict-Transport-Security (HSTS):**
1. Slå på **Strict-Transport-Security**
2. **Maximum age:** `31536000` (1 år i sekunder)
3. **Include subdomains:** `Yes`
4. **Preload:** `No` (ikke nødvendig for test-side)
5. **Override origin:** `Yes`

> **Merk:** `unsafe-inline` i `script-src` og `style-src` er nødvendig for Google OAuth og Tailwind CSS. Dette er en kjent begrensning dokumentert i sikkerhetsplanen (M2).

### 3.3 Lagre og tilknytt

1. Klikk **«Create»** for å lagre policyen
2. Gå tilbake til CloudFront-distribusjonen → **Behaviors**
3. Rediger **Default (`*`)** behavior:
   - Under **Response headers policy**, velg `tenner-og-trivsel-security-headers`
   - Klikk **«Save changes»**
4. Rediger **`/api/*`** behavior:
   - Legg til samme response headers policy
   - Klikk **«Save changes»**

---

## Steg 4: S3 Bucket Policy (for OAC)

Med OAC trenger ikke S3-bucketen `public-read` ACL lenger. I stedet gir vi CloudFront-distribusjonen eksplisitt tilgang via en bucket policy. Dette betyr at ingen kan nå S3-filene direkte — alt må gå via CloudFront.

### 4.1 Kopier policyen fra CloudFront

CloudFront genererer automatisk riktig bucket policy når du velger OAC:

1. Gå til CloudFront-distribusjonen fra steg 2
2. Under fanen **«Origins»**, klikk på S3-originen
3. Et blått banner viser: *«The S3 bucket policy needs to be updated»*
4. Klikk **«Copy policy»** — dette kopierer en ferdig JSON-policy til utklippstavlen

Policyen ser slik ut (med dine faktiske verdier):

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

### 4.2 Oppdater S3 bucket policy

1. Gå til **Services → S3**
2. Finn bucketen `test2.aarrestad.com` og klikk på den
3. Gå til fanen **«Permissions»**
4. Under **Bucket policy**, klikk **«Edit»**
5. Lim inn policyen fra steg 4.1 (erstatt eventuell eksisterende policy)
6. Klikk **«Save changes»**

### 4.3 Fjern offentlig tilgang

Nå som CloudFront er eneste vei inn, bør vi blokkere direkte offentlig S3-tilgang:

1. Fortsatt under **Permissions**-fanen
2. Under **Block public access (bucket settings)**, klikk **«Edit»**
3. Huk av **«Block all public access»**
4. Klikk **«Save changes»**
5. Skriv `confirm` i bekreftelsesboksen

> **Merk:** Eksisterende ACL-er (`public-read`) på individuelle objekter overstyres av «Block all public access». Bucket policyen for CloudFront OAC fungerer fortsatt fordi den bruker service principal, ikke offentlig tilgang.

### 4.4 Verifiser at direkte S3-tilgang er blokkert

Etter endringen skal direkte tilgang til S3 gi feil:

```bash
curl -I http://test2.aarrestad.com.s3.eu-west-1.amazonaws.com/index.html
# Forventet: 403 Forbidden
```

---

## Steg 5: DNS-oppdatering

DNS-posten for `test2.aarrestad.com` må endres fra å peke til S3 til å peke til CloudFront-distribusjonen.

### 5.1 Finn CloudFront-domenenavnet

1. Gå til CloudFront-distribusjonen fra steg 2
2. Kopier **Distribution domain name** (f.eks. `d1a2b3c4d5e6f7.cloudfront.net`)

### 5.2a Hvis du bruker Route 53

1. Gå til **Services → Route 53 → Hosted zones**
2. Klikk på hosted zone for `aarrestad.com`
3. Finn den eksisterende posten for `test2.aarrestad.com` (sannsynligvis en CNAME eller A-record som peker til S3)
4. Klikk **«Edit record»**
5. Endre til:
   - **Record type:** `A`
   - **Alias:** `Yes`
   - **Route traffic to:** `Alias to CloudFront distribution`
   - Velg distribusjonen fra nedtrekkslisten (den vises med domenenavnet fra 5.1)
6. Klikk **«Save»**

> **Fordel med Alias-record:** Ingen ekstra DNS-oppslag (raskere), og ingen kostnad for Route 53-forespørsler til CloudFront.

### 5.2b Hvis du bruker ekstern DNS-leverandør

1. Logg inn hos DNS-leverandøren
2. Finn eksisterende DNS-post for `test2.aarrestad.com`
3. Endre til (eller opprett ny):
   - **Type:** `CNAME`
   - **Name:** `test2`
   - **Value:** `d1a2b3c4d5e6f7.cloudfront.net` (domenenavnet fra 5.1)
   - **TTL:** `300` (5 minutter — kan økes til 3600 etter at alt fungerer)
4. Lagre endringen

> **Merk:** CNAME kan ikke brukes på apex-domener (f.eks. `aarrestad.com` uten subdomain). For `test2.aarrestad.com` fungerer CNAME fint.

### 5.3 Verifiser DNS-propagering

```bash
# Sjekk at DNS peker til CloudFront
dig test2.aarrestad.com

# Eller med nslookup
nslookup test2.aarrestad.com

# Forventet: CNAME eller A-record som til slutt resolver til cloudfront.net-adresser
```

DNS-propagering tar vanligvis 5–15 minutter, men kan ta opptil 48 timer avhengig av TTL på den gamle posten.

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

Når alle steg er fullført og CloudFront-distribusjonen har status «Deployed», kjør gjennom denne sjekklisten.

### 7.1 HTTPS fungerer

```bash
curl -I https://test2.aarrestad.com
```

**Forventet:**
- `HTTP/2 200`
- `server: AmazonS3` (origin)
- `x-cache: Hit from cloudfront` eller `Miss from cloudfront`
- `via: 1.1 xxxxxxx.cloudfront.net (CloudFront)`

### 7.2 Sikkerhetsheadere er til stede

```bash
curl -sI https://test2.aarrestad.com | grep -iE '(content-security|x-frame|x-content-type|referrer-policy|strict-transport)'
```

**Forventet output (alle 5 headere):**
```
content-security-policy: default-src 'self'; script-src ...
x-frame-options: DENY
x-content-type-options: nosniff
referrer-policy: strict-origin-when-cross-origin
strict-transport-security: max-age=31536000; includeSubDomains
```

### 7.3 API-filer caches IKKE

```bash
# Hent to ganger og sjekk at X-Cache alltid er Miss
curl -sI https://test2.aarrestad.com/api/active-messages.json | grep -i x-cache
sleep 2
curl -sI https://test2.aarrestad.com/api/active-messages.json | grep -i x-cache
```

**Forventet:** `X-Cache: Miss from CloudFront` begge ganger (CachingDisabled-policyen forhindrer caching).

### 7.4 404-side fungerer

Åpne i nettleseren:
```
https://test2.aarrestad.com/denne-siden-finnes-ikke
```

**Forventet:** Prosjektets 404-side vises (ikke en tom S3 XML-feilmelding eller standard CloudFront-feilside).

```bash
curl -sI https://test2.aarrestad.com/denne-siden-finnes-ikke
# Forventet: HTTP/2 404 (ikke 403)
```

### 7.5 Direkte S3-tilgang er blokkert

```bash
curl -I http://test2.aarrestad.com.s3.eu-west-1.amazonaws.com/index.html
```

**Forventet:** `403 Forbidden` — bekrefter at innhold kun er tilgjengelig via CloudFront.

### 7.6 Astro-undersider fungerer

Astro genererer rene URLer (`/kontakt/index.html` servert som `/kontakt`). Sjekk at CloudFront håndterer dette:

```bash
curl -sI https://test2.aarrestad.com/kontakt | head -1
curl -sI https://test2.aarrestad.com/tjenester | head -1
curl -sI https://test2.aarrestad.com/admin | head -1
```

**Forventet:** `HTTP/2 200` for alle. Hvis du får 403, kan det skyldes at CloudFront ikke legger til `index.html` for undermapper — da trengs en **CloudFront Function** for URL-rewriting (se feilsøking nedenfor).

### 7.7 Admin-panel

Manuell test i nettleseren:

1. Gå til `https://test2.aarrestad.com/admin`
2. Logg inn med Google OAuth — verifiser at innlogging fungerer (sjekk at CSP ikke blokkerer Google-domener)
3. Åpne nettleserens utviklerverktøy → Console — se etter CSP-feil
4. Test bildeopplasting (krever `blob:` i `connect-src`)
5. Test lagring av innstillinger, tannleger og galleri

### 7.8 SecurityHeaders.com

1. Gå til [securityheaders.com](https://securityheaders.com)
2. Skann `https://test2.aarrestad.com`
3. **Forventet:** Minimum karakter **B** (A krever CSP uten `unsafe-inline`)

### 7.9 Cache-invalidering via deploy

1. Gjør en liten endring (f.eks. endre en tekst i en innstilling via admin)
2. Trigger en deploy via GitHub Actions (push til main eller manuell workflow_dispatch)
3. Etter deploy, sjekk at endringen er synlig umiddelbart på `https://test2.aarrestad.com`

---

### Feilsøking

**Problem: Undersider gir 403**

CloudFront med S3 OAC håndterer ikke automatisk `index.html` for undermapper (f.eks. `/kontakt` → `/kontakt/index.html`). Løsning: Opprett en CloudFront Function for URL-rewriting:

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

**Problem: CSP blokkerer Google OAuth**

Sjekk at CSP-verdien i Response Headers Policy er nøyaktig lik den i steg 3.2. Vanlige feil:
- Manglende `https://accounts.google.com` i `frame-src`
- Manglende `blob:` i `connect-src` (trengs for bildeopplasting)
- Ekstra mellomrom eller linjeskift i CSP-strengen

---

## Knytning til andre oppgaver

- **Sikkerhetssjekk (steg 1):** Denne planen dekker M1 (CSP i produksjon) fra sikkerhetsplanen. Etter oppsett er dette steget løst.
- **CI/CD-forbedringer 2:** Cache-invalidering (steg 6c) dekker den oppgavens første punkt.

## Estimert tid

Manuelt arbeid i AWS-konsollen: ~30–45 minutter. DNS-propagering: minutter til timer. CI/CD-endring: ett lite commit.
