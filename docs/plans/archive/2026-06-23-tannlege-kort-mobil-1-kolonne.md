# Tannlege-kort: guide-alignering av grid (1 / 2 / 3 kolonner)

> **§0-merknad (todo-skill):** Dette er en liten, presentasjonell endring. Spec (hva/hvorfor)
> og plan (hvordan) er derfor slått sammen i denne ene fila i stedet for to separate dokumenter.
> Review-kriteriene er besvart kort nederst.

## Problem / mål

På `/tannleger` bruker kort-gridet `grid-cols-2` på mobil. Hvert kort blir da ~45 % av
skjermbredden med `aspect-[3/4]` — et lite bilde. Overlegget legger tre tekstlinjer oppå
(navn `text-sm`, tittel `text-xs`, beskrivelse `text-xs`, alltid synlig på touch), så
tekstandelen blir for stor relativt til bildet. Resultatet oppleves som at teksten dominerer.

Design-guiden foreskriver allerede `1 / 2 / 3` kolonner (mobil / md / lg) for tannleger-kort
([design-guide.md](../designs/design-guide.md) seksjon 6, grid-system). Den nåværende koden
(`grid-cols-2 md:grid-cols-3 lg:grid-cols-4`) avviker på **alle** bruddpunkter, og det er roten
til problemet — også på mellomstor (md) skjerm gir 3 kolonner små bilder med dominerende tekst.
Målet er å bringe hele kort-gridet i samsvar med guiden.

## Krav / akseptansekriterier

1. Kort-gridet følger guiden: **1 kolonne** på mobil (< `md`), **2** på `md`, **3** på `lg`.
2. Bildeforholdet `aspect-[3/4]` beholdes (bevisst valg — maks bildestørrelse).
3. Navn + tittel + beskrivelse beholder eksisterende oppførsel: alltid synlig på touch,
   beskrivelse tones inn på hover kun på pekerenheter (uendret CSS i `global.css`).
4. Ingen hardkodede farger/Tailwind-fargeklasser introduseres (token-regel).
5. Eksisterende tester (e2e + unit) er fortsatt grønne.

## Avgrensninger / non-goals

- **Forside-seksjonen** (`src/components/Tannleger.astro`, ett 16/9-fellesbilde) berøres ikke
  — den har ikke problemet.
- Ingen endring i tekststørrelser, scrim eller hover-logikk.
- `max-w-[1000px]` beholdes. (`gap` ble også justert til guidens `md:gap-8` — se Steg.)

## Designvalg med begrunnelse

- **1 kolonne på mobil, behold `aspect-[3/4]`** (valgt av bruker). Større bilde gjør at den
  konstante tekstmengden tar en mindre relativ andel av kortet → teksten slutter å dominere.
  Trade-off: høyere kort (~480px) og lengre scroll ved mange tannleger — akseptert.

## Steg

1. `src/pages/tannleger.astro` (linje 23): endre grid-klassen
   `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-7 …` →
   `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 …`.
   (`gap` justeres til guidens `md:gap-8`; `max-w-[1000px]` beholdes.)

## Testbehov / definition of done

- Endringen er ren presentasjon (statisk Tailwind-klasse, ingen logikk-greiner), så den faller
  utenfor unit-coverage-policyen (som gjelder `scripts`/API-kjerne-logikk). Ingen ny unit-test.
- **Verifisering:** `npm run build` går grønt, og visuell kontroll på mobil (~390px), md (~820px)
  og lg (~1100px) bekrefter 1 / 2 / 3 kolonner med proporsjonal tekst. Kjør eksisterende e2e
  (`accessibility.spec.ts` m.fl.) som dekker `/tannleger`.
- DoD: 1 / 2 / 3 kolonner på mobil/md/lg, alle eksisterende tester grønne.

## Kjente risiki / usikkerheter

- Lavere risiko: én statisk klasse. Hovedusikkerhet er kun estetisk (kort-høyde), som er
  bevisst akseptert.

---

## Review mot kriterier

**Spec:** (1) Problem/mål klart: tekst dominerer pga. avvik fra guidens 1/2/3-grid på alle
bruddpunkter. (2) Akseptansekriterier konkrete og etterprøvbare (1/2/3 kolonner, behold 3/4,
tester grønne). (3) Non-goals eksplisitte (forside-seksjon, tekststørrelser, gap/max-w).
(4) Designvalg begrunnet (større bilde → mindre relativ tekst). (5) Ingen åpne blokkerende spørsmål.

**Plan:** (1) Mål/avgrensning klare. (2) Konkret steg med fil + linje. (3) Testbehov definert
(build + visuell + eksisterende e2e; begrunnet hvorfor ingen ny unit-test). (4) Risiko nevnt
(estetisk kort-høyde). (5) Ingen åpne blokkerende spørsmål.
