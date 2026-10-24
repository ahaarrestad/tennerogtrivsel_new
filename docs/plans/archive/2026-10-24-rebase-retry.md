# Plan: Auto-merge-PR-er som ligger bak main skal løsne selv

Spec: [docs/designs/archive/2026-10-24-rebase-retry.md](../../designs/archive/2026-10-24-rebase-retry.md)

## Mål og avgrensninger

`dependabot-rebase.yml` får en timeskjøring som prøver på nytt og eskalerer. Logikken flyttes til et
testet skript. Ikke med: branch protection, 👍-sjekk, endringer i `stuck-pr-watch.yml` utover tekst.

## Forsøk før implementering (gjort 2026-10-24)

#522 sto `BEHIND` med auto-merge på etter tre ignorerte kommentarer. 19:08:57Z kjørte vi
`PUT …/pulls/522/update-branch` (rebase, `expected_head_sha`). Ny head `f7ed393`, auto-merge fortsatt på,
påkrevde sjekker bestått (`ci-ok` grønn; `build` skipped, som GitHub godtar), og PR-en ble **merget av
auto-merge 19:12:15Z**, 28 s etter at `ci-ok` ble grønn, uten manuelt grep. Den nye commiten har forfatter
`dependabot[bot]`, committer eieren og `verification: unsigned`.
(Kallet gikk med eierens egen `gh`-innlogging, ikke PAT-en; begge er samme konto med skrivetilgang.)

`update_method` er ikke dokumentert for REST-endepunktet `update-branch` (bare `expected_head_sha` er det).
Den virket på #522 og brukes allerede i dagens workflow. Slutter den å virke, feiler kallet eller gir merge
i stedet for rebase. Begge deler fanges av `stuck-pr-watch.yml`.

**Sjekkes før implementering:** at PAT-en kan oppdatere PR-er som endrer `.github/workflows/`
(fine-grained PAT trenger «Workflows: write»). Sjekk historikken til #472 og PAT-ens rettigheter. Mangler
den rettigheten, hopper eskaleringen over slike PR-er med en tydelig logglinje, og det dokumenteres.
PAT-en utvides ikke.
**Resultat:** Auto-Rebase-kjøring 35453475096 (2026-09-19 15:58Z) kjørte update-branch med PAT-en på
#472, som endret `.github/workflows/codeql.yml`, og force-pushen kom 15:58:56Z. PAT-en klarer det, så
unntaket trengs ikke.

## Steg

### 1. `.github/scripts/dependabot-rebase.sh` (ny)

Leser `GH_REPO`, `MODUS` (`push` | `retry`), `DRY_RUN` (`"true"` = tørrkjøring; tomt/`"false"` = ekte),
`MIN_MINUTES` (standard 30). `set -euo pipefail`.

**Dependabot-PR** betyr i begge moduser: forfatter `app/dependabot` | `dependabot[bot]` **og** head-commiten
er signert (`gh api repos/$GH_REPO/commits/$sha --jq .commit.verification.verified` = `true`; Dependabots
egne commits er signert av GitHub). En Dependabot-forfattet PR med usignert head er allerede eskalert eller
endret av andre. Dependabot rører den ikke lenger, så den behandles som «andre PR-er» (update-branch).

- **`push`:** som i dag: alle åpne PR-er (`gh pr list` med dagens standardgrense på 30), Dependabot-PR → `@dependabot rebase`, andre → update-branch.
  Eneste endring er definisjonen over. Feil per PR → logg og fortsett.
