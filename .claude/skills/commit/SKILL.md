---
name: commit
description: "Use when the user says 'commit', 'committ', 'lagre endringer', 'push', 'send til review', or asks to save/commit their work."
disable-model-invocation: false
allowed-tools: ["Bash(git *)", "Bash(cat *)", "Bash(npm test*)", "Bash(npm run *)", "Bash(bash scripts/setup-worktree.sh)", "Bash(bash .claude/skills/_shared/run-e2e.sh*)", "Bash(npx playwright*)", "Bash(npm audit*)", "Bash(lsof *)", "Bash(kill *)", "Bash(curl *)", "Bash(sleep *)", "Skill(quality-gate)", "Agent", "ExitWorktree"]
---

# Commit Skill

Eier all git-mekanikk: kvalitetsport → commit → review → (ved godkjent push) «ship it».
Kjør gjennom uten å be om bekreftelse underveis — eneste obligatoriske stopp er push-godkjenningen i Step 5b.

## Step 1: Forstå endringene

Kjør parallelt: `git status`, `git diff --staged`, `git diff`, `git log --oneline -5`.

## Step 2: Commit-melding

Konvensjonell melding på norsk:
- Format: `type: kort beskrivelse` — typer: `feat` `fix` `chore` `test` `docs` `refactor` `a11y`
- Én kort linje om «hvorfor»; bruk `—` ved flere tema: `fix: småfiks — typo, typesikkerhet m.m.`

Ikke spør om bekreftelse på meldingen — vis den i sluttrapporten.

## Step 3: Kvalitetsport

Kjør `/quality-gate`. Den avgjør selv om porten gjelder (docs-only → hopp over med begrunnelse)
og rapporterer HEAD-SHA-en den kjørte mot. Feiler porten → stopp, ikke stage eller commit.

## Step 4: Stage og commit

Stage kun filer som hører til oppgaven, med `git add <fil>` — aldri `git add -A`/`git add .`.
Aldri stage `.env*`, credentials, `node_modules/`, `coverage/`.

```bash
git commit -m "$(cat <<'EOF'
type: beskrivelse

<attribusjonslinjene harnessen oppgir for denne økten>
EOF
)"
```

Kjørte porten fullt (ikke hoppet over) og `git status --porcelain --untracked-files=no` er tom
etter commit, marker at denne tilstanden er testet:

```bash
git update-ref refs/worktree/gated HEAD
```

`/quality-gate` bruker refen til å avgjøre hva som er endret siden sist porten var grønn.

## Step 4.4: Synk med origin (før review og push)

**Hopp over hvis push ikke er bedt om.**

Kjør alltid `git fetch` her, også om det ble synket ved oppgavestart. `BASE_SHA` i Step 4.5
regnes mot `origin/main`; er refen utdatert, blir review-rangen stille feil — reviewen
rapporterer «ren» på feil commits.

```bash
git fetch origin
git rev-list --count HEAD..origin/main   # bak oss
git rev-list --count origin/main..HEAD   # foran — våre upushede commits
```

- **Bak oss > 0:** `git pull --rebase origin main`, løs konflikter, og kjør `/quality-gate` på
  nytt — nye commits fra origin kan bryte koden vår.
- **Foran > forventet:** sammenlign `git log --oneline origin/main..HEAD` med
  `git log --oneline -5 origin/main`. Samme melding på begge sider = duplikat fra auto-merge-rebase
  (ny SHA i `auto-pr.yml`). `git pull --rebase` fjerner den normalt via patch-id; gjør den ikke
  det, stopp og spør brukeren.

## Step 4.5: Code review før push

**Hopp over hvis push ikke er bedt om.** Forutsetter Step 4.4.

Invariant: **hver commit som pushes er reviewet** — også fix-commits. Men en commit reviewes
bare én gang: `review-loop` (og denne stegen) setter per-worktree-refen `refs/worktree/reviewed`
ved ren review, og vi reviewer kun det som har kommet etter.

```bash
MERGE_BASE=$(git merge-base HEAD origin/main)
REVIEWED=$(git rev-parse -q --verify refs/worktree/reviewed)
if [ -n "$REVIEWED" ] && git merge-base --is-ancestor "$MERGE_BASE" "$REVIEWED" \
   && git merge-base --is-ancestor "$REVIEWED" HEAD; then
  BASE_SHA=$REVIEWED          # kun commits etter siste rene review
else
  BASE_SHA=$MERGE_BASE        # ingen gyldig markør (f.eks. etter rebase) → hele rangen
fi
HEAD_SHA=$(git rev-parse HEAD)
git log --oneline $BASE_SHA..$HEAD_SHA
```

Shell-state lever ikke mellom Bash-kall — bruk de **literale SHA-ene** som ble skrevet ut her i
senere steg (aldri `HEAD` i stedet for `HEAD_SHA`). Kontroller at lista er nøyaktig de commitene
du forventer.

