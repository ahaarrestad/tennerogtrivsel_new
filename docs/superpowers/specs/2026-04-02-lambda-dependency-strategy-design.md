# Lambda dependency strategy — kontakt-form-handler

**Dato:** 2026-04-02

## Problem

`lambda/kontakt-form-handler/` har sin egen `package.json` med to avhengigheter
(`@aws-sdk/client-dynamodb`, `@aws-sdk/client-ses`), men:

- `dependabot.yml` dekker kun rot-katalogen `/` — lambda-deps får aldri automatiske oppdateringsforslag.
- `package-lock.json` er utracked i git.
- CI-jobben `update-lambda` bruker `npm install --omit=dev` (ikke `npm ci`), som betyr at deployede versjoner ikke er reproducerbare.

## Løsning

### 1. Dependabot-dekning for lambda

Legg til en separat `npm`-oppføring i `.github/dependabot.yml` som peker på
`/lambda/kontakt-form-handler` med sin egen gruppe `lambda-dependencies`:

```yaml
- package-ecosystem: "npm"
  directory: "/lambda/kontakt-form-handler"
  schedule:
    interval: "daily"
  open-pull-requests-limit: 5
  rebase-strategy: "auto"
  groups:
    lambda-dependencies:
      patterns:
        - "*"
```

PRer vil få tittel à la *"Bump lambda-dependencies in /lambda/kontakt-form-handler"*
og er dermed tydelig atskilt fra rot-prosjektets Dependabot-PRer.

### 2. Commit `package-lock.json`

`lambda/kontakt-form-handler/package-lock.json` committes til git. Fremtidige
Dependabot-PRer vil holde denne oppdatert automatisk.

### 3. `npm install` → `npm ci` i deploy-jobben

I `.github/workflows/deploy.yml`, jobb `update-lambda`:

```yaml
- name: Deploy Lambda code
  working-directory: lambda/kontakt-form-handler
  run: |
    npm ci --omit=dev
    zip -r function.zip index.mjs node_modules/
    ...
```

`npm ci` installerer nøyaktig de versjonene som er låst i `package-lock.json`.

## Filer som endres

| Fil | Endring |
|-----|---------|
| `.github/dependabot.yml` | Ny `npm`-oppføring for lambda-katalogen |
| `.github/workflows/deploy.yml` | `npm install` → `npm ci` |
| `lambda/kontakt-form-handler/package-lock.json` | Legges til i git (ny fil) |

## Auto-merge

Eksisterende `dependabot-auto-merge.yml` håndterer lambda-PRer på samme måte som
rot-PRer: auto-merge for patch og minor, manuell gjennomgang for major.
