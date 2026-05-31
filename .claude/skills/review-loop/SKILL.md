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

Dispatch en `general-purpose` Agent med følgende prompt (fyll inn `{TASK_DESCRIPTION}`, `{BASE_SHA}`, `{HEAD_SHA}`):

> You are a Senior Code Reviewer.
>
> ## What Was Implemented
> {TASK_DESCRIPTION}
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
> ### Issues
> #### Critical (Must Fix)
> #### Important (Should Fix)
> #### Minor (Nice to Have)
> Each issue: file:line — what's wrong — why it matters — how to fix.
> ### Assessment
> **Clean?** Yes / No

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

Fiks alle issues. Commit fiksen:
```bash
git add <berørte filer>
git commit -m "fix: reviewfiks — <kort beskrivelse>"
```

Avslutt med:
```
REVIEW_LOOP: ISSUES_FIXED
Fikset: <liste over hva som ble gjort>
Ny runde nødvendig.
```

`/goal`-systemet starter automatisk ny tur og kaller `review-loop` igjen.
