#!/usr/bin/env bash
# Delt dev:secure-oppstart for /commit (Step 2.5 E2E + Step 5 push).
# Kilde (source) denne, ikke kjør den: den setter STARTED_SERVER i kallerens scope
# slik at stop_secure_server kan rydde opp riktig.
#
#   source "$(git rev-parse --show-toplevel)/.claude/skills/_shared/start-secure-server.sh"
#   ensure_secure_server || exit 1
#   # ... kjør tester mot http://localhost:$PORT ...
#   stop_secure_server
#
# Bruker PORT (default 4321). Sett PORT=4322 e.l. per worktree.
# Dreper IKKE en eksisterende secure server — sjekker CSP-header først og gjenbruker den.

ensure_secure_server() {
  PORT=${PORT:-4321}
  STARTED_SERVER=false
  if curl -sf "http://localhost:$PORT/admin" -o /dev/null 2>/dev/null && \
     curl -s -I "http://localhost:$PORT/" 2>/dev/null | grep -qi "content-security-policy.*sha256-"; then
    echo "Reusing existing dev:secure on port $PORT"
    return 0
  fi
  lsof -ti:$PORT | xargs kill -9 2>/dev/null || true; sleep 1
  PORT=$PORT npm run dev:secure > /tmp/dev-secure.log 2>&1 &
  STARTED_SERVER=true
  for i in $(seq 1 45); do
    sleep 2
    curl -s "http://localhost:$PORT/admin" -o /dev/null -w "%{http_code}" 2>/dev/null | grep -q "200\|301\|302" && break
  done
  curl -sf "http://localhost:$PORT/admin" -o /dev/null || { echo "dev:secure failed to start"; return 1; }
}

stop_secure_server() {
  : "${STARTED_SERVER:=false}"   # eksplisitt default om kalt uten forutgående ensure_secure_server
  [ "$STARTED_SERVER" = true ] && { lsof -ti:${PORT:-4321} | xargs kill -9 2>/dev/null || true; }
  return 0
}
