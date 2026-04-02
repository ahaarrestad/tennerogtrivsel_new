# Lambda Dependency Strategy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gjøre lambda-avhengigheter reproducerbare og Dependabot-dekte ved å committe lock-fil, bytte til `npm ci`, og legge lambda-katalogen til i `dependabot.yml`.

**Architecture:** Tre uavhengige konfigurasjonsfil-endringer. Lock-filen eksisterer allerede lokalt og er utracked; den commites først slik at `npm ci` i deploy-steget alltid finner den. Dependabot-oppføringen er uavhengig og kan committes i samme eller separat commit.

**Tech Stack:** GitHub Actions, Dependabot, npm

---

### Task 1: Commit package-lock.json

**Files:**
- Commit (untracked): `lambda/kontakt-form-handler/package-lock.json`

- [ ] **Steg 1: Verifiser at lock-filen er tilstede og ser riktig ut**

```bash
head -15 lambda/kontakt-form-handler/package-lock.json
```

Forventet: JSON med `"lockfileVersion": 3`, inneholder `@aws-sdk/client-dynamodb` og `@aws-sdk/client-ses` under `"packages"`.

- [ ] **Steg 2: Verifiser at function.zip IKKE er med**

```bash
git status lambda/kontakt-form-handler/
```

Forventet: `package-lock.json` er untracked. `function.zip` skal IKKE stages (den er et build-artefakt).

- [ ] **Steg 3: Stage og commit lock-filen**

```bash
git add lambda/kontakt-form-handler/package-lock.json
git commit -m "$(cat <<'EOF'
chore: spor package-lock.json for lambda/kontakt-form-handler

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Bytt npm install til npm ci i deploy-workflow

**Files:**
- Modify: `.github/workflows/deploy.yml` (jobb `update-lambda`, steg `Deploy Lambda code`)

- [ ] **Steg 1: Finn linjen som skal endres**

```bash
grep -n "npm install" .github/workflows/deploy.yml
```

Forventet output: én linje, omtrent:
```
202:          npm install --omit=dev
```

- [ ] **Steg 2: Gjør endringen**

I `.github/workflows/deploy.yml`, under `Deploy Lambda code`-steget:

```yaml
      - name: Deploy Lambda code
        working-directory: lambda/kontakt-form-handler
        run: |
          npm ci --omit=dev
          zip -r function.zip index.mjs node_modules/
          aws lambda update-function-code \
            --function-name ${{ secrets.LAMBDA_KONTAKT_ARN }} \
            --zip-file fileb://function.zip \
            --region eu-west-1
          aws lambda wait function-updated \
            --function-name ${{ secrets.LAMBDA_KONTAKT_ARN }} \
            --region eu-west-1
```

(Kun `npm install --omit=dev` → `npm ci --omit=dev` endres, resten er uendret.)

- [ ] **Steg 3: Verifiser endringen**

```bash
grep -n "npm ci\|npm install" .github/workflows/deploy.yml
```

Forventet: kun `npm ci --omit=dev`, ingen `npm install` igjen.

- [ ] **Steg 4: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "$(cat <<'EOF'
chore: bruk npm ci i lambda-deploy for reproducerbare bygg

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Legg lambda-katalog til i dependabot.yml

**Files:**
- Modify: `.github/dependabot.yml`

- [ ] **Steg 1: Se nåværende innhold**

```bash
cat .github/dependabot.yml
```

Forventet: én `npm`-oppføring for `directory: "/"`.

- [ ] **Steg 2: Legg til ny oppføring**

Legg til etter den eksisterende `npm`-blokken i `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "daily"
    open-pull-requests-limit: 10
    rebase-strategy: "auto"
    groups:
      dependencies:
        patterns:
          - "*"

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

- [ ] **Steg 3: Verifiser at filen er gyldig YAML og har to oppføringer**

```bash
grep "directory:" .github/dependabot.yml
```

Forventet:
```
    directory: "/"
    directory: "/lambda/kontakt-form-handler"
```

- [ ] **Steg 4: Commit**

```bash
git add .github/dependabot.yml
git commit -m "$(cat <<'EOF'
chore: legg lambda/kontakt-form-handler til i Dependabot

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Push og verifiser

- [ ] **Steg 1: Push via git review**

```bash
git review
```

- [ ] **Steg 2: Verifiser at GitHub Actions kjører**

Sjekk at `update-lambda`-jobben i CI passerer uten feil på `npm ci`.

- [ ] **Steg 3: Verifiser Dependabot**

Gå til GitHub → Insights → Dependency graph → Dependabot og bekreft at `lambda/kontakt-form-handler` dukker opp som et eget pakkeøkosystem.
