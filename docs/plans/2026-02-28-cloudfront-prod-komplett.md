# Plan: CloudFront produksjon — komplett oppsett med alle domener

> **Status: BACKLOG** — Verifisert 2026-03-01. Fase 1 nesten ferdig (mangler Response Headers Policy). Fase 2 klar i kode (utkommentert). Fase 3 SAN-sertifikat issued, men .com/.net går via S3-redirect-buckets som skal fjernes. Apex-domener uten DNS.

## Bakgrunn

Sammenslått plan fra tre tidligere oppgaver som alle handler om det samme:
- Cache-Control og grønn hosting (PROD-stegene)
- CloudFront på produksjon (www.tennerogtrivsel.no)
- Flere domener på samme CloudFront (.com, .net)

Test-oppsettet (test2.aarrestad.com) er ferdig verifisert og fungerer. Denne planen gjør tilsvarende for produksjon, med alle domener på én distribusjon.

> **Nåværende situasjon (2026-03-01):** Prod-distribusjonen (`d19b7g2frcrx6i.cloudfront.net`) serverer fortsatt den gamle nettsiden. Den nye Astro-siden er kun live på test (`dnpjnvcuk7ym7.cloudfront.net`). Alle tre www-domener resolver til prod-distribusjonen, men `.com` og `.net` rutes via S3-redirect-buckets — disse skal fjernes til fordel for ekte CloudFront CNAMEs.

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
| `tennerogtrivsel.no` | `www.tennerogtrivsel.no` | Ja (301) |
| `tennerogtrivsel.com` | `www.tennerogtrivsel.com` | Ja (301) |
| `tennerogtrivsel.net` | `www.tennerogtrivsel.net` | Ja (301) |

---

## Fase 1: CloudFront-distribusjon for www.tennerogtrivsel.no

### ~~Steg 1.1: ACM-sertifikat (us-east-1)~~ ✅

Sertifikat for `www.tennerogtrivsel.no` er opprettet og issued.

### ~~Steg 1.2: CloudFront-distribusjon~~ ✅

Distribusjon `d19b7g2frcrx6i` opprettet med OAC, CachingOptimized (default) + CachingDisabled (`/api/*`), feilsider (403→404, 404→404), CloudFront Function (`url-rewrite-index` gjenbrukt fra test).

> Verifisert 2026-03-01: Distribusjonen svarer og serverer innhold via CloudFront (OSL50-pop).

### Steg 1.3: Response Headers Policy (sikkerhetsheadere) — ❌ ikke gjort

Gjenbruk policyen `tenner-og-trivsel-security-headers` fra test, eller opprett ny for prod. Tilknytt den til **begge** behaviors (default + `/api/*`).

> **Verifisert 2026-03-01:** Prod returnerer **ingen** sikkerhetsheadere (ingen CSP, X-Frame-Options, HSTS, X-Content-Type-Options, Referrer-Policy). Test-distribusjonen har alle headere korrekt. Denne policyen må tilknyttes før go-live.

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

> Verifisert 2026-03-01: CloudFront serverer innhold fra S3 (Server: AmazonS3).

### ~~Steg 1.5: DNS for www.tennerogtrivsel.no~~ ✅

DNS peker til CloudFront-distribusjonen.

> Verifisert 2026-03-01: `www.tennerogtrivsel.no` → `d19b7g2frcrx6i.cloudfront.net`

---

## Fase 2: Cache-Control, smart invalidering og deploy-workflow

### Steg 2.1: Splitt S3-sync med Cache-Control headere — ✅ klar i kode (utkommentert)

Tre separate syncer er skrevet i `deploy.yml` (linje 140–153), men utkommentert. Avkommenter for go-live.

> **Verifisert 2026-03-01:** Test-miljøet bruker identisk oppsett og har korrekt cache-control (fonter: `immutable`, HTML: `max-age=3600`). Prod har per nå ingen cache-control header (gammel side).

