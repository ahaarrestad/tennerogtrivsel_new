---
name: commit
model: sonnet
description: "Use when the user says 'commit', 'committ', 'lagre endringer', 'push', 'send til review', or asks to save/commit their work."
disable-model-invocation: false
allowed-tools: ["Bash(git *)", "Bash(cat *)", "Bash(source *)", "Bash(npm test*)", "Bash(npm run test*)", "Bash(npm run build*)", "Bash(node --input-type=commonjs*)", "Bash(npx playwright*)", "Bash(npm audit*)", "Bash(lsof *)", "Bash(kill *)", "Bash(curl *)", "Bash(sleep *)", "Agent", "ExitWorktree"]
---

# Commit Skill

## Step 1: Understand the Changes

Run in parallel:

```bash
git status
git diff --staged
git diff
git log --oneline -5
```

## Step 2: Generate Commit Message

Write a conventional commit message in Norwegian:
- Format: `type: kort beskrivelse` — types: `feat` `fix` `chore` `test` `docs` `refactor` `a11y`
- One short line on the "why"; use `—` for multi-concern: `fix: småfiks — typo, typesikkerhet m.m.`

Present message and ask for confirmation before proceeding.

## Step 2.5: Quality Gate (Required Before Commit)

**MANDATORY — do not skip, do not shorten.** Run all commands with `dangerouslyDisableSandbox: true`.

Run in sequence, stopping immediately on failure:

```bash
# 1. Unit tests + coverage
npm test 2>&1
```

If any unit test fails → **STOP**. Do not stage or commit. Report failures.

```bash
# 2. Per-file branch coverage (must be ≥ 80% per file)
node --input-type=commonjs -e "
var data = JSON.parse(require('fs').readFileSync('coverage/coverage-final.json','utf8'));
var cwd = process.cwd() + '/';
var results = [];
for (var fp in data) {
  var fd = data[fp], total = 0, covered = 0;
  for (var k in (fd.b || {})) {
    var arr = fd.b[k];
    for (var i = 0; i < arr.length; i++) { total++; if (arr[i] > 0) covered++; }
  }
  var pct = total === 0 ? 100 : (covered / total * 100);
  results.push({ file: fp.replace(cwd, ''), pct: pct, covered: covered, total: total });
}
results.sort(function(a,b) { return a.pct - b.pct; });
var fail = false;
for (var i = 0; i < results.length; i++) {
  var r = results[i];
  var s = r.pct < 80 ? 'FAIL' : r.pct < 90 ? 'OK  ' : 'GOOD';
  if (r.pct < 80) fail = true;
  console.log(s + ' | ' + r.pct.toFixed(1).padStart(5) + '% | ' + (r.covered+'/'+r.total).padStart(7) + ' | ' + r.file);
}
process.exit(fail ? 1 : 0);
"
```

If any file is below 80% → **STOP**. Write tests before committing.

```bash
# 3. E2E tests — krever dev:secure med korrekte CSP-hashes.
# Boot-/gjenbruk-logikken ligger i delt script (jf. Step 5).
source "$(git rev-parse --show-toplevel)/.claude/skills/_shared/start-secure-server.sh"
ensure_secure_server || exit 1
PORT=${PORT:-4321} npm run test:e2e 2>&1
E2E_EXIT=$?
stop_secure_server
[ $E2E_EXIT -ne 0 ] && exit $E2E_EXIT
```

If any E2E test fails → **STOP**. Do not commit.

```bash
# 4. Build
npm run build:ci 2>&1
```

If build fails → **STOP**.

```bash
# 5. Security audit
npm audit --audit-level=critical 2>&1
```

If critical vulnerabilities found → **STOP**.

Only proceed to Step 3 when **all five checks pass**.

## Step 3: Stage Files

Stage only files relevant to this task. Unstage unrelated files first (`git restore --staged <file>`).

Never stage: `.env*`, credentials, `node_modules/`, `coverage/`.

Use `git add <specific-file>` — never `git add -A` or `git add .`.

## Step 4: Create the Commit

