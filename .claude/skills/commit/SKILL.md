---
name: commit
description: "Use when the user says 'commit', 'committ', 'lagre endringer', 'push', 'send til review', or asks to save/commit their work."
disable-model-invocation: false
allowed-tools: ["Bash(git *)", "Bash(cat *)", "Bash(npm test*)", "Bash(npm run *)", "Bash(bash scripts/setup-worktree.sh)", "Bash(bash .claude/skills/_shared/run-e2e.sh*)", "Bash(npx playwright*)", "Bash(npm audit*)", "Bash(lsof *)", "Bash(kill *)", "Bash(curl *)", "Bash(sleep *)", "Skill(quality-gate)", "Agent", "ExitWorktree", "EnterWorktree"]
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

Kjørte porten fullt (ikke hoppet over) og `git status --porcelain` er tom etter commit — også
uten usporede filer, ellers kan porten ha testet en ny fil som ikke ble committet — marker at
denne tilstanden er testet:

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

Kjør som **enkle, separate kommandoer** og bruk de utskrevne SHA-ene literalt videre. Shell-state
lever ikke mellom Bash-kall, og worktree-isolerte økter nekter git inni `$(...)`.

```bash
git merge-base HEAD origin/main                 # → <MERGE_BASE>
git rev-parse HEAD                              # → <HEAD_SHA>
git rev-parse -q --verify refs/worktree/reviewed   # → <REVIEWED> (tom = ingen markør)
```

Finnes `<REVIEWED>`, sjekk at den ligger mellom merge-basen og HEAD (begge skal gi `0`):

```bash
git merge-base --is-ancestor <MERGE_BASE> <REVIEWED>; echo $?
git merge-base --is-ancestor <REVIEWED> <HEAD_SHA>; echo $?
```

`<BASE_SHA>` = `<REVIEWED>` hvis begge ga `0` (kun commits etter siste rene review), ellers
`<MERGE_BASE>` (ingen gyldig markør, f.eks. etter rebase → hele rangen). Vis rangen og kontroller
at den er nøyaktig de commitene du forventer:

```bash
git log --oneline <BASE_SHA>..<HEAD_SHA>
```

- **Tom range** (alt allerede reviewet) → hopp rett til Step 5.
- **Kun dokumentasjon** — avgjøres mekanisk etter definisjonen i `/quality-gate` («Hva regnes
  som dokumentasjon»), ikke ut fra commit-type: sjekk hver sti i
  `git diff --name-only <BASE_SHA>..<HEAD_SHA>`. Kun docs → les diffen selv, ingen
  reviewer-agent; er den ren, sett `git update-ref refs/worktree/reviewed <HEAD_SHA>` (ellers
  feiler den harde sjekken i 5c). Én annen sti → agent.
- **Ellers:** dispatch en `general-purpose` Agent med den delte prompten i
  [`../_shared/reviewer-prompt.md`](../_shared/reviewer-prompt.md). Fyll inn
  `{WHAT_WAS_IMPLEMENTED}` (commit-meldingen), `{BASE_SHA}` og `{HEAD_SHA}`.

Etter review:
- **Ingen Critical/Important:** `git update-ref refs/worktree/reviewed <HEAD_SHA>` og gå videre.
  Minor-funn vises i push-spørsmålet i 5b.
- **Critical/Important:** fiks, commit, les ny `<HEAD_SHA>` med `git rev-parse HEAD` — behold
  `<BASE_SHA>` — og review på nytt. Maks 3 runder; deretter presenter gjenstående funn og spør brukeren.

## Step 5: Push / «ship it» (kun hvis bedt om)

### 5a. Tester på nytt — kun ved endring

```bash
git rev-parse -q --verify refs/worktree/gated && git diff --name-only refs/worktree/gated..HEAD
git merge-base --is-ancestor refs/worktree/gated HEAD; echo $?
git status --porcelain
```

- Refen finnes, er stamfar til HEAD (`0`), diffen er tom eller kun dokumentasjon (definisjon i
  `/quality-gate`), og `git status --porcelain` er tom → forrige grønne port gjelder; si det i
  rapporten.
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

Worktree-isolerte økter nekter `git -C <primær-tre>` og git inni `$(...)`. Derfor: skriv ut
verdiene først, og bytt til primær-treet med `ExitWorktree (action: keep)` før main røres.

```bash
git branch --show-current     # → <BRANCH>
git rev-parse --show-toplevel # → <WT>
```

Committer du direkte på main (ingen worktree): kjør bare steg 2 og 4.

1. **Rebase på lokal main** (i worktreet — fanger upushede main-commits):
   `git rebase main` — forvent ev. konflikt i `TODO.md`; løs og `git rebase --continue`.
2. **Hard sjekk** (i treet der reviewen ble gjort — refen er per worktree). To separate kall,
   sammenlign de literale verdiene:
   ```bash
   git rev-parse refs/worktree/reviewed   # → <REVIEWED_SHA>
   git rev-parse HEAD
   ```
   Er de ulike, har rebasen endret SHA-er, dratt inn upushede main-commits (eller en
   konfliktløsning), eller det har kommet commits etter reviewen — kode verken reviewer eller
   bruker har sett. Gå tilbake til 5a → 4.5 (ancestor-sjekken tvinger da full range) → 5b ny
   godkjenning. Aldri `git review` uten like verdier.
3. **Fast-forward lokal main.** Kall `ExitWorktree` (action: `keep`). Verktøyet er no-op for
   worktrees som ikke ble entret med `EnterWorktree` i denne sesjonen — verifiser derfor, som
   separate kall, før merge:
   ```bash
   git rev-parse --show-toplevel   # skal være ulik <WT>
   git branch --show-current       # skal være main (avgjørende: main kan bare være utsjekket ett sted)
   git status --porcelain          # skal være tom
   ```
   Feiler én av dem — typisk fordi økten ble startet med `claude -w` og `ExitWorktree` er no-op —
   stopp og gi brukeren kommandoene å kjøre i primær-treet: `git merge --ff-only <BRANCH>`,
   `git rev-parse HEAD` (skal være `<REVIEWED_SHA>`), `git review`. Ellers `git merge --ff-only <BRANCH>`, og deretter
   `git rev-parse HEAD` — skal være `<REVIEWED_SHA>`. Feiler merge, har main beveget seg:
   `EnterWorktree (path: <WT>)` og start på nytt fra steg 1. Aldri en ekte merge-commit.
4. **Send til review** (HEAD == `<REVIEWED_SHA>`): `git review` (pusher `origin/main..HEAD` til
   `review/<slug>` og lager PR). **Aldri `git push`** — blokkeres uansett av `git-guard.sh`.
5. **Rydd opp worktreet** (commits ligger nå på main, så fjerning er trygg). Bruk aldri
   `--force`, så fjerning fortsatt nektes ved ucommittede filer:
   `git worktree remove <WT>`, deretter `git branch -d <BRANCH>`.
   Nekter `remove` fordi worktreet er låst (`ExitWorktree` frigjør normalt låsen selv): sjekk med
   `git worktree list --porcelain` at låsen ikke tilhører en annen aktiv økt, så
   `git worktree unlock <WT>` og `remove` på nytt.

### 5d. Etter merge

Følg opp selv: poll `gh pr view` til PR-en er merget, synk lokal main, og kjør eventuelle
etter-merge-steg (workflow-kjøringer, verifisering) uten å gi brukeren en huskeliste.

## Step 6: Rapport

Én kort oppsummering: commit-melding(er), filer, porten (kjørt/hoppet over + hvorfor),
review-resultat, pushet eller ikke, PR-lenke.
