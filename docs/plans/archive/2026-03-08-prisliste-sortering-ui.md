# Plan: Forbedre sortering-UI i prisliste-admin

## Problem

Prisliste-admin har to nivåer av sortering (kategori og item) med identiske opp/ned-knapper. Item-knappene er plassert til venstre i raden, mens alle andre admin-moduler (tjenester, galleri) har reorder-knapper til høyre sammen med edit/delete. Dette er forvirrende.

## Løsning

Flytt item-sorteringsknappene fra venstre til høyre side av raden, ved siden av edit/delete-knappene. Kategori-sortering forblir i headeren til venstre (som i dag).

### Før

```
[↑↓ item]  [behandling / pris]        [✏️] [🗑️]
```

### Etter

```
[behandling / pris]        [↑↓ item] [✏️] [🗑️]
```

Konsistent med tjenester og galleri:

```
[innhold]                  [↑↓] [✏️] [🗑️]
```

## Endringer

### 1. Flytt item-reorder-knapper (`admin-module-prisliste.js`)

I item-raden (linje ~342-354): Fjern `<div class="flex flex-col gap-1">` med reorder-knappene fra venstre side, og legg dem til på høyre side foran `renderActionButtons()`.

Ny struktur for item-rad:
```html
<div class="group flex items-center gap-4 ...">
    <!-- Innhold (venstre) -->
    <div class="flex-grow min-w-0">
        <span>behandling</span>
        <span>oppdatert</span>
    </div>
    <span>pris</span>
    <!-- Handlinger (høyre) -->
    <div class="flex items-center gap-2 shrink-0">
        <div class="flex flex-col gap-1">
            <button class="reorder-pris-btn ...">↑</button>
            <button class="reorder-pris-btn ...">↓</button>
        </div>
        <!-- edit + delete via renderActionButtons -->
    </div>
</div>
```

### 2. Oppdater renderActionButtons-kallet

`renderActionButtons` returnerer allerede edit+delete. Reorder-knappene legges rett foran dette i en wrapper-div som samler alle høyre-side-handlinger.

## Filer som endres

- `src/scripts/admin-module-prisliste.js` — flytte HTML-markup

## Ingen funksjonalitetsendring

- Samme JS-handlers (`.reorder-pris-btn`, `.reorder-kategori-btn`)
- Samme CSS-klasser (`admin-icon-btn-reorder`)
- Samme data-attributter og logikk
