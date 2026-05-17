# SHA-pin GitHub Actions (F4) Implementasjonsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pin alle GitHub Actions til commit-SHA i stedet for mutable `@vN`-tags, slik at en kompromittert action-publisher ikke kan endre hva som kjøres i CI uten at det fanges opp.

**Architecture:** Tre steg — (1) slå opp korrekt latest-tag og SHA for hvert action via GitHub API, (2) erstatt alle `@vN` med `@<sha>  # vN.M.K` i alle workflow-filer og rydd opp versjons-inkonsistenser, (3) legg til `github-actions`-ecosystem i Dependabot slik at SHA-er bumpes automatisk ved nye releases.

**Tech Stack:** GitHub Actions YAML, GitHub CLI (`gh api`), Dependabot.

---

## SHA-lookup (oppdatert 2026-05-06)

| Action | Tag | Commit-SHA |
|--------|-----|------------|
| `actions/checkout` | v6.0.2 | `de0fac2e4500dabe0009e67214ff5f5447ce83dd` |
| `actions/setup-node` | v6.4.0 | `48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e` |
| `actions/upload-artifact` | v7.0.1 | `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` |
| `actions/download-artifact` | v8.0.1 | `3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c` |
| `aws-actions/configure-aws-credentials` | v6.1.1 | `d979d5b3a71173a29b74b5b88418bfda9437d885` |
| `dependabot/fetch-metadata` | v3.1.0 | `25dd0e34f4fe68f24cc83900b1fe3fe149efef98` |
| `github/codeql-action` | v4.35.5 | `9e0d7b8d25671d64c341c19c0152d693099fb5ba` |

`github/codeql-action/init` og `github/codeql-action/analyze` er fra samme repo — begge pines til SHA `9e0d7b8d25671d64c341c19c0152d693099fb5ba`.

## Filer som endres

| Fil | Endring |
|-----|---------|
| `.github/workflows/deploy.yml` | Pin `checkout@v6`, `setup-node@v6`, `upload-artifact@v7`, `download-artifact@v8`, `configure-aws-credentials@v6` |
| `.github/workflows/auto-pr.yml` | Bump `checkout@v4` → v6 og pin |
| `.github/workflows/codeql.yml` | Bump `checkout@v4` → v6 og pin; pin `codeql-action` |
| `.github/workflows/dependabot-auto-merge.yml` | Bump `fetch-metadata@v2` → v3 og pin |
| `.github/dependabot.yml` | Legg til `github-actions`-ecosystem med cooldown |

`dependabot-rebase.yml` har ingen `uses:`-linjer (bare `run:`-skript) — ingen endring nødvendig.

---

## Task 1: Slå opp korrekte versjoner og SHAs

**Files:** (lese-only, ingen endringer)

Nåværende workflow-filer bruker inkonsistente og trolig ukorrekte tags:
- `deploy.yml`: `checkout@v6`, `setup-node@v6`, `upload-artifact@v7`, `download-artifact@v8`, `configure-aws-credentials@v6`
- `auto-pr.yml` / `codeql.yml`: `checkout@v4`
- `dependabot-auto-merge.yml`: `fetch-metadata@v2`

Siste kjente stabile major er `v4` for de fleste actions — versjonstallene i `deploy.yml` er sannsynligvis skrivefeil. Verifiser og finn riktig SHA nedenfor.

- [ ] **Steg 1.1: Finn alle `uses:` i workflow-filene**

  ```bash
  grep -rh "uses:" .github/workflows/ | sort -u
  ```

  Forventet output (nåværende state):
  ```
    uses: actions/checkout@v4
    uses: actions/checkout@v6
    uses: actions/download-artifact@v8
    uses: actions/setup-node@v6
    uses: actions/upload-artifact@v7
    uses: aws-actions/configure-aws-credentials@v6
    uses: dependabot/fetch-metadata@v2
    uses: github/codeql-action/analyze@v3
    uses: github/codeql-action/init@v3
  ```

- [ ] **Steg 1.2: Slå opp korrekt latest-tag for hvert action**

  For actions fra `actions/`-orgen, finn siste patch-release med:
  ```bash
  gh api repos/actions/checkout/releases/latest --jq '.tag_name'
  gh api repos/actions/setup-node/releases/latest --jq '.tag_name'
  gh api repos/actions/upload-artifact/releases/latest --jq '.tag_name'
  gh api repos/actions/download-artifact/releases/latest --jq '.tag_name'
  gh api repos/aws-actions/configure-aws-credentials/releases/latest --jq '.tag_name'
  gh api repos/dependabot/fetch-metadata/releases/latest --jq '.tag_name'
  gh api repos/github/codeql-action/releases/latest --jq '.tag_name'
  ```

