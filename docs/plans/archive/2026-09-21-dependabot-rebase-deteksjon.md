# Dependabot-rebase: gjenkjenn Dependabot-PR-er

**Spec og plan i ett dokument** (jf. `/todo` §0 — oppgaven er en ettlinjes-fiks i én
workflow-fil, med ferdig diagnose fra 2026-09-20). Bakgrunn: TODO.md-oppgaven
«CI: `dependabot-rebase.yml` gjenkjenner ikke Dependabot-PR-er».

---

## Spec

### Problem

`.github/workflows/dependabot-rebase.yml` skal, ved hver push til `main`, be Dependabot
rebase sine egne åpne PR-er (`@dependabot rebase`) og oppdatere alle *andre* åpne PR-er via
`update-branch`-API-et. Skillet gjøres med

```bash
if [ "$author" = "dependabot[bot]" ]; then
```

der `$author` er `.author.login` fra `gh pr list --json author`. Men `gh` rapporterer
bot-forfattere som `{"is_bot":true,"login":"app/dependabot"}`. Sammenligningen treffer
aldri, og **alle** Dependabot-PR-er går i `else`-grenen: de rebases av GitHub på vegne av
`MY_GITHUB_PAT`, som skriver om commiten med PAT-eieren som committer og uten signatur.

Feilen har vært der siden refaktoreringen 2026-03-01 (`50fe12c`), som byttet fra
`gh pr list --author 'dependabot[bot]'` (et søkefilter — fungerer) til streng-sammenligning
på `login` (fungerer ikke). Bekreftet i `Auto-Rebase`-loggene tilbake til 2026-07-25:
Dependabot-grenen er aldri kjørt.

