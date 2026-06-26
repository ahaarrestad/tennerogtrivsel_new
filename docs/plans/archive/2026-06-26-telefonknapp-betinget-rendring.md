# Plan: TelefonKnapp.astro — betinget rendring når phone1 mangler

> §0-oppgave: spec og plan slått sammen i én fil (triviell endring, én fil berøres).

## Problem / mål

Når `phone1` mangler i Google Sheets-innstillingene, bruker `?? ''`-fallbacken en tom streng. Begge knapper rendres fortsatt — med `href="tel:"` (ugyldig lenke) og kun ikon (ingen tekst). Resultatet er to ubrukelige knapper som ikke bør vises.

**Mål:** Render ingenting når telefonnummeret mangler.

## Krav og akseptansekriterier

- Når `phone1` er tom streng, `null`, eller ikke definert: ingen knapper rendres.
- Når `phone1` har verdi: begge knapper rendres som i dag (mobil + desktop).
- Ingen reel endring i oppførsel for den normale casen (telefonnummer finnes).

## Avgrensninger / non-goals

- Endrer ikke håndtering av `phone2` eller andre felt.
- Endrer ikke Button.astro eller PhoneIcon.astro.
- Ingen ny UI-logikk utover betinget wrapper.

## Implementasjonssteg

1. **`src/components/TelefonKnapp.astro`** — wrap begge `<Button>`-elementene i `{cleanPhone && (<Fragment>...</Fragment>)}` (guard på `cleanPhone` fanger også whitespace-only verdier).

## Testbehov / definition of done

- Visuell verifisering: komponent rendrer ingenting ved tom `phone`.
- Eksisterende tester passerer (ingen unit-tester for denne komponenten — den er statisk markup).
- Definition of done: `{phone && ...}`-guard på plass, bygg grønt.

## Kjente risiki

Ingen — endringen er rent additiv (guard), berører ikke eksisterende funksjonalitet.
