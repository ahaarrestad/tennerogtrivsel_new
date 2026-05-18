---
name: commit
model: sonnet
description: "Automate git commit and push following the project's review workflow. Stages files, generates a Norwegian conventional-commit message, and optionally pushes via `git review` (never `git push`). Use when the user says 'commit', 'committ', 'lagre endringer', 'push', 'send til review', or asks to save/commit their work. Also trigger when a quality gate passes and the user wants to commit the result."
disable-model-invocation: false
allowed-tools: ["Bash(git *)", "Bash(cat *)", "Agent"]
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
BASE_SHA=$(git merge-base HEAD origin/main || git rev-parse HEAD~1)
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

**NEVER use `git push`.** Always:

```bash
git review
```

## Step 6: Report

One-line summary: commit message, files changed, pushed or not.