Det går som regel bra, fordi `dependabot-auto-merge.yml` normalt rekker å aktivere
auto-merge før første rebase. Men når en Dependabot-PR åpnes *samtidig* som main beveger
seg, taper den kappløpet: PR #472 (2026-09-19) ble åpnet 15:55:54 og PAT-rebaset 15:55:58.
`dependabot/fetch-metadata` så en usignert commit med feil committer og nektet
(«Dependabot's commit signature is not verified, refusing to proceed»). Auto-merge ble
aldri aktivert, og PR-en sto til den ble merget manuelt 2026-09-20.

Branch protection på `main` har `strict: true` («require branches to be up to date»), så
rebase-workflowen er nødvendig — en PR som ligger bak main kan ikke merges. Fiksen er
altså ikke å fjerne workflowen, men å få den til å velge riktig gren.

### Mål

Dependabot-PR-er rebases av Dependabot selv, slik at commiten forblir signert av
Dependabot og `fetch-metadata` godtar den — uansett timing mot pushes til main.

### Krav og akseptansekriterier

1. **A1 — riktig gren:** For en åpen PR med forfatter Dependabot logger workflowen
   `PR #N (dependabot): commenting @dependabot rebase` og poster kommentaren. Den kaller
   *ikke* `update-branch`.
2. **A2 — andre PR-er uendret:** For en åpen PR med menneskelig forfatter (f.eks.
   `review/*`-PR-ene fra `auto-pr.yml`) kalles `update-branch` som før.
3. **A3 — robust mot begge login-former:** Både `app/dependabot` (slik `gh --json author`
   har rapportert boter siden gh 2.0) og `dependabot[bot]` (REST-API-ets `user.login` og
   `github.actor`) gjenkjennes, så en framtidig `gh`-endring på runneren ikke
   gjeninnfører feilen stille.
4. **A4 — signatur overlever:** Etter neste Dependabot-rebase på main viser
   `gh api repos/…/commits/<sha>` `verification.verified == true` med Dependabot som
   committer. (Verifiseres etter merge — se «Verifisering etter merge».)

### Avgrensninger / non-goals

- **Ikke** noe sikkerhetsnett i `dependabot-auto-merge.yml` for tilfellet der
  `fetch-metadata` nekter (f.eks. automatisk `@dependabot recreate`). Etter fiksen er
  det tilfellet ikke lenger nåbart i normal flyt: en Dependabot-rebase gir en signert
  commit. Skjer det likevel, er det et signal om noe *annet* som er galt, og manuell
  merge er riktig respons — ikke en automatikk som skjuler det.
- **Ikke** å erstatte PAT-en med en GitHub App. Det er Sikkerhetshardening Task 3. Denne
  fiksen reduserer bare *hva* PAT-en skriver om (ikke lenger Dependabot-commits).
- **Ikke** å trekke workflowen ut i en composite action eller endre `else`-grenen.
- **Ikke** å hoppe over kommentaren når PR-en allerede er à jour (se «Risiki»).

### Designvalg

**Match på begge login-formene, ikke på `is_bot` alene.** `is_bot == true` ville også
sende `@dependabot rebase` til PR-er fra andre boter (skulle noen dukke opp), der
kommentaren er meningsløs. En eksplisitt `case` på `dependabot[bot]` og `app/dependabot`
sier nøyaktig hva vi mener, og A3 dekkes:

```bash
case "$author" in
  "dependabot[bot]"|"app/dependabot")
    echo "PR #$number (dependabot): commenting @dependabot rebase"
    gh pr comment "$number" --body "@dependabot rebase" || \
      echo "  Skipped (comment failed)"
    ;;
  *)
    echo "PR #$number: updating branch via API"
    …
    ;;
esac
```

Alternativet — gå tilbake til `gh pr list --author 'dependabot[bot]'` som i den
opprinnelige versjonen — ville krevd to `gh pr list`-kall (ett for Dependabot, ett for
resten) og et «ikke i første liste»-filter. Én liste med `case` er enklere å lese.

---

## Plan

### Steg

1. **`.github/workflows/dependabot-rebase.yml`** — bytt `if [ "$author" = … ]` / `else`
   / `fi` med `case`-blokken over. Ingen andre linjer endres. Legg en kort kommentar over
   `case` om *hvorfor* det er to former (`gh` rapporterer boter som `app/<navn>`), så
   neste leser ikke «rydder» det bort. Dependabot-grenen får samme `|| echo "Skipped …"`
   som `update-branch`-grenen: `run:` kjører som `bash -e`, og `while`-løkken står i en
   pipeline-subshell der `errexit` gjelder — én feilende `gh pr comment` (rate limit,
   transient API-feil) ville ellers avbrutt løkken og hoppet over resten av PR-ene. Med
   `strict: true` blir en hoppet-over PR stående umergbar.
2. **Lokal verifisering** (før commit) — kjør løkke-kroppen mot ekte PR-data med
   sideeffektene byttet ut med `echo`:
   ```bash
   gh pr list --state all --limit 6 --json number,author --jq '.[]' | jq -c . | while read -r pr; do
     number=$(echo "$pr" | jq -r '.number'); author=$(echo "$pr" | jq -r '.author.login')
     case "$author" in
       "dependabot[bot]"|"app/dependabot") echo "PR #$number (dependabot): WOULD comment";;
       *) echo "PR #$number ($author): WOULD update-branch";;
     esac
   done
   ```
   Forventet: #472, #471, #470, #469 → «WOULD comment»; #473, #468 → «WOULD update-branch».
3. **YAML-syntaks** — `node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/dependabot-rebase.yml','utf8'))"`
   (repoet har ingen actionlint; `js-yaml` er allerede en avhengighet).
4. **Bash-syntaks** — trekk `run:`-blokken ut og kjør `bash -n` på den.
5. `review-loop` → arkiver oppgaven (Fase 5) → `/commit` med push.

### Testbehov / definition of done

Workflowen har ingen enhetstester, og det lages ingen — steg 2–4 er verifiseringen.
Kvalitetsporten i `/commit` kjøres likevel som vanlig (workflow-endringer er ikke
«rene docs»).

Ferdig når:
- Steg 2 gir forventet klassifisering på ekte data
- Steg 3 og 4 er grønne
- `review-loop` er ren og oppgaven er arkivert
- PR-en er merget

### Verifisering etter merge (manuell oppfølging, kan ikke forseres)

Neste gang en Dependabot-PR er åpen mens main får en push:

- **V1:** `Auto-Rebase Open PRs`-loggen viser `PR #N (dependabot): commenting …`, ikke
  `updating branch via API`.
- **V2:** Dependabot rebaser (👍-reaksjon på kommentaren, ny commit på PR-branchen).
- **V3:** `gh api repos/ahaarrestad/tennerogtrivsel_new/commits/<head-sha> --jq .commit.verification`
  gir `verified: true`, committer `GitHub <noreply@github.com>` / forfatter `dependabot[bot]`.
- **V4:** `Dependabot Auto-Merge` er `success` også på `synchronize`-hendelsen som følger
  rebasen, og PR-en merges uten inngripen.

Første anledning er trolig neste ukentlige Dependabot-runde. Noteres i arkivposten.

### Risiki

- **Kommentar-støy.** `@dependabot rebase` postes ved *hver* push til main per åpen
  Dependabot-PR, også når PR-en allerede er à jour — Dependabot svarer da med en «already
  up-to-date»-kommentar. Før fiksen var dette stille (API-kall). Akseptert: det er
  designet fra `50fe12c` som nå faktisk trer i kraft, og volumet er lavt (få åpne bot-PR-er
  om gangen). Å filtrere på `mergeStateStatus == BEHIND` ble vurdert og forkastet:
  rett etter en push rapporterer GitHub gjerne `UNKNOWN`, og en hoppet-over PR blir
  stående bak main og *kan ikke merges* (strict). Feil vei å feile.
- **`rebase-strategy: auto` i `dependabot.yml`.** Dependabot kan i noen tilfeller rebase
  på egen hånd. Den eksplisitte kommentaren er uansett harmløs og deterministisk — den
  gjør at vi ikke er avhengige av Dependabots interne heuristikk.
- **Dobbel auto-merge-kjøring.** Etter Dependabots force-push kommer en ny
  `synchronize`-hendelse med `actor = dependabot[bot]`, og `dependabot-auto-merge.yml`
  kjører `gh pr review --approve` + `gh pr merge --auto` på nytt. Begge er idempotente.
