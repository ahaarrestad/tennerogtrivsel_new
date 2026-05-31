---
name: commit
model: sonnet
description: "Use when the user says 'commit', 'committ', 'lagre endringer', 'push', 'send til review', or asks to save/commit their work."
disable-model-invocation: false
allowed-tools: ["Bash(git *)", "Bash(cat *)", "Bash(npm test*)", "Bash(npm run test*)", "Bash(npm run build*)", "Bash(node --input-type=commonjs*)", "Bash(npx playwright*)", "Bash(npm audit*)", "Bash(lsof *)", "Bash(kill *)", "Bash(curl *)", "Bash(sleep *)", "Agent"]
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
# 3. E2E tests — KREVER dev:secure-server med korrekte CSP-hashes
# En gammel server (npm run dev) gir CSP-feil fordi Vite injiserer inline scripts
# som ikke er whitelistet. dev:secure bygger prod, genererer hashes, starter Vite.
lsof -ti:4321 | xargs kill -9 2>/dev/null; sleep 1
npm run dev:secure > /tmp/dev-secure.log 2>&1 &
for i in $(seq 1 45); do
  sleep 2
  curl -s http://localhost:4321/admin -o /dev/null -w "%{http_code}" 2>/dev/null | grep -q "200\|301\|302" && break
done
curl -sf http://localhost:4321/admin -o /dev/null || { echo "dev:secure failed to start"; exit 1; }
npm run test:e2e 2>&1
E2E_EXIT=$?
lsof -ti:4321 | xargs kill -9 2>/dev/null || true
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

Dispatch a `general-purpose` Agent with this prompt (fill placeholders):

> You are a Senior Code Reviewer.
>
> ## What Was Implemented
> {COMMIT_MESSAGE}
>
> ## Project-Specific Rules (violations = Critical)
> Read CLAUDE.md. Extra checks:
> - **CSS tokens:** Only variables from `src/styles/global.css` — no hardcoded hex or Tailwind color classes
> - **Sheets API:** Numeric `sheets.values.get` calls MUST use `valueRenderOption: 'UNFORMATTED_VALUE'`
> - **Architecture:** Changes to images/messages/section-backgrounds/security must follow `docs/architecture/`
> - **Security:** No XSS, injection, exposed secrets, or unsafe innerHTML without DOMPurify
>
> ## Git Range
> ```bash
> git diff --stat {BASE_SHA}..{HEAD_SHA}
> git diff {BASE_SHA}..{HEAD_SHA}
> ```
>
> ## Output
> ### Strengths
> ### Issues
> #### Critical (Must Fix)
> #### Important (Should Fix)
> #### Minor (Nice to Have)
> Each issue: file:line — what's wrong — why it matters — how to fix.
> ### Assessment
> **Ready to merge?** Yes / No / With fixes — [1-2 sentence reasoning]

**After review:**
- **No Critical/Important:** Proceed to push.
- **Only Minor:** Show issues, ask user whether to push anyway.
- **Critical or Important found:** Fix all issues, commit the fixes, then update `HEAD_SHA=$(git rev-parse HEAD)` — **keep BASE_SHA unchanged from the start of Step 4.5** — and re-run review. Increment iteration count. If iteration count reaches 3 without a clean review, stop — present remaining issues and ask the user to resolve them manually before retrying.

## Step 5: Push (Only If Requested)

**Before pushing, re-run tests** — code review fixes may have changed code since Step 2.5.
Run with `dangerouslyDisableSandbox: true`. Restart dev:secure (may have been cleaned up after Step 2.5):

```bash
lsof -ti:4321 | xargs kill -9 2>/dev/null; sleep 1
npm run dev:secure > /tmp/dev-secure.log 2>&1 &
for i in $(seq 1 45); do
  sleep 2
  curl -s http://localhost:4321/admin -o /dev/null -w "%{http_code}" 2>/dev/null | grep -q "200\|301\|302" && break
done
curl -sf http://localhost:4321/admin -o /dev/null || { echo "dev:secure failed to start"; exit 1; }
npm test 2>&1
npm run test:e2e 2>&1
E2E_EXIT=$?
lsof -ti:4321 | xargs kill -9 2>/dev/null || true
[ $E2E_EXIT -ne 0 ] && exit $E2E_EXIT
```

If any test fails → **STOP**. Do not push. Fix and commit before retrying.

**NEVER use `git push`.** Always:

```bash
git review
```

## Step 6: Report

One-line summary: commit message, files changed, pushed or not.