- [ ] **Steg 1.3: Hent commit-SHA for hvert action**

  GitHub Actions pinner til commit-SHA (40 hex-tegn). Rolling major-tags (`@v4`) peker via tag-objekter — SHA-en må traverseres:

  ```bash
  # Funksjon for å hente commit-SHA fra tag (håndterer tag-objekt vs. direkte commit-ref):
  get_sha() {
    local repo=$1; local tag=$2
    local ref_sha type
    ref_sha=$(gh api "repos/$repo/git/ref/tags/$tag" --jq '.object.sha')
    type=$(gh api "repos/$repo/git/ref/tags/$tag" --jq '.object.type')
    if [ "$type" = "tag" ]; then
      # Tag-objekt — traverser ett steg til for å få commit-SHA
      gh api "repos/$repo/git/tags/$ref_sha" --jq '.object.sha'
    else
      echo "$ref_sha"
    fi
  }

  # Kjør for hvert action (erstatt <TAG> med resultatet fra Steg 1.2):
  get_sha actions/checkout <TAG>
  get_sha actions/setup-node <TAG>
  get_sha actions/upload-artifact <TAG>
  get_sha actions/download-artifact <TAG>
  get_sha aws-actions/configure-aws-credentials <TAG>
  get_sha dependabot/fetch-metadata <TAG>
  get_sha github/codeql-action <TAG>
  ```

- [ ] **Steg 1.4: Lag lookup-tabell og hold den i minnet til Task 2-4**

  Fyll inn verdier fra Steg 1.2–1.3:

  | Action | Korrekt tag | Commit-SHA (40 tegn) |
  |--------|-------------|----------------------|
  | `actions/checkout` | `v4.x.x` | `<SHA_CHECKOUT>` |
  | `actions/setup-node` | `v4.x.x` | `<SHA_SETUP_NODE>` |
  | `actions/upload-artifact` | `v4.x.x` | `<SHA_UPLOAD>` |
  | `actions/download-artifact` | `v4.x.x` | `<SHA_DOWNLOAD>` |
  | `aws-actions/configure-aws-credentials` | `vX.x.x` | `<SHA_AWS_CREDS>` |
  | `dependabot/fetch-metadata` | `v2.x.x` | `<SHA_FETCH_META>` |
  | `github/codeql-action` | `vX.x.x` | `<SHA_CODEQL>` |

  `github/codeql-action/init` og `github/codeql-action/analyze` er fra samme repo og bruker samme SHA.

---

## Task 2: Pin actions i `deploy.yml`

**Files:**
- Modify: `.github/workflows/deploy.yml`

`deploy.yml` har fem unike actions, brukt på til sammen ni steder.

- [ ] **Steg 2.1: Erstatt `actions/checkout` (alle 5 forekomster)**

  Nåværende: `uses: actions/checkout@v6`

  Nytt format (fyll inn SHA fra Task 1):
  ```yaml
  uses: actions/checkout@<SHA_CHECKOUT>  # v4.x.x
  ```

  Linjer der `checkout` brukes: 22, 47, 94, 132, 209. Erstatt alle.

- [ ] **Steg 2.2: Erstatt `actions/setup-node` (alle 4 forekomster)**

  Nåværende: `uses: actions/setup-node@v6`

  ```yaml
  uses: actions/setup-node@<SHA_SETUP_NODE>  # v4.x.x
    with:
      node-version: '24'
      cache: 'npm'
  ```

  Linjer: 23, 48, 97, 210.

- [ ] **Steg 2.3: Erstatt `actions/upload-artifact` (2 forekomster)**

  Nåværende: `uses: actions/upload-artifact@v7`

  ```yaml
  uses: actions/upload-artifact@<SHA_UPLOAD>  # v4.x.x
  ```

  Linjer: 70, 117.

- [ ] **Steg 2.4: Erstatt `actions/download-artifact`**

  Nåværende: `uses: actions/download-artifact@v8`

  ```yaml
  uses: actions/download-artifact@<SHA_DOWNLOAD>  # v4.x.x
  ```

  Linje: 135.

- [ ] **Steg 2.5: Erstatt `aws-actions/configure-aws-credentials` (2 forekomster)**

  Nåværende: `uses: aws-actions/configure-aws-credentials@v6`

  ```yaml
  uses: aws-actions/configure-aws-credentials@<SHA_AWS_CREDS>  # vX.x.x
  ```

  Linjer: 141, 222.

- [ ] **Steg 2.6: Verifiser at ingen `@v`-referanser gjenstår i `deploy.yml`**

  ```bash
  grep "uses:.*@v" .github/workflows/deploy.yml
  ```

  Forventet: ingen output (tom).

---

## Task 3: Pin actions i `codeql.yml`, `auto-pr.yml` og `dependabot-auto-merge.yml`

**Files:**
- Modify: `.github/workflows/codeql.yml`
- Modify: `.github/workflows/auto-pr.yml`
- Modify: `.github/workflows/dependabot-auto-merge.yml`