```yaml
# 1. Hashed assets — immutable (1 år)
aws s3 sync dist/_astro/ s3://www.tennerogtrivsel.no-se/_astro/ --delete \
  --cache-control "public, max-age=31536000, immutable"

# 2. Fonter — immutable (1 år, versjonert i filnavn)
aws s3 sync dist/fonts/ s3://www.tennerogtrivsel.no-se/fonts/ \
  --cache-control "public, max-age=31536000, immutable"

# 3. Alt annet (HTML, favicons, SW) — kort cache med revalidering
aws s3 sync dist/ s3://www.tennerogtrivsel.no-se --delete \
  --exclude "_astro/*" --exclude "fonts/*" \
  --cache-control "public, max-age=3600, stale-while-revalidate=86400"
```

### Steg 2.2: Smart CloudFront-invalidering — ✅ klar i kode (utkommentert)

Invalidering er skrevet i `deploy.yml` (linje 161–165), men utkommentert. Avkommenter for go-live.

```yaml
aws cloudfront create-invalidation \
  --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID_PROD }} \
  --paths "/" "/index.html" "/kontakt/" "/tjenester/" "/tjenester/*" "/tannleger/" "/galleri/" "/api/*" "/404.html" "/admin/*" "/sitemap-index.xml" "/robots.txt"
```

> Merk: deploy.yml bruker `CLOUDFRONT_DISTRIBUTION_ID_PROD` (ikke `CLOUDFRONT_PROD_DISTRIBUTION_ID` som opprinnelig planlagt).

### ~~Steg 2.3: GitHub secrets~~ ✅

> **Verifisert 2026-03-01:** `CLOUDFRONT_DISTRIBUTION_ID_PROD` finnes som GitHub secret (opprettet 2026-02-26). Også `CLOUDFRONT_DISTRIBUTION_ID_TEST` finnes.

### Steg 2.4: Vurder eu-north-1 for prod-bucket

Kortere nettverksvei for norske brukere. Samme prosess som test: ny bucket i Stockholm, pek CloudFront-origin dit, oppdater deploy-workflow, slett gammel bucket.

---

## Fase 3: Alle domener på samme CloudFront

### ~~Steg 3.1: ACM-sertifikat med www-domener~~ ✅

> **Verifisert 2026-03-01:** SAN-sertifikatet er **issued** og i bruk på prod-distribusjonen. Dekker 3 www-domener:
> - `www.tennerogtrivsel.no` (CN)
> - `www.tennerogtrivsel.com` (SAN)
> - `www.tennerogtrivsel.net` (SAN)
>
> Issuer: Amazon RSA 2048 M04. Apex-domener trenger ikke være på sertifikatet — de redirectes hos registrar før de når CloudFront.

### Steg 3.2: Legg til www-domener som ekte CloudFront CNAMEs — ❌ ikke gjort

Per nå rutes `www.tennerogtrivsel.com` og `.net` via **S3-redirect-buckets**. Disse skal fjernes og erstattes med ekte CloudFront alternate domain names.

CloudFront → prod-distribusjonen (`d19b7g2frcrx6i`) → General → Edit:
1. Legg til `www.tennerogtrivsel.com` og `www.tennerogtrivsel.net` som CNAMEs
2. Bytt til SAN-sertifikatet (allerede issued)

> Verifisert 2026-03-01: DNS for alle tre www-domener resolver til `d19b7g2frcrx6i.cloudfront.net`, men dette går via S3-redirect-buckets — ikke ekte CloudFront CNAMEs.

### Steg 3.3: DNS — pek www-domener direkte til CloudFront

Etter at steg 3.2 er gjort, oppdater DNS slik at .com og .net peker direkte til CloudFront uten S3-redirect:

