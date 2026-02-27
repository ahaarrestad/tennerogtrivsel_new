# Plan: Flere domener på samme CloudFront (uten redirect)

## Bakgrunn

I dag har vi flere S3-buckets som redirecter til `www.tennerogtrivsel.no`. Besøkende ser alltid `www.tennerogtrivsel.no` i adressefeltet uansett hvilket domene de skrev inn.

**Ønsket:** Alle domener skal vise samme innhold, men beholde sitt eget domenenavn i URL-en.

## Domener

| Domene | Type |
|--------|------|
| `tennerogtrivsel.no` | Apex |
| `www.tennerogtrivsel.no` | www |
| `tennerogtrivsel.com` | Apex |
| `www.tennerogtrivsel.com` | www |
| `tennerogtrivsel.net` | Apex |
| `www.tennerogtrivsel.net` | www |

DNS administreres hos ekstern registrar (ikke Route 53).

## Viktig avklaring: Apex-domener

Apex-domener (uten `www`) kan **ikke** bruke CNAME-records i DNS — det er en DNS-standard-begrensning. For å peke apex-domener til CloudFront uten redirect finnes tre alternativer:

| Alternativ | Fordel | Ulempe |
|-----------|--------|--------|
| **A) ALIAS/ANAME hos registrar** | Enkelt, ingen endring av DNS-leverandør | Ikke alle registrarer støtter det |
| **B) Flytt DNS til Route 53** | Full ALIAS-støtte, best CloudFront-integrasjon | Koster ~$0.50/mnd per zone, krever nameserver-bytte |
| **C) Hybrid: apex redirecter, www på CloudFront** | Fungerer med alle registrarer | Apex-domener redirecter fortsatt (bare til sin egen www) |

**Anbefaling:** Alternativ **B** (Route 53) gir best kontroll og null redirect. Alternativ C er et kompromiss om dere ikke vil flytte DNS.

## Steg-for-steg (Alternativ B — Route 53)

### Steg 1: ACM-sertifikat for alle domener

Opprett et SAN-sertifikat (Subject Alternative Name) i ACM **us-east-1** som dekker alle 6 domener:

- `tennerogtrivsel.no`
- `www.tennerogtrivsel.no`
- `tennerogtrivsel.com`
- `www.tennerogtrivsel.com`
- `tennerogtrivsel.net`
- `www.tennerogtrivsel.net`

**DNS-validering:** ACM krever en CNAME-record per domene for validering. Disse legges i eksisterende DNS-leverandør (eller Route 53 om det allerede er flyttet).

### Steg 2: Opprett Route 53 Hosted Zones

Opprett tre hosted zones i Route 53:
- `tennerogtrivsel.no`
- `tennerogtrivsel.com`
- `tennerogtrivsel.net`

Noter nameserverne for hver zone — disse må settes hos registraren.

### Steg 3: Bytt nameservere hos registrar

Hos den eksterne registraren: endre nameservere til de Route 53 tildelte (4 NS-records per domene).

**NB:** DNS-propagering kan ta opptil 48 timer. Planlegg dette i en rolig periode.

### Steg 4: Legg til Alternate Domain Names i CloudFront

I CloudFront-distribusjonen (prod), legg til alle 6 domener som **Alternate Domain Names (CNAMEs)**:

```
tennerogtrivsel.no
www.tennerogtrivsel.no
tennerogtrivsel.com
www.tennerogtrivsel.com
tennerogtrivsel.net
www.tennerogtrivsel.net
```

Knytt det nye ACM-sertifikatet (fra steg 1) til distribusjonen.

### Steg 5: DNS-records i Route 53

For hvert domene, opprett records som peker til CloudFront-distribusjonen:

| Record | Type | Verdi |
|--------|------|-------|
| `tennerogtrivsel.no` | A (Alias → CloudFront) | `dXXXXXXXX.cloudfront.net` |
| `www.tennerogtrivsel.no` | A (Alias → CloudFront) | `dXXXXXXXX.cloudfront.net` |
| `tennerogtrivsel.com` | A (Alias → CloudFront) | `dXXXXXXXX.cloudfront.net` |
| `www.tennerogtrivsel.com` | A (Alias → CloudFront) | `dXXXXXXXX.cloudfront.net` |
| `tennerogtrivsel.net` | A (Alias → CloudFront) | `dXXXXXXXX.cloudfront.net` |
| `www.tennerogtrivsel.net` | A (Alias → CloudFront) | `dXXXXXXXX.cloudfront.net` |

Alle bruker Route 53 Alias-records (gratis, ingen TTL-forsinkelse, fungerer med apex).

### Steg 6: Fjern gamle S3-redirect-buckets

Etter at alt fungerer:
1. Verifiser at alle 6 domener serverer riktig innhold
2. Slett S3-redirect-buckets som ikke lenger trengs
3. Behold kun prod-bucketen (`www.tennerogtrivsel.no`) som CloudFront-origin

### Steg 7: Verifisering

For hvert av de 6 domenene, sjekk:
- [ ] HTTPS fungerer (gyldig sertifikat)
- [ ] Innholdet vises korrekt
- [ ] URL i adressefeltet endres **ikke** (ingen redirect)
- [ ] Sikkerhetsheadere er på plass (CSP, HSTS, etc.)

## Kostnadsoverslag

| Ressurs | Kostnad |
|---------|---------|
| Route 53 Hosted Zone | $0.50/mnd × 3 = **$1.50/mnd** |
| Route 53 DNS-spørringer | ~$0.40/mnd (estimat) |
| ACM-sertifikat | Gratis |
| CloudFront (allerede i bruk) | Ingen ekstra kostnad |
| **Totalt** | **~$2/mnd** |

## Alternativ C: Hybrid (uten Route 53)

Om du ikke vil flytte DNS, kan du:
1. Legg til de 3 **www**-domenene som Alternate Domain Names i CloudFront
2. ACM-sertifikat for de 3 www-domenene
3. CNAME-records hos registrar: `www.tennerogtrivsel.com` → CloudFront
4. Apex-domenene redirecter til sin egen www-variant (via S3 redirect-bucket eller registrarens URL-forwarding)

Ulempen: apex-domener (`tennerogtrivsel.com`) vil fortsatt redirecte til `www.tennerogtrivsel.com`.
