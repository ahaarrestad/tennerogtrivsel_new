# Plan: Forbedre visuell synlighet på aktiv melding i info-banner

## Kontekst

InfoBanner-komponenten viser aktive meldinger øverst på siden. I dag har den en liten pulserende prikk (`animate-pulse w-2 h-2`) og relativt liten tekst (`text-xs md:text-sm font-medium`). Brukeren ønsker å fjerne prikken, erstatte den med et info-ikon, og gjøre teksten litt mer fremtredende.

## Endringer

### Fil: `src/components/InfoBanner.astro`

1. **Erstatt pulserende prikk med info-ikon (SVG)**
   - Fjern: `<span class="inline-block animate-pulse w-2 h-2 rounded-full bg-brand-dark"></span>`
   - Legg til: Inline SVG info-ikon (`<circle>` med "i") i `w-4 h-4` størrelse, `text-brand-dark`
   - Ikonet skal ha `aria-hidden="true"` (dekorativt)

2. **Øk tekststørrelse og font-weight**
   - `text-xs md:text-sm` → `text-sm md:text-base`
   - `font-medium` → `font-semibold`

Ingen andre endringer (farger, bakgrunn, posisjonering forblir som i dag).

## Status: Fullført

- 780 enhetstester passerer
- Bygg fullført uten feil
