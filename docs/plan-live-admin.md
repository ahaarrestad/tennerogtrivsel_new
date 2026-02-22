# Plan: Forbedre admin-opplevelsen — «live» følelse

## Bakgrunn

Oppgaven var å utrede backend-alternativer for mer «live» oppdatering. Etter analyse av nåværende system og diskusjon med bruker, ble konklusjonen:

- **Admin-panelet er allerede ganske «live»** — ingen caching, fersk data ved modul-åpning
- **Nettsiden kan henge litt etter** — det er OK (statisk site, rebuild+deploy)
- **Kjerneproblemet:** Usikkerhet om lagring faktisk gikk gjennom til Google Sheets

**Beslutning:** Beholder Google Sheets som backend. Forbedrer admin-opplevelsen med bedre feedback i stedet for å bytte teknologi.

## Valgte forbedringer

### 1. Stille verifisering etter lagring
- Etter vellykket write til Sheets, hent verdien tilbake i bakgrunnen
- Sammenlign med det som ble lagret
- **Match** → vis bekreftelse med tidspunkt
- **Mismatch** → last hele modulen på nytt automatisk

### 2. Bedre feedback med tidspunkt
- Lagremeldingen inkluderer tidspunkt: "✅ 22. feb kl. 14:32"
- Tooltip beholdes: "Publiseres automatisk om noen minutter"
- Feilmelding: "❌ Lagring feilet"
- Mismatch-varsel: "⚠️ Laster på nytt…"

### 3. "Sist hentet"-tid i modul-header
- Vises øverst i innstillinger-modulen: "Sist hentet: 22. feb kl. 14:32"
- Oppdateres ved modul-lasting og etter verifisering

## Scope

| Fase | Modul | Status |
|------|-------|--------|
| 1 | Innstillinger | Ferdig |
| 2 | Galleri | Ferdig |
| 3 | Tannleger | Ferdig |

## Filer som ble endret

| Fil | Endring |
|-----|---------|
| `src/scripts/admin-dashboard.js` | `formatTimestamp()`, `updateLastFetchedTime()`, oppdatert `saveSingleSetting()`, "Sist hentet" i tannleger- og galleri-lister |
| `src/pages/admin/index.astro` | Import, "Sist hentet"-header i innstillinger, stille verifisering i tannlege- og galleri-lagring |
| Tester | Nye/oppdaterte tester for verifisering og tidspunkt |

## Tekniske detaljer

### saveSingleSetting() — ny flyt
```
1. Bruker blur → sjekk om verdi endret
2. Vis spinner
3. Write til Sheets (updateSettings / updateSettingByKey)
4. Oppdater lokalt currentSettings[index].value
5. Re-fetch: kall getSettingsWithNotes(sheetId)
6. Oppdater "Sist hentet"-tid
7. Finn innstillingen med matchende id, sammenlign:
   - Match → vis "✅ 22. feb kl. 14:32" (forsvinner etter 5s)
   - Mismatch → vis "⚠️ Laster på nytt…", kall onReload()
8. Hvis verifisering feiler (nettverksfeil) → logg advarsel, vis lagret-melding uansett
```

### formatTimestamp()
Ny hjelpefunksjon som formaterer Date til "22. feb kl. 14:32" (norsk kort-format).

### Ny parameter: onReload
`saveSingleSetting()` tar en ny 5. parameter `onReload` — en callback som kalles ved mismatch for å laste modulen på nytt.

## Forkastede alternativer

| Alternativ | Hvorfor forkastet |
|------------|-------------------|
| Firebase Realtime DB | Overkill — admin er allerede rask nok, nettsiden trenger ikke sanntid |
| Supabase | Ekstra kompleksitet uten reell gevinst |
| Cloudflare KV/D1 | Krever migrering av all dataflyt |
| Hybrid (live admin + statisk site) | Introduserer ny arkitektur uten klar nytte |
