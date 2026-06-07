# Plan: Parallelliser galleri-bildeprosessering

**Dato:** 2026-06-07
**Oppgave:** Byggytelse: parallelliser galleri-bildeprosessering (TODO backlog)
**Opprinnelse:** PR #369-review

## Mål og avgrensninger

Parallelliser lightbox-bildeløkken i `src/components/Galleri.astro` slik at metadata-lesing
og bildeoppsett skjer samtidig i stedet for sekvensielt. Gevinsten er **moderat men reell**
og skalerer med antall galleribilder.

**Realistisk forventning:** Astro køer selve bildekodingen (Sharp encoding) internt i
build-pipelinen uansett. Den reelle gevinsten kommer fra `await loader()`, som leser
bildemetadata (width) per fil — det parallelliseres. Vi overselger ikke som «stor
byggetidskutt».

**Ikke med:**
- Thumbnail-rendringen i JSX (`visibleImages.map(...)`) — allerede parallell/synkron.
- Concurrency-cap på `Promise.all` — unødvendig ved dagens galleristørrelse (YAGNI).
- Endringer i andre komponenter, image-config eller Astro image service.
- Ytelsesmålinger / benchmarking.

## Konkrete steg

### Fil: `src/components/Galleri.astro` (linje 29–46)

Erstatt `for...of`-løkken med `Promise.all` + `.map()`:

```js
// Etter:
const results = await Promise.all(
    sortert.map(async (item) => {
        const imgPath = `/src/assets/galleri/${item.data.image}`;
        const loader = item.data.image ? images[imgPath] : undefined;
        if (!loader) return null;
        const mod = await loader();
        const maxWidth = mod.default.width;
        const widths = [1024, 1600, 2016].filter((w) => w <= maxWidth);
        if (widths.length === 0) widths.push(maxWidth);
        const optimized = await getImage({ src: mod.default, widths, format: 'webp' });
        return {
            id: item.id,
            src: optimized.src,
            srcset: optimized.srcSet?.attribute ?? '',
            title: item.data.title ?? '',
            alt: item.data.altText || item.data.title || '',
        };
    })
);
for (const result of results) {
    if (!result) continue;
    const { id, ...img } = result;
    indexById.set(id, lightboxImages.length);
    lightboxImages.push(img);
}
```

`Promise.all` returnerer resultatene i samme rekkefølge som `sortert`, så
`indexById`-indekseringen forblir identisk med dagens oppførsel.

Ingen andre filer endres.

## Testbehov / Definition of done

- `npm run build` fullføres uten feil eller advarsler.
- Alle tre galleri-berørte E2E-tester grønne:
  - `tests/galleri-lightbox.spec.ts`
  - `tests/accessibility.spec.ts`
  - `tests/sitemap-pages.spec.ts`
- **Ingen ny unit-test / coverage-gate:** 80%-branch-kravet i CLAUDE.md gjelder `scripts`
  og API. `Galleri.astro` er en komponent og dekkes via E2E + build, ikke av den porten.

## Kjente risiki

- **Rekkefølge:** `Promise.all` garanterer rekkefølge → `indexById`/`lightboxImages`
  bevares 1:1. Lav risiko.
- **Minne:** Ubegrenset `Promise.all` starter alle `loader()`-kall samtidig. Ufarlig ved
  dagens galleristørrelse; Astros build-kø demper encoding-presset. Ingen cap nødvendig.
- **`getImage` i parallell:** Standardmønster i Astro, trådsikkert.
