# Plan: CloudFront produksjon — komplett oppsett med alle domener

> **Status: KLAR FOR GO-LIVE** — Oppdatert 2026-04-03. Infrastruktur ferdig, kontaktskjema ferdig på test. Gjenstående: Response Headers Policy, `/api/kontakt`-behavior på prod-distribusjon, avkommenter prod-deploy i deploy.yml, URL-redirects.

---

## Go-live sjekkliste

Gjør disse stegene i rekkefølge. Detaljerte instruksjoner i fasene under.

- [ ] **A. Response Headers Policy** (Fase 1.3) — legg til sikkerheitsheadere på prod-distribusjon
- [ ] **B. Kontaktskjema på prod** (Fase 6) — legg til `/api/kontakt`-origin og behavior på prod-distribusjon
- [ ] **C. Aktiver prod-deploy** (Fase 2.1–2.2) — avkommenter linjene i `deploy.yml` og kjør deploy
- [ ] **D. Gamle URL-redirects** (Fase 5) — oppdater CloudFront Function for `?page=`-redirects
- [ ] **E. Verifiser alt** (Fase 4) — kjør verifiseringsstegene

---

## Bakgrunn

Sammenslått plan fra tre tidligere oppgaver som alle handler om det samme:
- Cache-Control og grønn hosting (PROD-stegene)
- CloudFront på produksjon (www.tennerogtrivsel.no)
- Flere domener på samme CloudFront (.com, .net)

Test-oppsettet (test2.aarrestad.com) er ferdig verifisert og fungerer. Denne planen gjør tilsvarende for produksjon, med alle domener på én distribusjon.

> **Nåværende situasjon (2026-04-03):** Prod-distribusjonen (`d19b7g2frcrx6i.cloudfront.net`) serverer den nye Astro-siden men har ikke Response Headers Policy, mangler `/api/kontakt`-behavior, og deploy-steget i CI/CD er utkommentert. Kontaktskjema er ferdig implementert og fungerer på test. Alle 6 domener og SAN-sertifikat er på plass.

### Erfaringer fra test-oppsettet

- Husk å tilknytte OAC til originen — uten dette får CloudFront ikke tilgang til S3 (403)
- Response Headers Policy må legges til på **begge** behaviors (default + `/api/*`)
- CloudFront Function for URL-rewriting var nødvendig for Astro-undersider
- **CSP i CloudFront må synces med `middleware.ts`** — middleware kjører kun i dev, CloudFront er det som gjelder i prod. Tiles lastes fra `'self'` via CloudFront tile-proxy (CartoDB Voyager), så ingen ekstern tile-URL trengs i CSP

## Resultat etter gjennomføring

| Bruker skriver | Ser i adressefeltet | Redirect? |
|----------------|---------------------|-----------|
| `www.tennerogtrivsel.no` | `www.tennerogtrivsel.no` | Nei |
| `www.tennerogtrivsel.com` | `www.tennerogtrivsel.com` | Nei |
| `www.tennerogtrivsel.net` | `www.tennerogtrivsel.net` | Nei |
| `tennerogtrivsel.no` | `tennerogtrivsel.no` | Nei (direkte innhold) |
| `tennerogtrivsel.com` | `tennerogtrivsel.com` | Nei (direkte innhold) |
| `tennerogtrivsel.net` | `tennerogtrivsel.net` | Nei (direkte innhold) |

---

## Fase 1: CloudFront-distribusjon for www.tennerogtrivsel.no

### ~~Steg 1.1: ACM-sertifikat (us-east-1)~~ ✅

Sertifikat for `www.tennerogtrivsel.no` er opprettet og issued.

### ~~Steg 1.2: CloudFront-distribusjon~~ ✅

Distribusjon `d19b7g2frcrx6i` opprettet med OAC, CachingOptimized (default) + CachingDisabled (`/api/*`), feilsider (403→404, 404→404), CloudFront Function (`url-rewrite-index` gjenbrukt fra test).

> Verifisert 2026-03-01: Distribusjonen svarer og serverer innhold via CloudFront (OSL50-pop).