- **`retry`:**
  1. Valider `MIN_MINUTES` (heltall), ellers rc 1. `GRENSE=$(date -u -d "-${MIN_MINUTES} minutes"
     +%Y-%m-%dT%H:%M:%SZ)`. Alle GitHub-tider er UTC med `Z`.
  2. `gh api repos/$GH_REPO/commits/main --jq .commit.committer.date` nyere enn `GRENSE` → logg og rc 0.
     Feiler kallet → rc 1 (rød kjøring: workflowen er ødelagt).
  3. `gh pr list --state open --limit 100 --json number,author,autoMergeRequest,mergeStateStatus,headRefOid`
     → jq: `autoMergeRequest.enabledAt != null`, logg `UNKNOWN`, velg `BEHIND`. Ut: `nr forfatter sha`.
     Feiler kallet → rc 1.
  4. Per PR (`mapfile` + `read -r`; valider `nr` `^[0-9]+$` og `sha` `^[0-9a-f]{40}$`), i en funksjon
     kalt som `behandle … || echo "::warning::…"` med eksplisitte returkodesjekker:
     - Dependabot-PR: `HEAD_TID` = `.commit.committer.date` fra samme `commits/$sha`-kall;
       `gh pr view $nr --json comments` (gh henter alle sider) → kommentarer med body nøyaktig
       `@dependabot rebase` og `createdAt > HEAD_TID`: antall `N` og siste `T`.
       - `T > GRENSE` → «venter».
       - `N < 2` → `gh pr comment`.
       - ellers → «eskalerer» + `PUT …/update-branch -f update_method=rebase -f expected_head_sha=$sha`.
     - Andre: `PUT …/update-branch -f update_method=rebase`.
     - `DRY_RUN=true`: logg «ville …» i stedet for skrivende kall (gjelder begge moduser; i praksis
       bare retry, siden push aldri har inputs).
     - `UNKNOWN` logges med PR-nummer («#N: UNKNOWN, prøver neste time»).
  5. Rc 0.

`expected_head_sha` hindrer at vi oppdaterer hvis Dependabot har rukket å pushe siden lista ble hentet.

### 2. `scripts/__tests__/dependabot-rebase.test.mjs` (ny)

Vitest kjører skriptet med `spawnSync('bash', [skript])` og en falsk `gh` først i `PATH` (i en tmp-katalog).
Den falske `gh` svarer fra fixturer bygd fra ekte utdata (#521/#522) og logger alle kall. `it.each`:

- push: Dependabot (begge login-former) → kommentar; annen → update-branch; feil i ett kall → fortsetter
- push og retry: Dependabot-forfatter med usignert head (eskalert tidligere) → update-branch, ingen kommentar
- retry: main pushet nylig → ingen `gh pr list`
- retry: `commits/main` eller `gh pr list` feiler → rc 1
- retry: Dependabot, 0–2 kommentarer etter head, siste eldre enn grensen → kommentar
- retry: siste kommentar nyere enn grensen → ingenting
- retry: 2 kommentarer etter head → update-branch med `expected_head_sha`; 2 der 1 er eldre enn head →
  kommentar
- retry: annen PR → update-branch
- retry: CLEAN / BLOCKED / UNKNOWN / auto-merge av / `enabledAt` null → ingen skrivende kall
- retry: `gh pr view` feiler for én PR → neste behandles, rc 0
- `DRY_RUN=true` → ingen skrivende kall; tom `DRY_RUN` → ekte kall
- `MIN_MINUTES=abc` → rc 1; ugyldig `nr`/`sha` → hoppes over med warning

Testen sier i en kommentar at den tester `.github/scripts/` (vitest plukker opp `scripts/__tests__`).
Den falske `gh` kjører `--jq` med ekte `jq`, og skriptet bruker GNU `date -d`. Testen krever derfor
`jq` og GNU coreutils (finnes på ubuntu-latest og lokalt på Linux).

Coverage måler ikke bash, så 80 %-kravet per fil gjelder ikke `dependabot-rebase.sh`. Dekningen
sikres i stedet av at hver gren i steg 1 har et tilfelle i lista over.

### 3. `.github/workflows/dependabot-rebase.yml`

```yaml
on:
  push:
    branches: [main]
  schedule:
    - cron: '23 * * * *'
  workflow_dispatch:
    inputs:
      dry_run: { description: 'Bare logg hva som ville skjedd', type: boolean, default: false }
      min_minutes: { description: 'Minutter siden siste push / siste kommentar (0 for testing)', default: '30' }
permissions:
  contents: read   # bare checkout av skriptet; alt mot API-et går via PAT
concurrency:
  # Egen gruppe per hendelse: en ventende kjøring i samme gruppe fortrenges av en nyere, så en
  # timeskjøring kunne ellers erstatte en ventende push-kjøring. Push og retry kolliderer ikke i
  # praksis: retry gjør ingenting mens mains siste commit er under 30 min gammel.
  group: dependabot-rebase-${{ github.event_name }}
jobs:
  rebase:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@<samme pinnede SHA som de andre workflowene>
        with: { persist-credentials: false, sparse-checkout: .github/scripts }
      - run: bash .github/scripts/dependabot-rebase.sh
        env:
          GH_TOKEN: ${{ secrets.MY_GITHUB_PAT }}
          GH_REPO: ${{ github.repository }}
          MODUS: ${{ github.event_name == 'push' && 'push' || 'retry' }}
          DRY_RUN: ${{ inputs.dry_run }}
          MIN_MINUTES: ${{ inputs.min_minutes || '30' }}
```

Toppkommentar: hvorfor PAT, de to modusene, terskler, eskalering og hvorfor den er trygg (#472 gjelder
bare før auto-merge er på), at Dependabot ikke rebaser av seg selv når en PR bare er `BEHIND`
(dokumentasjonen nevner det ikke, og 2026-10-24 skjedde det ikke), grønn ved funn.
Kommentaren om login-formene (a203afd, PR #472) flyttes til skriptet.

### 4. `.github/workflows/stuck-pr-watch.yml`

Toppkommentar og issue-tekst: `BEHIND` prøves først av `dependabot-rebase.yml` (hver time, eskalering
etter to ubesvarte kommentarer); issuen kan komme før det hvis auto-merge har vært på lenge.

### 5. `docs/architecture/sikkerhet.md`

- Vakttabellen (~l. 398–402): ny rad for `dependabot-rebase.yml`; «Tre planlagte workflows» (l. 396) →
  fire. Raden sier at den kommenterer og oppdaterer som PAT-eieren, og hvorfor.
  Raden sier også at eskaleringen er et bevisst unntak fra 2026-09-21-fiksen (ikke rebase
  Dependabot-PR-er med PAT): unntaket gjelder bare når auto-merge allerede er på. Den sier også at
  «Require approval of the most recent reviewable push» i branch protection ville stoppe eskaleringen.
- L. 406: legg den til blant vaktene som er grønne ved funn.
- PAT-rotering (l. 469): list alle brukere, verifisert med `grep -l 'secrets.MY_GITHUB_PAT'
  .github/workflows/*` — forventet `auto-pr`, `dependabot-auto-merge`, `dependabot-rebase`,
  `scheduled-audit`.

### 6. `.claude/skills/helsesjekk/SKILL.md`

Ny kommando `gh run list --workflow "Auto-Rebase Open PRs" --event schedule --limit 1 …` under
Vaktjobber: kjører hver time; eldre enn ~4 t eller `conclusion` ≠ `success` → ⚠️.

### 7. TODO.md

Rett oppgaveteksten til riktig diagnose og lenk spec/plan.

## Testbehov og definition of done

- Testene i steg 2 grønne; `actionlint` uten feil på endrede workflows. Testene beviser
  greinlogikken i skriptet, ikke hvordan GitHub og Dependabot oppfører seg. Det siste hviler på
  forsøket med #522 og sjekken etter merge.
- `/quality-gate` grønn.
- Etter merge: push-kjøringen fra selve mergen er grønn og logger som før;
  `gh workflow run "Auto-Rebase Open PRs" -f dry_run=true` gir forventet logg; første timeskjøring grønn.
- Reell effekt bekreftes neste gang en PR står `BEHIND` etter en ignorert kommentar.

## Risiki og usikkerheter

- Eskalering gjør at Dependabot slutter å vedlikeholde PR-en. Blir CI rød etterpå, varsler
  `stuck-pr-watch.yml` straks (rød `ci-ok`), og eieren må ta den (eller `@dependabot recreate`).
- Mange pusher til main samme dag teller med i de to kommentarene, så eskalering kan komme tidligere
  enn ~2,5 t. Det er ufarlig.
- `UNKNOWN` like etter endringer gir én times forsinkelse.
- Omskrivingen av push-modusen kan endre dagens oppførsel. Testene dekker den, og den første
  push-kjøringen etter merge sjekkes.
