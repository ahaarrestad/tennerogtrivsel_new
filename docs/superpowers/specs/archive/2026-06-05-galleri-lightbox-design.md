# Design: Galleri-lightbox («klikk for å vise større bilde»)

> Status: Godkjent design (brainstorming). Neste steg: implementasjonsplan.
> Dato: 2026-06-05

## Mål

Når en bruker klikker på et bilde i galleriet, åpnes bildet i en stor overlay-visning
(«lightbox») der man kan bla videre til neste/forrige bilde, både på mobil og desktop.

## Omfang

**Med:**
- Lightbox på **både** forside-preview (`Galleri.astro` som seksjon) og full `/galleri`-side (`standalone`).
- Fra forsiden blar man gjennom **hele** galleriet (ikke bare de 4 preview-bildene). Bekreftet valg.
- Full navigasjon med wrap-around (siste → første og omvendt).
- Input: synlige pil-knapper, piltaster (← →), Esc, klikk utenfor bildet, ×-knapp, og **swipe** på touch.
- Innhold i lightboxen: bildet stort, **bildetittel** (caption) og **teller** (`3 / 12`) samlet nederst i én info-blokk. Toppen har kun ×-knappen.

**Ikke med (mulige senere backlog-oppgaver):**
- Zoom/pan inne i bildet.
- Thumbnail-stripe.
- Deling/nedlasting av bilde.
- URL-deep-linking til enkeltbilde (`?bilde=…`).

## Brukeropplevelse (validert i prototype)

- Grid-tile har `cursor: zoom-in` og hover-scale (som i dag). Klikk åpner lightboxen på det bildet.
- Overlay: mørk, lett blur, bildet sentrert med `object-fit: contain`.
- Nederst: tittel (hvit, halvfet) med teller rett under (mindre, dempet) — deler samme gradient slik at det leses som én blokk.
- Navigasjon: ‹ › knapper sentrert vertikalt i hver kant.
- Lukking: ×, Esc, eller klikk på overlay utenfor bildet.
- **Regresjonskrav (funnet i prototype):** Nav-knappene SKAL ligge over bildet (`z-index`) på **alle** skjermbredder — på smal skjerm dekket bildet ellers venstre-pilen.
- Knappene har egen bakgrunn + svak skygge for kontrast mot lyse bilder.

## Arkitektur

Tre berørte/nye filer, hver med ett klart ansvar:

### 1. `src/components/Lightbox.astro` (ny)
Singleton overlay-markup (×, ‹, ›, scene med `<img>`, info-blokk med tittel + teller).
Rendres skjult som standard. Inkluderes **én gang** fra `Galleri.astro`.
Bruker kun navngitte klasser fra `global.css` (se Design-system) — ingen inline-styling.
Inneholder `<script>` som importerer og kaller `initGalleryLightbox()` på
`astro:page-load` + umiddelbart (samme mønster som `Navbar.astro`/`InfoBanner.astro`).

### 2. `src/scripts/gallery-lightbox.js` (ny)
All klient-logikk, eksportert som `initGalleryLightbox()`:
- Leser bildelista fra et `<script type="application/json">`-element (se Dataflyt).
- Binder klikk på tiles (`[data-lightbox-index]`), åpner på riktig indeks.
- Navigasjon (next/prev med wrap), keydown (← → Esc), klikk-utenfor, swipe (terskel ~50px).
- Focus-trap, focus-retur til utløsende tile, `document.body` scroll-lås ved åpning.
- **Idempotent**: en `data-lightbox-bound`-vakt (eller tilsvarende) hindrer dobbel-binding når init kjører på nytt ved view transitions.
- Bildet settes via `src`/`srcset` + `alt` med `setAttribute`; caption via `textContent`. **Ingen `innerHTML`-interpolasjon.**

### 3. `src/components/Galleri.astro` (endres)
- Bygger `lightboxImages` = **hele** den sorterte, aktive galleri-lista (ikke bare `visibleImages`).
- For hvert bilde: kall `getImage()` (fra `astro:assets`) med flere `widths` (f.eks. `[1024, 1600, 2016]`, format `webp`) → gir `src` + `srcset` i passende oppløsning.
- Emitterer `[{ src, srcset, width, height, title, alt }]` som JSON i et `<script type="application/json" id="galleri-lightbox-data">`-element.
- Hver tile blir en **`<button>`** (eller `role="button"` + `tabindex="0"` + Enter/Space) med `data-lightbox-index={i}`, der `i` er indeksen i hele lista. Preview-tiles er de første N i samme sortering, så indeksene stemmer.
- Inkluderer `<Lightbox />` én gang.

## Dataflyt

```
galleri.json (content collection)
  → Galleri.astro frontmatter: filtrer type==='galleri', sorter på order
  → for hvert bilde: getImage({ src, widths:[1024,1600,2016], format:'webp' })
  → JSON i <script type="application/json" id="galleri-lightbox-data">
  → gallery-lightbox.js leser JSON ved init, holder den som in-memory liste
  → klikk på [data-lightbox-index=i] → open(i) → setter <img src/srcset/alt>, caption, teller
```

