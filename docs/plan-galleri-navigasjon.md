# Plan: Galleri-navigasjon — konsistens mellom mobil og desktop

## Problemstilling

Galleriet har inkonsistent oppførsel mellom mobil og desktop:

| | Desktop (lg+) | Mobil (<lg) |
|---|---|---|
| **Navbar-lenke** | `/#galleri` (scroll til seksjon) | `/galleri` (standalone-side) |
| **Forsiden (5 bilder)** | Alle 5 vises (4+1 alene på rad 2) | Kun 4 vises |
| **«Se alle bilder»** | Brukeren opplever at den mangler på desktop | Vises, nyttig |

### Brukerens observasjoner
1. Scrolling på mobil → ser galleriet med 4 bilder og «Se alle bilder»-lenke
2. Klikk på menyen → går til standalone `/galleri` med alle bilder
3. «Se alle bilder» oppleves som manglende på desktop
4. Med 5 bilder og 4 kolonner ser desktop-galleriet ufullstendig ut (1 bilde alene på rad 2)
5. Desktop-opplevelsen må også være god — ikke bare «mobile first»

## Gjennomført

### Steg 1: Begrens forsidegalleriet til maks 4 bilder (alle skjermstørrelser)

I `Galleri.astro`: Erstattet responsiv skjuling (`hidden md:block`) med fast grense:

```astro
const MAX_PREVIEW = 4;
const visibleImages = standalone ? sortert : sortert.slice(0, MAX_PREVIEW);
const hasMore = !standalone && sortert.length > MAX_PREVIEW;
```

- Konsistent opplevelse — alle skjermstørrelser får samme utvalg
- Ingen «1 bilde alene»-problem på desktop
- «Se alle bilder →»-lenken vises på både mobil og desktop

## Gjenstår

### Vurder antall bilder på desktop

4 bilder i et 4-kolonners grid gir bare én rad på desktop — kan se sparsomt ut. Alternativer:
- Responsivt antall: 4 på mobil, 6 på md, 8 på lg (fyller 2 rader)
- Eller juster grid til 2 kolonner på forsiden (2×2 på alle størrelser)
- Avhenger av hvor mange bilder som typisk finnes i galleriet

### Vurder navbar-lenke

Desktop bruker `/#galleri` (scroll), mobil bruker `/galleri` (standalone-side). Alternativer:
- La begge bruke `/#galleri` — konsistent, og «Se alle bilder» er CTA til standalone
- La begge bruke `/galleri` — men bryter med mønsteret for tjenester/tannleger
- Behold som nå — fungerer, men er inkonsistent

> **NB:** Kontakt bruker `/#kontakt` på begge. Tjenester og Tannleger bruker `/#seksjon` på desktop og `/standalone` på mobil — samme mønster som galleriet.

## Risiko

- Lav risiko — kun visuell endring, ingen data-endring
- Ingen E2E-tester berørt (sjekket)
