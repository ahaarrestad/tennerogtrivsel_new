# Tannleger-rutenett: flex-sentrert layout (spec + plan)

> Liten oppgave — spec og plan slått sammen i én fil, jf. §0 i oppgaveflyten.
> Erstatter backlog-oppgave «tannleger.astro: gjenbruk `.card-grid`» (PR #405).

## Problem / mål

`src/pages/tannleger.astro:23` bruker et hardkodet CSS-grid
(`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3`). PR-review #405 foreslo gjenbruk av den
delte `.card-grid`-klassen. Underveis kom et nytt krav: **når siste rad ikke er full, skal
kortene i den raden sentreres** i stedet for å ligge venstrejustert.

CSS grid kan ikke sentrere en delvis siste rad — kortene låses til kolonnesporene. Derfor
forkastes den opprinnelige `.card-grid`-gjenbruken til fordel for en **flexbox-basert,
sentrert** layout.

## Krav og akseptansekriterier

- Mobil (<768px): kortene stables i én kolonne, full bredde.
- md (768–1023px): 2 kort per rad.
- lg (≥1024px): 3 kort per rad.
- Når siste rad ikke er full (orphan-kort), sentreres kortene i den raden — på både md og lg.
- Fulle rader ser identiske ut med dagens grid (samme gap, samme maks-bredde 1000px, sentrert blokk).
- Kun layout endres; kort-utseende (`aspect-[3/4]`, scrim, tekst) er uendret.
- Ingen hardkodede farger/hex — kun layout-utilities (design-guide).

## Avgrensninger (non-goals)

- `.card-grid` endres **ikke**. `Tjenester.astro` (eneste andre bruker) forblir uberørt.
- Ingen endring i innhold, sortering eller bildehåndtering på siden.
- Ikke en generell utrulling av sentrering til andre kort-rutenett.

## Designvalg

Ny, dedikert klasse `.card-grid-center` i `src/styles/global.css` (samme `@layer`-blokk som
`.card-grid`), som kapsler inn både gap og flex-basis så calc og gap holdes i sync ett sted:

```css
.card-grid-center {
    @apply flex flex-col md:flex-row md:flex-wrap md:justify-center;
    @apply gap-6 md:gap-8;
}
.card-grid-center > * {
    @apply md:basis-[calc((100%-2rem)/2)] lg:basis-[calc((100%-4rem)/3)];
}
```

- Gap på md+ er `2rem` (`gap-8`), som matcher `2rem`/`4rem` i basis-utregningen
  (`(100% - (N-1)·gap) / N`). Full rad summerer til nøyaktig `100%` → `justify-center` er en
  no-op på fulle rader (identisk med dagens grid); kun en kort siste rad sentreres.
- Mobil bruker `flex-col` → barna tar full bredde, ingen basis nødvendig; vertikal gap `1.5rem`.
- Default `flex-grow: 0` gjør at et enslig orphan-kort ikke strekkes; `justify-center` sentrerer det.
- `flex-shrink` beholdes på default (1) for å unngå overflow ved sub-pixel-avrunding.

**Vurdert alternativ — inline utilities (forkastet):** Layout-utilities kunne ligget inline på
`tannleger.astro` (matcher filens nåværende stil og unngår `@apply` med arbitrær `calc`). Forkastet
fordi gap (container) og basis (hvert kort) da ligger på ulike elementer og lett desynkes; klassen
holder gap↔calc-koblingen samlet i én regel. Merk: dette er en enbruker-klasse, ikke ekte gjenbruk
— den opprinnelige `.card-grid`-gjenbruken fra #405 er ikke mulig (grid kan ikke sentrere orphan-rad).

## Steg

1. Legg til `.card-grid-center` (+ `> *`-regel) i `src/styles/global.css` rett etter `.card-grid`.
2. I `src/pages/tannleger.astro:23`: bytt
   `class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 max-w-[1000px] mx-auto"`
   → `class="card-grid-center max-w-[1000px] mx-auto"` (gap flyttet inn i klassen).
3. Oppdater backlog-oppgaven i `TODO.md` (tittel/beskrivelse) så den reflekterer den nye løsningen.

## Testbehov / definition of done

- `npm run build` går grønt (bekrefter også at den responsive `basis`-utilityen med `calc` kompilerer — se risiko).
- Visuell verifisering: kjør `npm run preview`, åpne `/tannleger`, sjekk ved 3 breddene:
  - mobil (<768px): stablet, full bredde
  - md (~800px, 2 kol): full rad lik dagens; oddetall → siste kort sentrert
  - lg (≥1024px, 3 kol): full rad lik dagens; rest 1–2 → sentrert
- Lokalt (2 tannleger) er orphan-testtilfellet på lg: begge skal stå sentrert i 1000px-blokken.
- Eksisterende e2e (`tests/accessibility.spec.ts`) dekker /tannleger — skal fortsatt passere.
- Ren CSS/markup-endring uten logikk → ingen ny enhetstest-dekning kreves (quality-gate gjelder scripts/API-logikk).

## Kjente risiki / usikkerheter

- Flex-basis med `calc` + `gap` er følsomt for at gap-verdien i klassen matcher calc-leddene;
  endres gap senere må begge oppdateres (derfor samlet i én klasse).
- `@apply` med en responsiv `basis`-utility som har arbitrær `calc`-verdi er ikke brukt andre
  steder i kodebasen (eksisterende arbitrære verdier er inline). Lav risiko i Tailwind v4, men
  bekreftet ved build: kompilerer og reduseres til `calc(50% - 1rem)` / `calc(33.3333% - 1.33333rem)`.
  (Token-formen med bokstavelige brackets unngås i denne teksten — Tailwind skanner også docs.)
- Antall tannleger i produksjon er ukjent (lokalt 2). Påvirker bare *om* sentrering trigges,
  ikke korrektheten — flex-løsningen håndterer alle antall.
