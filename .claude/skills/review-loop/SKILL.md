---
name: review-loop
description: "Use after implementing a feature or task, as part of a /goal loop. Runs one code review pass: reviews the diff, fixes Critical and Important issues, commits the fixes. Designed to be called repeatedly by /goal until the review is clean."
disable-model-invocation: false
allowed-tools: ["Read", "Edit", "Write", "Glob", "Grep", "Bash(git *)", "Agent"]
---

# Review Loop (én gjennomgang)

Kjør én review-pass over diff-en fra denne branchen. Ment å kalles av `/goal` som looper til reviewen er ren.

## Steg 1: Finn git-range

```bash
BASE_SHA=$(git merge-base HEAD origin/main 2>/dev/null || git rev-parse HEAD~1)
HEAD_SHA=$(git rev-parse HEAD)
```

## Steg 2: Kjør review-agent

Dispatch en `general-purpose` Agent med den delte reviewer-prompten i
[`../_shared/reviewer-prompt.md`](../_shared/reviewer-prompt.md). Fyll inn
`{WHAT_WAS_IMPLEMENTED}`, `{BASE_SHA}` og `{HEAD_SHA}`.

`{WHAT_WAS_IMPLEMENTED}`: Hent fra TODO.md-oppgaven som ble fullført, eller skriv en
kortfattet oppsummering av diff-en (`git diff --stat {BASE_SHA}..{HEAD_SHA}`).

## Steg 3: Evaluer og avslutt

**Ingen Critical eller Important issues:**

Avslutt med:
```
REVIEW_LOOP: CLEAN
Ingen Critical eller Important issues. Klar for /commit.
```

**Kun Minor issues:**

Vis dem, avslutt med:
```
REVIEW_LOOP: CLEAN (minor issues listed above)
Ingen blokkerende issues. Klar for /commit.
```

**Critical eller Important issues funnet:**

Fiks alle issues. Stage og commit kun de berørte filene (aldri `git add .` eller `git add -A` — aldri `.env*`, credentials, `node_modules/`, `coverage/`):
```bash
git add <spesifikke filer — én og én>
git commit -m "$(cat <<'EOF'
fix: reviewfiks — <kort beskrivelse>

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

Avslutt med:
```
REVIEW_LOOP: ISSUES_FIXED
Fikset: <liste over hva som ble gjort>
Ny runde nødvendig.
```

`/goal`-systemet starter automatisk ny tur og kaller `review-loop` igjen.
