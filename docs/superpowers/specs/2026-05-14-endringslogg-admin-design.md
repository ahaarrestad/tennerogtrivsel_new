# Design: Endringslogg for admin-panelet

**Dato:** 2026-05-14
**Status:** Godkjent

## Mål

Logg hvem som gjør hvilke endringer i admin-panelet, inkludert gamle og nye verdier. Loggen skal være synlig som en egen fane i admin-UI-et og lesbar direkte på Google Drive. Støtter flere brukere med potensielt ulike rettigheter.

## Tilnærming

Eget Google Sheets-regneark for endringsloggen, atskilt fra innholds-regnearket. Spreadsheet-IDen lagres som innstillingen `endringsloggId` i det eksisterende Innstillinger-arket. Ingen ny infrastruktur (AWS/Lambda).

## Tilgangskontroll

### Prinsipp

**Skrivetilgang i admin forutsetter at brukeren kan skrive til endringsloggen.** Hvis ikke, er alle skriveoperasjoner blokkert — bortsett fra Innstillinger-modulen (der eieren konfigurerer `endringsloggId`).

### Tilgangssjekk ved oppstart

Kjøres parallelt med eksisterende tilgangssjekk mot hovedregnearket:

| Tilstand | UI-konsekvens |
|---|---|
| `endringsloggId` ikke konfigurert | Banner: *«Endringslogg ikke konfigurert — kontakt administrator»*. Innstillinger-modulen åpen, alle andre skriveoperasjoner deaktivert. |
| `endringsloggId` satt, men ikke skrivbart | Banner: *«Du mangler skrivetilgang til endringsloggen — kontakt administrator»*. Alle skriveoperasjoner deaktivert. |
| Tilgang OK | Normal drift. |

### Rekkefølge ved skriveoperasjoner

1. Utfør skriveoperasjonen mot hovedregnearket
2. Kall `logAudit` etterpå

Hvis `logAudit` feiler etter at skriveoperasjonen er gjennomført (f.eks. nettverkshikke): vis advarsel — *«Endringen ble lagret, men kunne ikke logges»* — og logg til konsoll. Ingen rollback.

Begrunnelse: init-sjekken er den strukturelle gaten. Feil ved kjøretid er sjeldne og forbigående; det er viktigere at endringen gjennomføres enn at logging alltid lykkes.

### Kjent begrensning

Siden admin er klient-side og bruker brukerens OAuth-token, kan kun brukere med editor-tilgang til logg-regnearket logge. Eieren må dele logg-regnearket med alle admin-brukere ved oppsett.

## Oppsett (manuelt, av eier)

1. Opprett et nytt Google Sheets-regneark («Endringslogg»)
2. Del det med alle admin-brukere (editor-tilgang)
3. Lagre spreadsheet-IDen som innstillingen `endringsloggId` i Innstillinger-arket
4. Valgfritt: beskytt arket med «Protected range» slik at eksisterende rader ikke kan redigeres manuelt av andre enn eieren

## Datamodell

### Arkkonfigurering

Arket «Endringslogg» i logg-regnearket. Opprettes automatisk første gang en loggoppføring skrives.

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
- `logAudit(auditSpreadsheetId, modul, handling, entitet, endringer)` — kaller `appendAuditEntry`. Ved feil: vis advarsel til bruker og logg til konsoll. Kaster ikke videre.

### Tillegg i `src/scripts/admin-sheets.js`

- `ensureEndringsloggSheet(spreadsheetId)` — delegerer til `ensureSheet` med kolonner `['Tidspunkt', 'Bruker', 'Modul', 'Handling', 'Entitet', 'Endringer']`
- `appendAuditEntry(spreadsheetId, { tidspunkt, bruker, modul, handling, entitet, endringer })` — appender én rad til «Endringslogg»-arket

### Tillegg i `src/scripts/admin-init.js`

Tilgangssjekk for audit-regneark kjøres parallelt med eksisterende `checkAccess`-kall. Resultatet lagres i admin-konfigurasjonen og brukes til å aktivere/deaktivere skriveknapper i alle moduler.

### Instrumenterte moduler

Alle eksisterende admin-moduler for skriveoperasjoner:

| Modul | Operasjoner som logges | Unntak |
|---|---|---|
| `admin-module-tannleger.js` | opprett, rediger, slett tannlege | — |
| `admin-module-bilder.js` | opprett, rediger, slett bilde; sett forsidebilde/fellesbilde | — |
| `admin-module-prisliste.js` | opprett, rediger, slett prisrad; endre kategori-rekkefølge | — |
| `admin-module-settings.js` | oppdater innstilling | Kan skrive uten logg-tilgang (for å konfigurere `endringsloggId`) |
| `admin-module-meldinger.js` | opprett, rediger, slett melding | — |
| `admin-module-kontaktskjema.js` | oppdater kontaktskjema-felt | — |

### Ny fil: `src/scripts/admin-module-endringslogg.js`

UI-modul for visning av loggen:

- Leser «Endringslogg»-arket via `gapi.client.sheets` fra logg-regnearket
- Viser siste 100 oppføringer, nyeste øverst
- «Last eldre»-knapp for paginering
- Dropdown-filter for modul (Alle / Tannleger / Galleri / osv.)
- Diff-kolonnen er klikk-ekspanderbar
- Viser «Du har ikke lesetilgang til endringsloggen» ved tilgangsfeil

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

| Scenario | Håndtering |
|---|---|
| `endringsloggId` ikke konfigurert ved init | Banner, skriveoperasjoner deaktivert (unntatt Innstillinger) |
| Ingen skrivetilgang ved init | Banner, skriveoperasjoner deaktivert |
| `logAudit` feiler etter vellykket skriveoperasjon | Advarsel til bruker, konsoll-feil, ingen rollback |
| Ingen lesetilgang i Endringslogg-fanen | Melding i fanen: «Du har ikke lesetilgang til endringsloggen» |

## Testing

### `admin-audit.test.js` (ny)

- `diffObjects`: ingen endring → tomt objekt; enkeltfelt; flere felt; typekasting (tall vs. streng); undefined/null-felt ignoreres
- `getAuditUser`: returnerer e-post fra mocket sessionStorage; returnerer `'ukjent'` om token mangler
- `logAudit`: viser advarsel ved feil; kaller `appendAuditEntry` med riktige argumenter

### `admin-sheets.test.js` (utvidelse)

- `ensureEndringsloggSheet`: verifiserer kall til `ensureSheet` med riktige kolonnenavn
- `appendAuditEntry`: verifiserer at `gapi.client.sheets.spreadsheets.values.append` kalles med korrekt rad

### `admin-module-endringslogg.test.js` (ny)

- Rendrer tabell med mocket arkdata
- Modul-filter viser kun riktige rader
- «Last eldre»-knapp vises etter 100 oppføringer
- Diff ekspanderer/kollapser ved klikk
- Viser tilgangsfeil-melding ved API-feil

### `admin-init.test.js` (utvidelse)

- Audit-tilgangssjekk kjøres parallelt med hovedregneark-sjekk
- Skriveknapper deaktiveres hvis audit-tilgang mangler
- Innstillinger-modulen forblir skrivbar uten audit-tilgang

### Eksisterende modultester (utvidelse)

Én test per modul verifiserer at:
1. Skriveoperasjonen utføres før `logAudit` kalles
2. `logAudit` kalles med korrekt `modul`, `handling` og `entitet`

Bruker `vi.spyOn` med kall-rekkefølge-verifisering.
