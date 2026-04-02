# AWS-oppsett for kontaktskjema

Manuelt oppsett som må gjøres én gang før kontaktskjema-featuren kan merges og testes i produksjon.
Se [spec](../superpowers/specs/2026-03-28-kontaktskjema-design.md) for fullstendig arkitekturbeskrivelse.

---

## Steg 1 — DynamoDB

1. Gå til **DynamoDB → Tables → Create table**
2. Table name: `kontakt-rate-limit`
3. Partition key: `ip` (String)
4. Capacity mode: **On-demand**
5. Etter oppretting: gå til **Additional settings → Time to live** → aktiver TTL, attributt-navn: `ttl`

---

## Steg 2 — SES

1. Gå til **SES → Verified identities → Create identity**
2. Velg **Domain**, skriv inn `tennerogtrivsel.no`
3. Aktiver **Easy DKIM** (RSA 2048)
4. AWS viser deg DNS-poster — legg disse til i DNS-sonen din (CNAME-poster for DKIM)
5. Vent på at verifikasjonen går grønt (kan ta noen minutter)
6. Sjekk om kontoen er i **sandbox**: gå til **SES → Account dashboard**
   - Hvis sandbox: verifiser mottaker-e-postadressen som separat identity, og klikk **Request production access** for å søke om å gå ut av sandbox

---

## Steg 3 — Lambda

1. Gå til **Lambda → Create function**
2. Name: `kontakt-form-handler`
3. Runtime: **Node.js 22.x**
4. Opprett funksjonen, gå deretter til **Configuration → Concurrency → Edit**
5. Sett **Reserved concurrency** til `5`
6. Last opp kode (kun første gang):
   ```bash
   cd lambda/kontakt-form-handler
   npm install --omit=dev
   zip -r function.zip index.mjs node_modules/
   aws lambda update-function-code --function-name kontakt-form-handler --zip-file fileb://function.zip
   ```
7. Gå til **Configuration → Function URL → Create function URL**
   - Auth type: **NONE**
   - Kopier URL-en — brukes i CloudFront-oppsettet

---

## Steg 4 — IAM-tillatelser for Lambda

1. Gå til Lambda → din funksjon → **Configuration → Permissions**
2. Klikk på rollen (f.eks. `kontakt-form-handler-role-xxxx`)
3. Legg til en inline policy:
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

## Steg 5 — CloudFront

1. Gå til **CloudFront → din distribusjon → Origins → Create origin**
2. Origin domain: Lambda Function URL (lim inn URL fra steg 3, uten `https://`-prefix og uten trailing slash)
3. Protocol: **HTTPS only**
4. Under **Add custom header**:
   - Header name: `X-Origin-Verify`
   - Value: generer en sterk secret: `openssl rand -hex 32` — ta vare på denne verdien
5. Lagre origin

6. Gå til **Behaviors → Create behavior**:
   - Path pattern: `/api/kontakt`
   - Origin: velg Lambda-origin du akkurat opprettet
   - Viewer protocol: **HTTPS only**
   - Allowed HTTP methods: **GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE**
   - Cache policy: **CachingDisabled**
   - Origin request policy: **AllViewerExceptHostHeader**
7. Lagre og vent på at distribusjonen deployer

---

## Steg 6 — GitHub Secrets

Gå til **GitHub → repo → Settings → Secrets and variables → Actions** og legg til:

| Secret | Verdi |
|--------|-------|
| `LAMBDA_KONTAKT_ARN` | ARN til `kontakt-form-handler` (finnes under Lambda → funksjon → ARN øverst) |
| `ORIGIN_VERIFY_SECRET` | Hex-strengen du genererte i steg 5 |

---

## Steg 7 — Google Sheet

1. Åpne Google Sheet som er koblet til nettsiden
2. Opprett en ny fane med nøyaktig navn: `KontaktSkjema`
3. Legg inn følgende rader (kolonne A = nøkkel, kolonne B = verdi):

| A | B |
|---|---|
| `aktiv` | `ja` |
| `tittel` | Ta kontakt med oss |
| `tekst` | Vi svarer vanligvis innen én arbeidsdag. |
| `kontaktEpost` | resepsjon@tennerogtrivsel.no |
| `tema` | Timebooking |
| `tema` | Spørsmål om behandling |
| `tema` | Priser |
| `tema` | Annet |

---

## Steg 8 — SES identity policy (begrens hvem som kan sende)

Som standard kan alle IAM-brukere/-roller i kontoen med `ses:SendEmail` sende fra den verifiserte identiteten. En ressursbasert policy på selve SES-identiteten begrenser dette til kun Lambda-rollen.

1. Hent konto-ID og rolle-ARN:
   ```bash
   aws sts get-caller-identity --query Account --output text
   aws lambda get-function-configuration --function-name kontakt-form-handler \
     --query Role --output text
   ```

2. Gå til **SES → Verified identities → velg `aarrestad.com`**
3. Fanen **Authorization → Create policy**
4. Velg **Custom policy** og lim inn:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "AllowOnlyKontaktLambda",
         "Effect": "Allow",
         "Principal": {
           "AWS": "LAMBDA_ROLE_ARN"
         },
         "Action": [
           "ses:SendEmail",
           "ses:SendRawEmail"
         ],
         "Resource": "arn:aws:ses:eu-north-1:ACCOUNT_ID:identity/aarrestad.com"
       }
     ]
   }
   ```
   Bytt ut `LAMBDA_ROLE_ARN` og `ACCOUNT_ID` med verdiene fra steg 1.
5. Klikk **Create policy**

> **Obs:** Etter at denne policyen er satt, vil andre IAM-brukere/-roller i kontoen få `Access Denied` ved forsøk på å sende fra `aarrestad.com`, selv om de har `ses:SendEmail` i sin IAM-policy.

---

## Steg 9 — AWS Budget (valgfritt)

1. Gå til **AWS Billing → Budgets → Create budget**
2. Velg **Cost budget**, sett beløp til `$1`
3. Legg til e-postvarsel ved 100% av budsjett

---

## Etter oppsettet

Når alt over er på plass, er backend-infrastrukturen klar. Neste CI/CD-kjøring vil:

1. Lese `kontaktEpost` fra Google Sheet
2. Oppdatere Lambda-miljøvariablene (`KONTAKT_MOTTAKER_EPOST`, `ORIGIN_VERIFY_SECRET`)
3. Synkronisere CloudFront origin-headeren
4. Bygge og deploye nettsiden
