---
name: commit
description: "Automate git commit and push following the project's review workflow. Stages files, generates a Norwegian conventional-commit message, and optionally pushes via `git review` (never `git push`). Use when the user says 'commit', 'committ', 'lagre endringer', 'push', 'send til review', or asks to save/commit their work. Also trigger when a quality gate passes and the user wants to commit the result."
disable-model-invocation: false
allowed-tools: ["Bash(git *)", "Bash(cat *)"]
---

# Commit Skill

Automate the commit workflow for this project. The project uses a review-based flow where `git review` pushes to `review/**` branches, which triggers auto-PR creation via GitHub Actions. Direct `git push` to main is never allowed.

## Step 1: Understand the Changes

Run these commands to get a full picture of what's changed:

```bash
git status
```

```bash
git diff --staged
```

```bash
git diff
```

```bash
git log --oneline -5
```

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
