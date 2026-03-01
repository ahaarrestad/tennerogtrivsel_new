# Plan: Dev-Test-Prod miljø oppsett

> **Status: BACKLOG** — ikke startet

## Mål

Kontrollere **når** endringer når produksjon, uten å duplisere datakilder.

- **Push til main** → automatisk deploy til **test** (som i dag)
- **Google Drive-oppdatering** (`repository_dispatch`) → automatisk deploy til **prod** (innholdsendringer skal alltid gå live)
- **Manuell knapp i GitHub** (`workflow_dispatch`) → velg miljø (test / prod / begge)

Alle miljøer bruker **samme Google Sheet og Drive-mapper** — det er deploy-tidspunktet som styrer isolasjonen.

## Nåtilstand

| Aspekt | Status |
|--------|--------|
| Dev (lokalt) | ✅ `npm run dev` med sync |
| Test (test2.aarrestad.com) | ✅ S3 + CloudFront, auto-deploy |
| Prod (www.tennerogtrivsel.no) | 🟡 S3 + CloudFront finnes, deploy utkommentert |
| `astro.config.mjs` site | Hardkodet til prod-URL |
| `repository_dispatch` | Deployer til test (burde være prod) |

## Endringer

### Steg 1: Oppdater `deploy.yml` med miljøvalg

**Fil:** `.github/workflows/deploy.yml`

Legg til `inputs` på `workflow_dispatch`:

```yaml
workflow_dispatch:
  inputs:
    environment:
      description: 'Velg deploy-miljø'
      required: true
      default: 'test'
      type: choice
      options:
        - test
        - prod
        - both
```

Endre `deploy`-jobben til to separate steg med betingelser:

```yaml
deploy:
  needs: build
  if: always() && needs.build.result == 'success' && github.event_name != 'pull_request'
  runs-on: ubuntu-latest
  steps:
    - name: Download build artifact
      uses: actions/download-artifact@v4
      with:
        name: build-output
        path: dist/

    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: eu-west-1

    # --- TEST ---
    - name: Deploy to S3 TEST
      if: >-
        github.event_name == 'push' ||
        (github.event_name == 'workflow_dispatch' && (inputs.environment == 'test' || inputs.environment == 'both'))
      run: aws s3 sync dist/ s3://test2.aarrestad.com --delete

    - name: Invalidate CloudFront cache TEST
      if: >-
        github.event_name == 'push' ||
        (github.event_name == 'workflow_dispatch' && (inputs.environment == 'test' || inputs.environment == 'both'))
      run: |
        aws cloudfront create-invalidation \
          --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID_TEST }} \
          --paths "/*"

    # --- PROD ---
    - name: Deploy to S3 PROD
      if: >-
        github.event_name == 'repository_dispatch' ||
        (github.event_name == 'workflow_dispatch' && (inputs.environment == 'prod' || inputs.environment == 'both'))
      run: aws s3 sync dist/ s3://www.tennerogtrivsel.no --delete

    - name: Invalidate CloudFront cache PROD
      if: >-
        github.event_name == 'repository_dispatch' ||
        (github.event_name == 'workflow_dispatch' && (inputs.environment == 'prod' || inputs.environment == 'both'))
      run: |
        aws cloudfront create-invalidation \
          --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID_PROD }} \
          --paths "/*"
```

**Deploy-matrise oppsummert:**

| Trigger | Tester | Deploy test | Deploy prod |
|---------|--------|-------------|-------------|
| Push til main | ✅ | ✅ | ❌ |
| Pull request | ✅ | ❌ | ❌ |
| `repository_dispatch` | ❌ | ❌ | ✅ |
| `workflow_dispatch` (test) | ✅ | ✅ | ❌ |
| `workflow_dispatch` (prod) | ✅ | ❌ | ✅ |
| `workflow_dispatch` (both) | ✅ | ✅ | ✅ |

### Steg 2: Verifiser at GitHub Secrets finnes

Sjekk at disse secrets er satt i GitHub-repositoryet:

- `CLOUDFRONT_DISTRIBUTION_ID_PROD` — allerede brukt i utkommentert kode, bør finnes
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` — allerede i bruk

*(Manuelt steg — utføres av bruker i GitHub UI.)*

### Steg 3: Test workflow manuelt

1. Push endringen til main → verifiser at test-deploy kjører (prod skal IKKE kjøre)
2. Kjør `workflow_dispatch` med `environment: prod` → verifiser at prod-deploy kjører
3. Verifiser begge sider:
   - `https://test2.aarrestad.com` — oppdatert
   - `https://www.tennerogtrivsel.no` — oppdatert kun etter prod-deploy

## Utenfor scope

- **Separate Google Sheets per miljø** — ikke nødvendig, innholdet er det samme
- **Dynamisk `site`-URL i astro.config** — test-siden trenger ikke egen sitemap/canonical (ikke indeksert av søkemotorer)
- **Miljøspesifikke `.env`-filer** — alle miljøer bruker samme datakilder

## Risiko

- **Lav:** Prod-deploy er kun en S3 sync + cache-invalidering, samme mønster som test
- **CloudFront prod-distribusjon** må ha Response Headers Policy og CloudFront Function konfigurert (oppgave 2 i backlog dekker dette)