### Steg 1.3: Response Headers Policy (sikkerhetsheadere) ❌

Gjenbruk policyen `tenner-og-trivsel-security-headers` fra test, eller opprett ny for prod. Tilknytt den til **begge** behaviors (default + `/api/kontakt`).

> **Verifisert 2026-03-01:** Prod returnerer **ingen** sikkerhetsheadere. Test-distribusjonen har alle headere korrekt.

Headere: X-Frame-Options (DENY), X-Content-Type-Options (nosniff), Referrer-Policy (strict-origin-when-cross-origin), HSTS (1 år, includeSubDomains, vurder preload for prod).

**CSP — bruk verdien fra `src/middleware.ts` (denne er sannhetskilde):**

```
default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com https://accounts.google.com https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com; font-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; img-src 'self' data: blob: https://lh3.googleusercontent.com https://drive.google.com https://www.google.com; frame-src https://drive.google.com https://accounts.google.com https://www.google.com https://*.googleapis.com; connect-src 'self' blob: https://www.googleapis.com https://content.googleapis.com https://oauth2.googleapis.com https://accounts.google.com https://apis.google.com https://www.google.com
```

> **Lærdom fra test:** CSP i CloudFront og `middleware.ts` må holdes synkronisert.
> Middleware kjører kun i dev/SSR — CloudFront Response Headers Policy er det som gjelder i produksjon.
> Når CSP endres i kode, oppdater alltid CloudFront-policyen samtidig.

### ~~Steg 1.4: S3 Bucket Policy (OAC)~~ ✅

Bucket policy satt, offentlig tilgang blokkert.

### ~~Steg 1.5: DNS for www.tennerogtrivsel.no~~ ✅

DNS peker til CloudFront-distribusjonen.

---

## Fase 2: Cache-Control, smart invalidering og deploy-workflow

### Steg 2.1: Avkommenter prod-deploy i deploy.yml ❌

Tre separate syncer er skrevet i `deploy.yml` (linje 149–163), men utkommentert. Avkommenter for go-live:

```yaml
# - name: Deploy to S3 PROD-SE
#   run: |
#     aws s3 sync dist/_astro/ s3://tennerogtrivsel-se/_astro/ --delete \
#       --cache-control "public, max-age=31536000, immutable"
#     aws s3 sync dist/fonts/ s3://tennerogtrivsel-se/fonts/ \
#       --cache-control "public, max-age=31536000, immutable"
#     aws s3 sync dist/ s3://tennerogtrivsel-se --delete \
#       --exclude "_astro/*" --exclude "fonts/*" \
#       --cache-control "public, max-age=3600, stale-while-revalidate=86400"
```

> **Verifisert 2026-03-01:** Test-miljøet bruker identisk oppsett og har korrekt cache-control. Prod S3-bucket `tennerogtrivsel-se` er klar i eu-north-1.

### Steg 2.2: Avkommenter CloudFront-invalidering for prod ❌

Invalidering er skrevet i `deploy.yml` (linje 170–174), men utkommentert. Avkommenter for go-live:

```yaml
# - name: Invalidate CloudFront cache PROD
#   run: |
#     aws cloudfront create-invalidation \
#       --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID_PROD }} \
#       --paths "/*"
```

> GitHub Secret `CLOUDFRONT_DISTRIBUTION_ID_PROD` er allerede satt.

### ~~Steg 2.3: GitHub secrets~~ ✅

`CLOUDFRONT_DISTRIBUTION_ID_PROD` og `CLOUDFRONT_DISTRIBUTION_ID_TEST` finnes som GitHub secrets.

### ~~Steg 2.4: S3-bucket i eu-north-1 (Stockholm)~~ ✅

Bucket `tennerogtrivsel-se` opprettet i eu-north-1. OAC og bucket policy konfigurert.

---

## Fase 3: Alle domener på samme CloudFront

### ~~Steg 3.1: ACM-sertifikat med alle 6 domener~~ ✅

