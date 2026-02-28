# Plan: Drive-sletting og toveis konsistenssjekk for galleri og tannleger

## Bakgrunn

Når et galleribilde eller en tannlege slettes fra admin-panelet, fjernes kun
Sheet-raden. Bildefilen i Google Drive forblir. Meldinger og Tjenester bruker
`deleteFile()` korrekt, men galleri- og tannlege-modulene mangler dette steget.

I tillegg kan det over tid oppstå inkonsistens begge veier:
- **Drive → Sheet:** Filer i Drive som ikke refereres av noen Sheet-rad
- **Sheet → Drive:** Sheet-rader som refererer et filnavn som ikke finnes i Drive

Inkonsistens må håndteres på tre nivåer: admin-panelet (sanntid), sync-data
(byggetid), og frontend (visning).

## Del 1: Galleri — Drive-sletting ved slett

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

## Del 2: Tannleger — Drive-sletting ved slett

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

## Del 3: Toveis konsistenssjekk i admin-panelet

### Konsept

Når admin laster galleri- eller tannleger-listen, sammenlign Sheet-innhold med
Drive-innhold **begge veier** og vis advarsler.

### Steg 1: Hjelpefunksjon `checkConsistency`

Delt funksjon som kan brukes av begge moduler. Plasser i en ny hjelpefil eller
direkte i hver modul.

```js
async function checkConsistency(sheetItems, folderId) {
    const driveFiles = await listImages(folderId);
    const driveFileNames = new Set(driveFiles.map(f => f.name));
    const sheetFileNames = new Set(sheetItems.map(item => item.image).filter(Boolean));

    // Filer i Drive som ikke finnes i Sheet
    const orphanedInDrive = driveFiles.filter(f => !sheetFileNames.has(f.name));

    // Sheet-rader som refererer filer som ikke finnes i Drive
    const missingFromDrive = sheetItems.filter(item =>
        item.image && !driveFileNames.has(item.image)
    );

    return { orphanedInDrive, missingFromDrive };
}
```

### Steg 2: Vis advarsler i admin-panelet

Kjøres asynkront etter at listen er vist (ikke-blokkerende). Vis en info-boks
per retning:

**Filer i Drive uten Sheet-rad (info-tone, ikke alarm):**

Disse filene kan være bevisst opplastet i forkant — f.eks. bilder som venter på
å bli tilknyttet et nytt galleri-element eller en ny tannlege. Tonen skal være
informerende og løsningsorientert, ikke alarmerende.

```
ℹ 3 bilder i Drive-mappen er ikke koblet til noen rad i regnearket:
  • bilde1.jpg
  • bilde2.png
  • gammelt-foto.jpg
Disse kan brukes når du legger til nye elementer, eller slettes fra
Google Drive hvis de ikke lenger trengs.
```

**Sheet-rader uten Drive-fil (advarsel-tone):**

Disse er mer kritiske — en rad lover et bilde som ikke eksisterer, og nettsiden
vil vise "Bilde mangler".

```
⚠ 2 rader i regnearket refererer bilder som ikke finnes i Drive:
  • «Venterom» → venterom.jpg
  • «Behandlingsrom» → behandling.png
Bildene vil vises som «Bilde mangler» på nettsiden.
Last opp bildene på nytt, eller fjern filnavnet fra raden.
```

**Implementering:** Bruk `showToast()` med type `'warning'` for korte meldinger,
eller en dedikert konsistens-seksjon i admin-panelet dersom listen er lang.
Konsistenssjekken er best-effort — feiler `listImages()`, vises ingen advarsel.

### Steg 3: Tilsvarende i tannleger-modulen

Samme `checkConsistency()`-kall med `TANNLEGER_FOLDER`.

## Del 4: Konsistenssjekk i sync-data.js (byggetid)

### Nåværende oppførsel — allerede delvis på plass

`logWarning('Missing Asset', ...)` kalles allerede når en fil i Sheet ikke finnes
i Drive. I CI (GitHub Actions) gir dette `::warning`-annotasjoner som vises i
workflow-loggen. **Warnings på GitHub fungerer altså allerede per bilde.**

Men det er to svakheter:
1. JSON-filen skrives med det stale filnavnet (`image: 'manglende.jpg'`), selv om
   filen ikke ble lastet ned
2. Ingen samlet oppsummering — man må lete i loggen

### Forbedring 4a: Nullstill stale `image` i output-JSON

