---
name: coverage
description: "Run unit tests and show per-file branch coverage report. Use when the user says 'coverage', 'dekningsgrad', 'show coverage', 'sjekk coverage', 'branch coverage', or asks about test coverage for specific files."
disable-model-invocation: false
allowed-tools: ["Bash(npm test:*)", "Bash(node --input-type=commonjs:*)"]
---

# Coverage Report

Run unit tests and present a per-file branch coverage breakdown.

IMPORTANT: All Bash commands MUST run with `dangerouslyDisableSandbox: true` because Vitest needs to write to temp directories and coverage output.

## Step 1: Run Tests

```bash
npm test 2>&1
```

If any test fails, report the failures and stop.

## Step 2: Parse Coverage

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

## Step 3: Report

Present the results:

```
## Coverage Report

### Unit Tests
X passed, Y failed, Z total

### Branch Coverage (per file)
| File | Branch % | Status |
|------|----------|--------|
| ... | ...% | FAIL/OK/GOOD |

Coverage: FAIL = below 80%, OK = 80-90%, GOOD = above 90%
```

If any file is below 80%, flag it clearly and suggest which files need more tests.
