#!/usr/bin/env bash
# Kopierer gitignorerte filer fra main inn i en ny worktree.
# Kjør fra worktree-roten ETTER `npm install`, FØR build eller tester.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# Absolutt sti til hovedrepoets rot — robust både fra en worktree (git-common-dir er
# absolutt) og fra hovedrepoet selv (git-common-dir er relativ `.git`).
MAIN=$(cd "$(git rev-parse --git-common-dir)/.." && pwd)

mkdir -p src/content src/assets/galleri

for f in galleri.json innstillinger.json prisliste.json tannleger.json kontaktskjema.json; do
  if [ ! -f "src/content/$f" ] && [ -f "$MAIN/src/content/$f" ]; then
    cp "$MAIN/src/content/$f" "src/content/$f"
  fi
done

cp -rn "$MAIN/src/assets/galleri/." src/assets/galleri/ 2>/dev/null || true

if [ ! -f src/assets/hovedbilde.png ] && [ -f "$MAIN/src/assets/hovedbilde.png" ]; then
  cp "$MAIN/src/assets/hovedbilde.png" src/assets/hovedbilde.png
fi
if [ ! -f .env ] && [ -f "$MAIN/.env" ]; then
  cp "$MAIN/.env" .env
fi

echo "Worktree-oppsett fullført."
