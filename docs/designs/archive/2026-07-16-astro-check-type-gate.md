# Spec: `astro check` som type-gate

**Dato:** 2026-07-16
**Oppgave:** Innfør `astro check` som type-gate i CI, og rydd opp i eksisterende typefeil som avdekkes.

---

## Problem / mål

`.astro`-filer type-sjekkes ikke i dag:

- ESLint linter dem ikke.
- `astro build` stripper typer uten å sjekke dem.
- `tsconfig` er `strict`, men ingenting kjører faktisk en type-sjekk — verken lokalt eller i CI.

Resultatet er at typefeil i `.astro`-frontmatter, `.ts`-filer og config kan nå `main` og deploy uten å bli fanget. En måling med `astro check` på nåværende `main` avdekker **63 errors** (og 88 hints) fordelt på produksjonskode, tester og config.

Målet er å innføre `astro check` som en obligatorisk gate — både som lokalt npm-script og som eget CI-steg — og å rydde opp i hele det eksisterende etterslepet slik at gaten starter grønn.

## Krav og akseptansekriterier

1. `@astrojs/check` og `typescript` er direkte, pinnede `devDependencies` (ikke transitive).
2. `package.json` har et `check`-script: `astro check`.
3. `npm run check` gir **0 errors** lokalt (hints tillates).
4. `deploy.yml` har en egen `type-check`-jobb som kjører `npm run check`, og **`build`-jobben** `needs` den (på linje med `lint`, som er gated i `build` — ikke i `deploy`).
5. Alle 63 nåværende errors er ryddet med **ekte typefikser** — ingen blanket `any`, `@ts-ignore` eller `@ts-nocheck` som skjuler problemet.
6. Alle eksisterende kvalitetsporter (unit-tester, lint, e2e, coverage) er fortsatt grønne etter oppryddingen.

## Avgrensninger / non-goals

- **Ingen egen `tsc --noEmit`** i tillegg — `astro check` dekker hele prosjektet (`tsconfig` `include: **/*`).
- **Ingen ESLint-endringer** (verken nye regler eller `.astro`-parsing i ESLint).
- **Ingen refaktorering** utover det som trengs for å fjerne typefeilene. Hints (88 stk.) er utenfor scope.
- **Ingen nye miljøvariabler** → ingen workflow-`env` å oppdatere utover den nye jobben.
- **Ikke** senke `strict` eller løsne `tsconfig` for å skjule feil.

## Designvalg med begrunnelse

| Valg | Begrunnelse |
|------|-------------|
| Full-prosjekt-omfang (prod + tester + config) | Størst verdi; tester og config type-sjekkes framover, ikke bare `.astro`. Bruker valgte dette. |
| Egen `type-check`-jobb (ikke steg i `lint`) | Matcher repoets ett-gate-per-ansvar-mønster; tydelig rødt/grønt kun på typesjekk; kan kjøre parallelt. |
| `typescript` som direkte devDep | I dag kun transitivt via `typescript-eslint` — for skjørt for en gate som avhenger av det. |
| Ekte typefikser, ingen undertrykking | En gate full av `any`/`@ts-ignore` har ingen verdi. |

## Etterslepet (63 errors) gruppert etter rotårsak

Grupperingen viser at flere feil deler én felles fiks:

**Config / oppsett (fikser flere på én gang):**
- `getSettings.test.ts` — 5× `ts(2503) Cannot find namespace 'vi'`. `vi` er allerede value-importert; koden bruker `vi.Mock` som *type*, men vitest har ingen `vi`-namespace. Fikses med `import type { Mock }` (ikke ny value-import).
- `vitest.config.ts` — 1× `test` finnes ikke i `UserConfig`. Fila bruker `getViteConfig` fra `astro/config` (ikke `defineConfig`); vitest' `UserConfig`-augmentering lastes ikke. Fikses med `/// <reference types="vitest/config" />`.

**Produksjonskode (`.astro` / `.ts`), ~22 feil:**
- `prisliste.astro` — 8× implisitt `any` på callback-parametere (`item`, `i`, `a`, `b`)
- `Galleri.astro` — 3× (`mod` unknown ×2, `Promise<unknown>` til `ImageMetadata`)
- `llms.txt.ts` + `llms-full.txt.ts` — 4× `never[]`. Rotårsaken er **`src/scripts/generate-llms.js`** hvor `generateLlmsTxt`/`generateLlmsFullTxt` har param-defaultene `tannleger = [], tjenester = []` → `never[]`. Fikses i `generate-llms.js` (JSDoc `@param`-typer), ikke i `.txt.ts`-filene.
- `mapInit.ts` — 2× (leaflet `tap` er fjernet fra `MapOptions` i `@types/leaflet` 1.9; `Default`-konvertering). Koblet til `mapInit.test.ts` som asserter `tap`.
- `tannleger.astro` (**side**) — 1× `Promise<unknown>` (bilde-glob, `import.meta.glob` linje 11)
- `Tannleger.astro` (**komponent**) — 1× `Promise<unknown>` (bilde-glob)
- `MessageButton.astro` — 1× `variant`-prop-typemismatch (ingen `interface Props`)
- `middleware.ts` — 1× `MiddlewareHandler`-signatur
- `admin/index.astro` — 1× `window.flatpickr` mangler på `Window`

**Test-/config-filer, ~41 feil:**
- `admin.spec.ts` — 12× (implisitt `any` på mock-params, `never`-property-tilgang)
- `buildSchema.test.ts` — 10× parsed JSON er `unknown`
- `mapInit.test.ts` — 9× (`Window`→`Record`-konvertering, `tap`-property)
- `getSettings.test.ts` — 5× (se config-gruppen over)
- `data-validation.test.ts` — 3× (ZMock, `schema` mulig undefined / `safeParse`)
- `content.config.test.ts` — 1× ZMock

## Åpne spørsmål

Ingen som blokkerer planlegging.
