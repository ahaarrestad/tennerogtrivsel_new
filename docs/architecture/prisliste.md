# Prisliste — Arkitektur

## Dataflyt

```
Google Sheets (Prisliste-ark)
    |
    v  sync-data.js: syncPrisliste()
    |  valueRenderOption: 'UNFORMATTED_VALUE'
    v
src/content/prisliste.json
    |
    v  content.config.ts (JSON-loader)
    |
    v
Astro content collection
    |
    +---> /prisliste (public page)
    +---> Admin module (live CRUD via gapi)
```

## Google Sheets

- Ark: `Prisliste`
- Kolonner: `Kategori` (A), `Behandling` (B), `Pris` (C)
- Pris kan vaere tall (850) eller tekst ("Fra 500,-")
- UNFORMATTED_VALUE brukes for a unnga norsk locale-formatering

## Content Collection

- Fil: `src/content/prisliste.json`
- Schema: `{ kategori: string, behandling: string, pris: string | number }`
- Loader: JSON-basert (som tannleger/galleri)

## Public Side

- Rute: `/prisliste`
- Grupperer etter kategori, rendrer som kort-liste
- Print-support via `@media print`

## Admin

- Modul: `admin-module-prisliste.js`
- CRUD: `admin-sheets.js` (getPrislisteRaw, addPrislisteRow, updatePrislisteRow, deletePrislisteRowPermanently)
- Auto-save med 1.5s debounce
- Sikkerhet: escapeHtml() for listevisning, programmatisk .value for input-felt, DOMPurify.sanitize() for innerHTML

## Berorte filer

- `src/content.config.ts` — prisliste collection
- `src/content/prisliste.json` — synkronisert data
- `src/scripts/sync-data.js` — syncPrisliste()
- `src/pages/prisliste.astro` — publik side
- `src/components/Navbar.astro` — menylenke
- `src/components/Footer.astro` — footer-lenke
- `src/scripts/admin-sheets.js` — CRUD-funksjoner
- `src/scripts/admin-module-prisliste.js` — admin-modul
- `src/scripts/admin-init.js` — modul-registrering
- `src/pages/admin/index.astro` — dashboard-kort
