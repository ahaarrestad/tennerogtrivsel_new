# Plan: AI-drevet PR-review

> **Status: BACKLOG** — ikke startet

## Mål

Bruke AI som automatisk kodereviewer på alle pull requests, slik at hver PR får gjennomgang av kodeendringer før merge — **uten kostnad**.

## Bakgrunn: Valg av verktøy

Opprinnelig plan var GitHub Copilot code review, men det krever betalt Copilot-plan ($10+/mnd). To gratis Gemini-baserte alternativer skiller seg ut:

| Verktøy | Kostnad | Oppsett | Modellvalg | Konfigurerbarhet |
|---------|---------|---------|------------|------------------|
| **Gemini Code Assist** | Gratis (GitHub App) | Installer fra Marketplace | Google velger | Begrenset |
| **PR-Agent + Gemini API** | Gratis (API free tier) | GitHub Action + API-nøkkel | Du velger (2.5 Pro/Flash) | Svært høy |
| CodeRabbit | Gratis for public repos | Installer GitHub App | CodeRabbit velger | Middels |
| GitHub Copilot | $10+/mnd | Ruleset i repo-settings | GitHub velger | Middels |

## Anbefaling: Start med Gemini Code Assist, vurder PR-Agent ved behov

**Fase 1 — Gemini Code Assist** (enklest mulig start):
- Null konfigurasjon, installer GitHub App og ferdig
- Automatisk review på alle PR-er innen ~5 min
- Interaktiv via `/gemini` i PR-kommentarer

**Fase 2 — PR-Agent + Gemini API** (hvis mer kontroll ønskes):
- Velg modell selv (Gemini 2.5 Pro for best kvalitet, Flash for hastighet)
- Custom prompts og prosjektspesifikke regler
- Flere kommandoer: `/review`, `/improve`, `/describe`, `/ask`
- Kan kjøres parallelt med Gemini Code Assist

### Gemini API — modeller og rategrenser (free tier)

| Modell | Kvalitet | Free tier | Egnet for |
|--------|----------|-----------|-----------|
| `gemini/gemini-2.5-pro` | Best resonnering | 100 req/dag, 5 req/min | Best code review-kvalitet |
| `gemini/gemini-2.5-flash` | God balanse | 250 req/dag, 15 req/min | Daglig bruk, rask feedback |
| `gemini/gemini-2.5-flash-lite` | Grunnleggende | 1000 req/dag, 30 req/min | Enkle sjekker, fallback |

For et solo-prosjekt med noen få PR-er i uka er selv 100 req/dag (Pro) mer enn nok.

### Alternativer vurdert

**CodeRabbit** er også gratis for public repos og har flere funksjoner (release notes, lærende profil), men de to Gemini-alternativene dekker behovet godt — Code Assist for enkelhet, PR-Agent for kontroll.

## Nåtilstand

| Aspekt | Status |
|--------|--------|
| PR-oppretting | ✅ Auto-PR via `git review` → `review/**`-branch → `auto-pr.yml` |
| CI-sjekker | ✅ Unit tests, E2E, build, CodeQL |
| Kode-review | ❌ Ingen reviewer — auto-approve + auto-merge for `ahaarrestad` |

## Fase 1: Gemini Code Assist (GitHub App)

### Steg 1.1: Installer Gemini Code Assist

*(Manuelt steg — utføres av bruker i GitHub UI)*

