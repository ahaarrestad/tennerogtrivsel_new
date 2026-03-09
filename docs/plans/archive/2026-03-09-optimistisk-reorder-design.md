# Design: Optimistisk reorder med animasjon i admin-moduler

## Problem

Sorteringsknapper (opp/ned) i admin-modulene oppleves som trege. Etter hvert klikk gjøres API-kall, deretter full listeinnlasting og re-rendering. Bruker må vente 1-3 sekunder per klikk.

Berørte moduler: Tjenester, Prisliste, Galleri, Settings.

## Løsning

Erstatt "API-kall → full reload" med "DOM-swap → animasjon → API i bakgrunn → revert ved feil".

## Felles animasjonsmodul

Ny fil `admin-reorder.js` med hjelpefunksjon `animateSwap(elementA, elementB)`:

1. Beregn vertikal avstand mellom de to elementene (`getBoundingClientRect()`)
2. Bruk CSS `transform: translateY()` med `transition` (150-200ms)
3. Etter animasjon: swap elementene i DOM (insertBefore) og fjern transform
4. Returnerer et Promise som resolves når animasjonen er ferdig

Funksjonen er ren DOM — ingen avhengighet til API eller modulspesifikk logikk.

## Per-modul endringer

### Prisliste, Galleri, Settings (swap 2 rader)

1. Klikk opp/ned → disable begge knapper
2. `animateSwap()` på de to kort/radene
3. Oppdater lokal `items`-array (swap order-verdier)
4. Oppdater opp/ned-knappenes synlighet (første/siste-sjekk)
5. API: `reorderXxxItem()` i bakgrunnen (eksisterende funksjon, uendret)
6. Suksess: re-enable knapper
7. Feil: swap tilbake i DOM + array, vis toast, re-enable knapper

### Tjenester (re-indekserer alle priorities)

1. Klikk opp/ned → disable begge knapper
2. `animateSwap()` på de to kortene
3. Oppdater lokal `services`-array (splice + re-insert)
4. API: `Promise.all(saveFile(...))` for alle filer i bakgrunnen
5. Suksess: re-enable knapper
6. Feil: swap tilbake i DOM + array, vis toast, re-enable knapper

## Hva vi IKKE endrer

- API-lageret (`admin-sheets.js`, `admin-drive.js`)
- Retry-logikk (`admin-api-retry.js`)
- `reorderXxxItem()`-funksjonene — gjenbrukes, bare kalt asynkront etter DOM-swap
- Ingen ny state management eller caching

## Disabling under flight

Opp/ned-knappene disables mens API-kallet pågår for å unngå race conditions ved raske dobbeltklikk. Re-enables etter suksess eller revert.

## Testing

- Enhetstest for `animateSwap()` — DOM-manipulasjon, animasjonslogikk
- Enhetstest per modul: verifiser at optimistic swap skjer, at revert fungerer ved API-feil, og at knapper disables/re-enables korrekt
- 80% branch coverage per fil (prosjektets kvalitetskrav)
