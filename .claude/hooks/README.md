# Hooks

## git-guard.sh

PreToolUse(Bash)-vakt for git-flyten:

- **Blokkerer** rå `git push` → bruk `git review` via `/commit` (Step 5 «ship it»).
- **Advarer** (blokkerer ikke) ved `git commit` mens HEAD er `main` → oppgaver skal kjøres i
  worktree (jf. `/todo`-flyten).

### Wiring (gjøres lokalt per klon)

`.claude/settings.local.json` er gitignorert, så koblingen committes ikke — kun selve
scriptet. Etter en fersk klone: legg til denne `hooks`-blokken i `.claude/settings.local.json`:

```json
"hooks": {
  "PreToolUse": [
    {
      "matcher": "Bash",
      "hooks": [
        { "type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/git-guard.sh" }
      ]
    }
  ]
}
```

### Test

Kjør fra repo-roten (relativ sti til scriptet):

```bash
echo '{"tool_input":{"command":"git push origin main"},"cwd":"'"$PWD"'"}' | .claude/hooks/git-guard.sh
# → permissionDecision: deny
```
