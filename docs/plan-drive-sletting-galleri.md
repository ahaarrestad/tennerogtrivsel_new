# Plan: Slett Drive-fil ved sletting av galleribilde og tannlege

## Bakgrunn

Når et galleribilde eller en tannlege slettes fra admin-panelet, fjernes kun
Sheet-raden. Bildefilen i Google Drive forblir. Meldinger og Tjenester bruker
`deleteFile()` korrekt, men galleri- og tannlege-modulene mangler dette steget.

Over tid samler det seg foreldreløse filer i Drive-mappene. Planen inkluderer
derfor også en orphan-deteksjon som viser admin-brukeren hvilke filer som finnes
i Drive men ikke i Sheet.

## Del 1: Galleri — Drive-sletting

### Steg 1: Imports

**Fil:** `src/scripts/admin-module-bilder.js`

Legg til `findFileByName` og `deleteFile` i importen fra `admin-client.js`.

### Steg 2: Oppdater `deleteGalleriBilde`

Ny flyt:
1. Hent bildefilnavnet fra Sheet-raden via `getGalleriRaw()` **før** sletting
2. Slett Sheet-raden med `deleteGalleriRowPermanently()`
3. Best-effort Drive-sletting: `findFileByName()` → `deleteFile()`
4. Oppdater toast-melding til å nevne Drive-papirkurven

**Designvalg:**
- Sheet-sletting først — hvis Drive feiler, forsvinner bildet fra listen uansett
- Drive-sletting i egen try/catch (best-effort) — feiler den, logges warning men
  brukeren får suksessmelding om Sheet-slettingen
- `parentFolderId` er allerede i scope (closure fra `loadBilderModule`)

```js
const deleteGalleriBilde = async (rowIndex, title) => {
    if (!await showConfirm(`Vil du slette «${title}» permanent? ...`)) return;
    try {
        const galleriItems = await getGalleriRaw(SHEET_ID);
        const item = galleriItems.find(g => g.rowIndex === rowIndex);
        const imageName = item?.image;

        await deleteGalleriRowPermanently(SHEET_ID, rowIndex);

        if (imageName) {
            try {
                const file = await findFileByName(imageName, parentFolderId);
                if (file) await deleteFile(file.id);
            } catch (driveErr) {
                console.warn('[Admin] Kunne ikke slette Drive-fil:', driveErr);
            }
        }

        showDeletionToast(title, 'Bildet ble slettet fra regnearket og lagt i Drive-papirkurven.');
        reloadGalleriListe();
    } catch (e) {
        showToast('Kunne ikke slette bildet: ' + e.message, 'error');
    }
};
```

## Del 2: Tannleger — Drive-sletting

**Identisk bug.** `deleteTannlege()` i `admin-module-tannleger.js` kaller kun
`deleteTannlegeRowPermanently()`. Tannleger har et `image`-felt (kolonne D) med
Drive-filnavn.

### Steg 1: Imports

**Fil:** `src/scripts/admin-module-tannleger.js`

Legg til `findFileByName` og `deleteFile` i importen fra `admin-client.js`.

### Steg 2: Oppdater `deleteTannlege`

Samme mønster som galleri — hent `rowData.image` (som allerede hentes for
backup), finn Drive-fil, slett den etter Sheet-raden.

```js
async function deleteTannlege(rowIndex, name) {
    const { SHEET_ID } = getAdminConfig();
    if (await showConfirm(`Vil du slette «${name}» permanent? ...`)) {
        try {
            const allRows = await getTannlegerRaw(SHEET_ID);
            const rowData = allRows.find(r => r.rowIndex === rowIndex);
            if (rowData) {
                await backupToSlettetSheet(SHEET_ID, 'tannlege', rowData.name, JSON.stringify(rowData));
            }
            await deleteTannlegeRowPermanently(SHEET_ID, rowIndex);

            // Drive-sletting (best-effort)
            const imageName = rowData?.image;
            if (imageName) {
                try {
                    const { TANNLEGER_FOLDER } = getAdminConfig();
                    const file = await findFileByName(imageName, TANNLEGER_FOLDER);
                    if (file) await deleteFile(file.id);
                } catch (driveErr) {
                    console.warn('[Admin] Kunne ikke slette Drive-fil:', driveErr);
                }
            }

            reloadTannleger();
            showDeletionToast(name,
                'Profilen er slettet fra regnearket og bildet lagt i Drive-papirkurven. ' +
                'En sikkerhetskopi finnes i «Slettet»-fanen.');
        } catch (e) { showToast("Kunne ikke slette profilen.", "error"); }
    }
}
```

