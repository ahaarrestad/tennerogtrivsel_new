# Fast kvittering, /status og versjonert SyncOnEdit

**Mål:** brukeren skal ikke trenge å spørre om alt er sjekket, reviewet og virker.

**Bakgrunn:** I økten 2026-10-03–14 spurte brukeren gjentatte ganger «funker alt?» og om ting var
sjekket. Sluttrapportene varierte i form, og helsesjekken ble satt sammen på nytt hver gang.

## Endringer

1. **`/commit` Step 6 → fast kvittering.** Sjekkliste med ✅/⏭️/❌ for commit, kvalitetsport, review,
   push/PR, deploy, opprinnelig problem og «Gjenstår». Ingen linjer utelates.
2. **Ny skill `/status`.** Kun lesing: siden, uptime, kjøringer siste ~7 dager, åpne
   Dependabot-varsler, issues/PR-er, siste Drive-bygg. Fast tabell og én konklusjonslinje.
3. **`/commit` 5d → eksplisitt verifisering** av at problemet som utløste oppgaven er borte, ikke
   bare at fiksen er merget (lukket varsel/issue, eller manuelt startet workflow grønn).
4. **`scripts/apps-script/SyncOnEdit.gs`.** Versjonert kopi av Apps Script-et som starter bygg ved
   Drive-endringer (versjonen med `LAST_CHECK` og logging fra 2026-10-10). Lenket fra README.

## Verifisering

- Kommandoene i `/status` er kjørt manuelt mot repoet (alert-filter `?state=open`, 100 kjøringer
  dekker ~11 dager).
- Kvalitetsporten kjøres fordi `scripts/` ikke er dokumentasjon. `.gs` lintes ikke (eslint matcher
  bare js/ts).
