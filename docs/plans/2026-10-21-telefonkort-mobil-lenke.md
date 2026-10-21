# Telefonkortet i Kontakt som hel tel:-lenke på mobil

> Liten oppgave — spec og plan er slått sammen i én fil (§0 i `start-oppgave.md`).
> Reviewet av tre blinde reviewere (faktasjekk, empiri, design) 2026-10-21; funnene er innarbeidet.

## Spec

**Problem:** På mobil er bare telefonnummeret på «Telefon»-kortet i Kontakt-seksjonen klikkbart
(`formatInfoText(settings.phone1)` i `src/components/Kontakt.astro`). Treffflaten er én tekstlinje,
og brukeren bommer. Brukeren forventer at hele kortet ringer, slik «Besøksadresse»-kortet allerede
er én stor lenke til veibeskrivelse.

**Krav / akseptansekriterier:**
1. Under `lg` (< 1024 px) er hele telefonkortet ett `<a href="tel:<nummer uten mellomrom>">`.
   Trykk hvor som helst på kortet — også under nummeret — starter en oppringning.
2. Mobilkortet har samme interaksjon som de andre kort-lenkene (`cursor-pointer`, hover,
   `group-hover` på tittelen, fokusring fra `.card-base`) og en `card-link`-linje nederst:
   **«Ring oss →»**, i samme markup som «Få veibeskrivelse →».
3. Ingen nestet lenke: nummeret inne i det lenkede kortet er ren tekst. I `#kontakt` finnes
   nøyaktig én synlig `a[href^="tel:"]` på mobil, og den inneholder både «Telefon» og nummeret.
4. Fra `lg` og opp er kortet som i dag: `<div>`, ikke-interaktivt, ingen synlig/fokuserbar
   `tel:`-lenke (vernet av `tests/telefon-tab-rekkefolge.spec.ts`).
5. Mangler `phone1` (tom eller bare mellomrom), rendres ett kort uten lenke på alle bredder —
   aldri `href="tel:"`.
6. Tilgjengelig navn på mobillenka er kortinnholdet: «Telefon», nummer, sentralbordtekst,
   «Ring oss». Ingen `aria-label` (den ville skjule sentralbordtiden). Pila `→` er
   `aria-hidden="true"`.
7. Nummeret brytes ikke over to linjer (`whitespace-nowrap`, som i dag).

**Non-goals:**
- Telefonnummeret i `Footer.astro` og `TelefonKnapp.astro` endres ikke.
- Ingen endring i layout, farger eller tekster utover «Ring oss →».
- iOS Safaris automatiske nummergjenkjenning (`format-detection`) på desktop-varianten — dagens
  oppførsel, utenfor scope.

**Designvalg:**
- **To kort-varianter, som `TelefonKnapp.astro`:** `Card` rendrer én tag (`a` eller `div`), så én
  instans kan ikke være lenke på mobil og `div` på desktop. Dobbel rendering er etablert mønster, og
  `display: none` holder den skjulte varianten ute av tab-rekkefølge og tilgjengelighetstre.
- **Stretched link forkastet:** kortets hover/fokus (`.card-base:hover`, `group-hover`,
  progress-bar, ring) henger på at roten er lenka; måtte gjenskapes med `focus-within` o.l.
- **Breakpoint `lg`, ikke `md`:** konsistent med `TelefonKnapp`, footer og navbar, som alle skiller
  på `lg`. Nettbrett (768–1023 px) får altså lenkekortet. Ikke «fiks» dette til `md`.
- **`lg:hidden` / `max-lg:hidden`:** symmetrisk par. (Empirisk sjekket i Tailwind 4.3.3: begge vinner
  over `flex`-utilityen og `.card-base` i `@layer components`. `hidden lg:flex` ville også virket.)
- **Egen `TelefonKort.astro`** med rene props (ingen `getSiteSettings`-kall) holder `Kontakt.astro`
  ryddig, unngår duplisert markup og gjør AC5 enhetstestbart uten mocking.
- **`formatInfoText` slettes:** telefonkortet er eneste produksjonsbruk (verifisert). Den blir død
  kode, så funksjonen og dens tester fjernes fra `textFormatter.js` / `textFormatter.test.js`.
  Øvrige funksjoner i fila brukes av admin og blir stående.

## Plan