```bash
git commit -m "$(cat <<'EOF'
type: beskrivelse

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

## Step 4.5: Code Review Before Push

**Skip if push was NOT requested.**

This step loops until the review is clean, **max 3 iterations**. Track iteration count starting at 1.

```bash
BASE_SHA=$(git merge-base HEAD origin/main 2>/dev/null || git rev-parse HEAD~1)
HEAD_SHA=$(git rev-parse HEAD)
```

Dispatch a `general-purpose` Agent med den delte reviewer-prompten i
[`../_shared/reviewer-prompt.md`](../_shared/reviewer-prompt.md). Fyll inn
`{WHAT_WAS_IMPLEMENTED}` (commit-meldingen), `{BASE_SHA}` og `{HEAD_SHA}`.

**After review:**
- **No Critical/Important:** Proceed to push.
- **Only Minor:** Show issues, ask user whether to push anyway.
- **Critical or Important found:** Fix all issues, commit the fixes, then update `HEAD_SHA=$(git rev-parse HEAD)` — **keep BASE_SHA unchanged from the start of Step 4.5** — and re-run review. Increment iteration count. If iteration count reaches 3 without a clean review, stop — present remaining issues and ask the user to resolve them manually before retrying.

## Step 5: Push / «Ship it» (Only If Requested)

### 5a. Re-run tests

**Before pushing, re-run tests** — code review fixes may have changed code since Step 2.5.
Run with `dangerouslyDisableSandbox: true`. Bruker delt boot-script (samme som Step 2.5).

```bash
source "$(git rev-parse --show-toplevel)/.claude/skills/_shared/start-secure-server.sh"
ensure_secure_server || exit 1
npm test 2>&1
UNIT_EXIT=$?
PORT=${PORT:-4321} npm run test:e2e 2>&1
E2E_EXIT=$?
stop_secure_server
[ $UNIT_EXIT -ne 0 ] && exit $UNIT_EXIT
[ $E2E_EXIT -ne 0 ] && exit $E2E_EXIT
```

If any test fails → **STOP**. Do not push. Fix and commit before retrying.

### 5b. Brukergodkjenning før push

Spør eksplisitt: **«Vil du at jeg pusher?»** og VENT på svar. Ikke anta stilltiende
samtykke — selv om brukeren sa «push» i utgangspunktet, kjøres review (Step 4.5) først,
funn presenteres, og brukeren godkjenner push eksplisitt etterpå.

### 5c. «Ship it»-sekvens

Når push er godkjent. Forutsetning: arbeidet er gjort i en worktree (jf. `/todo`-flyten).
Modellen er **merge til lokal main, kjør `git-review` derfra** — gir lineær historikk og
clean tree.

> **Hvorfor dette er trygt:** `auto-pr.yml` auto-merger PR-en med `gh pr merge --auto
> --rebase` (ikke squash). Når `origin/main` ikke har beveget seg, blir rebase en
> fast-forward som bevarer commits; om den har beveget seg, selv-heler `git pull --rebase`
> i synk-steget (start av neste `/todo`-oppgave) ev. divergens via patch-id.

> **Rekkefølgen er kritisk:** merge til main MÅ skje *før* worktreet fjernes. `ExitWorktree
> (action: remove)` **nekter** å fjerne et worktree som har commits som ikke ligger på
> opphavsbranchen (main) — og det er nettopp tilstanden inntil `merge --ff-only` er kjørt.
> `ExitWorktree` er dessuten **no-op** hvis worktreet ble laget med `git worktree add` eller
> i en tidligere sesjon — derfor `git worktree remove` som fallback.

Fang stier og branch-navn først (kjøres i worktreet):
```bash
PRIMARY=$(git rev-parse --git-common-dir); PRIMARY=${PRIMARY%/.git}   # primær-treets rot
WT=$(git rev-parse --show-toplevel)                                   # worktreets sti
BRANCH=$(git branch --show-current)
```

1. **Rebase feature-branchen på LOKAL main** (i worktreet — fanger opp commits som ligger
   på lokal main men ikke er pushet ennå; dette er det autoritative siste synk-punktet):
   ```bash
   git rebase main
   ```
   Forvent mulig konflikt der både main-commit og worktree-commit rører samme fil (typisk
   `TODO.md`) — løs manuelt, så `git rebase --continue`.
2. **Fast-forward lokal main til branchen** — fra primær-treet (`main` er utsjekket der;
   `--ff-only` lykkes fordi rebasen i steg 1 gjorde main til stamfar). **Før** opprydding,
   så branchens commits ligger på main og `ExitWorktree`/`worktree remove` ikke nekter:
   ```bash
   git -C "$PRIMARY" merge --ff-only "$BRANCH"
   ```
   Hvis `--ff-only` feiler: main har beveget seg siden rebasen — kjør `git rebase main` på
   nytt i worktreet og prøv igjen. Aldri en ekte merge-commit her.
3. **Send til review.** `git-review` pusher `origin/main..HEAD` til en `review/<slug>`-branch
   og lager PR-en — den pusher **ikke** `main` selv (origin/main oppdateres når PR-en
   auto-merges). Kan kjøres fra worktreet (HEAD == main-tipp nå). **NEVER use `git push`:**
   ```bash
   git review
   ```
4. **Rydd opp worktreet** (commits ligger nå på main, så fjerning er trygg):
   - Opprettet denne sesjonen worktreet via `EnterWorktree`? Kall verktøyet `ExitWorktree`
     (action: `remove`) — det sletter worktree-katalog og branch og setter cwd tilbake til
     primær-treet.
   - Ellers (`git worktree add` eller tidligere sesjon → `ExitWorktree` er no-op):
     ```bash
     git -C "$PRIMARY" worktree remove "$WT" && git -C "$PRIMARY" branch -d "$BRANCH"
     ```

## Step 6: Report

One-line summary: commit message, files changed, pushed or not.