Kildebildene er 2016×1512 og oppover (én 2856px), så full oppløsning for fullskjerm er tilgjengelig. `srcset` lar nettleseren velge riktig variant etter viewport og DPI.

## Design-system / layout-fit

- Kun token-klasser / CSS-variabler fra `@theme` — **ingen hardkodet hex eller Tailwind-fargeklasser**.
- **Gjenbruk CSS-klasser — ikke hardkod styling i `.astro`-filene.** Lightboxens stiler defineres som navngitte, gjenbrukbare klasser i `@layer components` i `src/styles/global.css` (samme mønster som `.section-container`, `.btn-primary`, `.card-base`, `image-overlay-gradient`), bygget med `@apply` på token-klasser. `Lightbox.astro` refererer kun til disse klassene — **ingen `style=`-attributter eller inline CSS-blokker med hardkodede verdier i komponenten**.
  - Foreslåtte klasser: `.lightbox`, `.lightbox-stage`, `.lightbox-img`, `.lightbox-info`, `.lightbox-title`, `.lightbox-count`, `.lightbox-nav-btn` (+ `.lightbox-nav-btn--prev`/`--next`), `.lightbox-close`.
  - Eksisterende klasser gjenbrukes der de passer (f.eks. gradient-mønsteret fra `image-overlay-gradient`).
- Mørk overlay-bakgrunn: gjenbruk `--color-brand-dark` (#1c1917) med alpha, evt. innfør et dedikert `--color-overlay`-token. Ikke rå `rgba()` utenfor token-systemet.
- Fonter: eksisterende `--font-heading`/`--font-body` via `text-`-tokens.
- Grid og tiles beholder dagens klasser/struktur; vi legger kun til klikk-affordans og `data`-attributt.

## Sikkerhet

- Ingen `innerHTML`/`outerHTML` med interpolasjon → ingen DOMPurify nødvendig, og `local/no-unsafe-inner-html` (ESLint) er tilfreds.
- Kun lokale, byggetids-genererte bilder → **ingen CSP-endring**.
- JSON-data er Astro-escapet i `<script type="application/json">`; parses med `JSON.parse`.

## Tilgjengelighet

- Overlay: `role="dialog"`, `aria-modal="true"`, `aria-label` (f.eks. «Bildevisning»).
- Alle knapper har `aria-label` (Lukk / Forrige / Neste).
- Focus flyttes inn i dialogen ved åpning; Tab fanges (focus-trap); focus returneres til utløsende tile ved lukking.
- `<img>` får riktig `alt` per bilde.
- Teller annonseres som tekst slik at det er lesbart for skjermleser.

## Testing (test-drevet — tester skrives FØR implementasjon)

Rammeverk: Vitest + jsdom. Mål: **80% branch coverage per fil** (kjerne-logikk). Behavioral, structure-insensitive (følger `docs/guides/test-guide.md`).

`gallery-lightbox.js` struktureres slik at `initGalleryLightbox()` opererer på DOM som testen bygger opp i jsdom. Testene dekker atferd:

- Åpner på riktig bilde når en tile klikkes (riktig `src`/caption/teller).
- Neste/forrige bytter bilde; **wrap-around** i begge ender.
- Piltaster ← → navigerer; Esc lukker; klikk på overlay (utenfor bildet) lukker; × lukker.
- Swipe over/under terskel (bytter / bytter ikke bilde).
- `body` scroll-lås settes ved åpning og fjernes ved lukking.
- Focus-retur til utløsende tile ved lukking.
- Idempotens: to init-kall gir ikke dobbel event-binding (én klikk = én navigasjon).
- Tom/manglende data: init feiler ikke (guard).

Astro-komponentenes byggetids-logikk (at hele lista emitteres, indeks-mapping preview→full) verifiseres via eksisterende komponent-/innholdstest-mønster der det er praktisk; ellers dekkes mappingen av lightbox-modulens tester.

## Kjente risiki / usikkerheter

- **`getImage()` i frontmatter** øker antall genererte bildevarianter ved build. Akseptabelt; galleriene er små. Bør verifiseres at build-tid ikke eksploderer.
- **View transitions / `astro:page-load`**: dobbel-binding må håndteres (idempotens-krav over).
- **Overlay-token**: hvis nytt `--color-overlay`-token innføres, må det dokumenteres i design-guiden.
- **Indeks-mapping preview→full** forutsetter at preview er de første N i samme sortering — gjelder i dagens `Galleri.astro` (`sortert.slice(0, MAX_PREVIEW)`); må bevares.

## Definition of done

- Lightbox virker på forside og `/galleri`, mobil + desktop, med alle input-metodene over.
- Bilder vises i riktig oppløsning (srcset, ≥1600px tilgjengelig).
- Følger design-systemet (token-klasser), ingen CSP-endring, ingen ESLint-brudd.
- Alle nye/endrede kjernefiler ≥80% branch coverage; fersk testrapport presentert.
- Ingen Critical/Important funn igjen etter `review-loop`.
```
