#!/usr/bin/env bash
# Holder åpne PR-er à jour med main (branch protection er `strict`). Kalles fra
# .github/workflows/dependabot-rebase.yml. Spec: docs/designs/2026-10-24-rebase-retry.md
#
# MODUS=push   Etter push til main: ett forsøk på alle åpne PR-er.
# MODUS=retry  Hver time: auto-merge-PR-er som fortsatt står BEHIND får nytt forsøk,
#              og Dependabot-PR-er eskaleres til update-branch når Dependabot ikke svarer.
#
# Andre variabler: GH_REPO (påkrevd), DRY_RUN ("true" = bare logg), MIN_MINUTES (standard 30).
# Rc 0 også når noe ble gjort eller én PR feilet; rc 1 betyr at selve oppslaget er ødelagt.

set -euo pipefail

MODUS="${MODUS:-push}"
DRY_RUN="${DRY_RUN:-}"
MIN_MINUTES="${MIN_MINUTES:-30}"
: "${GH_REPO:?GH_REPO mangler}"

KOMMANDO='@dependabot rebase'
MAKS_KOMMENTARER=2
ISO_TID='^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$'

# Skrivende gh-kall går hit, så tørrkjøring aldri endrer noe.
skriv() {
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "  (tørrkjøring) ville kjørt: gh $*"
    return 0
  fi
  gh "$@"
}

# gh rapporterer boter som «app/<navn>» i --json author; REST-API-et og github.actor
# bruker «<navn>[bot]». Begge må matches — ellers går Dependabot-PR-er i else-grenen
# og rebases via PAT før auto-merge er på, og fetch-metadata nekter da å slå det på
# (jf. PR #472).
er_dependabot_forfatter() {
  [[ "$1" == "dependabot[bot]" || "$1" == "app/dependabot" ]]
}

# Skriver «<signert> <committer-dato>» for en commit. Dependabots egne commits er
# signert av GitHub; en usignert head betyr at noen andre (f.eks. en tidligere
# eskalering) har oppdatert PR-en, og at Dependabot ikke rører den mer.
head_info() {
  gh api "repos/$GH_REPO/commits/$1" \
    --jq '"\(.commit.verification.verified) \(.commit.committer.date)"'
}

oppdater_branch() {
  local nr="$1"
  shift
  skriv api --method PUT "repos/$GH_REPO/pulls/$nr/update-branch" -f update_method=rebase "$@"
}

gyldig_pr() {
  local nr="$1" sha="$2"
  if [[ ! "$nr" =~ ^[0-9]+$ || ! "$sha" =~ ^[0-9a-f]{40}$ ]]; then
    echo "::warning::Hopper over ugyldig PR-linje: «$nr $sha»"
    return 1
  fi
}

modus_push() {
  local prs linjer linje nr forfatter sha signert
  # gh sin standardgrense (30) som i den gamle inline-versjonen; retry tar opptil 100.
  prs=$(gh pr list --state open --json number,author,headRefOid \
    --jq '.[] | "\(.number) \(.author.login) \(.headRefOid)"')
  mapfile -t linjer <<<"$prs"
  for linje in "${linjer[@]}"; do
    [[ -z "$linje" ]] && continue
    read -r nr forfatter sha <<<"$linje"
    gyldig_pr "$nr" "$sha" || continue
    signert=true
    if er_dependabot_forfatter "$forfatter"; then
      # Feiler oppslaget, gjør vi som før denne sjekken fantes: kommenterer.
      read -r signert _ < <(head_info "$sha" || echo "true -")
    fi
    if er_dependabot_forfatter "$forfatter" && [[ "$signert" == "true" ]]; then
      echo "PR #$nr (dependabot): commenting $KOMMANDO"
      skriv pr comment "$nr" --body "$KOMMANDO" || echo "  Skipped (comment failed)"
    else
      echo "PR #$nr: updating branch via API"
      oppdater_branch "$nr" 2>/dev/null || echo "  Skipped (already up to date or conflict)"
    fi
  done
}

