# Plan: Landscape print av prisliste med to kolonner

**Dato:** 2026-03-08
**Status:** Ikke startet

## Mål

Print-modus for prislisten skal bruke landscape-orientering med to kolonner side om side. Kategoriene fordeles jevnt over kolonnene basert på antall rader, i samme rekkefølge som web-visningen.

## Design

### Print-CSS (`prisliste.astro`)

- `@page { size: landscape; margin: 0; }` — erstatter nåværende portrait
- Kategori-containeren får `column-count: 2` med passende `column-gap`
- Hver `.prisliste-kategori` beholder `break-inside: avoid` slik at ingen kategori deles over kolonner

### Jevn fordeling (build-tid i Astro)

- Summer antall rader (elementer + 1 for overskrift) per kategori
- Del i to grupper som er så jevne som mulig, bevarer rekkefølgen
- Sett `break-before: column` på første kategori i gruppe 2 via en CSS-klasse (f.eks. `.kolonne-2-start`)
- Dette gir forutsigbar fordeling uavhengig av CSS-rendering

### Admin popup (`admin-module-prisliste.js`)

- Endre `width` i `window.open()` til ca. 1100 for å matche landscape

### Rekkefølge

- Kategorier og elementer rendres i nøyaktig samme rekkefølge som på web (styrt av `kategoriOrder` og `order`-felt fra Sheets)
- Kolonne 1 får de første kategoriene, kolonne 2 de neste — leserekkefølge venstre→høyre

## Utenfor scope

- Bunntekst med tannlegenavn
- Valg mellom portrait/landscape (alltid landscape)
- Nye filer — alt er endringer i eksisterende filer

## Berørte filer

- `src/pages/prisliste.astro` — print-CSS og kolonne-splitt-logikk
- `src/scripts/admin-module-prisliste.js` — popup-bredde
