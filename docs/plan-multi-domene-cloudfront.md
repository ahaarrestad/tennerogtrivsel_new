# Plan: Flere domener på samme CloudFront (Alternativ C — Hybrid)

## Bakgrunn

I dag har vi flere S3-buckets som redirecter til `www.tennerogtrivsel.no`. Besøkende ser alltid `www.tennerogtrivsel.no` i adressefeltet uansett hvilket domene de skrev inn.

**Ønsket:** Alle domener skal vise samme innhold og beholde sitt eget domenenavn i URL-en.

**Valgt løsning:** Hybrid-tilnærming uten Route 53. De tre `www`-domenene serveres direkte fra CloudFront (ingen redirect). Apex-domenene redirecter til sin egen `www`-variant via registrarens URL-forwarding.

## Resultat etter gjennomføring

| Bruker skriver | Ser i adressefeltet | Redirect? |
|----------------|---------------------|-----------|
| `www.tennerogtrivsel.no` | `www.tennerogtrivsel.no` | Nei |
| `www.tennerogtrivsel.com` | `www.tennerogtrivsel.com` | Nei |
| `www.tennerogtrivsel.net` | `www.tennerogtrivsel.net` | Nei |
| `tennerogtrivsel.no` | `www.tennerogtrivsel.no` | Ja (301) |
| `tennerogtrivsel.com` | `www.tennerogtrivsel.com` | Ja (301) |
| `tennerogtrivsel.net` | `www.tennerogtrivsel.net` | Ja (301) |

Apex-domener redirecter kun til sin **egen** www-variant — ikke til `www.tennerogtrivsel.no`.

## Steg-for-steg

### Steg 1: ACM-sertifikat med alle 6 domener

**Hvor:** AWS Console → Certificate Manager → **us-east-1 (N. Virginia)**

Opprett ett SAN-sertifikat som dekker alle 6 domener:

```
tennerogtrivsel.no
www.tennerogtrivsel.no
tennerogtrivsel.com
www.tennerogtrivsel.com
tennerogtrivsel.net
www.tennerogtrivsel.net
```

1. Klikk **Request a certificate** → **Request a public certificate**
2. Legg inn alle 6 domener (ett per linje)
3. Velg **DNS validation**
4. ACM viser CNAME-records som må legges til for hvert domene

**Obs:** Apex- og www-variant av samme domene deler vanligvis én CNAME-record, så det blir typisk 3–6 records å legge til.

### Steg 2: DNS-validering hos registrar

For hvert domene ACM ber om validering for:

1. Logg inn hos domeneregistraren
2. Legg til CNAME-recorden ACM oppgir (navn → verdi)
3. Vent til ACM viser **Issued** (kan ta 5–30 minutter)

| Domene | CNAME-navn | CNAME-verdi |
|--------|-----------|-------------|
| `tennerogtrivsel.no` | `_abc123.tennerogtrivsel.no` | `_def456.acm-validations.aws` |
| `tennerogtrivsel.com` | `_abc123.tennerogtrivsel.com` | `_def456.acm-validations.aws` |
| `tennerogtrivsel.net` | `_abc123.tennerogtrivsel.net` | `_def456.acm-validations.aws` |

*(Verdiene over er eksempler — ACM gir de faktiske verdiene.)*

### Steg 3: Legg til www-domener i CloudFront

**Hvor:** AWS Console → CloudFront → Prod-distribusjonen → **General** → **Edit**

1. Under **Alternate domain names (CNAMEs)**, legg til:
   ```
   www.tennerogtrivsel.com
   www.tennerogtrivsel.net
   ```
   (`www.tennerogtrivsel.no` skal allerede ligge der.)

2. Under **Custom SSL certificate**, velg det nye sertifikatet fra steg 1
3. Klikk **Save changes**

### Steg 4: DNS — pek www-domener til CloudFront

Hos registraren, legg til CNAME-records for de to nye www-domenene:

| Record | Type | Verdi |
|--------|------|-------|
| `www.tennerogtrivsel.com` | CNAME | `dXXXXXXXX.cloudfront.net` |
| `www.tennerogtrivsel.net` | CNAME | `dXXXXXXXX.cloudfront.net` |

Erstatt `dXXXXXXXX.cloudfront.net` med den faktiske CloudFront-distribusjonens domenenavn (finnes under **Distribution domain name** i CloudFront Console).

`www.tennerogtrivsel.no` peker allerede til CloudFront.

### Steg 5: Apex-redirect via registrar

Hos registraren, sett opp URL-forwarding/redirect for apex-domenene:

| Apex-domene | Redirecter til | Type |
|-------------|---------------|------|
| `tennerogtrivsel.no` | `https://www.tennerogtrivsel.no` | 301 (permanent) |
| `tennerogtrivsel.com` | `https://www.tennerogtrivsel.com` | 301 (permanent) |
| `tennerogtrivsel.net` | `https://www.tennerogtrivsel.net` | 301 (permanent) |

**Viktig:** Hvert apex-domene redirecter til sin **egen** www-variant.

De fleste registrarer (Domeneshop, Namecheap, GoDaddy) har dette som innebygd funksjon under DNS-innstillinger, ofte kalt «URL forwarding» eller «Web redirect».

### Steg 6: Fjern gamle S3-redirect-buckets

Etter at alt er verifisert:

1. List opp S3-redirect-buckets som redirecter til `www.tennerogtrivsel.no`
2. Tøm hver bucket (`aws s3 rm s3://bucket-name --recursive` eller via Console)
3. Slett bucketen
4. Behold kun prod-bucketen (`www.tennerogtrivsel.no`) som CloudFront-origin

### Steg 7: Verifisering

Test alle 6 domener:

| Sjekk | Kommando/metode |
|-------|-----------------|
| HTTPS fungerer | Åpne `https://www.tennerogtrivsel.com` i nettleser |
| Riktig sertifikat | Klikk hengelåsen → sjekk at SAN-listen inkluderer domenet |
| Innhold vises | Verifiser at forsiden laster korrekt |
| Ingen uønsket redirect | `curl -I https://www.tennerogtrivsel.com` → skal gi `200`, ikke `301/302` |
| Apex redirecter riktig | `curl -I http://tennerogtrivsel.com` → `301` til `https://www.tennerogtrivsel.com` |
| Sikkerhetsheadere | `curl -I https://www.tennerogtrivsel.com` → CSP, HSTS, X-Frame-Options |

## Kostnader

| Ressurs | Kostnad |
|---------|---------|
| ACM-sertifikat | **Gratis** |
| CloudFront (allerede i bruk) | Ingen ekstra kostnad |
| Registrar URL-forwarding | Vanligvis inkludert |
| **Totalt ekstra** | **$0/mnd** |