# Ett nytt forsøk på én BEHIND-PR. Rc ≠ 0 gir en warning hos kalleren.
behandle_retry() {
  local nr="$1" forfatter="$2" sha="$3" info signert=false head_tid telling antall siste
  if er_dependabot_forfatter "$forfatter"; then
    info=$(head_info "$sha") || return 1
    read -r signert head_tid <<<"$info"
  fi

  if [[ "$signert" != "true" ]]; then
    echo "PR #$nr: står bak main, oppdaterer via API"
    oppdater_branch "$nr" || return 1
    return 0
  fi

  if [[ ! "$head_tid" =~ $ISO_TID ]]; then
    echo "::warning::PR #$nr: uventet committer-dato «$head_tid»"
    return 1
  fi

  # Bare kommandoer etter head-commiten teller: en vellykket rebase nullstiller.
  telling=$(gh pr view "$nr" --json comments \
    --jq "[.comments[] | select(.body == \"$KOMMANDO\" and .createdAt > \"$head_tid\") | .createdAt]
          | \"\(length) \(max // \"-\")\"") || return 1
  read -r antall siste <<<"$telling"

  if [[ "$siste" != "-" && "$siste" > "$GRENSE" ]]; then
    echo "PR #$nr (dependabot): siste $KOMMANDO $siste er under $MIN_MINUTES min gammel, venter"
  elif (( antall < MAKS_KOMMENTARER )); then
    echo "PR #$nr (dependabot): $antall ubesvarte $KOMMANDO, kommenterer igjen"
    skriv pr comment "$nr" --body "$KOMMANDO" || return 1
  else
    # Auto-merge er allerede på (filtrert i modus_retry), så en usignert commit
    # stopper den ikke. expected_head_sha: ikke overskriv en rebase Dependabot
    # har rukket å gjøre siden lista ble hentet.
    echo "PR #$nr (dependabot): $antall ubesvarte $KOMMANDO, eskalerer til update-branch"
    oppdater_branch "$nr" -f expected_head_sha="$sha" || return 1
  fi
}

modus_retry() {
  local main_tid prs linjer linje nr forfatter sha
  if [[ ! "$MIN_MINUTES" =~ ^[0-9]+$ ]]; then
    echo "::error::MIN_MINUTES må være et heltall, fikk «$MIN_MINUTES»"
    return 1
  fi
  # Alle GitHub-tider er UTC med Z, så strengsammenligning holder.
  GRENSE=$(date -u -d "-${MIN_MINUTES} minutes" +%Y-%m-%dT%H:%M:%SZ)

  main_tid=$(gh api "repos/$GH_REPO/commits/main" --jq .commit.committer.date)
  # Uten sjekk ville f.eks. «null» sortert etter alle datoer og stille gitt «venter» hver time.
  if [[ ! "$main_tid" =~ $ISO_TID ]]; then
    echo "::error::Uventet committer-dato på main: «$main_tid»"
    return 1
  fi
  if [[ "$main_tid" > "$GRENSE" ]]; then
    echo "main ble endret $main_tid (under $MIN_MINUTES min siden); push-kjøringen har nettopp prøvd"
    return 0
  fi

  prs=$(gh pr list --state open --limit 100 \
    --json number,author,autoMergeRequest,mergeStateStatus,headRefOid)
  jq -r '.[] | select(.autoMergeRequest.enabledAt != null and .mergeStateStatus == "UNKNOWN")
         | "PR #\(.number): UNKNOWN, prøver neste time"' <<<"$prs"
  mapfile -t linjer < <(jq -r '.[]
    | select(.autoMergeRequest.enabledAt != null and .mergeStateStatus == "BEHIND")
    | "\(.number) \(.author.login) \(.headRefOid)"' <<<"$prs")

  if (( ${#linjer[@]} == 0 )); then
    echo "Ingen auto-merge-PR-er står bak main"
    return 0
  fi
  for linje in "${linjer[@]}"; do
    read -r nr forfatter sha <<<"$linje"
    gyldig_pr "$nr" "$sha" || continue
    behandle_retry "$nr" "$forfatter" "$sha" || echo "::warning::PR #$nr: forsøket feilet, prøver neste time"
  done
}

case "$MODUS" in
  push) modus_push ;;
  retry) modus_retry ;;
  *) echo "::error::Ukjent MODUS «$MODUS»"; exit 1 ;;
esac
