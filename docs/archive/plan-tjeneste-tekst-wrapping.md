# Plan: Fiks wrapping av tekst i tjeneste-listen i admin på mobil

> **Status: FULLFØRT**

## Problem

I tjeneste-listen i admin-panelet kan tittel og ingress-tekst bli avkuttet eller wrappe dårlig på smale skjermer. Samme mønster brukes i tannleger- og galleri-listen — fiksen bør gjelde alle tre.

## Analyse

Kort-layouten (linje 353–375 i `admin-dashboard.js`) bruker:

```html
<div class="admin-card-interactive flex flex-col sm:flex-row ...">
  <div class="min-w-0 flex-grow">
    <div class="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-3">
      <button class="toggle-active-btn shrink-0">...</button>
      <h3 class="font-bold text-brand sm:truncate sm:min-w-0">Tittel</h3>
    </div>
    <p class="text-xs text-slate-500 mt-1 line-clamp-1">Ingress...</p>
  </div>
  <div class="flex gap-2 shrink-0"><!-- knapper --></div>
</div>
```

**Problemer på mobil (`< 640px`):**

1. **Tittel:** Har `sm:truncate` og `sm:min-w-0`, men ingen mobil-begrensning. Lange titler bryter på flere linjer, som presser kortet i høyden og ser ujevnt ut.
2. **Ingress:** Har `line-clamp-1` som fungerer, men kan se avkuttet ut uten ellipsis-indikator på eldre nettlesere.
3. **Knapper:** Ligger under teksten i `flex-col` på mobil — dette er OK, men gapet mellom tekst og knapper kan bli stort med lang tittel.

## Løsning

Små CSS-justeringer som forbedrer tekst-visning på mobil uten å endre layoutstrukturen:

### Steg 1: Tjeneste-listen — legg til `line-clamp-2` på tittel (mobil)

Endre h3-klassen fra:
```
font-bold text-brand sm:truncate sm:min-w-0
```
til:
```
font-bold text-brand line-clamp-2 sm:line-clamp-none sm:truncate sm:min-w-0
```

- Mobil: Tittel vises på maks 2 linjer med ellipsis
- Desktop: Uendret (`truncate` på én linje)

### Steg 2: Samme fiks på tannleger-listen

Tannleger-listen (linje 453) har identisk mønster — bruk samme klasser.

### Steg 3: Verifiser galleri-listen

Galleri-listen har en annen layout (med thumbnails og reorder-knapper). Sjekk om samme problem finnes der og fiks tilsvarende.

### Steg 4: Juster knapp-plassering på mobil

På mobil ligger knappene (`flex gap-2 shrink-0`) under teksten. Legg til `self-end` (eller `self-start`) slik at de ligger konsistent i høyre hjørne:

```
flex gap-2 shrink-0 self-end sm:self-auto
```

### Steg 5: Test visuelt

Verifiser i nettleseren med responsiv modus:
- 320px (liten mobil)
- 375px (iPhone)
- 414px (stor mobil)
- 640px+ (desktop)

Sjekk at:
- Lange titler vises pent med ellipsis etter 2 linjer
- Ingress vises på én linje med ellipsis
- Knapper har konsistent plassering
- Toggle-switch og tittel ikke overlapper

## Filer som endres

| Fil | Endring |
|-----|---------|
| `src/scripts/admin-dashboard.js` | Oppdater klasser for h3 og knapp-div i tjeneste- og tannlege-listen |

## Omfang

Ren CSS-justering — ingen ny JS-logikk, ingen nye filer, ingen nye tester nødvendig (eksisterende HTML-struktur beholdes, bare klasser justeres).
