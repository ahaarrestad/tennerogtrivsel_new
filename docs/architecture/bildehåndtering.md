# Arkitektur: Bildehåndtering (Galleri + Forsidebilde)

## Google Sheets-ark

**Galleri** (`galleri!A:I`):

| A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| Tittel | Bildefil | AltTekst | Aktiv | Rekkefølge | Skala | PosX | PosY | Type |

- **`Type`-kolonnen** skiller mellom `'galleri'` (standard) og `'forsidebilde'` (hero-bilde på forsiden).
- Kun **én rad** kan ha `type='forsidebilde'` om gangen — `setForsideBildeInGalleri()` nedgraderer automatisk den eksisterende.
- Rader uten Type-verdi tolkes som `'galleri'` (bakoverkompatibilitet).

**Tannleger** (`tannleger!A:H`):

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| Navn | Tittel | Beskrivelse | Bildefil | Aktiv | Skala | PosX | PosY |

## Dataflyt

```
Google Sheets (galleri-ark)
  ↓ sync-data.js
  ├── syncGalleri()        → src/content/galleri.json  (inkluderer forsidebilde med type-felt)
  └── syncForsideBilde()   → src/assets/hovedbilde.png (leser KUN forsidebilde-rad)
                           → public/hovedbilde.png     (beskjært OG-bilde 1200×630)
```

- `Forside.astro` leser utsnitt (scale, posX, posY) fra **galleri-collectionen** (forsidebilde-raden), ikke fra Innstillinger.
- `Galleri.astro` filtrerer ut forsidebilde-rader ved rendering.

**Forsidebilde-fallback:** `syncForsideBilde()` prøver galleri-arket først. Hvis det ikke finnes en forsidebilde-rad (eller arket mangler), faller den tilbake til Innstillinger-arket (`forsideBilde`, `forsideBildeScale`, `forsideBildePosX`, `forsideBildePosY`).

## Google Sheets API: valueRenderOption

Alle `sheets.values.get`-kall som leser numeriske felter (scale, posX, posY, order) **SKAL** bruke `valueRenderOption: 'UNFORMATTED_VALUE'`. Uten dette returnerer API-et tall i spreadsheetets lokale format — med norsk locale blir f.eks. `1.5` til `"1,5"`, og `parseFloat("1,5")` gir `1`. Heltall er upåvirket, men desimaltall (som zoom/scale) mister desimaldelen.

## Admin-panelet (bilder-modul)

Nøkkelfunksjoner i `admin-client.js`:

| Funksjon | Formål |
|----------|--------|
| `getGalleriRaw()` | Henter alle rader fra galleri-arket (A:I) |
| `updateGalleriRow()` | Oppdaterer én rad inkl. type |
| `addGalleriRow()` | Legger til ny rad, sikrer at arket finnes (`ensureGalleriSheet`) |
| `setForsideBildeInGalleri()` | Setter én rad som forsidebilde, nedgraderer evt. eksisterende |
| `migrateForsideBildeToGalleri()` | One-time migrering fra Innstillinger-ark til galleri-ark |

Nøkkelfunksjoner i `admin-dashboard.js`:

| Funksjon | Formål |
|----------|--------|
| `loadGalleriListeModule()` | Viser bildeoversikt med thumbnails, badges og reorder-knapper |
| `reorderGalleriItem()` | Bytter rekkefølge mellom to naboer (opp/ned-knapper) |

**Thumbnails** (galleri og tannleger) lastes asynkront via `findFileByName()` + `getDriveImageBlob()` (best-effort, blokkerer ikke UI). Thumbnails viser utsnitt (scale, posX, posY) via CSS `object-position`, `transform: scale()` og `transform-origin`. Blob-URLer krever `blob:` i CSP `connect-src`.

## Tester

`syncForsideBilde()`-tester MÅ mocke **to** `sheets.values.get`-kall: først galleri-arket, deretter Innstillinger-fallback. Eldre tester som kun mocker Innstillinger-kallet vil feile fordi koden nå prøver galleri-arket først.
