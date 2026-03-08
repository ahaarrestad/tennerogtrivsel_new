# Plan: Sortering av elementer i prisliste-kategorier (admin)

## Oversikt

Legg til mulighet for å sortere prisliste-elementer innenfor en kategori via opp/ned-knapper i admin. Følger samme mønster som galleri- og innstillinger-modulene.

## Design

### Sheets-endring

- Ny kolonne **E** (`order`) i `Prisliste`-arket — numerisk verdi
- Per-kategori rekkefølge: elementer grupperes per kategori, sorteres etter `order` innenfor gruppen
- **Bakoverkompatibilitet**: Eksisterende rader uten `order`-verdi behandles som `0`. Når alle elementer i en kategori har `order=0`, brukes rad-rekkefølge fra Sheets som tiebreaker (stabil sortering). Første gang en bruker sorterer, tildeles unike `order`-verdier til begge elementene som flyttes.

### Rekkefølge-logikk

- **Opp/ned-knapper**: Swapper `order`-verdien mellom to naboer i samme kategori (identisk med `reorderGalleriItem`/`reorderSettingItem`)
- **Nye elementer**: `order = max(order i kategori) + 1`
- **Kategori-endring**: `order = max(order i ny kategori) + 1` (legges til sist)

### Filer som endres

| Fil | Endring |
|-----|---------|
| `src/scripts/admin-module-prisliste.js` | Opp/ned-knapper i UI, sortering per kategori |
| `src/scripts/admin-sheets.js` | Utvid CRUD til kolonne E, les/skriv `order` |
| `src/scripts/admin-dashboard.js` | Ny `reorderPrislisteItem()` funksjon |
| `src/scripts/sync-data.js` | Synk `order`-felt fra Sheets |
| `src/content.config.ts` | Legg til `order` i prisliste-schema |
| `src/pages/prisliste.astro` | Sorter elementer per kategori etter `order` |

## Implementeringssteg

### Steg 1: Sheets API og data-lag

1. **`admin-sheets.js`**: Utvid `getPrislisteRaw()` til å lese kolonne A:E (inkl. `order`)
2. **`admin-sheets.js`**: Utvid `updatePrislisteRow()` til å skrive kolonne E
3. **`admin-sheets.js`**: Utvid `addPrislisteRow()` til å inkludere `order`-verdi (beregn max+1 for kategorien)
4. **`admin-dashboard.js`**: Legg til `reorderPrislisteItem()` — swap `order` mellom to naboer, oppdater begge rader i parallell

### Steg 2: Admin UI

5. **`admin-module-prisliste.js`**: Sorter elementer per kategori etter `order` ved visning
6. **`admin-module-prisliste.js`**: Legg til opp/ned-knapper per element (skjul for første/siste i kategori)
7. **`admin-module-prisliste.js`**: Ved kategori-endring i edit-form, sett `order = max(order i ny kategori) + 1`

### Steg 3: Build og public side

8. **`sync-data.js`**: Les kolonne E, inkluder `order` i JSON-output
9. **`content.config.ts`**: Legg til `order: z.number().default(0)` i prisliste-schema
10. **`prisliste.astro`**: Sorter elementer per kategori etter `order`

### Steg 4: Tester

11. Skriv/oppdater tester for endrede funksjoner — mål 80% branch coverage per fil
