# Plan: setup-worktree.sh — robust utledning av MAIN

> Liten, triviell oppgave. Spec og plan er slått sammen til denne ene fila (jf. todo-flytens §0).

## Problem / mål

`scripts/setup-worktree.sh` utleder stien til hovedrepoet slik:

```bash
MAIN=$(git rev-parse --git-common-dir); MAIN=${MAIN%/.git}
```

`git rev-parse --git-common-dir` returnerer en **relativ** sti (`.git`) når skriptet kjøres
fra hovedrepoet. `${MAIN%/.git}` stripper bare et *avsluttende* `/.git`-suffiks, som ikke
matcher den bare strengen `.git` — så `MAIN` blir stående som `.git`. Alle påfølgende baner
som `"$MAIN/src/content/$f"` evaluerer da til `.git/src/content/...` (feil relativ kilde som
ikke finnes), og kopieringen hopper stille over (no-op).

Gemini Code Assist flagget dette som «high» på PR #399. Skriptet kjøres normalt kun fra en ny
worktree (der git-common-dir gir en absolutt sti og det fungerer), så reell risiko er lav, men
fiksen gjør skriptet korrekt uansett kjørested.

## Akseptansekriterier

1. `MAIN` peker alltid på den absolutte stien til hovedrepoets rot — både fra en worktree og fra
   hovedrepoet selv.
2. Eksisterende oppførsel fra en worktree er uendret (filene kopieres som før).
3. Skriptet feiler ikke selv om målmappene (`src/content`, `src/assets/galleri`) ikke finnes ennå.

## Avgrensninger (non-goals)

- Ingen endring i *hvilke* filer som kopieres eller logikken rundt `[ -f ... ]`-sjekkene.
- Ingen ny test-infrastruktur for shell-skript (utenfor scope; skriptet er ikke kjerne-logikk
  dekket av coverage-kravet).

## Plan (hvordan)

Endre `scripts/setup-worktree.sh` linje 8:

```bash
# Før
MAIN=$(git rev-parse --git-common-dir); MAIN=${MAIN%/.git}

# Etter
MAIN=$(cd "$(git rev-parse --git-common-dir)/.." && pwd)
```

`cd "$COMMON_DIR/.." && pwd` resolver til absolutt sti uansett om git-common-dir er relativ
(`.git` → hovedrepo, siden vi alt har `cd`-et til toplevel på linje 6) eller absolutt
(`/abs/main/.git` → `/abs/main`).

I tillegg, defensiv `mkdir -p` rett etter, så `cp -rn ... galleri/` (som svelger feil med
`|| true`) ikke stille hopper over kopiering hvis målmappa mangler:

```bash
mkdir -p src/content src/assets/galleri
```

### Filer som berøres
- `scripts/setup-worktree.sh`

### Testbehov / definition of done
- Manuell verifikasjon: kjør skriptet fra denne worktreen og bekreft «Worktree-oppsett fullført.»
  uten feil, og at `MAIN` peker på hovedrepoet (kan ekko-debugges midlertidig ved behov).
- `bash -n scripts/setup-worktree.sh` (syntakssjekk) er grønn.
- Ikke noe coverage-krav: shell-bootstrap, ikke kjerne-logikk i scripts/API.

### Kjente risiki / usikkerheter
- Lav. Eneste reelle endring er hvordan `MAIN` utledes; worktree-stien (det normale tilfellet)
  gir identisk resultat som før.
