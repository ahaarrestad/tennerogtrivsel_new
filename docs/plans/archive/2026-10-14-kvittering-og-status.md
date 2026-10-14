# Fast kvittering, /status og versjonert SyncOnEdit

**Mål:** brukeren skal ikke trenge å spørre om alt er sjekket, reviewet og virker.

**Bakgrunn:** I økten 2026-10-03–14 spurte brukeren gjentatte ganger «funker alt?» og om ting var
sjekket. Sluttrapportene varierte i form, og helsesjekken ble satt sammen på nytt hver gang.

## Endringer

1. **`/commit` Step 6 → fast kvittering.** Sjekkliste med ✅/⏭️/❌ for commit, kvalitetsport, review,
   push/PR, deploy, opprinnelig problem og «Gjenstår». Ingen linjer utelates.
2. **Ny skill `/status`.** Kun lesing. Åpne issues er hovedsignalet (uptime og vaktjobber melder
   funn som issues, ikke røde kjøringer); i tillegg siden, Dependabot- og CodeQL-varsler, og
   siste kjøringer per workflow. Fast tabell og én konklusjonslinje.
3. **`/commit` 5d → eksplisitt verifisering** av at problemet som utløste oppgaven er borte, ikke
   bare at fiksen er merget (lukket varsel/issue, eller manuelt startet workflow grønn).
4. **`scripts/apps-script/SyncOnEdit.gs`.** Versjonert kopi av Apps Script-et som starter bygg ved
   Drive-endringer (versjonen med `LAST_CHECK` og logging, installert 2026-10-10 og verifisert
   med et Drive-bygg 2026-10-12). Kjente begrensninger står i fil-headeren. Lenket fra README.

## Verifisering

- Hver kommando i `/status` er kjørt manuelt mot repoet. `--workflow "CodeQL"` er tvetydig
  (to workflows heter det), så skillen bruker `codeql.yml`.
- Kvalitetsporten kjøres fordi `scripts/` ikke er dokumentasjon, selv om ingen verktøy plukker
  opp `.gs` (eslint matcher bare js/ts, vitest bare `__tests__`).