SAN-sertifikatet er issued og i bruk. Dekker alle 6 domener:
- `tennerogtrivsel.no` (CN), `www.tennerogtrivsel.no`, `www.tennerogtrivsel.net`, `tennerogtrivsel.net`, `www.tennerogtrivsel.com`, `tennerogtrivsel.com`

### ~~Steg 3.2–3.7~~ ✅

Alle domener som CloudFront CNAMEs, DNS, apex-domener, Google OAuth (`tennerogtrivsel.com`/`.net` lagt til), gamle S3-redirect-buckets slettet — alt fullført 2026-03-01.

---

## Fase 4: Verifisering

### 4.1 HTTPS og sikkerhetsheadere

```bash
for domain in www.tennerogtrivsel.no www.tennerogtrivsel.com www.tennerogtrivsel.net tennerogtrivsel.no tennerogtrivsel.com tennerogtrivsel.net; do
  echo "=== $domain ==="
  curl -sI "https://$domain" | grep -iE '(HTTP|cache-control|content-security|x-frame|strict-transport|x-cache)'
done
```

### 4.2 Cache-Control headere

```bash
# Hashed asset — skal ha immutable
curl -sI https://www.tennerogtrivsel.no/_astro/index.js | grep -i cache-control

# HTML — skal ha max-age=3600
curl -sI https://www.tennerogtrivsel.no/ | grep -i cache-control

# Font — skal ha immutable
curl -sI https://www.tennerogtrivsel.no/fonts/inter-v18-latin-regular.woff2 | grep -i cache-control
```

### 4.3 API og kontaktskjema caches ikke

```bash
curl -sI https://www.tennerogtrivsel.no/api/kontakt | grep -i x-cache
# Forventet: Miss from cloudfront (CachingDisabled-behavior)
```

### 4.4 Kontaktskjema fungerer

1. Åpne `https://www.tennerogtrivsel.no`
2. Klikk «Send melding»
3. Fyll inn skjema og send — verifiser at e-post ankommer `kontaktEpost` fra Google Sheet

### 4.5 Apex http→https redirect

```bash
for domain in tennerogtrivsel.no tennerogtrivsel.com tennerogtrivsel.net; do
  echo "=== $domain ==="
  curl -sI "http://$domain" | grep -iE '(HTTP|location)'
done
# Forventet: 301 til https://<eget domene>
```

### 4.6 Undersider og 404

```bash
curl -sI https://www.tennerogtrivsel.no/kontakt | head -1
curl -sI https://www.tennerogtrivsel.com/tjenester | head -1
curl -sI https://www.tennerogtrivsel.net/denne-finnes-ikke | head -1
# Forventet: 200, 200, 404
```

### 4.7 Admin-panel og OAuth

1. Gå til `https://www.tennerogtrivsel.no/admin`
2. Logg inn med Google OAuth — sjekk at CSP ikke blokkerer
3. Test bildeopplasting og lagring

### 4.8 Direkte S3-tilgang blokkert

```bash
curl -ksI https://s3.eu-north-1.amazonaws.com/tennerogtrivsel-se/index.html | head -1
# Forventet: 403 Forbidden
```

### 4.9 SecurityHeaders.com

Skann alle tre www-domener — forventet minimum karakter **B**.

---

## Fase 5: Redirects fra gammel side

Den gamle nettsiden bruker jQuery SPA med query-parameter-routing (`/index.html?page=X`). Disse URL-ene finnes i Google-indeks og bokmerker.

### Steg 5.1: Utvid CloudFront Function `url-rewrite-index` ❌

Legg til redirect-logikk **før** den eksisterende URL-rewrite-logikken:

