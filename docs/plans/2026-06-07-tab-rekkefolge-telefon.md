# Plan: Tab-rekkefølge — telefon ikke fokuserbar på stor skjerm

**Dato:** 2026-06-07
**Oppgave:** Bug — telefonnummer fokuserbart på stor skjerm ved tabbing, selv om det ikke er en klikkbar lenke der.

## Mål

Telefonnummeret skal ikke være i tab-rekkefølgen på stor skjerm (≥1024px), der det
kun er informativt. På mobil (< 1024px) forblir det en `tel:`-lenke. Ingen visuell
endring på noen skjermstørrelse.

## Avgrensninger (ikke med)

- E-postlenke i Footer endres ikke.
- Ingen JS/`matchMedia`-løsning (gir SSR-flash, krever resize-håndtering).
- Ingen ny funksjonalitet.

## Rotårsak

`TelefonKnapp.astro` rendrer via `Button.astro` som `<a href="tel:...">` og bruker
`lg:pointer-events-none lg:cursor-default` for å «deaktivere» klikk på desktop.
Klassen fjerner klikk, men `<a href>` forblir i tab-rekkefølgen. Samme mønster i
`Footer.astro` (egen `<a>`, ikke via Button).

Å droppe `href` hjelper ikke: `Button.astro` rendrer da `<button>`, som også er
fokuserbart. Desktop-varianten må være et ekte ikke-interaktivt element (`<span>`).

## Tilnærming

To elementer per breakpoint, ren CSS:
- Mobil: interaktivt element, `lg:hidden`.
- Desktop: ikke-fokuserbart `<span>`, `hidden lg:inline-flex`.

Tailwind `utilities`-laget vinner over `.btn-*` i `components`-laget, så
`hidden`/`lg:inline-flex` overstyrer `inline-flex` fra btn-klassen (samme mekanisme
som dagens `lg:pointer-events-none`).

## Steg / filer

1. **`src/components/Button.astro`** — additiv `interactive?: boolean` (default
   `true`). Når `false` → `Tag = 'span'` (ikke `<button>`). Bevarer variant-klasse
   og slots. Standardoppførsel uendret for alle eksisterende kallsteder.

2. **`src/components/TelefonKnapp.astro`** — to `<Button>`:
   - Mobil: `<Button href={`tel:${cleanPhone}`} class="lg:hidden …">`
   - Desktop: `<Button interactive={false} class="hidden lg:inline-flex …">`
   - SVG-ikon + `{phone}` i begge (bevisst ~12 linjer duplisert markup; egen
     `PhoneIcon`-komponent er overkill her).
   - Fjern `lg:pointer-events-none lg:cursor-default`.

3. **`src/components/Footer.astro`** — `<a class="lg:hidden" href="tel:…">` (mobil)
   + `<span class="hidden lg:inline …">{phone}</span>` (desktop). Fjern
   `lg:pointer-events-none`.

## Testbehov / Definition of Done

- Ny E2E-test i `tests/`: desktop-viewport → ingen synlig/fokuserbar
  `a[href^="tel:"]`; mobil-viewport → `tel:`-lenke finnes og er fokuserbar.
  Deterministisk (viewport + DOM-assert, ingen `networkidle`).
- `npm run build:ci` passerer.
- Manuell visuell sjekk: ingen endring i Navbar/Footer/Forside på mobil og desktop.
- Unit-coverage ikke berørt (Astro-komponenter er utenfor scope; kun scripts/API).

## Kjente risiki

- `<span class="btn-secondary">` må se identisk ut — verifiseres visuelt + i build.
- `interactive`-prop er additiv; `Button` brukes 6 steder. Default `true` bevarer
  all eksisterende oppførsel; kun TelefonKnapp endrer kallsted.
- Markup-duplisering av ikon i TelefonKnapp er en bevisst, liten kostnad.
