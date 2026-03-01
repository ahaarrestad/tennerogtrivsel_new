---
name: commit
model: sonnet
description: "Automate git commit and push following the project's review workflow. Stages files, generates a Norwegian conventional-commit message, and optionally pushes via `git review` (never `git push`). Use when the user says 'commit', 'committ', 'lagre endringer', 'push', 'send til review', or asks to save/commit their work. Also trigger when a quality gate passes and the user wants to commit the result."
disable-model-invocation: false
allowed-tools: ["Bash(git *)", "Bash(cat *)", "Agent"]
---

# Commit Skill

Automate the commit workflow for this project. The project uses a review-based flow where `git review` pushes to `review/**` branches, which triggers auto-PR creation via GitHub Actions. Direct `git push` to main is never allowed.

## Step 1: Understand the Changes

Run these four commands **in parallel** (all in a single response, as separate Bash tool calls):

1. `git status`
2. `git diff --staged`
3. `git diff`
4. `git log --oneline -5`

Review the output carefully. Identify:
- Which files have meaningful changes
- Whether changes are staged or unstaged
- The commit message style from recent history (Norwegian, conventional commits)

## Step 2: Generate Commit Message

Based on the diff, write a commit message that:

1. **Uses conventional commits format**: `type: kort beskrivelse`
   - `feat:` — ny funksjonalitet
   - `fix:` — feilretting
   - `chore:` — vedlikehold, oppdateringer, config
   - `test:` — nye/oppdaterte tester
   - `docs:` — dokumentasjonsendringer
   - `refactor:` — kodeomstrukturering uten atferdsendring
   - `a11y:` — tilgjengelighetsforbedringer

2. **Is written in Norwegian**, matching the project's existing style

3. **Is concise** — one short line summarizing the "why", optionally followed by a blank line and bullet points for multi-file changes

4. **Uses a dash-separated summary** after the type prefix when the change spans multiple concerns (e.g., `fix: kodekvalitet-småfiks — typo, typesikkerhet, observer-scope m.m.`)

Present the proposed commit message to the user and ask for confirmation before proceeding.

## Step 3: Stage Files

Stage **only** the files that are relevant to the current task/conversation. If `git status`
shows previously staged changes or modifications from other tasks, **unstage them first** with
`git restore --staged <file>` before staging the correct files. Never blindly commit what
happens to be in the staging area — verify that every staged file belongs to the current work.

**Never stage these files:**
- `.env`, `.env.*`
- Files containing credentials, tokens, or secrets
- `node_modules/`
- Coverage output (`coverage/`)

Use `git add <specific-file>` for each file — avoid `git add -A` or `git add .`.

## Step 4: Create the Commit

Create the commit using a HEREDOC for proper formatting:

```bash
git commit -m "$(cat <<'EOF'
type: commit message here

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

## Step 4.5: Code Review Before Push

**Skip this step if the user has NOT asked to push.** Only run this review when push is requested.

First, get the git SHAs for the review range:

```bash
BASE_SHA=$(git rev-parse HEAD~1)
HEAD_SHA=$(git rev-parse HEAD)
```

Then use the Agent tool to spawn a code review subagent:

- **subagent_type:** `superpowers:code-reviewer`
- **description:** `Review diff before push`
- **prompt:** Fill in the template placeholders:

> You are reviewing code changes for production readiness.
>
> **Your task:**
> 1. Review the changes in the most recent commit
> 2. Compare against project rules and coding standards
> 3. Check code quality, architecture, testing
> 4. Categorize issues by severity
> 5. Assess production readiness
>
> ## What Was Implemented
>
> {COMMIT_MESSAGE from Step 2}
>
> ## Requirements/Plan
>
> Read CLAUDE.md for project rules. Pay special attention to these **project-specific rules — violations are Critical issues:**
> - **CSS tokens:** Only CSS variables from `src/styles/global.css` — never hardcoded hex (#xxx), rgb(), or Tailwind color classes
> - **Sheets API:** All `sheets.values.get` calls with numeric fields MUST use `valueRenderOption: 'UNFORMATTED_VALUE'`
> - **Architecture docs:** Changes to subsystems (images, messages, section backgrounds, security) must follow patterns in `docs/architecture/`
> - **Security:** No XSS, injection, exposed secrets, or unsafe innerHTML without DOMPurify
>
> ## Git Range to Review
>
> **Base:** {BASE_SHA}
> **Head:** {HEAD_SHA}
>
> Run: `git diff {BASE_SHA}..{HEAD_SHA}`
>
> ## Output Format
>
> Use this exact structure:
>
> ### Strengths
> [What's well done]
>
> ### Issues
> #### Critical (Must Fix)
> [Bugs, security issues, project rule violations from CLAUDE.md]
> #### Important (Should Fix)
> [Architecture problems, missing error handling, test gaps]
> #### Minor (Nice to Have)
> [Code style, optimization, documentation]
>
> For each issue: file:line reference, what's wrong, why it matters.
>
> ### Assessment
> **Ready to merge?** Yes / No / With fixes
> **Reasoning:** [1-2 sentences]

After the subagent returns its review (Strengths, Issues, Assessment):

1. **If "Ready to merge: Yes" with no Critical or Important issues:** Proceed directly to Step 5 (push).
2. **If "Ready to merge: Yes/With fixes" with only Minor issues:** Display the issues to the user and ask: "Review fant noen forbedringsforslag (se over). Vil du fortsette med push?" If yes, proceed to Step 5.
3. **If any Critical issues found:** Display all findings and say: "Review fant blokkerende problemer som må fikses før push. Rett opp og kjør /commit igjen." Do NOT proceed to Step 5.
4. **If Important issues found:** Display them and let the user decide whether to fix now or push anyway.

## Step 5: Push (Only If Requested)

Only push if the user explicitly asked for it (said "push", "send til review", or similar).

When pushing, **always** use:

```bash
git review
```

This runs the project's review script which:
- Rebases on origin/main
- Creates a `review/**` branch name from the commit message
- Force-pushes to that branch
- GitHub Actions auto-creates a PR

**NEVER use `git push` directly.** The `git review` command handles everything.

## Step 6: Report

After committing (and optionally pushing), show a brief summary:

```
## Commit Summary

**Message:** type: description
**Files:** X files changed
**Pushed:** Yes (via git review) / No (local only)
```

If pushed, mention that a PR will be created automatically.