- [ ] **Steg 3.1: Pin `codeql.yml`**

  Nåværende:
  ```yaml
  - name: Checkout repository
    uses: actions/checkout@v4

  - name: Initialize CodeQL
    uses: github/codeql-action/init@v3
    with:
      languages: javascript-typescript

  - name: Perform CodeQL Analysis
    uses: github/codeql-action/analyze@v3
  ```

  Nytt (fyll inn SHA fra Task 1):
  ```yaml
  - name: Checkout repository
    uses: actions/checkout@<SHA_CHECKOUT>  # v4.x.x

  - name: Initialize CodeQL
    uses: github/codeql-action/init@<SHA_CODEQL>  # v3.x.x
    with:
      languages: javascript-typescript

  - name: Perform CodeQL Analysis
    uses: github/codeql-action/analyze@<SHA_CODEQL>  # v3.x.x
  ```

  Merk: `init` og `analyze` bruker samme SHA — de er del av samme release av `github/codeql-action`.

- [ ] **Steg 3.2: Pin `auto-pr.yml`**

  Nåværende:
  ```yaml
  - uses: actions/checkout@v4
  ```

  Nytt:
  ```yaml
  - uses: actions/checkout@<SHA_CHECKOUT>  # v4.x.x
  ```

- [ ] **Steg 3.3: Pin `dependabot-auto-merge.yml`**

  Nåværende:
  ```yaml
  uses: dependabot/fetch-metadata@v2
  ```

  Nytt:
  ```yaml
  uses: dependabot/fetch-metadata@<SHA_FETCH_META>  # v2.x.x
  ```

- [ ] **Steg 3.4: Verifiser at ingen `@v`-referanser gjenstår i noen workflow-fil**

  ```bash
  grep -rn "uses:.*@v" .github/workflows/
  ```

  Forventet: ingen output (tom).

- [ ] **Steg 3.5: Commit alle workflow-endringer**

  ```bash
  git add .github/workflows/
  git commit -m "fix(ci): SHA-pin alle GitHub Actions (F4)"
  ```

---

## Task 4: Legg til `github-actions`-ecosystem i Dependabot

**Files:**
- Modify: `.github/dependabot.yml`

Dependabot støtter `github-actions` som eget ecosystem og vil automatisk oppdatere SHA-kommentarene (f.eks. `# v4.1.1` → `# v4.2.0`) og selve SHA-en ved nye releases, med cooldown som for npm.

- [ ] **Steg 4.1: Legg til github-actions-blokk i `.github/dependabot.yml`**

  Nåværende fil slutter etter den andre npm-blokken. Legg til:

  ```yaml
    - package-ecosystem: github-actions
      directory: /
      schedule: { interval: weekly }
      cooldown:
        default-days: 7
        semver-major-days: 30
        semver-minor-days: 7
        semver-patch-days: 3
      groups:
        actions-version-updates:
          applies-to: version-updates
          patterns: ["*"]
        actions-security-updates:
          applies-to: security-updates
          patterns: ["*"]
  ```

  Cooldown-reglene er identiske med npm-blokkene — 7/7/3/30 dager. Auto-merge-workflow fra Task 1 i sikkerhetshardening-planen dekker disse PR-ene automatisk (samme `alert-state`/`update-type`-logikk).

- [ ] **Steg 4.2: Sjekk at filen har korrekt YAML-struktur**

  ```bash
  python3 -c "import yaml,sys; yaml.safe_load(open(sys.argv[1]))" .github/dependabot.yml && echo "OK"
  ```

  Forventet: `OK`

- [ ] **Steg 4.3: Commit**

  ```bash
  git add .github/dependabot.yml
  git commit -m "chore(deps): aktiver Dependabot for github-actions med cooldown"
  ```

---

## Task 5: Verifiser i CI

- [ ] **Steg 5.1: Push via `git review` og verifiser at alle CI-jobber er grønne**

  Push begge commits via `/commit`-skillen. Verifiser i GitHub Actions UI:
  - `CI/CD` → alle jobber grønne (SHA-er resolveres korrekt av GitHub runner)
  - `CodeQL` → kjører uten feil
  - Dependabot-seksjonen i Insights → `github-actions` vises nå som eget ecosystem

  Vanligste feil: SHA peker til et tag-objekt i stedet for en commit. GitHub runner gir da `Unable to resolve action` eller `invalid format`. Løsning: traverser SHA én ekstra gang med `gh api repos/<owner>/<repo>/git/tags/<sha> --jq '.object.sha'`.

- [ ] **Steg 5.2: Marker Task 2 (F4) som fullført i TODO.md og arkiver plan**

  Oppdater TODO.md:
  ```
  ~~Task 2 (F4): SHA-pin GitHub Actions — ferdig 2026-05-XX~~
  ```
  Flytt planfilen til `docs/plans/archive/`.