**Filer:**
1. `src/components/Card.astro` — ny valgfri `class`-prop (`class: className`), sist i rot-elementets
   `class:list`. `→` i default «Les mer» får `aria-hidden="true"`.
2. `src/components/TelefonKort.astro` (ny). Props: `phone`, `sentralbordTekst`, `minHeight`.
   - `cleanPhone = (phone ?? '').replace(/\s+/g, '')`.
   - Innhold (ikon-SVG flyttet fra Kontakt, `<p class="whitespace-nowrap">{phone}</p>`,
     `<p class="text-xs">{sentralbordTekst}</p>`) rendres i:
     - `cleanPhone` finnes: `<Card href={`tel:${cleanPhone}`} class="lg:hidden">` med
       `<div slot="link"><div class="card-link">Ring oss <span aria-hidden="true" …>→</span></div></div>`,
       pluss `<Card class="max-lg:hidden">` uten href.
     - `cleanPhone` mangler: ett `<Card>` uten href og klasse.
   - Ikon og tekst gjentas i malen for de to variantene (Astro-frontmatter kan ikke holde markup);
     det er få linjer og holdes samlet i denne ene fila.
3. `src/components/Kontakt.astro` — erstatt telefonkortet med
   `<TelefonKort phone={settings.phone1} sentralbordTekst={settings.sentralbordTekst} minHeight={minHeight} />`;
   fjern `formatInfoText`-importen. Pila i «Få veibeskrivelse →» får `aria-hidden="true"`.
4. `src/scripts/textFormatter.js` + `src/scripts/__tests__/textFormatter.test.js` — fjern
   `formatInfoText` (og regexene/`escapeHtml` hvis kun den bruker dem) og tilhørende tester.
5. `src/components/__tests__/Card.test.ts` (ny, AstroContainer som `Button.test.ts`):
   `class` havner på roten for både `<a>` og `<div>`; uten `href` → `<div>` uten `cursor-pointer`.
6. `src/components/__tests__/TelefonKort.test.ts` (ny), `it.each`:
   - `''` og `'   '` → ingen `<a>`, ingen `href="tel:"`, ett kort.
   - `'12 34 56 78'` → én `href="tel:12345678"`, to kort (`lg:hidden` + `max-lg:hidden`),
     «Ring oss», nummeret er ikke inne i en ekstra `<a>`.
7. `tests/telefon-tab-rekkefolge.spec.ts` — utvid, parametrisert over `['/', '/kontakt/']`,
   alt avgrenset til `#kontakt`:
   - Mobil (390 px): nøyaktig én synlig `a[href^="tel:"]`; den inneholder heading «Telefon» og
     nummeret; `getByRole('link', { name: /Telefon.*Ring oss/s })` er synlig; høyde ≥ 250 px;
     `elementFromPoint` nær bunnen av kortet har `closest('a[href^="tel:"]')`.
   - Begge bredder: nøyaktig én synlig heading «Telefon» (`exact: true`).
   - Desktop: eksisterende test (0 synlige `tel:`-lenker) uendret.
   - (Nestet `<a>` kan ikke testes som `a a` — HTML-parseren splitter den. «Én synlig lenke som
     inneholder både tittel og nummer» er sjekken som faktisk fanger feilen.)

**Test / definition of done:**
- Nye/utvidede tester grønne; eksisterende `accessibility.spec.ts` (axe, også mobilprosjektene)
  grønn. Merk: axe fanger *ikke* nestede lenker (`nested-interactive` gjelder ikke `link`) og
  flagger ikke lange lenkenavn — derfor E2E-sjekkene over.
- `/quality-gate` grønn (lint, unit, ≥ 80 % branch coverage per fil, E2E, build, audit).
- Manuell sjekk på 390 px og 1280 px (skjermbilde): kortet ser ut som før, «Ring oss →» kun på mobil.

**Risiko / usikkerhet:**
- To `<h3>Telefon</h3>` i DOM; tekstbaserte locatorer må bruke `:visible`/rolle. `Card`s `index`
  brukes ikke i markup, så ingen id-kollisjon. Grid påvirkes ikke (`display: none`).
- Eksisterende mobiltest (`a[href^="tel:"]:visible .first()`) treffer nå en annen lenke enn før —
  ufarlig, de nye testene tar over det kortspesifikke vernet.
