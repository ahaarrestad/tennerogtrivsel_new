#!/usr/bin/env bash
# Kjører E2E mot dev:secure:fixtures via start-secure-server.sh. Brukes av /quality-gate Steg 4.
# Eget script (kjøres med `bash`, ikke `source`) fordi worktree-isolerte økter nekter `source`
# i Bash-kall. Ekstra argumenter sendes videre til Playwright.
#
#   bash .claude/skills/_shared/run-e2e.sh            # PORT default 4321
#   PORT=4327 bash .claude/skills/_shared/run-e2e.sh --project=chromium

cd "$(dirname "$0")/../../.." || exit 1
export PORT=${PORT:-4321}
. .claude/skills/_shared/start-secure-server.sh
ensure_secure_server || exit 1
npm run test:e2e -- "$@" 2>&1
E2E_EXIT=$?
stop_secure_server
exit $E2E_EXIT
