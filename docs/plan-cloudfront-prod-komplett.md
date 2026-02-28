# Plan: CloudFront produksjon — komplett oppsett med alle domener

> **Status: BACKLOG** — Fase 1 delvis fullført, nytt ACM-sertifikat bestilt (venter på issued)

## Bakgrunn

Sammenslått plan fra tre tidligere oppgaver som alle handler om det samme:
- Cache-Control og grønn hosting (PROD-stegene)
- CloudFront på produksjon (www.tennerogtrivsel.no)
- Flere domener på samme CloudFront (.com, .net)

Test-oppsettet (test2.aarrestad.com) er ferdig verifisert og fungerer. Denne planen gjør tilsvarende for produksjon, med alle domener på én distribusjon.

### Erfaringer fra test-oppsettet

- Husk å tilknytte OAC til originen — uten dette får CloudFront ikke tilgang til S3 (403)
- Response Headers Policy må legges til på **begge** behaviors (default + `/api/*`)
- CloudFront Function for URL-rewriting var nødvendig for Astro-undersider

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

Distribusjon opprettet med OAC, CachingOptimized (default) + CachingDisabled (`/api/*`), feilsider (403→404, 404→404), CloudFront Function (`url-rewrite-index` gjenbrukt fra test).

### Steg 1.3: Response Headers Policy (sikkerhetsheadere) — ⚠️ delvis

Gjenbruk policyen `tenner-og-trivsel-security-headers` fra test, eller opprett ny for prod. Tilknytt den til **begge** behaviors (default + `/api/*`).

Headere: CSP, X-Frame-Options (DENY), X-Content-Type-Options (nosniff), Referrer-Policy (strict-origin-when-cross-origin), HSTS (1 år, includeSubDomains, vurder preload for prod).

### ~~Steg 1.4: S3 Bucket Policy (OAC)~~ ✅

Bucket policy satt, offentlig tilgang blokkert.

### ~~Steg 1.5: DNS for www.tennerogtrivsel.no~~ ✅

DNS peker til CloudFront-distribusjonen.

---

## Fase 2: Cache-Control, smart invalidering og deploy-workflow

### Steg 2.1: Splitt S3-sync med Cache-Control headere

Erstatt enkel `aws s3 sync` med tre separate syncer i deploy-workflowen:

```yaml
# 1. Hashed assets — immutable (1 år)
aws s3 sync dist/_astro/ s3://PROD_BUCKET/_astro/ --delete \
  --cache-control "public, max-age=31536000, immutable"

# 2. Fonter — immutable (1 år)
aws s3 sync dist/fonts/ s3://PROD_BUCKET/fonts/ \
  --cache-control "public, max-age=31536000, immutable"

# 3. Alt annet (HTML, API, favicons) — kort cache med revalidering
aws s3 sync dist/ s3://PROD_BUCKET --delete \
  --exclude "_astro/*" --exclude "fonts/*" \
  --cache-control "public, max-age=3600, stale-while-revalidate=86400"
```

### Steg 2.2: Smart CloudFront-invalidering

Begrens invalidering til kun ikke-hashed innhold (hashed assets trenger aldri invalideres):

```yaml
aws cloudfront create-invalidation \
  --distribution-id ${{ secrets.CLOUDFRONT_PROD_DISTRIBUTION_ID }} \
  --paths "/" "/index.html" "/kontakt/*" "/tjenester/*" "/tannleger/*" "/galleri/*" "/api/*" "/404.html" "/admin/*" "/sitemap-index.xml" "/robots.txt"
```

### Steg 2.3: GitHub secrets

Legg til `CLOUDFRONT_PROD_DISTRIBUTION_ID` som GitHub secret.

### Steg 2.4: Vurder eu-north-1 for prod-bucket

Kortere nettverksvei for norske brukere. Samme prosess som test: ny bucket i Stockholm, pek CloudFront-origin dit, oppdater deploy-workflow, slett gammel bucket.

---

## Fase 3: Alle domener på samme CloudFront

### Steg 3.1: ACM-sertifikat med alle 6 domener — ⏳ venter på issued

Nytt SAN-sertifikat bestilt med alle domener:

```
tennerogtrivsel.no       www.tennerogtrivsel.no
tennerogtrivsel.com      www.tennerogtrivsel.com
tennerogtrivsel.net      www.tennerogtrivsel.net
```

DNS-validering: legg til CNAME-records fra ACM hos registraren for hvert domene.

### Steg 3.2: Legg til www-domener i CloudFront

CloudFront → prod-distribusjonen → General → Edit:
1. Legg til `www.tennerogtrivsel.com` og `www.tennerogtrivsel.net` som CNAMEs
2. Bytt til det nye SAN-sertifikatet fra steg 3.1

### Steg 3.3: DNS — pek www-domener til CloudFront

Hos registraren, legg til CNAME-records:

| Record | Type | Verdi |
|--------|------|-------|
| `www.tennerogtrivsel.com` | CNAME | `dXXXXXXXX.cloudfront.net` |
| `www.tennerogtrivsel.net` | CNAME | `dXXXXXXXX.cloudfront.net` |

### Steg 3.4: Apex-redirect via registrar

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
