# Plan: Seksjons-titler bommer ved aktiv melding

**Dato:** 2026-03-09
**Oppgave:** Seksjons-titler på framsiden bommer ved aktiv melding

## Problem

Ankerlenke-navigering (#kontakt, #tjenester etc.) på framsiden scroller til feil posisjon når InfoBanner har en aktiv melding. Tittelen havner bak navbar+banner.

## Rotårsak

`.section-container` bruker statisk `scroll-mt-6` (24px). `layout-helper.js` beregner allerede `--nav-total-height` dynamisk (inkl. banner), men variabelen brukes ikke for scroll-offset.

## Løsning

Bruk `--nav-total-height` CSS-variabelen for `scroll-margin-top` i stedet for statiske verdier.

### Endringer

1. **`src/styles/global.css`** — Erstatt `scroll-mt-6` med `scroll-margin-top: var(--nav-total-height, 1.5rem)`
2. **`src/components/Forside.astro`** — Fjern statiske `scroll-mt-16 lg:scroll-mt-20` overrides
3. **Verifiser `src/scripts/layout-helper.js`** — Bekreft at `--nav-total-height` settes korrekt med/uten banner

### Implementeringssteg

1. Oppdater `.section-container` i global.css
2. Fjern scroll-mt overrides i Forside.astro
3. Verifiser layout-helper.js-logikk
4. Test manuelt med/uten aktiv melding
5. Kjør kvalitetssjekk
