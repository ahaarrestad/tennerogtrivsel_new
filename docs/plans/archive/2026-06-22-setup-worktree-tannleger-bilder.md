# setup-worktree.sh: kopier også tannleger-bilder

> Kombinert spec + plan (§0-snarvei — triviell endring, én scriptlinje).

## Problem/mål
`scripts/setup-worktree.sh` kopierer gitignorerte filer fra main inn i nye worktrees
(innhold-JSON, galleri-bilder, hovedbilde, `.env`), men hopper over
`src/assets/tannleger/` (også gitignorert). Nye worktrees mangler dermed
tannlege-portrettene til de kopieres manuelt. Oppdaget under «Tannleger-siden:
visuelt løft» (2026-06-21).

## Krav / akseptansekriterier
- Etter `bash scripts/setup-worktree.sh` i en fersk worktree finnes
  `src/assets/tannleger/`-portrettene (kopiert fra main).
- Eksisterende filer i worktreet overskrives ikke (samme `-n`-semantikk som galleri).
- Mangler tannleger-mappa på main, skal scriptet ikke feile.

## Avgrensninger (non-goals)
- Ikke generalisere til «alle gitignorerte asset-mapper» — kun tannleger legges til nå,
  konsistent med eksisterende eksplisitte mønster (galleri, hovedbilde).
- Ingen endring i øvrig kopieringslogikk.

## Plan (hvordan)
Berørt fil: `scripts/setup-worktree.sh`
1. Utvid `mkdir -p`-linja med `src/assets/tannleger`.
2. Legg til en `cp -rn "$MAIN/src/assets/tannleger/." src/assets/tannleger/ 2>/dev/null || true`
   rett etter den tilsvarende galleri-linja (samme idempotente mønster).

## Testbehov / definition of done
- Scriptet har ingen automatiserte tester (rent bash); coverage-kravet gjelder ikke.
- DoD: linjene lagt til, `bash -n scripts/setup-worktree.sh` passerer (syntakssjekk),
  og endringen følger galleri-mønsteret.

## Risiki
- Ingen kjente. Endringen er additiv og idempotent (`-n` + `|| true`).
