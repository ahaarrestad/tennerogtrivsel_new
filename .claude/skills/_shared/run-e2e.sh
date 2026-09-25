#!/usr/bin/env bash
# Kjører E2E mot dev:secure:fixtures via start-secure-server.sh. Brukes av /quality-gate Steg 4.
# Eget script (kjøres med `bash`, ikke `source`) fordi worktree-isolerte økter nekter `source`
# i Bash-kall. Ekstra argumenter sendes videre til Playwright.
#
#   bash .claude/skills/_shared/run-e2e.sh
#   bash .claude/skills/_shared/run-e2e.sh --project=chromium
#
# Port: PORT hvis satt; ellers 4321 i hovedrepoet og 4400–4499 (utledet fra stien) i en
# worktree. start-secure-server.sh gjenbruker en kjørende server på porten, så hver checkout
# må ha sin egen — ellers tester vi en annen checkouts kode.

cd "$(dirname "$0")/../../.." || exit 1
if [ -z "$PORT" ]; then
  if [ -f .git ]; then   # worktree: .git er en fil, ikke en katalog
    PORT=$((4400 + $(pwd | cksum | cut -d' ' -f1) % 100))
  else
    PORT=4321
  fi
fi
export PORT
echo "E2E på port $PORT"
. .claude/skills/_shared/start-secure-server.sh
ensure_secure_server || exit 1
npm run test:e2e -- "$@" 2>&1
E2E_EXIT=$?
stop_secure_server
exit $E2E_EXIT
