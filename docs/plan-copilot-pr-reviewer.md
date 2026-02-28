# Plan: GitHub Copilot som PR-reviewer

> **Status: BACKLOG** — ikke startet

## Mål

Bruke GitHub Copilot som automatisk kodereviewer på alle pull requests, slik at hver PR får AI-gjennomgang av kodeendringer før merge.

## Nåtilstand

| Aspekt | Status |
|--------|--------|
| PR-oppretting | ✅ Auto-PR via `git review` → `review/**`-branch → `auto-pr.yml` |
| CI-sjekker | ✅ Unit tests, E2E, build, CodeQL |
| Kode-review | ❌ Ingen reviewer — auto-approve + auto-merge for `ahaarrestad` |
| Copilot-lisens | ⚠️ Må verifiseres — code review krever betalt Copilot-plan |

## Forutsetninger

- GitHub Copilot må være aktivert for brukeren/organisasjonen (minst Individual-plan, $10/mnd)
- «Copilot code review»-funksjonen må være slått på i Copilot-policy (organisasjonsnivå hvis aktuelt)

## Endringer

### Steg 1: Verifiser Copilot-tilgang

*(Manuelt steg — utføres av bruker i GitHub UI)*

1. Gå til **github.com → Settings → Copilot** og verifiser at du har en aktiv plan
2. Sjekk at «Code review» er aktivert under Copilot-innstillingene

### Steg 2: Aktiver automatisk Copilot-review via Repository Ruleset

*(Manuelt steg — utføres av bruker i GitHub UI)*

1. Gå til repo **Settings → Rules → Rulesets**
2. Klikk **New ruleset → New branch ruleset**
3. Gi rulesettet et navn, f.eks. `copilot-review`
4. Under «Target branches» — velg `main` (default branch)
5. Under «Branch rules» — huk av **«Automatically request Copilot code review»**
6. Valgfritt: Huk av **«Review new pushes»** slik at Copilot også re-reviewer etter force-push eller nye commits
7. Lagre rulesettet

Etter dette vil Copilot automatisk bli lagt til som reviewer på alle PR-er mot `main`.

### Steg 3: Oppdater `auto-pr.yml` — fjern auto-approve

**Fil:** `.github/workflows/auto-pr.yml`

Fjern eller kommenter ut auto-approve-steget slik at Copilot faktisk får tid til å reviewe før PR merges:

```yaml
# Fjern dette steget:
# - name: Auto-approve PR
#   if: github.actor == 'ahaarrestad'
#   run: gh pr review "$PR_URL" --approve
```

Behold auto-merge — den venter uansett på required checks og reviews.

### Steg 4: Konfigurer branch protection (valgfritt, anbefalt)

*(Manuelt steg — utføres av bruker i GitHub UI)*

For å **kreve** Copilot-godkjenning før merge:

1. Gå til repo **Settings → Branches → Branch protection rules** (eller bruk Rulesets fra steg 2)
2. For `main`-branchen, aktiver:
   - **Require approvals** — sett til minst 1
   - **Dismiss stale pull request approvals when new commits are pushed**
3. Lagre

> **Merk:** Copilots review teller som en approval. Med dette oppsettet må Copilot godkjenne før auto-merge kan kjøre.

### Steg 5: Test oppsettet

1. Gjør en liten kodeendring og kjør `git review`
2. Verifiser at PR opprettes automatisk (som før)
3. Verifiser at Copilot dukker opp som reviewer og legger igjen kommentarer
4. Verifiser at PR **ikke** auto-merges før Copilot har fullført review
5. Sjekk at auto-merge aktiveres etter Copilot-godkjenning + CI-sjekker

## Forventet flyt etter endring

```
git review
  ↓
auto-pr.yml: Oppretter PR (review/** → main)
  ↓
Copilot: Automatisk code review (via ruleset)
CI: Unit tests, E2E, build, CodeQL
  ↓  (parallelt)
Copilot godkjenner / kommenterer
  ↓
Auto-merge (rebase) når alt er grønt
```

## Utenfor scope

- **Copilot som required status check** — bruker approval-modellen i stedet, som er den offisielle måten
- **Custom Copilot-instruksjoner** (`.github/copilot-review-instructions.md`) — kan legges til senere for prosjektspesifikke regler
- **Andre AI-review-verktøy** — holder oss til GitHub-native Copilot

## Risiko

- **Lav:** Endringen er reversibel — kan slå av rulesettet og gjeninnføre auto-approve når som helst
- **Kostnad:** Krever betalt Copilot-plan, men code review er inkludert i alle betalte planer
- **Falske positiver:** Copilot kan flagge ting som ikke er problemer — kan justeres over tid med instruksjonsfil