| Record | Type | Verdi |
|--------|------|-------|
| `www.tennerogtrivsel.com` | CNAME | `d19b7g2frcrx6i.cloudfront.net` |
| `www.tennerogtrivsel.net` | CNAME | `d19b7g2frcrx6i.cloudfront.net` |

### Steg 3.4: Apex-redirect via registrar — ❌ ikke gjort

> **Verifisert 2026-03-01:** Ingen av apex-domenene har DNS-oppføringer — de resolver ikke og returnerer ingenting på http/https.

| Apex-domene | Redirecter til | Type |
|-------------|---------------|------|
| `tennerogtrivsel.no` | `https://www.tennerogtrivsel.no` | 301 |
| `tennerogtrivsel.com` | `https://www.tennerogtrivsel.com` | 301 |
| `tennerogtrivsel.net` | `https://www.tennerogtrivsel.net` | 301 |

### Steg 3.5: Google OAuth — legg til nye domener

Google Cloud Console → Credentials → OAuth 2.0 Client ID → Authorized JavaScript origins:

```
https://www.tennerogtrivsel.com
https://www.tennerogtrivsel.net
```

### Steg 3.6: Google Maps API — legg til nye referrere

API key → HTTP referrers:

```
www.tennerogtrivsel.com/*
www.tennerogtrivsel.net/*
```

### Steg 3.7: Fjern gamle S3-redirect-buckets

Etter verifisering: tøm og slett redirect-buckets som ikke lenger trengs.

---

## Fase 4: Verifisering

### 4.1 HTTPS og sikkerhetsheadere

```bash
# Alle tre www-domener
for domain in www.tennerogtrivsel.no www.tennerogtrivsel.com www.tennerogtrivsel.net; do
  echo "=== $domain ==="
  curl -sI "https://$domain" | grep -iE '(HTTP|cache-control|content-security|x-frame|strict-transport|x-cache)'
done
```

### 4.2 Cache-Control headere

```bash
# Hashed asset — skal ha immutable
curl -sI https://www.tennerogtrivsel.no/_astro/[en-fil].js | grep -i cache-control

# HTML — skal ha max-age=3600
curl -sI https://www.tennerogtrivsel.no/ | grep -i cache-control

# Font — skal ha immutable
curl -sI https://www.tennerogtrivsel.no/fonts/inter-v18-latin-regular.woff2 | grep -i cache-control
```

### 4.3 API caches ikke

```bash
curl -sI https://www.tennerogtrivsel.no/api/active-messages.json | grep -i x-cache
# Forventet: Miss from cloudfront
```

### 4.4 Apex-redirects

```bash
for domain in tennerogtrivsel.no tennerogtrivsel.com tennerogtrivsel.net; do
  curl -sI "http://$domain" | grep -i location
done
# Forventet: 301 til https://www.<eget domene>
```

### 4.5 Undersider og 404

```bash
curl -sI https://www.tennerogtrivsel.no/kontakt | head -1
curl -sI https://www.tennerogtrivsel.com/tjenester | head -1
curl -sI https://www.tennerogtrivsel.net/denne-finnes-ikke | head -1
# Forventet: 200, 200, 404
```

### 4.6 Admin-panel og OAuth

1. Gå til `https://www.tennerogtrivsel.no/admin`
2. Logg inn med Google OAuth — sjekk at CSP ikke blokkerer
3. Test bildeopplasting og lagring

### 4.7 Direkte S3-tilgang blokkert

```bash
curl -I http://PROD_BUCKET.s3.eu-west-1.amazonaws.com/index.html
# Forventet: 403 Forbidden
```

### 4.8 SecurityHeaders.com

Skann alle tre www-domener — forventet minimum karakter **B**.

---

## Kostnader

| Ressurs | Kostnad |
|---------|---------|
| ACM-sertifikat | Gratis |
| CloudFront (allerede i bruk) | Ingen ekstra |
| Registrar URL-forwarding | Vanligvis inkludert |
| **Totalt ekstra** | **$0/mnd** |
