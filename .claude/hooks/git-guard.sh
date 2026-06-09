#!/usr/bin/env bash
# PreToolUse(Bash)-vakt: deterministisk sikkerhetsnett for git-flyten.
#
#  1. Blokkerer rå `git push`            → bruk `git review` via /commit (Step 5 «ship it»).
#  2. Advarer (blokkerer ikke) ved        → oppgaver skal kjøres i worktree (jf. /todo-flyten).
#     `git commit` mens HEAD == main
#
# Idempotent og rask. Ingen sideeffekter utover JSON på stdout + exit 0.
# Kontrakt: exit 0 + hookSpecificOutput.permissionDecision=deny blokkerer; systemMessage
# er en ikke-blokkerende advarsel til brukeren. Se code.claude.com/docs/en/hooks.
#
# Merk: git-review sin interne `git push` er en subprosess inni scriptet — aldri et eget
# Bash-verktøykall — så denne hooken ser den aldri og kan ikke blokkere den.

input=$(cat)
command=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')
cwd=$(printf '%s' "$input" | jq -r '.cwd // empty')

[ -z "$command" ] && exit 0

# 1. Blokker rå `git push` (matcher «git push» som token-sekvens; «git review» og
#    «git-review» matcher ikke — egne kommandoer uten «push»).
if printf '%s' "$command" | grep -Eq '(^|[^[:alnum:]_-])git[[:space:]]+push([[:space:]]|$)'; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "Rå \"git push\" er blokkert. Bruk \"git review\" via /commit (Step 5 «ship it») — git-review håndterer review-branch og PR automatisk."
    }
  }'
  exit 0
fi

# 2. Advar ved `git commit` på main (ikke-blokkerende — normal tillatelsesflyt fortsetter).
if printf '%s' "$command" | grep -Eq '(^|[^[:alnum:]_-])git[[:space:]]+commit([[:space:]]|$)'; then
  branch=$(git -C "${cwd:-.}" rev-parse --abbrev-ref HEAD 2>/dev/null)
  if [ "$branch" = "main" ]; then
    jq -n '{
      systemMessage: "⚠ Du committer på main, ikke i en worktree. Oppgaver skal kjøres i worktree (jf. /todo-flyten). Er dette med vilje?"
    }'
    exit 0
  fi
fi

exit 0
