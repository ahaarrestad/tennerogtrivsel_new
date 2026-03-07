# Design: Redesign tjenester-seksjonen

## Endringer

1. **Nytt `priority`-felt i frontmatter** — `z.number().default(99)` i `config.ts`. Sortering endres fra alfabetisk til priority (lavest = viktigst).

2. **Begrens til 6 på forsiden** — `Tjenester.astro` viser kun de 6 første (etter priority-sortering). Fullt utvalg vises fortsatt på `/tjenester`.

3. **"Se mer"-knapp** — `btn-secondary` under kortgridet på forsiden, lenker til `/tjenester`.

4. **Synlig på mobil** — Fjern `hidden md:block`, vis kortgrid i én kolonne på mobil, 2 kolonner md, 3 kolonner lg.

5. **Admin-modul** — Legg til priority-felt (number input) i `admin-module-tjenester.js`.

6. **Eksisterende markdown-filer** — Legg til `priority`-felt i frontmatter på alle 11 tjeneste-filer med standardverdi 99.

## Berørte filer

- `src/content.config.ts`
- `src/components/Tjenester.astro`
- `src/scripts/admin-module-tjenester.js`
- `src/content/tjenester/*.md` (alle 11 filer)
- `src/pages/index.astro` (fjern `hidden md:block` wrapper)

## Ikke i scope

- Endring av kortdesign/layout
- Endring av `/tjenester`-siden (viser fortsatt alle)
