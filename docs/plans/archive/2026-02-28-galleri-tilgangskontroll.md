# Plan: Galleri krever tilgang til både Google Sheet og Bilder-mappen

## Bakgrunn

Bilder-modulen (galleri) i admin-panelet krever i praksis tilgang til to Google Drive-ressurser:

1. **`SHEET_ID`** — for å lese/skrive galleri-data i Google Sheets (`galleri!A:I`)
2. **En Drive-mappe for bilder** — for å browse, laste opp og vise thumbnails

I dag utledes bildemappen dynamisk som **foreldemappen til regnearket** via `getSheetParentFolder(SHEET_ID)`. Det betyr at bildene deler mappe med regnearket (Innstillinger-mappen). `enforceAccessControl()` sjekker kun tilgang til `SHEET_ID` for Bilder-modulen — ikke til mappen.

### Problemet

1. En bruker med Sheet-tilgang men uten Drive-mappetilgang ser Bilder-kortet, men modulen feiler ved lasting
2. Bildene ligger blandet med regnearket istedenfor i en dedikert mappe

### Dagens kode

**Tilgangskontroll** (`admin-dashboard.js`):
```js
{ id: 'bilder', resource: config.SHEET_ID, card: 'card-bilder' }
```

**Bildemodul** (`admin-module-bilder.js`):
```js
const parentFolderId = await getSheetParentFolder(SHEET_ID);
```

**Sync** (`sync-data.js`) — to steder utleder mappe dynamisk:
```js
// syncForsideBilde (linje ~289)
const sheetMeta = await drive.files.get({ fileId: config.spreadsheetId, fields: 'parents' });
const forsideFolderId = sheetMeta.data.parents?.[0];

// syncGalleri (linje ~383)
const sheetMeta = await drive.files.get({ fileId: config.spreadsheetId, fields: 'parents' });
const folderId = sheetMeta.data.parents?.[0];
```

## Valgt tilnærming: Ny dedikert `BILDER_FOLDER`

Opprett en egen Google Drive-mappe for bilder og konfigurer den med miljøvariabelen `PUBLIC_GOOGLE_DRIVE_BILDER_FOLDER_ID`. Følger samme mønster som `TJENESTER_FOLDER`, `TANNLEGER_FOLDER` og `MELDINGER_FOLDER`.

**Fordeler:**
- Bilder separert fra regnearket — renere Drive-struktur
- Konsistent med de andre modulenes mappe-mønster
- Eksplisitt konfigurasjon — ingen dynamisk utledning med ekstra API-kall
- Tilgangskontroll kan sjekke mappen direkte

**Avveining:**
- Krever at bildene flyttes til den nye mappen i Google Drive (manuelt engangsjobb)
- Én ekstra env-variabel

## Steg

### Steg 1: Opprett mappe og legg til miljøvariabel

- Opprett en ny mappe «Bilder» i Google Drive (samme nivå som Tjenester, Meldinger, Tannleger)
- Flytt eksisterende galleribilder dit
- Legg til `PUBLIC_GOOGLE_DRIVE_BILDER_FOLDER_ID` i:
  - `.env.example`
  - `.env` (lokalt)
  - `.github/workflows/`-filer (deploy, evt. andre som refererer til Drive-IDer)
  - GitHub Secrets

### Steg 2: Legg til i admin-config

**`src/pages/admin/index.astro`** (frontmatter):
```js
const BILDER_FOLDER = import.meta.env.PUBLIC_GOOGLE_DRIVE_BILDER_FOLDER_ID;
```
Legg til `data-bilder-folder={BILDER_FOLDER}` på `#admin-config`-elementet.

**`src/scripts/admin-editor-helpers.js`** (`getAdminConfig()`):
```js
BILDER_FOLDER: configEl?.dataset.bilderFolder,
```

### Steg 3: Oppdater `enforceAccessControl`

**`src/scripts/admin-dashboard.js`:**

Endre Bilder-modulen fra enkel sjekk til multi-ressurs (samme mønster som Tannleger):

```js
// Før:
{ id: 'bilder', resource: config.SHEET_ID, card: 'card-bilder' }

// Etter:
{ id: 'bilder', resources: [config.SHEET_ID, config.BILDER_FOLDER], card: 'card-bilder' }
```

Legg til `config.BILDER_FOLDER` i `ids`-arrayet som sendes til `checkMultipleAccess`.

### Steg 4: Bruk `BILDER_FOLDER` i bildemodulen

**`src/scripts/admin-module-bilder.js`:**

```js
// Før:
const { SHEET_ID } = getAdminConfig();
const parentFolderId = await getSheetParentFolder(SHEET_ID);

// Etter:
const { SHEET_ID, BILDER_FOLDER } = getAdminConfig();
const parentFolderId = BILDER_FOLDER || await getSheetParentFolder(SHEET_ID);
```

