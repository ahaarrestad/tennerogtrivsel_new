#!/usr/bin/env bash
# OSV-skann for selvhelingen i scheduled-audit.yml: alle lockfiler i repoet, med unntakene i
# osv-scanner.toml, som JSON til $1. Kjøres før `npm ci`, så node_modules skannes ikke.
# Exit 0 (rent) og 1 (funn) er OK. Alt annet — 127 generell feil, 128 ingen pakker, 129 API,
# 130 ugyldig config — eller manglende/tom utfil skriver ::error:: og setter OSV_FEIL=1 i
# $GITHUB_ENV, slik at vurderingen blir `feil` i stedet for `ren`. Feiler aldri selv.
#
# Imaget er det samme som osv-scanner-reusable.yml i scheduled-audit.yml bruker, pinnet på
# digest. Dependabot ser ikke denne pinningen — bump den sammen med SHA-en der.
set -uo pipefail

IMAGE=ghcr.io/google/osv-scanner-action:v2.7.0@sha256:d54770fe0b09493894e76a02aaed9f51a0513fa57c5186452a755d257b0068a6
UT="$1"
rm -f "$UT"

docker run --rm \
  -v "$GITHUB_WORKSPACE:/github/workspace" -v "$(dirname "$UT"):/ut" -w /github/workspace \
  --entrypoint osv-scanner "$IMAGE" \
  scan source --config=./osv-scanner.toml --format=json --output-file="/ut/$(basename "$UT")" -r ./
RC=$?
echo "osv-scanner exit $RC"

if [ "$RC" -gt 1 ] || [ ! -s "$UT" ]; then
  echo "::error::osv-scanner feilet (exit $RC) — resultatet kan ikke brukes"
  echo "OSV_FEIL=1" >> "$GITHUB_ENV"
fi
exit 0
