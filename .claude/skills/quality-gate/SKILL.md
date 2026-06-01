---
name: quality-gate
description: "Use when completing a task, before committing, or when asked to verify quality. Trigger on: 'quality gate', 'kjør kvalitetssjekk', 'run checks', 'er alt klart', 'verify tests', 'coverage', 'dekningsgrad', 'show coverage', 'sjekk coverage', 'branch coverage'."
disable-model-invocation: false
allowed-tools: ["Bash(npm test*)", "Bash(npm run test*)", "Bash(npm run build*)", "Bash(node --input-type=commonjs*)", "Bash(npx playwright*)", "Bash(npm audit*)"]
---

# Quality Gate

Run all quality checks sequentially. Stop early if any step fails.

IMPORTANT: All Bash commands in this skill MUST run with `dangerouslyDisableSandbox: true` because Vitest and Playwright need to write to temp directories, coverage output, and browser caches that the sandbox blocks.

## Step 0: Worktree-forberedelse

Sjekk om vi er i en worktree. Hvis ja, kopier manglende gitignorerte filer fra main automatisk — ellers feiler build og E2E.

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
if [ "$GIT_DIR" != "$GIT_COMMON" ]; then
  MAIN=$(git rev-parse --git-common-dir); MAIN=${MAIN%/.git}
  for f in galleri.json innstillinger.json prisliste.json tannleger.json kontaktskjema.json; do
    [ ! -f "src/content/$f" ] && [ -f "$MAIN/src/content/$f" ] && cp "$MAIN/src/content/$f" "src/content/$f" && echo "Kopierte $f"
  done
  cp -rn "$MAIN/src/assets/galleri/." src/assets/galleri/ 2>/dev/null || true
  [ ! -f src/assets/hovedbilde.png ] && [ -f "$MAIN/src/assets/hovedbilde.png" ] && cp "$MAIN/src/assets/hovedbilde.png" src/assets/hovedbilde.png && echo "Kopierte hovedbilde.png"
  [ ! -f .env ] && [ -f "$MAIN/.env" ] && cp "$MAIN/.env" .env && echo "Kopierte .env"
  echo "Worktree-forberedelse ferdig"
fi
```

## Step 1: ESLint

Run ESLint before tests:

```bash
npm run lint 2>&1
```

If ESLint reports any **errors** (not warnings), stop and fix them before continuing. Warnings are acceptable.

## Step 2: Unit Tests

Run unit tests with coverage (disable sandbox):

```bash
npm test 2>&1
```

Note the test results (passed/failed/total) from the output. If any test FAILS, stop — report the failures and skip all remaining steps.

## Step 3: Per-File Branch Coverage

After tests pass, check that every file has at least 80% branch coverage. Run:

```bash
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

If exit code is non-zero (any file below 80%), stop and report which files need more tests. Do not continue.

## Step 4: E2E Tests

Run Playwright E2E tests:

```bash
npm run test:e2e 2>&1
```

Note passed/failed/skipped counts. If any E2E test fails, stop and report.

## Step 5: Build

Verify the project compiles:

```bash
npm run build 2>&1
```

If the build fails, stop and report errors.

## Step 6: Security Audit

Run npm audit with the same level as CI (`--audit-level=critical`):

```bash
npm audit --audit-level=critical 2>&1
```

If the audit finds critical vulnerabilities, stop and report them. Include the package name, severity, and suggested fix (e.g., `npm audit fix` or specific version upgrade). This matches the CI check in `.github/workflows/deploy.yml` so issues are caught locally before push.

## Step 7: CI/CD Variable Check

If this session added new environment variables (in `.env`, `src/env.d.ts`, or `sync-data.js`), verify they are present in `.github/workflows/` for both test and build steps. Flag any missing variables.

## Step 8: Report

Present a single consolidated report:

```
## Quality Gate Report

### ESLint: PASS/FAIL
X errors, Y warnings

### Unit Tests: PASS/FAIL
X passed, Y failed, Z total

### Branch Coverage (per file)
| File | Branch % | Status |
|------|----------|--------|
| ... | ...% | FAIL/OK/GOOD |

Coverage: FAIL = below 80%, OK = 80-90%, GOOD = above 90%

### E2E Tests: PASS/FAIL
X passed, Y failed, Z skipped

### Build: PASS/FAIL

### Security Audit: PASS/FAIL
X critical vulnerabilities / No critical vulnerabilities found

---
**Overall: PASS / FAIL**
```

If all checks pass, state the task is clear for commit.
If anything fails, list what needs to be fixed before the task can be completed.
