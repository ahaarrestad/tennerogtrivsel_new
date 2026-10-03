#!/usr/bin/env bash
# Teller høy/kritisk-advisories fra `npm audit` i gjeldende katalog, minus unntakene i
# osv-scanner.toml som ikke har utløpt (samme liste som OSV-scanneren bruker).
# stdout: antall gjenstående. stderr: hver advisory, merket FUNN eller IGNORERT.
# Exit 0 når auditen kunne leses (uansett antall), 2 når npm audit eller lista er ugyldig.
set -uo pipefail

LISTE="$(dirname "$0")/../../osv-scanner.toml"
[ -f "$LISTE" ] || LISTE=/dev/null

# Ett id per linje for unntak som fortsatt gjelder. Et unntak uten gyldig
# ignoreUntil er en feil — evige unntak skal ikke snike seg inn.
if ! IGNORERT=$(awk -v idag="$(date -u +%F)" '
    function avslutt() {
      if (id == "") return
      if (til !~ /^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]$/) {
        print "::error::" id ": mangler ignoreUntil = YYYY-MM-DD" > "/dev/stderr"; feil = 1
      } else if (idag < til) print id
      id = ""; til = ""
    }
    /^\[\[IgnoredVulns\]\]/ { avslutt() }
    /^id *=/          { v = $0; sub(/^[^"]*"/, "", v); sub(/".*/, "", v); id = v }
    /^ignoreUntil *=/ { v = $0; sub(/^[^=]*= */, "", v); sub(/[ #].*/, "", v); til = v }
    END { avslutt(); exit feil }' "$LISTE"); then
  exit 2
fi

JSON=$(npm audit --json 2>/dev/null) || true
if ! jq -e '.vulnerabilities | type == "object"' >/dev/null 2>&1 <<<"$JSON"; then
  echo "::error::npm audit ga ikke gyldig resultat" >&2
  exit 2
fi

# Advisories ligger som objekter i `via`; strenger der peker bare videre til en annen pakke.
FUNN=$(jq -r --arg ign "$IGNORERT" '
  ($ign | split("\n")) as $ignorert
  | [.vulnerabilities[].via[] | objects
     | select(.severity == "high" or .severity == "critical")
     | {ghsa: (.url | split("/") | last), name, severity, title}]
  | unique_by(.ghsa)[]
  | "\(if .ghsa | IN($ignorert[]) then "IGNORERT" else "FUNN" end) \(.ghsa) \(.name) (\(.severity)): \(.title)"
  ' <<<"$JSON")

[ -z "$FUNN" ] || echo "$FUNN" >&2
grep -c '^FUNN ' <<<"$FUNN" || true
