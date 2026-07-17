# Plan: `astro check` som type-gate

**Dato:** 2026-07-16
**Spec:** [docs/designs/2026-07-16-astro-check-type-gate.md](../designs/2026-07-16-astro-check-type-gate.md)
**Oppgave:** Innfør `astro check` som lokal + CI type-gate og rydd de 63 eksisterende typefeilene.

---

## Mål

- `npm run check` (= `astro check`) gir 0 errors, lokalt og i CI.
- Egen `type-check`-jobb i `deploy.yml` gater deploy.
- `@astrojs/check` + `typescript` som direkte, pinnede devDeps.

## Avgrensninger

- Ingen `tsc --noEmit`, ingen ESLint-endringer, ingen tsconfig-løsning, ingen refaktorering utover typefikser.
- Hints (88 stk.) er ikke i scope.
- Ingen undertrykking (`any`/`@ts-ignore`/`@ts-nocheck`) som skjuler feil.

---

## Steg 1 — Avhengigheter + script

**Filer:** `package.json`, `package-lock.json`

1. `npm install --save-dev @astrojs/check typescript` (pinnes til aktuelle versjoner).
2. Legg til script: `"check": "astro check"`.

**Verifisering:** `npm run check` kjører (forventet: rapporterer errors før opprydding).

## Steg 2 — Rydd config-/oppsett-feil (fikser 6 feil på tvers)

**Filer:** `vitest.config.ts`, `src/scripts/__tests__/getSettings.test.ts`

> **NB (avdekket i uavhengig review):** de opprinnelige diagnosene her var feil. `vitest.config.ts` bruker `getViteConfig` fra `astro/config` — ikke `defineConfig` fra vite. Og `vi` er *allerede* value-importert i `getSettings.test.ts:1`; feilen er at koden bruker `vi.Mock` som type, men vitest eksporterer ingen `vi`-namespace.

1. `vitest.config.ts:7` — `ts(2353) 'test' finnes ikke i UserConfig`. Legg til `/// <reference types="vitest/config" />` øverst i fila (eller importer typene) så vitest' `UserConfig`-augmentering med `test`-nøkkelen lastes. **Ikke** bytt `defineConfig`-import (fila bruker ikke `defineConfig`). Fikser 1.
2. `getSettings.test.ts` `ts(2503) Cannot find namespace 'vi'` (5×) — erstatt `vi.Mock`-type­referansene med en ekte type: `import type { Mock } from 'vitest'` + `as Mock`, eller bruk `vi.mocked(...)`. Fikser 5.

**Verifisering:** de 6 feilene borte i `npm run check`.

## Steg 3 — Rydd produksjonskode (~22 feil)

Ekte typefikser, én fil av gangen:

| Fil | Feil | Tilnærming |
|-----|------|-----------|
| `src/pages/prisliste.astro` | 8× implisitt `any` (`item`, `i`, `a`, `b`) | Typ dataarrayen fra `prisliste.json` (interface for prislinje) og annotér callback-params |
| `src/components/Galleri.astro` | 3× (`mod` unknown, `Promise<unknown>`) | `import.meta.glob<{ default: ImageMetadata }>('...')` (generisk glob-signatur) |
| `src/pages/tannleger.astro` (**side**) | 1× `Promise<unknown>` | Samme glob-typing som Galleri (`import.meta.glob` linje 11) |
| `src/components/Tannleger.astro` (**komponent**) | 1× `Promise<unknown>` | Samme glob-typing som Galleri |
| `src/scripts/generate-llms.js` | 4× `never[]` (viser i `llms.txt.ts` + `llms-full.txt.ts`) | Rotårsak er param-defaultene `tannleger = [], tjenester = []` i `generateLlmsTxt`/`generateLlmsFullTxt` (linje 86/95). Legg til JSDoc `@param`-typer. **Ikke** annotér i `.txt.ts`-filene — det er kall-siden. |
| `src/scripts/mapInit.ts` | 2× (leaflet `tap`, `Default`-cast) | `tap` er fjernet fra `MapOptions` i `@types/leaflet` 1.9 og er en død no-op i Leaflet 1.9. Foretrukket: fjern `tap: false` og oppdater `mapInit.test.ts:102-103` (assertene på `tap`) i takt. Cast via `unknown` for `Default`-konverteringen. Se risiko-note om test-kobling. |
| `src/components/MessageButton.astro` | 1× `variant`-prop | Legg til `interface Props` og typ `variant` mot `Button`s variant-union (ikke `any`) |
| `src/middleware.ts` | 1× `MiddlewareHandler` | Rett returtype/signatur så den matcher `MiddlewareHandler` |
| `src/pages/admin/index.astro` | 1× `window.flatpickr` | Augmentér `Window`-interface (global `declare`) for `flatpickr` (linje 260) |

**Verifisering per fil:** kjør `npm run check` og bekreft at akkurat de feilene forsvinner uten nye. `mapInit.ts`: kjør `mapInit.test.ts` etterpå (koblet via `tap`-assertene). `generate-llms.js`: kjør tilhørende llms-tester.

## Steg 4 — Rydd test-/config-filer (~41 feil)

