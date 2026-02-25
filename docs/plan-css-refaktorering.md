# Plan: Refaktorere inline-klasser til global.css

> **Status: FULLFØRT**

## Kontekst

Prosjektets `.astro`-komponenter har flere gjentatte Tailwind-klassekombinasjoner og duplisert logikk. Målet er å redusere duplisering ved å:
1. Trekke ut gjentatte CSS-mønstre til navngitte klasser i `global.css`
2. Trekke ut duplisert komponent-logikk til delte Astro-komponenter og hjelpefunksjoner
3. **Ikke** over-refaktorere — enkle utility-kombinasjoner som `w-full h-full object-cover` og SVG-attributter forblir som de er

## Hva som endres

### Steg 1: Ny hjelpefunksjon `sectionVariant.ts`

**Ny fil:** `src/scripts/sectionVariant.ts`

Trekker ut den identiske variant-logikken som finnes i 4 komponenter:
```typescript
export type SectionVariant = 'white' | 'brand';

export function getSectionClasses(variant: SectionVariant = 'white') {
  return {
    sectionBg: variant === 'brand' ? 'bg-brand-light' : 'bg-white',
    headerBg: variant === 'brand' ? 'bg-brand-light/95 md:bg-transparent' : 'bg-white/95',
  };
}
```

Inkluderer en enkel unit-test.

### Steg 2: Nye CSS-klasser i `global.css`

**Fil:** `src/styles/global.css`

| Klasse | Erstatter | Brukes i |
|--------|-----------|----------|
| `.image-frame` | `rounded-2xl border-4 border-white shadow-md overflow-hidden` | Forside.astro, Card.astro |
| `.card-grid` | `flex flex-col md:grid md:grid-cols-2 lg:grid-cols-3` | Tjenester.astro, Tannleger.astro |

### Steg 3: Ny komponent `SectionHeader.astro`

**Ny fil:** `src/components/SectionHeader.astro`

Erstatter den identiske header-blokken i 4 seksjonskomponenter:
```astro
---
interface Props {
  title: string;
  intro?: string;
  headerBg?: string;
  sticky?: boolean;
}
const { title, intro, headerBg = '', sticky = false } = Astro.props;
---
<div class:list={["section-header section-header-centered", { "section-header-sticky": sticky }, headerBg]}>
  <h2 class="section-heading">{title}</h2>
  {intro && <p class="section-intro">{intro}</p>}
  <div class="heading-accent"></div>
</div>
```

### Steg 4: Oppdater seksjonskomponentene

Anvend `getSectionClasses()`, `SectionHeader` og `.card-grid` i:
- `Galleri.astro` (enklest — ingen sticky, ingen card-grid)
- `Kontakt.astro` (sticky header)
- `Tjenester.astro` (sticky header + card-grid)
- `Tannleger.astro` (sticky header + card-grid)

### Steg 5: Anvend `.image-frame`

Erstatt inline-klassene i:
- `Forside.astro` (linje ~42)
- `Card.astro` (linje ~63)

## Hva som IKKE refaktoreres

- `w-full h-full object-cover` — for enkelt og kontekstuelt varierende
- SVG-ikon-attributter i Kontakt — HTML-attributter kan ikke flyttes til CSS
- Galleri-grid (`grid-cols-2 md:grid-cols-3 lg:grid-cols-4`) — unik, bare brukt én gang
- Kontakt-grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-4`) — unik pga. betinget kolonne-antall
- Forside-layout — fundamentalt unik, ingen duplisering

## Filer som endres

| Fil | Handling |
|-----|----------|
| `src/scripts/sectionVariant.ts` | **NY** — hjelpefunksjon |
| `tests/sectionVariant.test.ts` | **NY** — unit-test |
| `src/components/SectionHeader.astro` | **NY** — delt komponent |
| `src/styles/global.css` | Legg til `.image-frame` og `.card-grid` |
| `src/components/Galleri.astro` | Bruk getSectionClasses + SectionHeader |
| `src/components/Kontakt.astro` | Bruk getSectionClasses + SectionHeader (sticky) |
| `src/components/Tjenester.astro` | Bruk getSectionClasses + SectionHeader + card-grid |
| `src/components/Tannleger.astro` | Bruk getSectionClasses + SectionHeader + card-grid |
| `src/components/Forside.astro` | Bruk `.image-frame` |
| `src/components/Card.astro` | Bruk `.image-frame` |

## Verifisering

1. `npm test` — alle unit-tester + ny sectionVariant-test passerer
2. `npm run build` — bygget kompilerer uten feil
3. `npm run test:e2e` — visuell verifisering, spesielt:
   - `sitemap-pages.spec.ts` (sjekker `bg-white`-klasse på standalone-sider)
   - `homepage.spec.ts` (sjekker seksjonssynlighet)
4. Manuell visuell sjekk i dev-server at alle seksjoner ser identiske ut
