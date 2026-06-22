# Spec: Tannleger-siden — visuelt løft

> Design-doc (hva/hvorfor) for backlog-oppgaven «Tannleger-siden: visuelt løft».
> Dato: 2026-06-21. Plan (hvordan) skrives separat i `docs/plans/`.

## Problem / mål

Den frittstående `/tannleger`-siden oppleves flat og kjedelig. Dagens kort er
rektangulære portretter (`aspect-[3/4]`) begrenset til `max-w-[75%]`, uten kortflate
eller hover-liv, og biografien er gjemt bak et `<details>`/`<summary>`-accordion. To
konkrete smertepunkter fra eier:

1. Siden ser «utrolig kjedelig» og flat ut — mangler personlighet og liv.
2. Accordion-mønsteret («trykk for litt mer tekst») føles kjedelig og tungvint.

Målet er et visuelt løft som gir siden liv og fjerner klikk-for-mer-mønsteret, ved å
**gjenbruke det visuelle språket fra galleriet** (gradient-scrim med tekst på bildet +
subtil hover-zoom) slik at siden henger sammen med resten av nettstedet.

## Valgt løsning — «Galleri-overlay» (variant A)

Hvert kort er et portrett som fyller kortet, med en gradient-scrim nederst der navn og
tittel ligger **oppå bildet og alltid er synlige** — samme grep som galleri-flisene.
Spesialkompetansen toner inn under navnet ved hover på desktop, og er alltid synlig på
touch/mobil. Validert mot eier via interaktive mockups.

Landede detaljer fra mockup-runden:

- **Bildeformat:** `3/4` (stående) beholdes — eier likte forholdet.
- **Rutenett:** fast 4 kolonner på desktop → 8 tannleger = to rene rader à fire. 3
  kolonner på tablet (md), 2 på mobil. Rutenettet **kapsles til ~1000px og sentreres**
  med jevn luft (gap), slik at kortene ikke blåses opp i full bredde («in your face»)
  og siste rad blir jevn.
- **Tekst på bildet:** navn (`font-heading`, extrabold, hvit) + tittel (hvit, redusert
  opasitet) alltid synlig via scrim.
- **Spesialitet (bio):** progressiv forbedring — se «Tilgjengelighet» under.
- **Hover:** subtil bilde-zoom (`scale ~1.04`) + skygge-løft, som galleriet.

## Krav og akseptansekriterier

1. `/tannleger` viser tannlegene som variant A-kort: portrett fyller kortet (3/4), navn
   + tittel alltid synlige på bildet via gradient-scrim.
2. Rutenett: 4 kolonner (lg), 3 (md), 2 (mobil). Kapslet maks-bredde (~1000px) og
   sentrert; 8 tannleger gir to rene rader på desktop. Jevn luft via spacing-tokens.
3. Spesialiteten vises som hover-uttoning på pekerenheter med hover; **alltid synlig på
   touch/mobil**; teksten ligger **alltid i DOM-en** (lesbar for skjermlesere uavhengig
   av visningstilstand).
4. `<details>`/`<summary>`-accordion fjernes helt — ingen «klikk for mer tekst».
5. Hover gir subtil bilde-zoom + skygge-løft (konsistent med galleriet).
6. Tannleger uten spesialitet (i dag Ida, Trude) viser kun navn + tittel, uten tomt
   tekstområde.
7. Per-tannlege `imageConfig` (object-position/scale via `buildImageStyle`) bevares, så
   ansiktsutsnittene fortsatt sitter riktig.
8. Visuell utforming bruker kun CSS-tokens (stone-paletten); ingen nye hardkodede
   fargeklasser. Scrim-gradient bygges på `--color-brand-dark`.
9. Kontrast for navn/tittel over scrim oppfyller WCAG AA (hvit på mørk scrim ≥ 4.5:1).
10. Ingen regresjon: forsidens «Tannleger»-seksjon (gruppebildet i `Tannleger.astro`)
    er uendret.
11. Admin-forhåndsvisningen (`admin-module-tannleger.js`) viser **nøyaktig det samme
    kortet** som `/tannleger`: samme scrim-overlegg, samme `.tannlege-kort`/
    `.tannlege-scrim`/`.tannlege-spec`-klasser, samme tekst-overlegg.
12. Admin-previewet har **identisk hover-/fokus-/touch-oppførsel** for spesialiteten
    som den offentlige siden (glir inn på hover på pekerenheter; alltid synlig på
    touch/mobil — relevant når admin brukes på mobil).
13. Live-oppdateringen i admin (navn/tittel/beskrivelse/bildeutsnitt) fungerer mot den
    nye markupen, og det gamle accordion-baserte previewet (`<details>`,
    `preview-no-desc`) er fjernet.

## Admin-forhåndsvisning (paritet)

Admin-modulen for tannleger har en «Forhåndsvisning» som i dag replikerer det *gamle*
kortet (samme `max-w-[75%]`, `aspect-[3/4] rounded-xl`, og `<details>`/`<summary>`-
accordion). Når det offentlige kortet endres, **skal previewet endres tilsvarende**, ellers
redigerer eier mot et utdatert bilde.

Løsning: admin-previewet gjenbruker **nøyaktig de samme kort-klassene** som den offentlige
siden, slik at tekst-overlegg og hover-/fokus-/mobiloppførsel er identisk. `updatePreview()`-
logikken oppdateres til den nye DOM-strukturen (`#preview-name`, `#preview-title`,
`#preview-spec`), og accordion-/`no-desc`-grenene fjernes. Bildeutsnitt-previewet
(`#preview-img` med `object-position`/`scale` fra crop-sliderne) beholdes uendret — kun
tekst-/scrim-laget endres.

## Tilgjengelighet (a11y)

Hover-uttoning av spesialiteten er **kun en visuell forbedring**, ikke eneste vei til
informasjonen:

- Uttoningen aktiveres bare på enheter med ekte peker/hover
  (`@media (hover: hover) and (pointer: fine)`).
- På touch/mobil (`hover: none`) vises spesialiteten alltid under navn/tittel.
- Spesialitetsteksten er **alltid til stede i DOM-en** — den skjules kun visuelt på
  desktop inntil hover — så skjermlesere får alltid med innholdet.

Dette tilfredsstiller eiers valg: «alltid synlig på mobil + ved fokus», og unngår at
WCAG-relevant innhold låses bak hover.

## Avgrensninger / non-goals

- **Forsidens teaser-seksjon** (`Tannleger.astro`, gruppebilde som lenker til
  `/tannleger`) endres ikke.
- **Ingen per-tannlege detaljside** — kortene er ikke lenker.
- **Ingen nye bilder** og ingen endring av eksisterende bildefiler.
- **Ingen endring i datamodellen** — `tannleger.json`/content-schema er uendret.
- **Ingen animasjoner** utover hover-zoom, scrim-overgang og skygge-løft.

## Konsekvens for design-guiden

Design-guiden (`docs/designs/design-guide.md`) §5.3 angir i dag at tannleger-bilder skal
være `rounded-full` (sirkel) med `border-4 border-white`. Variant A erstatter dette med
et rektangulært 3/4-kort med scrim-overlegg. **§5.3 må oppdateres** så guiden samsvarer
med faktisk design (håndteres i planen).

## Åpne spørsmål

Ingen som blokkerer planlegging.
