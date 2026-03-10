# Plan: Oppgrader til Astro 6

## Bakgrunn

Astro 6 er utgitt med Vite 7, Zod 4, Shiki 4 og nye bildehåndteringsregler. Prosjektet er allerede godt forberedt — bruker Content Layer API, ingen deprecated APIer (`ViewTransitions`, `Astro.glob()`), og kjører Node 24.

## Forutsetninger

- Node 22+ (vi har 24 — OK)
- Content Layer API (allerede migrert — OK)
- Ingen `ViewTransitions` eller `Astro.glob()` — OK

## Steg

### 1. Bump dependencies

```bash
npm install astro@^6 @astrojs/sitemap@^4
```

Sjekk at `@tailwindcss/vite` og `sharp` fortsatt er kompatible med Vite 7.

### 2. Fiks Zod 4-endringer i content.config.ts

Zod 4 endrer noen APIer. Sjekk at følgende mønstrene vi bruker fortsatt fungerer:
- `z.coerce.date()` (meldinger)
- `z.union([z.string(), z.number()])` (prisliste)
- `.default()` verdier
- `.optional()` felter

Kjør `astro build` og fiks eventuelle Zod-feil.

### 3. Sjekk Vite 7-kompatibilitet

- `@tailwindcss/vite` plugin i `astro.config.mjs`
- Vite dev proxy (`/tiles`) — verifiser at proxy-config fortsatt fungerer
- Sjekk at `vitest` fungerer med nye Vite-versjonen

### 4. Sjekk bildehåndtering

Astro 6 endrer bildeoppførsel:
- **Bilder cropper som standard** — sjekk `Image`-komponenter i Galleri, Tannleger, Forside, Footer, Navbar
- **Bilder oppskaleres aldri** — verifiser at dette ikke påvirker små bilder
- Vurder om `fit`-prop trengs på noen bilder

### 5. Kjør tester og build

```bash
npm test              # Vitest unit/integration
npm run build         # Full Astro build
npm run test:e2e      # Playwright E2E
```

Fiks eventuelle feil. Spesielt:
- `astro:content` mock i tester
- `getCollection` oppførsel
- Markdown heading ID-endringer (kan påvirke E2E-tester som sjekker ankre)

### 6. Visuell verifisering

Kjør `npm run dev` og sjekk:
- Forsidebildet
- Galleri-bilder
- Tannlege-bilder
- Prisliste-tabell
- Tjeneste-sider med markdown-innhold

## Risiko

| Risiko | Sannsynlighet | Konsekvens | Tiltak |
|--------|---------------|------------|--------|
| Zod 4 bryter skjemaer | Lav | Bygg feiler | Fiks skjemaer, kjør build tidlig |
| Vite 7 bryter Tailwind-plugin | Lav | Dev/build feiler | Bump `@tailwindcss/vite` |
| Bilde-cropping endrer utseende | Middels | Visuell regresjon | Legg til `fit="cover"` der nødvendig |
| Vitest inkompatibel med Vite 7 | Lav | Tester feiler | Bump vitest |

## Estimat

Rett-frem dependency-bump. Mesteparten av arbeidet er testing og verifisering.