- **Tom range** (alt allerede reviewet) → hopp rett til Step 5.
- **Kun dokumentasjon** — avgjøres mekanisk, ikke ut fra commit-type: hver sti i
  `git diff --name-only <BASE_SHA>..<HEAD_SHA>` er `*.md` under `docs/`, `TODO*.md` eller
  `.claude/**/*.md` → les diffen selv; ingen reviewer-agent. Én annen sti → agent.
- **Ellers:** dispatch en `general-purpose` Agent med den delte prompten i
  [`../_shared/reviewer-prompt.md`](../_shared/reviewer-prompt.md). Fyll inn
  `{WHAT_WAS_IMPLEMENTED}` (commit-meldingen), `{BASE_SHA}` og `{HEAD_SHA}`.

Etter review:
- **Ingen Critical/Important:** `git update-ref refs/worktree/reviewed <HEAD_SHA>` og gå videre.
  Minor-funn vises i push-spørsmålet i 5b.
- **Critical/Important:** fiks, commit, sett `HEAD_SHA=$(git rev-parse HEAD)` — behold `BASE_SHA`
  — og review på nytt. Maks 3 runder; deretter presenter gjenstående funn og spør brukeren.

## Step 5: Push / «ship it» (kun hvis bedt om)

### 5a. Tester på nytt — kun ved endring

```bash
git rev-parse -q --verify refs/worktree/gated && git diff --name-only refs/worktree/gated..HEAD
```

- Refen finnes, er stamfar til HEAD (`git merge-base --is-ancestor refs/worktree/gated HEAD`),
  og diffen er tom eller kun dokumentasjon → forrige grønne port gjelder; si det i rapporten.
- Ellers (review-fikser, fix-commits fra `review-loop`, rebase i 4.4, manglende ref) → kjør
  `/quality-gate` på nytt og sett `refs/worktree/gated` til HEAD når den er grønn.

### 5b. Brukergodkjenning før push

Spør eksplisitt: **«Vil du at jeg pusher?»** og vent på svar. Selv om brukeren sa «push» i
utgangspunktet: review (4.5) kjøres først, funn presenteres, og brukeren godkjenner push
eksplisitt etterpå.

### 5c. «Ship it»-sekvens

Når push er godkjent. Modellen er **merge til lokal main, kjør `git review` derfra** — lineær
historikk og rent tre. `auto-pr.yml` auto-merger PR-en med `gh pr merge --auto --rebase`; når
`origin/main` ikke har beveget seg blir det en fast-forward, ellers selv-heler
`git pull --rebase` divergensen via patch-id.

**Rekkefølgen er kritisk:** merge til main MÅ skje før worktreet fjernes. `ExitWorktree
(action: remove)` nekter å fjerne et worktree med commits som ikke ligger på main, og er no-op
for worktrees laget med `git worktree add` eller i en tidligere sesjon.

Fang stier og branch-navn (i worktreet):
```bash
PRIMARY=$(git rev-parse --git-common-dir); PRIMARY=${PRIMARY%/.git}
WT=$(git rev-parse --show-toplevel)
BRANCH=$(git branch --show-current)
```

1. **Rebase på lokal main** (fanger upushede main-commits):
   `git rebase main` — forvent ev. konflikt i `TODO.md`; løs og `git rebase --continue`.
   **Hard sjekk før du går videre:**
   ```bash
   [ "$(git rev-parse refs/worktree/reviewed)" = "$(git rev-parse HEAD)" ] && echo REVIEWED_OK
   ```
   Uten `REVIEWED_OK` har rebasen endret SHA-er eller dratt inn upushede main-commits (eller en
   konfliktløsning) som verken reviewer eller bruker har sett. Gå tilbake til 5a → 4.5 (ancestor-
   sjekken tvinger da full range) → 5b ny godkjenning. Aldri `git review` uten `REVIEWED_OK`.
2. **Fast-forward lokal main** fra primær-treet:
   `git -C "$PRIMARY" merge --ff-only "$BRANCH"` — feiler den, har main beveget seg: rebase på
   nytt og prøv igjen. Aldri en ekte merge-commit.
3. **Send til review:** `git review` (pusher `origin/main..HEAD` til `review/<slug>` og lager
   PR). **Aldri `git push`** — blokkeres uansett av `git-guard.sh`.
4. **Rydd opp worktreet:**
   - Laget via `EnterWorktree` i denne sesjonen → `ExitWorktree` (action: `remove`).
   - Ellers: `git -C "$PRIMARY" worktree remove "$WT" && git -C "$PRIMARY" branch -d "$BRANCH"`

### 5d. Etter merge

Følg opp selv: poll `gh pr view` til PR-en er merget, synk lokal main, og kjør eventuelle
etter-merge-steg (workflow-kjøringer, verifisering) uten å gi brukeren en huskeliste.

## Step 6: Rapport

Én kort oppsummering: commit-melding(er), filer, porten (kjørt/hoppet over + hvorfor),
review-resultat, pushet eller ikke, PR-lenke.