```javascript
function handler(event) {
    var request = event.request;
    var uri = request.uri;
    var qs = request.querystring;

    // Redirect gamle ?page= URL-er til nye paths (301 Permanent)
    if (qs && qs.page) {
        var pageMap = {
            'kontakt': '/kontakt',
            'behandlingstilbud': '/tjenester',
            'trygdeordninger': '/tjenester',
            'omoss': '/tannleger'
        };
        var newPath = pageMap[qs.page.value];
        if (newPath) {
            return {
                statusCode: 301,
                statusDescription: 'Moved Permanently',
                headers: { 'location': { value: newPath } }
            };
        }
    }

    // Redirect bare /index.html til forsiden
    if (uri === '/index.html' && (!qs || !qs.page)) {
        return {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: { 'location': { value: '/' } }
        };
    }

    // Eksisterende URL-rewrite for Astro-undersider
    if (uri.endsWith('/')) {
        request.uri += 'index.html';
    } else if (!uri.includes('.')) {
        request.uri += '/index.html';
    }
    return request;
}
```

### Steg 5.2: Verifisering

```bash
for page in kontakt behandlingstilbud trygdeordninger omoss; do
  echo "=== ?page=$page ==="
  curl -sI "https://www.tennerogtrivsel.no/index.html?page=$page" | grep -iE '(HTTP|location)'
done
curl -sI "https://www.tennerogtrivsel.no/index.html" | grep -iE '(HTTP|location)'
curl -sI https://www.tennerogtrivsel.no/kontakt | head -1
# Forventet: 301 til riktig ny URL, og vanlige sider fortsatt 200
```

---

## Fase 6: Kontaktskjema på prod-distribusjon

Kontaktskjema-infrastrukturen (Lambda, DynamoDB, SES) er delt mellom test og prod — samme funksjon brukes. Det som mangler er `/api/kontakt`-behavior på prod-distribusjonen (`d19b7g2frcrx6i`).

Se [aws-kontaktskjema-oppsett.md](../guides/aws-kontaktskjema-oppsett.md) Steg 5 for detaljert veiledning.

### Steg 6.1: Legg til Lambda-origin på prod-distribusjonen ❌

1. Gå til **CloudFront → d19b7g2frcrx6i → Origins → Create origin**
2. Origin domain: Lambda Function URL (samme som test — hentes fra `aws lambda get-function-url-config --function-name kontakt-form-handler`)
3. Protocol: **HTTPS only**
4. Custom header: `X-Origin-Verify` = `ORIGIN_VERIFY_SECRET` (hentes fra GitHub Secrets)

### Steg 6.2: Legg til `/api/kontakt`-behavior ❌

1. Gå til **Behaviors → Create behavior**
   - Path pattern: `/api/kontakt`
   - Origin: Lambda-origin fra steg 6.1
   - Viewer protocol: HTTPS only
   - Allowed HTTP methods: GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE
   - Cache policy: **CachingDisabled**
   - Origin request policy: **AllViewerExceptHostHeader**
2. Legg også til Response Headers Policy (fra Fase 1.3) på dette behavioret

### Steg 6.3: Verifiser

```bash
curl -s -X POST https://www.tennerogtrivsel.no/api/kontakt \
  -H "Content-Type: application/json" \
  -d '{"navn":"Test","epost":"test@test.no","melding":"testmelding","tema":"Annet","telefon":"","_honeypot":""}' \
  | head -c 200
# Forventet: JSON-respons (ikke 403/502)
```

---

## Fremtidig: Separate IAM-brukere for test og prod

Når **Dev-Test-Prod miljø oppsett** gjennomføres, bør `githubTestDeploy` erstattes med separate brukere:
- `githubTestDeploy` — kun tilgang til test-bøtte og test-distribusjon
- `githubProdDeploy` — kun tilgang til prod-bøtte og prod-distribusjon

`CICDDeploy`-policyen i [aws-kontaktskjema-oppsett.md](../guides/aws-kontaktskjema-oppsett.md) kan da innsnevres ytterligere — fjern prod-ressursene fra test-brukeren og omvendt.

---

## Kostnader

| Ressurs | Kostnad |
|---------|---------|
| ACM-sertifikat | Gratis |
| CloudFront (allerede i bruk) | Ingen ekstra |
| Lambda, DynamoDB, SES | Marginalt (deles med test) |
| **Totalt ekstra** | **~$0/mnd** |
