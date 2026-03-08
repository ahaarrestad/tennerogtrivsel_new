# Plan: Ustabil sortering i prisliste

**Dato:** 2026-03-08
**Kilde:** Gemini Code Assist, PR #148

## Problem

Elementer med samme `order`-verdi kan endre rekkefølge mellom builds. JavaScript's `Array.sort()` er stabil per spec (ES2019+), men å returnere `0` for like verdier gir ingen deterministisk rekkefølge på tvers av ulike JS-motorer eller builds.

## Berørte steder

1. **`src/pages/prisliste.astro:31`** — items sorteres kun på `order`, ingen tiebreaker
2. **`src/scripts/admin-dashboard.js:691`** — `reorderPrislisteKategori` sorterer kun på `order`

Admin-modulen (`admin-module-prisliste.js`) har allerede tiebreaker med `items.indexOf()` — OK.

## Løsning

### prisliste.astro
Legg til tiebreaker med `tjeneste`-navnet (alfabetisk) for determinisme:
```javascript
items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.tjeneste ?? '').localeCompare(b.tjeneste ?? '', 'nb'));
```

### admin-dashboard.js
Legg til tiebreaker med `kategori`-navnet:
```javascript
sorted = [...kategoriOrder].sort((a, b) => a.order - b.order || a.kategori.localeCompare(b.kategori, 'nb'));
```

## Tester

- Test i prisliste at items med lik `order` sorteres stabilt (etter navn)
- Test i admin-dashboard at `reorderPrislisteKategori` med lik order bruker tiebreaker