Når `downloadImageIfNeeded()` returnerer `false` (bilde mangler i Drive), sett
`image: ''` i output-JSON. Da viser frontend "Bilde mangler"-placeholder i
stedet for en krasjet asset-import.

**Galleri** (`syncGalleri`): Returverdien fra `downloadImageIfNeeded` ignoreres
i dag. Endre til:

```js
let imageFound = false;
if (bildeFil && !isForsidebilde) {
    try {
        const destinationPath = path.join(config.paths.galleriAssets, bildeFil);
        imageFound = await downloadImageIfNeeded(bildeFil, folderId, destinationPath, 'Galleribilde');
    } catch (imgErr) {
        logWarning('Download Error', `Feil ved behandling av galleribilde ${bildeFil}: ${imgErr.message}`);
    }
}

return {
    ...
    image: imageFound ? bildeFil : '',  // Tom streng hvis ikke funnet
    ...
};
```

**Tannleger** (`syncTannleger`): Samme endring.

### Forbedring 4b: Samlet oppsummering i loggen

Etter at sync er ferdig, skriv en samlet rapport som gjør det lettere å se
helheten uten å lete i loggen:

```
⚠ Konsistenssjekk:
  Galleri: 1 bilde i Sheet mangler i Drive (venterom.jpg)
  Tannleger: 0 manglende bilder
```

Implementer ved å samle warnings underveis og logge dem i `runSync()` etter at
alle sync-funksjoner er ferdige. Bruk `logWarning()` slik at det også blir
`::warning`-annotasjoner i GitHub Actions.

## Teststrategi

### Delete-tester: Galleri (`admin-module-bilder.test.js`)

| Test | Verifiserer |
|------|-------------|
| Slett bilde — happy path | `getGalleriRaw` → `deleteRow` → `findFileByName` → `deleteFile` |
| Bruker avbryter | Ingen API-kall etter `showConfirm(false)` |
| Tom `image`-felt | Hopper over `findFileByName`/`deleteFile` |
| Rad ikke funnet i Sheet | Hopper over Drive-sletting |
| Fil ikke funnet i Drive | `findFileByName` → null, `deleteFile` kalles ikke |
| Drive-sletting feiler | Best-effort: toast vises, ingen error til bruker |
| Sheet-sletting feiler | Error-toast, Drive-sletting forsøkes ikke |

### Delete-tester: Tannleger (`admin-module-tannleger.test.js`)

Tilsvarende tester, tilpasset tannleger-flyten (backup-steg osv).

### Konsistenssjekk-tester (admin)

| Test | Verifiserer |
|------|-------------|
| Alt konsistent | Ingen advarsel vises |
| Orphans i Drive | Advarsel med filnavn for Drive-orphans |
| Manglende i Drive | Advarsel med radinfo for Sheet-orphans |
| Begge retninger | Begge advarsler vises |
| `listImages` feiler | Ingen advarsel, ingen crash (best-effort) |

### Konsistenssjekk-tester (sync-data)

| Test | Verifiserer |
|------|-------------|
| Manglende Drive-fil | `image` settes til `''` i JSON, `logWarning` kalles |
| Foreldreløs Drive-fil | `logWarning('Orphaned File', ...)` kalles |
| Alt konsistent | Ingen advarsler |

## Filer som endres

| Fil | Endring |
|-----|---------|
| `src/scripts/admin-module-bilder.js` | Import `findFileByName`, `deleteFile`, `listImages`. Oppdater `deleteGalleriBilde()`. Legg til konsistenssjekk. |
| `src/scripts/admin-module-tannleger.js` | Import `findFileByName`, `deleteFile`, `listImages`. Oppdater `deleteTannlege()`. Legg til konsistenssjekk. |
| `scripts/sync-data.js` | Legg til `listFilesInFolder()`, samlet rapport, nullstill stale `image`-felt i JSON. |
| `src/scripts/__tests__/admin-module-bilder.test.js` | Oppdater mocks/imports. Nye delete- og konsistens-tester. |
| `src/scripts/__tests__/admin-module-tannleger.test.js` | Oppdater mocks/imports. Nye delete- og konsistens-tester. |
| `scripts/__tests__/sync-data.test.js` | Nye tester for konsistenssjekk ved byggetid. |

**Ingen nye npm-pakker.** `deleteFile`, `findFileByName` og `listImages` finnes
allerede i `admin-drive.js`. sync-data bruker allerede googleapis med
service-konto.
