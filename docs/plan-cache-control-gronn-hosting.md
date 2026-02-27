# Plan: Cache-Control og grønn hosting

## Kontekst

Nettsiden serveres fra S3 via CloudFront, men har **ingen eksplisitte Cache-Control-headere** på S3-objektene. Astro bygger hashed assets (`/_astro/filnavn.AbCd1234.js`) som er trygge å cache evig, men CloudFront behandler alt likt. Resultatet er unødvendige origin-forespørsler og dataoverføring — høyere kostnad og karbonfotavtrykk enn nødvendig.

## Fil som endres

- `.github/workflows/deploy.yml`

## Plan (3 steg)

### Steg 1: Splitt S3-sync i tre kommandoer med Cache-Control

Erstatt den enkle `aws s3 sync`-kommandoen med tre separate syncer, hver med passende `Cache-Control`-header:

```yaml
- name: Deploy to S3 TEST
  run: |
    # 1. Hashed assets — immutable (1 år)
    aws s3 sync dist/_astro/ s3://test2.aarrestad.com/_astro/ --delete \
      --cache-control "public, max-age=31536000, immutable"

    # 2. Fonter — immutable (1 år, versjonert i filnavn)
    aws s3 sync dist/fonts/ s3://test2.aarrestad.com/fonts/ \
      --cache-control "public, max-age=31536000, immutable"

    # 3. Alt annet (HTML, API, favicons, SW) — kort cache med revalidering
    aws s3 sync dist/ s3://test2.aarrestad.com --delete \
      --exclude "_astro/*" --exclude "fonts/*" \
      --cache-control "public, max-age=3600, stale-while-revalidate=86400"
```

**Cache-strategi:**

| Filtype | Cache-Control | Begrunnelse |
|---------|--------------|-------------|
| `/_astro/*` (JS, CSS, bilder) | `immutable, max-age=31536000` | Content-hash i filnavn — ny URL ved endring |
| `/fonts/*.woff2` | `immutable, max-age=31536000` | Versjonert i filnavn (`inter-v18-...`) |
| HTML-sider | `max-age=3600, stale-while-revalidate=86400` | Frisk i 1 time, serve stale i opptil 24t mens revalidering skjer |
| `/api/*.json` | Satt på S3, men overstyrt av CloudFront `CachingDisabled`-policy | Alltid fersk fra origin |
| Admin SW/manifest | `max-age=3600, stale-while-revalidate=86400` | Oppdateres sjelden |

### Steg 2: Smartere CloudFront-invalidering

Nå: `--paths "/*"` invaliderer hele distribusjonen.

Hashed assets (`/_astro/*`) trenger **aldri** invalideres — de får nye URL-er ved endring. Vi kan begrense invalidering til kun ikke-hashed innhold:

```yaml
- name: Invalidate CloudFront cache TEST
  run: |
    aws cloudfront create-invalidation \
      --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID_TEST }} \
      --paths "/" "/index.html" "/kontakt/*" "/tjenester/*" "/tannleger/*" "/galleri/*" "/api/*" "/404.html" "/admin/*" "/sitemap-index.xml" "/robots.txt"
```

Fordel: Raskere invalidering, færre objekter å revalidere fra origin.

### Steg 3: Verifisering

Etter deploy, sjekk headere manuelt:

```bash
# Hashed asset — bør ha immutable
curl -sI https://test2.aarrestad.com/_astro/[en-fil].js | grep -i cache-control

# HTML-side — bør ha max-age=3600
curl -sI https://test2.aarrestad.com/ | grep -i cache-control

# Font — bør ha immutable
curl -sI https://test2.aarrestad.com/fonts/inter-v18-latin-regular.woff2 | grep -i cache-control
```

## Steg 4 (valgfritt): Flytt S3-bucket til eu-north-1 (Stockholm)

Kortere nettverksvei fra CloudFront edge → origin for norske brukere. OAC-innstillingen i CloudFront trenger ikke røres — kun origin-domenet endres.

### 4a. Opprett ny bucket i eu-north-1

```bash
aws s3 mb s3://test2.aarrestad.com-eu-north-1 --region eu-north-1
```

### 4b. Blokker offentlig tilgang

```bash
aws s3api put-public-access-block \
  --bucket test2.aarrestad.com-eu-north-1 \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true \
  --region eu-north-1
```

### 4c. Sett bucket policy for CloudFront OAC

```bash
aws s3api put-bucket-policy --bucket test2.aarrestad.com-eu-north-1 --policy '{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "cloudfront.amazonaws.com"},
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::test2.aarrestad.com-eu-north-1/*",
    "Condition": {
      "StringEquals": {
        "AWS:SourceArn": "arn:aws:cloudfront::ACCOUNT_ID:distribution/DISTRIBUTION_ID"
      }
    }
  }]
}' --region eu-north-1
```

### 4d. Pek CloudFront til ny bucket

```bash
# Hent nåværende config
aws cloudfront get-distribution-config --id DISTRIBUTION_ID > cf-config.json

# Endre origin domain fra:
#   test2.aarrestad.com.s3.eu-west-1.amazonaws.com
# til:
#   test2.aarrestad.com-eu-north-1.s3.eu-north-1.amazonaws.com
# Oppdater ETag og lagre som cf-config-updated.json

aws cloudfront update-distribution --id DISTRIBUTION_ID \
  --if-match ETAG \
  --distribution-config file://cf-config-updated.json
```

### 4e. Oppdater deploy.yml

Bytt bucket-navn i `aws s3 sync`-kommandoene (steg 1) til ny bucket.

### 4f. Slett gammel bucket

```bash
aws s3 rb s3://test2.aarrestad.com --force
```

## Ikke i scope

- CloudFront-distribusjonskonfigurasjon (cache policies, compression) — allerede satt opp riktig med `CachingOptimized` (inkl. Brotli) og `CachingDisabled` for `/api/*`
- Bildekomprimering — Astro håndterer dette i bygget
- Prod-deploy — aktiveres i en egen oppgave (CloudFront-prod)