Beholder `getSheetParentFolder()` som fallback for bakoverkompatibilitet (dersom env-variabelen ikke er satt ennå).

### Steg 5: Bruk `BILDER_FOLDER` i sync-data

**`src/scripts/sync-data.js`:**

Legg til `bilderFolderId` i `getConfig()`:
```js
bilderFolderId: process.env.PUBLIC_GOOGLE_DRIVE_BILDER_FOLDER_ID,
```

**`syncForsideBilde()`** (~linje 280):
```js
// Før: dynamisk utledning via drive.files.get
const sheetMeta = await drive.files.get({ fileId: config.spreadsheetId, fields: 'parents' });
const forsideFolderId = sheetMeta.data.parents?.[0];

// Etter: bruk config med fallback
let forsideFolderId = config.bilderFolderId;
if (!forsideFolderId) {
    const sheetMeta = await drive.files.get({ fileId: config.spreadsheetId, fields: 'parents' });
    forsideFolderId = sheetMeta.data.parents?.[0];
}
```

**`syncGalleri()`** (~linje 373): Samme mønster — bruk `config.bilderFolderId` med fallback.

### Steg 6: Oppdater tester

**`src/scripts/__tests__/admin-dashboard.test.js`:**
- Oppdater eksisterende `enforceAccessControl`-tester til å inkludere `BILDER_FOLDER` i config
- Legg til test: Bilder skjules når bruker har `SHEET_ID` men **ikke** `BILDER_FOLDER`
- Legg til test: Bilder vises når bruker har **begge**
- Oppdater øvrige tester som verifiserer Bilder-synlighet

**`src/scripts/__tests__/admin-module-bilder.test.js`:**
- Oppdater `getAdminConfig`-mock til å inkludere `BILDER_FOLDER`
- Test fallback: `BILDER_FOLDER` er `undefined` → kaller `getSheetParentFolder`
- Test primær: `BILDER_FOLDER` er satt → bruker den direkte (ingen API-kall)

**`src/scripts/__tests__/sync-data.test.js`:**
- Oppdater `getConfig`-mock til å inkludere `bilderFolderId`
- Test at `syncForsideBilde` og `syncGalleri` bruker `bilderFolderId` når satt
- Test fallback: `bilderFolderId` er `undefined` → dynamisk utledning fra Sheet-forelder

### Steg 7: Oppdater dokumentasjon

**`docs/architecture/sikkerhet.md`** — oppdater modul-ressurs-tabellen:

| Modul | Krever tilgang til | Logikk |
|-------|-------------------|--------|
| Bilder | `SHEET_ID` + `BILDER_FOLDER` | Begge må være tilgjengelige |

**`docs/architecture/bildehåndtering.md`** — oppdater datflytseksjonen:
- Bildene ligger nå i en dedikert `BILDER_FOLDER`, ikke i Sheet-foreldemappen
- Beskriv fallback-mekanismen

## Filer som endres

| Fil | Endring |
|-----|---------|
| `.env.example` | Ny variabel `PUBLIC_GOOGLE_DRIVE_BILDER_FOLDER_ID` |
| `.github/workflows/deploy.yml` | Ny env-variabel |
| `src/pages/admin/index.astro` | Ny `data-bilder-folder`-attributt |
| `src/scripts/admin-editor-helpers.js` | Ny `BILDER_FOLDER` i `getAdminConfig()` |
| `src/scripts/admin-dashboard.js` | Oppdatert tilgangssjekk for Bilder |
| `src/scripts/admin-module-bilder.js` | Bruk `BILDER_FOLDER` med fallback |
| `src/scripts/sync-data.js` | Bruk `bilderFolderId` i config + fallback |
| `src/scripts/__tests__/admin-dashboard.test.js` | Nye/oppdaterte tester |
| `src/scripts/__tests__/admin-module-bilder.test.js` | Nye/oppdaterte tester |
| `src/scripts/__tests__/sync-data.test.js` | Nye/oppdaterte tester |
| `docs/architecture/sikkerhet.md` | Oppdatert tabell |
| `docs/architecture/bildehåndtering.md` | Oppdatert dataflyt |

## Manuell engangsjobb (utenfor kodebasen)

1. Opprett mappen «Bilder» i Google Drive
2. Del mappen med samme brukere/grupper som har tilgang til de andre mappene
3. Flytt eksisterende galleribilder fra Innstillinger-mappen til Bilder-mappen
4. Sett `PUBLIC_GOOGLE_DRIVE_BILDER_FOLDER_ID` i miljøet

## Avgrensninger

- **`getSheetParentFolder()` beholdes** — brukes som fallback og kan ha andre bruksområder
- **Ingen endring i `admin-init.js`** — `handleAuth()` sender hele config-objektet; ny nøkkel følger med automatisk
- **Bakoverkompatibel** — fallback til dynamisk utledning sikrer at eksisterende oppsett fungerer under migrering