| Fil | Feil | Tilnærming |
|-----|------|-----------|
| `tests/admin.spec.ts` | 12× (`any`-params, `never`-property) | Annotér Playwright `page`/mock-`params`; typ mock-data-arrayene så `.find()` ikke gir `never` |
| `src/scripts/__tests__/buildSchema.test.ts` | 10× `unknown` | Typ parsed JSON-resultat (interface eller `as`-cast med begrunnelse) |
| `src/scripts/__tests__/mapInit.test.ts` | 9× (`Window`→`Record`, `tap`) | Cast via `unknown` først der påkrevd; typ leaflet-options |
| `src/__tests__/data-validation.test.ts` | 3× (ZMock, `schema` undefined, `safeParse`) | Guard mot `undefined`; typ zod-mock riktig |
| `src/__tests__/content.config.test.ts` | 1× ZMock | Juster ZMock-typen |

**Merk:** `getSettings.test.ts` (5×) er allerede løst i Steg 2.

**Verifisering:** `npm run check` → 0 errors. `npm test` fortsatt grønt (ingen runtime-endring i testlogikk — kun typer).

## Steg 5 — CI-jobb

**Fil:** `.github/workflows/deploy.yml`

> **NB (avdekket i uavhengig review):** to ting må være riktige her, ellers passerer gaten lokalt men feiler i CI.
>
> **(a) Riktig jobb å gate:** `lint` er *ikke* gated i `deploy` — den er gated i **`build`**-jobben (`needs: [unit-tests, e2e-tests, lint]`, `if`-guarden linje 122–130). `deploy` og `update-lambda` har begge kun `needs: build`. `type-check` skal derfor inn i **`build`**-jobbens `needs` + `if`, ikke i `deploy`.
>
> **(b) Data + sync kreves:** `src/content/prisliste.json` er gitignorert og **statisk importert** i `prisliste.astro:6` og `llms-full.txt.ts:4` → uten fila gir check `ts(2307) Cannot find module`. I tillegg regenererer *ikke* `astro check` `.astro/types.d.ts` (også gitignorert) — det gjør `astro sync`/`build`. Verifisert: uten data + sync stiger feiltallet (63 → 68 → 106). Jobben MÅ derfor seede fixtures og synke før check.

1. Ny jobb `type-check` (mønster fra `lint`/`e2e-tests`):
   - checkout → `setup-node` (`node-version: '24'`) → `npm ci --ignore-scripts` (matcher øvrige jobber)
   - `npm run seed:fixtures` (skriver bl.a. `prisliste.json`)
   - `npx astro sync` (regenererer `.astro/`-typer) — ev. `npm run build:ci` som i e2e-jobben
   - `npm run check`
   - Samme `if`-guard for fork/`repository_dispatch` som `lint`/`unit-tests` bærer.
2. Legg `type-check` til i **`build`**-jobbens `needs` (`needs: [unit-tests, e2e-tests, lint, type-check]`) og i `if`-betingelsen (`needs.type-check.result == 'success' || needs.type-check.result == 'skipped'`), på linje med `lint`.

**Verifisering:** flytt `src/content/*.json` + `.astro/` midlertidig til side, kjør `npm run seed:fixtures && npx astro sync && npm run check` → skal gi 0 errors. Gjenopprett filene etterpå.

## Steg 6 — Kvalitetsport + arkivering + commit

1. Kjør full kvalitetsport (`/quality-gate`): `npm test` (coverage), `npm run lint`, `npm run check`.
2. `review-loop` til `REVIEW_LOOP: CLEAN`.
3. Arkiver oppgaven (TODO → TODO-archive, flytt plan/spec til `archive/`) **før** `/commit`.
4. `/commit`.

---

## Testbehov og definition of done

Dette er en type-hardening-oppgave; ingen ny runtime-funksjonalitet → ingen nye enhetstester kreves. Endringene i test-filer er rene typeannotasjoner som ikke endrer testlogikk.

**Definition of done:**
- [ ] `@astrojs/check` + `typescript` er direkte pinnede devDeps; `check`-script finnes
- [ ] `npm run check` → 0 errors
- [ ] `type-check`-jobb i `deploy.yml` gater `deploy`
- [ ] `npm test` (inkl. coverage ≥ 80% branch per berørt kjernefil), `npm run lint`, e2e fortsatt grønne
- [ ] Ingen `any`/`@ts-ignore`/`@ts-nocheck` brukt for å skjule feil
- [ ] Oppgaven arkivert

## Kjente risiki og usikkerheter

| Risiko | Håndtering |
|--------|------------|
| `npm run check` feiler i CI uten data + sync (**bekreftet**: statisk `prisliste.json`-import + gitignorert `.astro/`) | Løst i Steg 5: `seed:fixtures` + `astro sync` før check; ikke lenger en åpen antakelse |
| `type-check` gates feil sted (`deploy` vs `build`) | Løst i Steg 5: `lint` gates i `build` — `type-check` legges samme sted |
| `mapInit.ts`-fiks (fjerne `tap`) endrer `mapInit.test.ts:102-103` | Fiks kilde + test i takt; grenser mot «ingen refaktorering», men er nødvendig for korrekt type |
| Bilde-glob-typing gjentas i 3 filer (`Galleri`, `tannleger.astro`, `Tannleger.astro`) | Samme `import.meta.glob<{default: ImageMetadata}>`-mønster per fil; vurder delt wrapper kun hvis det vokser |
| Coverage kan falle hvis en fiks endrer forgreninger | Usannsynlig (kun typer), men kjør coverage i Steg 6 og skriv tester ved behov |
| `astro check`-versjon drift mot Astro 7 | Pinn `@astrojs/check` og `typescript`; dependabot holder dem oppdatert |
