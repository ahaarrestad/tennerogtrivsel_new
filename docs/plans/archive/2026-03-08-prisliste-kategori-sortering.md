# Plan: Sortering av prisliste-kategorier (admin)

## Oversikt

Legg til mulighet for å sortere selve kategoriene i prislisten via opp/ned-knapper i admin. Kategori-rekkefølgen lagres i et eget Sheets-ark.

## Design

### Sheets-endring

- Nytt ark **`KategoriRekkefølge`** med to kolonner: `kategori` (A) + `order` (B)
- **Bakoverkompatibilitet**: Kategorier uten rad i arket vises sist, sortert alfabetisk som fallback
- Nye kategorier (opprettet via element-redigering) legges automatisk til sist i arket

### Rekkefølge-logikk

- **Opp/ned-knapper** per kategori-header i prisliste-visningen
- Swapper `order`-verdier mellom naboer (samme mønster som galleri/settings)

### Filer som endres

| Fil | Endring |
|-----|---------|
| `src/scripts/admin-module-prisliste.js` | Opp/ned-knapper per kategori-header, sorter kategorier ved visning |
| `src/scripts/admin-sheets.js` | CRUD for `KategoriRekkefølge`-arket |
| `src/scripts/admin-dashboard.js` | Ny `reorderPrislisteKategori()` funksjon |
| `src/scripts/sync-data.js` | Synk kategori-rekkefølge fra Sheets |
| `src/pages/prisliste.astro` | Sorter kategorier etter rekkefølge ved visning |

## Implementeringssteg

### Steg 1: Sheets API og data-lag

1. **`admin-sheets.js`**: Ny funksjon `getKategoriRekkefølge()` — les `KategoriRekkefølge!A:B`
2. **`admin-sheets.js`**: Ny funksjon `updateKategoriOrder()` — oppdater `order` for en rad
3. **`admin-sheets.js`**: Ny funksjon `addKategoriRekkefølge()` — legg til ny kategori med `order = max + 1`
4. **`admin-dashboard.js`**: Ny `reorderPrislisteKategori()` — swap `order` mellom naboer

### Steg 2: Admin UI

5. **`admin-module-prisliste.js`**: Hent kategori-rekkefølge ved lasting
6. **`admin-module-prisliste.js`**: Sorter kategorier etter `order` ved visning (fallback: alfabetisk)
7. **`admin-module-prisliste.js`**: Opp/ned-knapper per kategori-header
8. **`admin-module-prisliste.js`**: Ved ny kategori (fra element-redigering), legg til i `KategoriRekkefølge`

### Steg 3: Build og public side

9. **`sync-data.js`**: Synk `KategoriRekkefølge`-arket til JSON
10. **`prisliste.astro`**: Sorter kategorier etter rekkefølge ved visning

### Steg 4: Tester

11. Skriv/oppdater tester — mål 80% branch coverage per fil

## Avhengighet

Denne oppgaven bør implementeres etter oppgave 4 (elementsortering), da begge endrer prisliste-modulen.
