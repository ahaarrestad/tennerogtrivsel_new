# Plan: Sjekk bildeoppløsning — bilder er hakkete

**Dato:** 2026-06-01
**Oppgave:** Backlog — Sjekk bildeoppløsning

## Mål

Identifisere og utbedre årsaker til at bilder på siden ser hakkete/pixelerte ut.

**Ikke i scope:**
- Redesign av bildeseksjoner
- Ny bildekomprimeringsinfrastruktur
- Video/animasjon

---

## Rapportert symptom

Bilder ser hakkete/pixelerte ut, **spesielt galleriet på stor skjerm**.

## Analyse: Kjent rotårsak

### Problem 1 — Forsidebildet (kritisk)
`src/assets/hovedbilde.png` er **942×854 px** (72 DPI, 80 KB). Containeren er `aspect-[16/10]` som tar halve bredden på desktop (`lg:grid-cols-2`). På en 1440 px skjerm med 2x DPR (HiDPI/Retina) trengs ~1440 px bredt bilde — vi har bare 942 px → oppskalering → hakkete.

`sync-data.js:downloadFile()` laster ned filen direkte fra Google Drive uten resize. Rotårsak: filen i Drive er et lavoppløslig eksemplar.

### Problem 2 — Manglende `widths`/`sizes` på galleribilder (mest sannsynlig årsak til galleri-problemet)
`Galleri.astro`, `Forside.astro` og `Tannleger.astro` bruker Astros `<Image>` uten `widths`/`sizes`-props. Uten disse:
- Astro genererer kun **én utgangsstørrelse** (kildestørrelsen) og ingen `srcset`
- Nettleseren har ingen hint om visningsbredde → velger suboptimal variant på HiDPI/stor skjerm
- På 2x DPR-skjermer vises bildene ved dobbel pikselbredde; uten `srcset` kan nettleseren velge feil størrelse

Gallerikildene er 2016×1512 px — store nok — men Astros standardkomprimering til webp uten eksplisitte bredder kan gi kvalitetstap. Uten `densities` eller `widths` leveres én variant; på store 2x-skjermer med ~640 px kolonne trengs ~1280 px, og 2016 px er akkurat nok men marginalt.

---

## Steg

### Steg 1 — Brukeraktivitet: last opp forsidebilde i høy oppløsning
**Ingen kodeendring**
- Forsidebildet i Google Drive MÅ byttes ut med en versjon på **minst 1920 px bredde** (helst 2560 px for 2x HiDPI-dekkning) **før** Steg 2 gjennomføres.
- Etter opplasting: kjør sync-scriptet eller `npm run build` for å hente ny fil til `src/assets/hovedbilde.png`.
- Årsak: Astro/Sharp kan ikke generere et 1920 px bilde fra en 942 px kilde — kodeendringen i Steg 2 vil generere oppskalerte (dårlige) varianter hvis kilden fortsatt er 942 px.

### Steg 2 — Kodeendring: legg til `widths`/`sizes` i Forside.astro
**Fil:** `src/components/Forside.astro` — gjøres etter Steg 1
- Container er `aspect-[16/10]` i halv grid-bredde på desktop (`lg:grid-cols-2`) → ~50vw
- Legg til `widths={[960, 1440, 1920]}` og `sizes="(min-width: 1024px) 50vw, 100vw"` på `<Image>`-komponenten

### Steg 3 — Kodeendring: legg til `widths`/`sizes` i Galleri.astro
**Fil:** `src/components/Galleri.astro`
- Grid: `grid-cols-2 md:grid-cols-3 lg:grid-cols-4` → ~50vw / 33vw / 25vw
- På 2x HiDPI + 2560px skjerm trengs ~1260px per kolonne (640px × 2) — arrayen må dekke dette
- Legg til `widths={[400, 600, 800, 1200]}` og `sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"`

### Steg 4 — Kodeendring: legg til `widths`/`sizes` i Tannleger.astro
**Fil:** `src/components/Tannleger.astro`
- Fellesbildet tar full bredde av `section-content`
- Legg til `widths={[768, 1152, 1600]}` og `sizes="(min-width: 1024px) calc(100vw - 4rem), 100vw"`

### Steg 5 — Verifiser visuelt
- Kjør `npm run dev` og åpne siden
- Sjekk at forsidebilde, galleri og tannlegerbilde ser skarpe ut
- Bruk DevTools `Elements`-fanen til å bekrefte at `srcset`-attributt er til stede på alle tre bildene
- Bruk DevTools `Network`-fanen til å verifisere at nettleseren velger riktig variant

---

## Testbehov

- **Ingen nye enhetstester** — dette er ren visuell kvalitet + markup-attributter
- Verifiser manuelt at `srcset`-attrs er til stede i DOM (DevTools Elements)
- Verifiser visuelt på skjermer med HiDPI/2x DPR
- Definition of done: forsidebilde, galleri og tannlegerbilde ser skarpe ut på 2x DPR-skjerm, `srcset` genereres korrekt på alle tre

---

## Kjente risiki

- **Forsidebildet i Drive (rekkefølge)**: Steg 2 (`Forside.astro`) MÅ gjøres etter Steg 1 (Drive-opplasting). Astro/Sharp vil forsøke å generere 960/1440/1920 px varianter — med 942 px kilde gir det oppskalerte (dårlige) bilder. Kilden i Drive MÅ oppgraderes først.
- **Galleri-bilder på 2016 px**: Kildene er tilstrekkelige for thumbnails (1200 px max i srcset). Men på full-side-galleri (`/galleri/`) med potensielt større fremtidige visninger kan det bli trangt på 2x HiDPI. Kan håndteres ved å be klient laste opp enda høyere oppløsning.