1. Gå til [Gemini Code Assist på GitHub Marketplace](https://github.com/marketplace/gemini-code-assist)
2. Klikk **Install**
3. Velg bruker/organisasjon
4. Velg repoet `tennerogtrivsel2` (eller «All repositories»)
5. Godkjenn Google Terms of Service og Generative AI Prohibited Use Policy
6. Ferdig — `gemini-code-assist[bot]` legges automatisk til som reviewer på nye PR-er

### Steg 1.2: Oppdater `auto-pr.yml` — fjern auto-approve

**Fil:** `.github/workflows/auto-pr.yml`

Fjern eller kommenter ut auto-approve-steget slik at Gemini faktisk får tid til å reviewe før PR merges:

```yaml
# Fjern dette steget:
# - name: Auto-approve PR
#   if: github.actor == 'ahaarrestad'
#   run: gh pr review "$PR_URL" --approve
```

Behold auto-merge — den venter uansett på required checks og reviews.

### Steg 1.3: Konfigurer branch protection (valgfritt, anbefalt)

*(Manuelt steg — utføres av bruker i GitHub UI)*

For å **kreve** en approval før merge (slik at Gemini-review blokkerer merge):

1. Gå til repo **Settings → Branches → Branch protection rules** (eller **Rules → Rulesets**)
2. For `main`-branchen, aktiver:
   - **Require approvals** — sett til minst 1
   - **Dismiss stale pull request approvals when new commits are pushed**
3. Lagre

> **Merk:** Gemini Code Assist gir kommentarer og forslag, men teller per i dag **ikke** som en formal approval. Hvis du vil ha «hard gate» må du enten:
> - Bruke Gemini-kommentarene som manuell sjekkliste og approve selv
> - Kombinere med en GitHub Action som auto-approver etter at Gemini har kommentert uten kritiske funn

### Steg 1.4: Test oppsettet

1. Gjør en liten kodeendring og kjør `git review`
2. Verifiser at PR opprettes automatisk (som før)
3. Verifiser at `gemini-code-assist[bot]` dukker opp som reviewer innen ~5 min
4. Prøv å skrive `/gemini summarize` i en PR-kommentar for å teste interaktiv modus
5. Sjekk at auto-merge fungerer som forventet etter review

## Fase 2: PR-Agent + Gemini API (valgfritt tillegg)

Gir mer kontroll over modellvalg, prompts og review-regler. Kan kjøres i tillegg til eller i stedet for Gemini Code Assist.

### Steg 2.1: Opprett Gemini API-nøkkel

*(Manuelt steg)*

1. Gå til [Google AI Studio](https://aistudio.google.com/apikey)
2. Klikk **Create API Key**
3. Kopier nøkkelen

### Steg 2.2: Legg til API-nøkkel som GitHub Secret

*(Manuelt steg — utføres av bruker i GitHub UI)*

1. Gå til repo **Settings → Secrets and variables → Actions**
2. Klikk **New repository secret**
3. Navn: `GEMINI_API_KEY`, verdi: nøkkelen fra steg 2.1

### Steg 2.3: Opprett PR-Agent workflow

**Ny fil:** `.github/workflows/pr-agent.yml`

```yaml
name: PR-Agent AI Review

on:
  pull_request:
    types: [opened, reopened, ready_for_review]
  issue_comment:
    types: [created]

permissions:
  issues: write
  pull-requests: write
  contents: read

jobs:
  pr-agent:
    if: ${{ github.event.sender.type != 'Bot' }}
    runs-on: ubuntu-latest
    name: PR-Agent Review
    steps:
      - uses: qodo-ai/pr-agent@main
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          github_action_config.auto_review: "true"
          github_action_config.auto_describe: "true"
          github_action_config.auto_improve: "true"
          config.model: "gemini/gemini-2.5-pro"
          config.fallback_models: '["gemini/gemini-2.5-flash"]'
          GOOGLE_AI_STUDIO.gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
```

### Steg 2.4: (Valgfritt) Legg til prosjektspesifikke instruksjoner

**Ny fil:** `.pr_agent.toml` (i repo-roten)

```toml
[config]
model = "gemini/gemini-2.5-pro"
fallback_models = ["gemini/gemini-2.5-flash"]

[pr_reviewer]
extra_instructions = """
- Prosjektet bruker Astro 5, Tailwind CSS v4, og Google Sheets/Drive som CMS.
- Sjekk at CSS bruker design-tokens (CSS-variabler), ikke hardkodede farger.
- Sheets API-kall med numeriske felter SKAL bruke valueRenderOption: 'UNFORMATTED_VALUE'.
- Sikkerhet: sjekk for XSS, injection, og at DOMPurify brukes for brukerinnhold.
"""

[pr_description]
generate_ai_title = false
```

### Steg 2.5: Test PR-Agent

1. Gjør en kodeendring og kjør `git review`
2. Verifiser at PR-Agent kjører som GitHub Action
3. Sjekk at du får tre kommentarer: **describe** (PR-sammendrag), **review** (kodefunn), **improve** (forbedringsforslag)
4. Test interaktive kommandoer i en PR-kommentar: `/review`, `/improve`, `/ask "hva gjør denne endringen?"`

### PR-Agent — kommandoer

| Kommando | Beskrivelse |
|----------|-------------|
| `/review` | Kjør code review på nytt |
| `/improve` | Foreslå konkrete kodeforbedringer |
| `/describe` | Generer PR-beskrivelse og tittel |
| `/ask "spørsmål"` | Still et spørsmål om PR-en |
| `/update_changelog` | Oppdater CHANGELOG basert på endringene |

## Forventet flyt

### Med bare Gemini Code Assist (fase 1)

```
git review
  ↓
auto-pr.yml: Oppretter PR (review/** → main)
  ↓
Gemini Code Assist: Automatisk code review (~5 min)
CI: Unit tests, E2E, build, CodeQL
  ↓  (parallelt)
Gemini kommenterer / foreslår endringer
  ↓
Bruker leser feedback, approver manuelt
  ↓
Auto-merge (rebase) når alt er grønt
```

### Med PR-Agent i tillegg (fase 2)

```
git review
  ↓
auto-pr.yml: Oppretter PR (review/** → main)
  ↓
PR-Agent: /describe + /review + /improve (Gemini 2.5 Pro)
Gemini Code Assist: Automatisk code review
CI: Unit tests, E2E, build, CodeQL
  ↓  (alle parallelt)
To AI-reviewere gir feedback fra ulike perspektiver
  ↓
Bruker leser feedback, approver manuelt
  ↓
Auto-merge (rebase) når alt er grønt
```

## Utenfor scope

- **Gemini som hard required reviewer** — per i dag gir hverken Gemini Code Assist eller PR-Agent formal approval. Kan revurderes.
- **CodeRabbit som supplement** — to AI-reviewere (Code Assist + PR-Agent) er nok, en tredje tilfører støy.
- **Betalt Gemini API** — free tier er mer enn nok for dette prosjektets volum.

## Risiko

- **Lav:** Begge verktøy er reversible — avinstaller App / slett workflow
- **Kostnad:** Ingen — helt gratis (Gemini Code Assist + Gemini API free tier)
- **Personvern:** Koden sendes til Google for analyse. For et public repo er dette uproblematisk.
- **Falske positiver:** AI kan flagge ting som ikke er problemer — juster med `.pr_agent.toml` instruksjoner
- **API-rategrenser (PR-Agent):** 100 req/dag for 2.5 Pro, 250 for Flash — mer enn nok for solo-prosjekt. Flash som fallback sikrer at review alltid kjører.
- **Avhengighet:** Hvis Google endrer prismodell, kan vi bytte til CodeRabbit (gratis for public repos) eller bruke en annen LLM-backend i PR-Agent
