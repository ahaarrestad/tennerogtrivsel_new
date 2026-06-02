# Runbook: Supply-chain-hendelse

Bruk denne runbooken hvis en npm-pakke i produksjon viser seg å være kompromittert — enten via CVE, `npm audit`-alarm, ekstern rapportering (socket.dev, GitHub Advisory) eller mistenkelig oppførsel.

---

## Steg 1: Stopp bløding — rull tilbake prod umiddelbart

Gjør dette **før** du bruker tid på å analysere omfang.

```bash
# Finn forrige vellykkede deploy-SHA i GitHub Actions → Runs → siste grønne deploy-jobb
# Kopier SHA-en og redeploy manuelt:
git checkout <forrige-grønne-sha>
npm ci --ignore-scripts
npm run build:ci
aws s3 sync dist/ s3://tennerogtrivsel-se --delete \
  --cache-control "public, max-age=3600, stale-while-revalidate=86400"
aws cloudfront create-invalidation \
  --distribution-id $CLOUDFRONT_DISTRIBUTION_ID_PROD \
  --paths "/*"
```

Etter rollback: verifiser med `curl -s https://tennerogtrivsel.no/ | head -5` at siden er oppe.

---

## Steg 2: Identifiser den kompromitterte pakken

```bash
# Finn hvilken versjon som er installert og når den kom inn:
npm ls <pakkenavn>
git log --all --oneline -- package-lock.json | head -20

# Finn PR/commit som bumpa pakken:
git log --all -S '"<pakkenavn>"' -- package-lock.json
```

Sjekk `package-lock.json` for å fastslå eksakt versjon og om pakken er direkte avhengighet eller transitiv.

---

## Steg 3: Vurder hva som kan ha blitt eksponert

Gå gjennom hvilke hemmeligheter CI-miljøet hadde tilgang til da den kompromitterte versjonen kjørte:

| Secret | Risiko ved lekkasje | Prioritet |
|--------|---------------------|-----------|
| `MY_GITHUB_PAT` | Push til main, merge av PR-er | **Høy** |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | S3-skriving, CloudFront-endringer | **Høy** |
| `GOOGLE_PRIVATE_KEY` / `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Sheets/Drive-tilgang | **Høy** |
| `LAMBDA_KONTAKT_ARN` / `ORIGIN_VERIFY_SECRET` | Lambda-manipulasjon | **Middels** |
| `PUBLIC_GOOGLE_CLIENT_ID` / `PUBLIC_GOOGLE_API_KEY` | Allerede eksponert klient-side | **Lav** |
| `CLOUDFRONT_*_DISTRIBUTION_ID` / `CLOUDFRONT_CSP_POLICY_ID` | CloudFront-konfig-endringer | **Middels** |

**Merk:** `npm audit signatures` og postinstall-scripts kan eksfiltrere via outbound HTTP — sjekk AWS CloudTrail og GitHub audit log for uvanlig aktivitet i tidsrommet pakken var aktiv.

---

## Steg 4: Bytt alle høy-prioritet secrets

Gjør dette i parallell for å minimere eksponeringsvinduet:

**GitHub PAT (`MY_GITHUB_PAT`):**
1. `github.com/settings/personal-access-tokens` → finn token → **Revoke**
2. Generer ny token med samme scope (Contents: read/write, Pull requests: write — kun dette repoet)
3. Oppdater GitHub secret: Settings → Secrets and variables → Actions → `MY_GITHUB_PAT`

**AWS-nøkler:**
1. AWS Console → IAM → Users → finn deploy-brukeren → Security credentials
2. **Deaktiver** eksisterende access key (ikke slett ennå — logger kan trenge den for sporing)
3. **Create access key** → oppdater GitHub secrets `AWS_ACCESS_KEY_ID` og `AWS_SECRET_ACCESS_KEY`
4. Verifiser at neste CI-deploy fungerer, deretter slett gammel nøkkel

**Google service account:**
1. Google Cloud Console → IAM & Admin → Service Accounts → finn service account
2. Keys → **Add key** → JSON → last ned
3. Oppdater GitHub secrets `GOOGLE_PRIVATE_KEY` og `GOOGLE_SERVICE_ACCOUNT_EMAIL`
4. Slett gammel nøkkel fra Google Cloud Console

---

## Steg 5: Blokker pakken og oppdater avhengigheter

```bash
# Oppdater til en trygg versjon (eller fjern pakken):
npm update <pakkenavn>
# Eller pin til en spesifikk trygg versjon i package.json

# Verifiser at signaturer er rene:
npm audit signatures
npm audit --audit-level=critical

# Commit ny package-lock.json:
git add package-lock.json package.json
git commit -m "fix: oppdater <pakkenavn> etter supply-chain-hendelse"
```

---

## Steg 6: Varsle

**Internt:** Informer alle som har tilgang til admin-panelet om potensielt kompromittert token (OAuth-token i sessionStorage — kort levetid, men informer likevel).

**Eksternt (hvis nødvendig):**
- Rapporter kompromittert pakke til npm: `npm report <pakkenavn>`
- GitHub Advisory: `github.com/advisories` → Submit advisory
- Informer relevante brukere hvis persondata kan ha blitt eksponert (GDPR art. 33 — meldeplikt til Datatilsynet innen 72 timer ved risiko for fysiske personer)

---

## Steg 7: Post-mortem

Dokumenter hendelsen:
- Hvilken pakke og versjon
- Oppdaget av: (npm audit / ekstern varsling / mistenkelig oppførsel)
- Tidsrom pakken var aktiv i prod
- Hvilke secrets ble rotert
- Tiltak for å forhindre gjentakelse (f.eks. skjerpet cooldown, allowlisting)
