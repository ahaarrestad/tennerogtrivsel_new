# Plan: deaktiver posisjons-slidere som ikke har effekt

Spec: [docs/designs/2026-11-22-bildeutsnitt-deaktiver-uvirksomme-slidere.md](../designs/2026-11-22-bildeutsnitt-deaktiver-uvirksomme-slidere.md)

## Mål og avgrensninger

Deaktiver X/Y-slider + −/+ når aksen ikke kan flytte bildet, med hint, og oppdater live ved zoom,
bilde-load og typebytte. Ikke med: endring av lagring, publisert rendering, auto-justering av
verdier, dra-panorering (se spec, Non-goals).

## Steg

1. **Ren regel** — `src/scripts/admin-editor-helpers.js`
   - `export function getCropAxisMovability({ naturalWidth, naturalHeight, boxWidth, boxHeight, scale })`
     → `{ x: boolean, y: boolean }`. Konstant `CROP_AXIS_TOLERANCE = 0.01`.
   - Ukjent/0-dimensjon → `{ x: true, y: true }`. `scale > 1` → begge `true`.
     Ellers `x = imgRatio > boxRatio * (1 + tol)`, `y = boxRatio > imgRatio * (1 + tol)`.

2. **Markup** — `renderImageCropSliders` i samme fil
   - Under X- og Y-raden: `<p id="${prefix}-x-hint" class="crop-axis-hint" hidden>…</p>` (og `-y-`).
   - `aria-describedby="${prefix}-x-hint"` på range-inputene.

3. **DOM-oppdatering** — samme fil
   - `export function applyCropSliderAvailability({ prefix, img, container })`: leser
     `img.naturalWidth/Height`, `container.clientWidth/Height` og `${prefix}-scale`-verdien, kaller
     regelen, og setter per akse `disabled` på `${prefix}-x` og `.slider-step-btn[data-target="${prefix}-x"]`
     + `hidden` på hinten. Skjult `img` (klasse `hidden`/tom `src`) → behandles som ukjent.
   - `export function bindCropSliderAvailability({ prefix, img, container })`: kaller apply én gang,
     legger på `img`-`load`-lytter og `input`-lytter på zoom-slideren, og returnerer `apply`-funksjonen
     for eksplisitte kall (typebytte).

4. **CSS** — `src/styles/global.css`
   - `.slider-step-btn`: `disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-admin-hover
     disabled:hover:text-admin-muted disabled:active:scale-100`.
   - Range: `input[type="range"]:disabled` → `opacity-40 cursor-not-allowed` (i admin-scope).
   - `.crop-axis-hint`: `text-[10px] text-admin-muted-light mt-1`. Kun token-klasser.

5. **Galleri** — `src/scripts/admin-module-bilder.js`
   - Etter at preview-bildet er satt: `const refreshCropAvailability = bindCropSliderAvailability({ prefix: 'galleri-edit', img: gPreviewImg, container: previewContainer })`.
   - Kall `refreshCropAvailability()` etter hver aspect-klasse-endring i forsidebilde- og
     fellesbilde-handlerne (kun i suksess-grenene — feilgrenene endrer ikke klassen).

6. **Tannleger** — `src/scripts/admin-module-tannleger.js`
   - Tilsvarende med `prefix: 'edit-t'`, `img: #preview-img`, `container: .tannlege-kort` (preview-rammen).

## Tester (definition of done)

- `admin-editor-helpers.test.js`:
  - `it.each` for regelen: likt forhold (4:3-bilde i 4:3-ramme) → begge false; bredt bilde → kun x;
    høyt → kun y; innenfor toleransen (1 % avvik) → false; `scale` 1.01 → begge true; 0-dimensjoner
    → begge true.
  - `renderImageCropSliders` rendrer hint-elementer skjult og `aria-describedby`.
  - `applyCropSliderAvailability`: setter/fjerner `disabled` på range + begge step-knapper og
    viser/skjuler hint; jsdom-quirk: `naturalWidth`/`clientWidth` må stubbes med
    `Object.defineProperty`.
  - `bindCropSliderAvailability`: zoom-`input` 1 → 1.5 → 1 aktiverer og deaktiverer igjen; `load`
    på bildet re-beregner.
- `admin-module-bilder.test.js` / `admin-module-tannleger.test.js`: at editorene binder
  tilgjengeligheten (sliderne blir deaktivert for et bilde med samme forhold som rammen), og at
  typebytte i galleri re-beregner.
- `/quality-gate` grønn (80 % branch coverage per fil, lint, type-check, e2e).
- Manuell sjekk i `astro dev` admin: galleri 4:3 og tannlege 3:4 med et bilde av samme form —
  X/Y dempet m/hint; zoom opp → aktive; zoom ned → dempet igjen.

## Risiko / usikkerhet

- **Container-størrelse 0** når editoren rendres før layout (f.eks. skjult panel) → faller tilbake
  til «aktiv» (krav 5); load-hendelsen og zoom-endring re-beregner når den er synlig.
- **Bilde fra cache** kan være `complete` før `load`-lytteren legges på — derfor kalles `apply`
  også umiddelbart i `bind`.
- **`hover:`-varianter på disabled knapp** — Tailwind v4 `disabled:hover:` må verifiseres at den
  faktisk overstyrer `hover:bg-brand` (rekkefølge/spesifisitet); sjekkes manuelt.
- Toleransen 1 % er et skjønn; kan justeres uten designendring.
