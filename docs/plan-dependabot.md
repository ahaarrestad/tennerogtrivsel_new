# Plan: Sikre at Dependabot-PRer ikke merges ved feilet bygg

## Kontekst

Prosjektet har en `dependabot-auto-merge.yml` som automatisk godkjenner og aktiverer auto-merge for Dependabot-PRer. Workflowen bruker `gh pr merge --auto`, som betyr at GitHub venter på at required status checks passerer før merge. **Problemet:** Rulesettet refererte til «build-and-deploy» — et jobb-navn som ikke eksisterer etter CI-sammenslåingen. Rulesettet er nå aktivert, men status check-navnene måtte oppdateres.

## Nåværende tilstand (før endring)

- **Ruleset:** Aktivt, men krevde «build-and-deploy» (eksisterte ikke)
- **CI/CD-jobber:** `unit-tests`, `e2e-tests`, `build`, `deploy`
- **Auto-merge:** `gh pr merge --auto` — venter på required checks
- **Kjede:** `build` har `needs: [unit-tests, e2e-tests]` — starter ikke hvis testene feiler

## Endringer

### 1. Begrens auto-merge til minor/patch (kodeendring)

**Fil:** `.github/workflows/dependabot-auto-merge.yml`

Lagt til en betingelse slik at kun `minor` og `patch`-oppdateringer auto-merges. Major-oppdateringer (breaking changes) gjennomgås manuelt.

```yaml
- name: Approve and Enable Auto-Merge
  if: steps.metadata.outputs.update-type != 'version-update:semver-major'
  run: |
    gh pr review --approve "$PR_URL"
    gh pr merge --auto --merge "$PR_URL"
```

### 2. Oppdater ruleset (manuelt steg)

Bruker oppdaterer rulesettet i GitHub UI:

1. Fjern «build-and-deploy» fra required status checks
2. Legg til «build» som required status check

Det er tilstrekkelig å kun kreve `build`, fordi den har `needs: [unit-tests, e2e-tests]` — den starter aldri hvis en test-jobb feiler. Feilet test -> `build` forblir «skipped» -> required check ikke oppfylt -> merge blokkert.

## Verifisering

1. `npm test` passerer (ingen kodeendring i src/)
2. Push endring -> opprett PR -> verifiser at `build`-check er required
3. Dependabot-PRer med major-oppdateringer skal ikke auto-merges