**Merk:** Tannleger har allerede `rowData` tilgjengelig (brukes til backup), så
vi trenger ikke et ekstra `getRaw()`-kall — vi gjenbruker `rowData.image`.

## Del 3: Orphan-deteksjon — filer i Drive uten Sheet-rad

### Konsept

Når admin laster galleri- eller tannleger-listen, sammenlign Drive-innhold med
Sheet-innhold og vis en advarsel hvis det finnes foreldreløse filer.

### Steg 1: Hjelpefunksjon `findOrphanedFiles`

**Fil:** `src/scripts/admin-module-bilder.js` (og tilsvarende i tannleger)

```js
async function findOrphanedFiles(sheetItems, folderId) {
    const driveFiles = await listImages(folderId);
    const sheetFileNames = new Set(sheetItems.map(item => item.image).filter(Boolean));
    return driveFiles.filter(f => !sheetFileNames.has(f.name));
}
```

### Steg 2: Vis advarsel i galleri-modulen

Etter at gallerilisten er lastet, kjør orphan-sjekk og vis en info-boks:

```
⚠ 3 filer i Drive-mappen finnes ikke i regnearket:
  - bilde1.jpg
  - bilde2.png
  - gammelt-foto.jpg
Disse kan slettes manuelt fra Google Drive.
```

Implementer som en enkel `showToast()` med type `'warning'` eller en dedikert
info-seksjon i admin-panelet. Kjøres asynkront etter listen er vist (ikke
blokkerende).

### Steg 3: Tilsvarende i tannleger-modulen

Samme mønster — sammenlign `TANNLEGER_FOLDER`-innhold med Sheet-data.

## Teststrategi

### Galleri-tester (`admin-module-bilder.test.js`)

Oppdater eksisterende delete-tester og legg til nye:

| Test | Hva den verifiserer |
|------|-------------------|
| Slett bilde — happy path | `getGalleriRaw` → `deleteRow` → `findFileByName` → `deleteFile` |
| Bruker avbryter | Ingen API-kall etter `showConfirm(false)` |
| Tom `image`-felt | Hopper over `findFileByName`/`deleteFile` |
| Rad ikke funnet i Sheet | Hopper over Drive-sletting |
| Fil ikke funnet i Drive | `findFileByName` → null, `deleteFile` kalles ikke |
| Drive-sletting feiler | Best-effort: toast vises, ingen error til bruker |
| Sheet-sletting feiler | Error-toast, Drive-sletting forsøkes ikke |

### Tannleger-tester (`admin-module-tannleger.test.js`)

Tilsvarende tester som for galleri, tilpasset tannleger-flyten (backup-steg osv).

### Orphan-deteksjon tester

| Test | Hva den verifiserer |
|------|-------------------|
| Ingen orphans | Ingen advarsel vises |
| 2 orphans funnet | Advarsel med filnavn vises |
| `listImages` feiler | Ingen advarsel, ingen crash (best-effort) |

### Coverage-branches som dekkes

Galleri: `imageName` truthy/falsy, `file` found/null, Drive-error, Sheet-error
Tannleger: `rowData?.image` truthy/falsy, `file` found/null, Drive-error
Orphan: orphans.length > 0 / === 0, listImages-feil

## Filer som endres

| Fil | Endring |
|-----|---------|
| `src/scripts/admin-module-bilder.js` | Import `findFileByName`, `deleteFile`, `listImages`. Oppdater `deleteGalleriBilde()`. Legg til orphan-deteksjon. |
| `src/scripts/admin-module-tannleger.js` | Import `findFileByName`, `deleteFile`, `listImages`. Oppdater `deleteTannlege()`. Legg til orphan-deteksjon. |
| `src/scripts/__tests__/admin-module-bilder.test.js` | Oppdater mocks/imports. Nye delete- og orphan-tester. |
| `src/scripts/__tests__/admin-module-tannleger.test.js` | Oppdater mocks/imports. Nye delete- og orphan-tester. |

**Ingen andre filer endres.** `deleteFile`, `findFileByName` og `listImages`
finnes allerede i `admin-drive.js` og re-eksporteres via `admin-client.js`.
