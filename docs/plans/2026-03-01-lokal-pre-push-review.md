# Lokal Pre-Push Code Review — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Legge til automatisk code review som subagent-steg i `/commit`-skillen, slik at koden reviewes før push.

**Architecture:** Nytt Step 4.5 i commit-skillen som bruker Agent-verktøyet til å spawne en `superpowers:code-reviewer`-subagent. Subagenten analyserer diffen mot CLAUDE.md-regler og generell kodekvalitet, og returnerer funn kategorisert etter alvorlighetsgrad (Critical/Important/Minor).

**Tech Stack:** Claude Code skills, Agent tool (superpowers:code-reviewer subagent)

---

### Task 1: Legg til Agent i allowed-tools og oppdater skill-metadata

**Files:**
- Modify: `.claude/skills/commit/SKILL.md:6` (allowed-tools)

**Step 1: Oppdater allowed-tools**

Endre linje 6 i `.claude/skills/commit/SKILL.md` fra:

```yaml
allowed-tools: ["Bash(git *)", "Bash(cat *)"]
```

til:

```yaml
allowed-tools: ["Bash(git *)", "Bash(cat *)", "Agent"]
```

**Step 2: Verifiser endringen**

Les filen og bekreft at frontmatter er korrekt YAML og at Agent er med i listen.

---

### Task 2: Legg til Step 4.5 — Code Review Before Push

**Files:**
- Modify: `.claude/skills/commit/SKILL.md` (mellom Step 4 og Step 5)

**Step 1: Sett inn nytt steg**

Legg til følgende seksjon mellom `## Step 4: Create the Commit` og `## Step 5: Push (Only If Requested)`:

```markdown
## Step 4.5: Code Review Before Push

**Skip this step if the user has NOT asked to push.** Only run this review when push is requested.

Use the Agent tool to spawn a code review subagent that analyzes the committed changes:

- **subagent_type:** `superpowers:code-reviewer`
- **description:** `Review diff before push`
- **prompt:** The following prompt (adapt the diff command if multiple commits are being pushed):

```
Review the git diff for the most recent commit in this project. Run:

git diff HEAD~1

Then read /home/asbjorn/IdeaProjects/tennerogtrivsel2/CLAUDE.md for project rules.

Analyze the diff against these criteria:

## BLOCKING (must fix before push)
- Security issues: XSS, injection, exposed secrets, unsafe innerHTML without DOMPurify
- Hardcoded colors: hex values (#xxx), rgb(), or Tailwind color classes instead of CSS token variables (text-brand, bg-accent, etc.)
- Missing valueRenderOption: any `sheets.values.get` call with numeric fields that lacks `valueRenderOption: 'UNFORMATTED_VALUE'`
- Architecture violations: changes to subsystems (images, messages, section backgrounds, security) without following the patterns in docs/architecture/

## ADVISORY (report but don't block)
- General code quality: over-engineering, code smells, poor error handling
- Improvement suggestions
- Minor style issues

Report your findings in this exact format:

### Code Review Results

**BLOCKING issues:** (list each with file:line and explanation, or "None")

**ADVISORY notes:** (list each with file:line and explanation, or "None")

**Summary:** PASS (no blocking issues) or FAIL (blocking issues found)
```

After the subagent returns:

1. **If Summary is PASS with no advisory notes:** Proceed directly to Step 5 (push).
2. **If Summary is PASS with advisory notes:** Display the advisory notes to the user and ask: "Review fant noen forbedringsforslag (se over). Vil du fortsette med push?" If yes, proceed to Step 5.
3. **If Summary is FAIL:** Display all findings and say: "Review fant blokkerende problemer som må fikses før push. Rett opp og kjør /commit igjen." Do NOT proceed to Step 5.
```

**Step 2: Verifiser at steget er riktig plassert**

Les hele SKILL.md og bekreft:
- Step 4.5 kommer etter Step 4 og før Step 5
- Markdown-formateringen er korrekt
- Subagent-prompten er komplett

---

### Task 3: Manuell test

**Step 1: Gjør en liten endring å teste med**

Lag en triviell endring (f.eks. en kommentar i en fil) og kjør `/commit` med push for å verifisere at:
- Step 1-4 kjører som normalt
- Step 4.5 spawner subagenten og viser review-resultater
- Flyten håndterer PASS/FAIL korrekt

**Step 2: Commit implementasjonen**

Kjør `/commit` for selve SKILL.md-endringen med melding:
```
feat: legg til automatisk code review før push i commit-skill
```
