# Design: Endringslogg for admin-panelet

**Dato:** 2026-05-14
**Status:** Godkjent

## Mål

Logg hvem som gjør hvilke endringer i admin-panelet, inkludert gamle og nye verdier. Loggen skal være synlig som en egen fane i admin-UI-et og lesbar direkte på Google Drive.

## Tilnærming

Google Sheets «Endringslogg»-ark i eksisterende regneark. Konsistent med eksisterende «Slettet»-ark-mønster. Ingen ny infrastruktur.

## Datamodell

### Arkkonfigurering

Nytt ark «Endringslogg» i spreadsheet. Opprettes automatisk første gang en loggoppføring skrives.

**Kolonner:**

| Kolonne | Navn | Eksempel |
|---|---|---|
| A | Tidspunkt | `2026-05-14T12:34:56.789Z` |
| B | Bruker | `asbjorn@aarrestad.com` |
| C | Modul | `tannleger` |
| D | Handling | `redigerte` |
| E | Entitet | `Kari Holm` |
| F | Endringer | JSON-streng (se nedenfor) |

### Handlinger

Tre mulige verdier: `opprettet`, `redigerte`, `slettet`. Rekkefølgeendringer og toggle-endringer behandles som `redigerte`.

### Endringer-felt

**opprettet:**
```json
{ "_ny": { "navn": "Kari Holm", "tittel": "Tannlege", "aktiv": true } }
```

**redigerte:**
```json
{ "navn": {"fra": "Kari", "til": "Kari Holm"}, "aktiv": {"fra": false, "til": true} }
```
Kun felt som faktisk endret seg inkluderes.

**slettet:**
```json
{ "_slettet": { "navn": "Kari Holm", "tittel": "Tannlege", "aktiv": true } }
```

### Markdown-filer (.md på Google Drive)

Frontmatter-felt logges som strukturert diff. Body-teksten logges ikke — Google Drive har innebygd versjonshistorikk. I stedet brukes et boolsk flagg:

```json
{
  "title": {"fra": "Stengt påske", "til": "Stengt påsken 2026"},
  "endDate": {"fra": "2026-04-17", "til": "2026-04-20"},
  "innholdEndret": true
}
```

For opprettet/slettet inkluderes tegntall for body:
```json
{ "_ny": { "title": "...", "startDate": "...", "endDate": "...", "innhold": "142 tegn" } }
```

## Kodestruktur

### Ny fil: `src/scripts/admin-audit.js`

Samler all audit-logikk:

- `diffObjects(oldObj, newObj)` — returnerer `{felt: {fra, til}}` for felt som faktisk endret seg
- `getAuditUser()` — henter `email` fra sessionStorage-tokenet, returnerer `'ukjent'` om token mangler
- `logAudit(spreadsheetId, modul, handling, entitet, endringer)` — kaller `appendAuditEntry`, fire-and-forget med `.catch(console.error)`. Feiler stille siden operasjonen allerede er fullført.

### Tillegg i `src/scripts/admin-sheets.js`

- `ensureEndringsloggSheet(spreadsheetId)` — delegerer til `ensureSheet` med kolonner `['Tidspunkt', 'Bruker', 'Modul', 'Handling', 'Entitet', 'Endringer']`
- `appendAuditEntry(spreadsheetId, { tidspunkt, bruker, modul, handling, entitet, endringer })` — appender én rad til «Endringslogg»-arket

### Instrumenterte moduler

Alle eksisterende admin-moduler for skriveoperasjoner:

| Modul | Operasjoner som logges |
|---|---|
| `admin-module-tannleger.js` | opprett, rediger, slett tannlege |
| `admin-module-bilder.js` | opprett, rediger, slett bilde; sett forsidebilde/fellesbilde |
| `admin-module-prisliste.js` | opprett, rediger, slett prisrad; endre kategori-rekkefølge |
| `admin-module-settings.js` | oppdater innstilling |
| `admin-module-meldinger.js` | opprett, rediger, slett melding |
| `admin-module-kontaktskjema.js` | oppdater kontaktskjema-felt |

### Ny fil: `src/scripts/admin-module-endringslogg.js`

UI-modul for visning av loggen:

- Leser «Endringslogg»-arket via `gapi.client.sheets`
- Viser siste 100 oppføringer, nyeste øverst
- «Last eldre»-knapp for paginering
- Dropdown-filter for modul (Alle / Tannleger / Galleri / osv.)
- Diff-kolonnen er klikk-ekspanderbar

### HTML

Ny fane «Endringslogg» legges bakerst i admin-navigasjonen i `src/pages/admin/index.astro`.

## UI-design

**Tabell-kolonner:**

| Tidspunkt | Bruker | Modul | Handling | Entitet | Endringer |
|---|---|---|---|---|---|
| 14. mai 2026, 12:34 | asbjorn@... | `tannleger` (chip) | `redigerte` (gul) | Kari Holm | ▶ Se endringer |

Fargekoding for Handling:
- `opprettet` — grønn
- `redigerte` — gul
- `slettet` — rød

## Feilhåndtering

Audit-logging er best-effort. `logAudit` kaster aldri — feil logges til konsoll med `console.error`. Bruker ser ingen feilmelding for audit-feil.

## Testing

### `admin-audit.test.js` (ny)

- `diffObjects`: ingen endring → tomt objekt; enkeltfelt; flere felt; typekasting (tall vs. streng); undefined/null-felt ignoreres
- `getAuditUser`: returnerer e-post fra mocket sessionStorage; returnerer `'ukjent'` om token mangler

### `admin-sheets.test.js` (utvidelse)

- `ensureEndringsloggSheet`: verifiserer kall til `ensureSheet` med riktige kolonnenavn
- `appendAuditEntry`: verifiserer at `gapi.client.sheets.spreadsheets.values.append` kalles med korrekt rad

### `admin-module-endringslogg.test.js` (ny)

- Rendrer tabell med mocket arkdata
- Modul-filter viser kun riktige rader
- «Last eldre»-knapp vises etter 100 oppføringer
- Diff ekspanderer/kollapser ved klikk

### Eksisterende modultester (utvidelse)

Én test per modul verifiserer at `logAudit` kalles med korrekt `modul`, `handling` og `entitet` etter skriveoperasjon. Bruker `vi.spyOn` — verifiserer at funksjonen ble kalt, ikke awaitet.
