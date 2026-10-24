# Spec: Auto-merge-PR-er som ligger bak main skal løsne selv

Plan: [docs/plans/2026-10-24-rebase-retry.md](../plans/2026-10-24-rebase-retry.md)

## Problem

Klassisk branch protection på `main` er `strict`: en PR må være à jour med main før den merges.
Havner en auto-merge-PR bak (`BEHIND`), blir den liggende til noen oppdaterer den.

`dependabot-rebase.yml` håndterer dette ved push til main: `@dependabot rebase` på Dependabot-PR-er,
update-branch-API-et på andre. Den gjør ett forsøk og sjekker ikke resultatet.

2026-10-24 ignorerte Dependabot alle `@dependabot rebase`-kommentarer på #522 (15:56 og 18:41 fra
workflowen, 18:45 manuelt) og den første på #521 (15:56). Ingen 👍, ingen oppdateringskjøring. En manuell
kommentar 18:35 på #521 virket. 2026-10-17 virket 4 av 4. Årsaken er ukjent; ingen forskjell i metadata
eller timing er funnet. Dependabot er altså upålitelig enkelte dager, uansett avsender. PR-ene sto i timer,
og `stuck-pr-watch.yml` ville varslet først etter 6 t.

Målet er at slike PR-er løsner uten at eieren gjør noe, også de dagene Dependabot ikke svarer.

## Krav og akseptansekriterier

1. Ved push til main: som i dag (alle åpne PR-er, ett forsøk).
2. Hver time: en åpen PR med auto-merge som står `BEHIND`, og der mains siste commit er minst 30 min
   gammel, får et nytt forsøk:
   - Dependabot-PR med en `@dependabot rebase` nyere enn 30 min → vent.
   - Dependabot-PR med færre enn 2 `@dependabot rebase` siden head-commiten → ny kommentar.
   - Dependabot-PR med 2 eller flere → **eskaler**: update-branch (rebase) via PAT, logget som
     eskalering.
   - Andre PR-er → update-branch.
3. Eskalering skjer bare når auto-merge allerede er på (ellers kan `fetch-metadata` nekte å slå det på —
   PR #472).
4. PAT-en brukes bare i en workflow uten PR-triggere (`push` til main, `schedule`, `workflow_dispatch`).
   `GITHUB_TOKEN` får bare `contents: read`. Ingen PR-styrt tekst går inn i shell.
5. `dry_run` viser hva som ville skjedd uten å skrive noe.
6. Kjøringen er grønn også når den finner noe; rød betyr at workflowen er ødelagt.

## Avgrensninger

- `strict` beholdes (brukerens valg 2026-10-24).
- Ingen 👍-sjekk (udokumentert oppførsel).
- `stuck-pr-watch.yml` endres bare i tekst. 6-timers-issuen er fortsatt varselet når ingenting virker.
- Vi forklarer ikke hvorfor Dependabot ignorerer kommentarer; vi tåler det.

## Designvalg

- **Samme fil som i dag (`dependabot-rebase.yml`):** all rebase-logikk på ett sted. Fila har ingen
  PR-trigger, så PAT-skillet er like sterkt som i en egen fil.
- **Logikken i `.github/scripts/dependabot-rebase.sh` med tester:** en workflow-inline-blokk kan ikke
  testes, og den nye logikken har nok grener til å trenge det.
- **Tid siden mains siste commit:** committer-datoen på mains HEAD er merge-tidspunktet (verifisert mot
  `mergedAt` for #516–#521). `enabledAt` nullstilles ikke ved rebase og passer ikke.
- **Telling per head-commit:** `@dependabot rebase`-kommentarer nyere enn head-commitens
  *committer*-dato. En vellykket rebase gir ny commit og nullstiller tellingen. Kilden kan ikke skilles
  (alt kommer fra samme konto), så tellingen er total. Typisk forløp: kommentar ved push → én til ved
  første timeskjøring der main er minst 30 min gammel → eskalering timen etter, typisk ~2,5 t etter
  merge (simulert mot tidene for #522 2026-10-24).
- **Eskalering er trygt** (verifisert 2026-10-24): main krever verken review eller signerte commits, CI
  har ingen Dependabot-spesiallogikk, `dependabot-auto-merge.yml` hopper over pusher som ikke er fra
  Dependabot, og auto-merge som allerede er på blir stående (forsøk på #522 — se plan). Ulempen:
  Dependabot slutter å vedlikeholde PR-en. Det er akseptabelt fordi den merges straks; trengs
  Dependabot igjen, gir `@dependabot recreate` en ny.
- **Hvorfor PAT:** Dependabot ser ut til å ta kommandoer bare fra brukere med skrivetilgang, og en
  oppdatering med `GITHUB_TOKEN` trigger ikke CI. Det første er ikke dokumentert av GitHub; det er
  arvet fra dagens oppsett, som har virket.
- **Dependabot-PR = Dependabot-forfatter og signert head-commit.** Etter en eskalering er head-commiten
  usignert, og Dependabot rører ikke PR-en mer. Den behandles da som andre PR-er (update-branch) i begge
  moduser, så den ikke får nye kommentarer som ingen svarer på.
- Dependabot rebaser ikke av seg selv når en PR bare er `BEHIND`. Dokumentasjonen nevner det ikke, og
  2026-10-24 skjedde det ikke.
- **Varselet kan komme før eskaleringen:** `stuck-pr-watch.yml` måler tid siden auto-merge ble slått
  på. Er det lenge siden, kan issuen komme først. Den lukkes selv når PR-en er merget.
