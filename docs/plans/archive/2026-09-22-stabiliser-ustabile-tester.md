# Plan: Stabiliser ustabile tester

**Spec:** [docs/designs/2026-09-22-stabiliser-ustabile-tester.md](../designs/2026-09-22-stabiliser-ustabile-tester.md)
**Dato:** 2026-09-22

## Mål og avgrensninger

Fjerne mekanismen bak tre last-avhengige tester (A: a11y `/admin` `networkidle`,
B: `links.spec.ts` `evaluateAll`, C: `data-validation.test.ts` tung import). Kun testfiler
og `tests/global-setup.ts` berøres. Ikke med: `playwright.config.ts`, `csp-check.spec.ts`,
`setup-worktree.sh`, produksjonskode, timeouts/retries (se spec-ens non-goals).

Rekkefølge: **A først** (den eneste som stopper deployer), så C (enklest, isolert
unit-test), så B (krever reproduksjon før valg av fiks).

## Steg

### Steg 0 — Reproduser baseline (før noen endring)

Kjør med kunstig last (`for i in 1..6: yes > /dev/null &`, load ≳ 15) mot `dev:secure:fixtures`:

```bash
npx playwright test tests/accessibility.spec.ts tests/links.spec.ts \
  --project=chromium --repeat-each=4 --workers=4 --reporter=line
```

og for C: `npx vitest --run` 3 ganger under samme last. Noter hva som faktisk feiler. Dette
er referansen fiksen måles mot. (Kjøres allerede 2026-09-22 som del av spec-arbeidet;
resultatet noteres i denne fila under «Baseline» før implementasjon starter.)

**Baseline (2026-09-22, load 19–21, varm Vite-cache, chromium 4×4):** 36/36 grønne —
verken A eller B reproduseres av CPU-last alene. Nettverksmåling på `/admin` viser at
`networkidle` inntreffer 2–2,7 s *etter* `load`, utelukkende ventende på en seriell
Google-kjede (apis → accounts → content.googleapis). A er altså nett-bundet; se
mekanismetesten i Steg 4. B må reproduseres med kald cache (Steg 3.1). C ble
reprodusert 2026-09-21 (4/4 rødt under Gradle-last) og har målt årsak (780 ms import).

### Steg 1 — A: `tests/accessibility.spec.ts`

Fil: `tests/accessibility.spec.ts`

1. Lag en lokal hjelper øverst i fila:
   ```ts
   // Deterministisk «siden er klar for axe»: DOM parset (domcontentloaded), innhold
   // (main), stilark anvendt (link.sheet — color-contrast), fonter klare. Bevisst
   // verken networkidle eller load — begge venter på Googles async-skript på /admin.
   async function ventTilKlarForAxe(page: Page) {
     await page.waitForSelector('main');
     await page.waitForFunction(() =>
       Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
         .every((l) => l.sheet !== null));
     await page.evaluate(() => document.fonts.ready);
   }
   ```
   *Endret underveis:* første utkast brukte `goto(path, { waitUntil: 'load' })` og ingen
   stilark-sjekk. Mekanismetesten (Steg 4) viste at `load` også timet ut med forsinkede
   Google-svar (`<script async defer>` inngår i `load`). Derfor `domcontentloaded` i
   `goto`, og en eksplisitt stilark-sjekk som erstatning for garantien `load` ga.
2. Bruk den i forsiden-testen, `standaloneSider`-løkka og tjeneste-side-testen (der
   erstattes `goto`+klikk-sekvensen med: `goto('/tjenester/', domcontentloaded)` →
   klikk → `waitForLoadState('domcontentloaded')` → hjelperen).
3. Fjern alle tre `waitForLoadState('networkidle')` og kommentaren som påstår at
   `networkidle` «løser umiddelbart mot preview-bygg».

### Steg 2 — C: `src/__tests__/data-validation.test.ts` (+ `content.config.test.ts`)

Fil: `src/__tests__/data-validation.test.ts`

1. Legg til ved siden av eksisterende `vi.mock('astro:content', …)`:
   ```ts
   // astro/loaders drar inn hele Astros content-layer (~0,8 s i vitest) — irrelevant for
   // skjema-sjekken, og gjorde testen last-avhengig (timeout i full kjøring 2026-09-21).
   vi.mock('astro/loaders', () => ({
       glob: vi.fn(() => ({ name: 'glob-mock', load: vi.fn() })),
   }));
   ```
2. Samme mock i `src/__tests__/content.config.test.ts` — den bruker top-level await
   (ingen timeout), men samme vekt. Sjekket: loader-testene der tester kun
   `innstillinger`- og `galleri`-loaderne (håndskrevne funksjoner), aldri `glob`.
3. Mål: `npx vitest --run src/__tests__/data-validation.test.ts -t imageConfig` → testens
   varighet < 100 ms (før: ~780 ms).

### Steg 3 — B: `tests/links.spec.ts` (+ evt. `tests/global-setup.ts`)

Filer: `tests/links.spec.ts`, `tests/global-setup.ts`

1. **Reproduser med kald Vite-cache:** stopp dev-server, `rm -rf node_modules/.vite`, start
   `dev:secure:fixtures`, kjør `links.spec.ts --project=chromium --repeat-each=4` under
   last. Sjekk `/tmp/dev-secure.log` for `optimized`/`reload`-linjer tidsmessig rundt en
   eventuell feil.
2. **Hvis dev-reload bekreftes** (log viser reoptimering ved første `/tjenester/<id>/`):
   legg første tjeneste-side i warm-up-lista i `tests/global-setup.ts`. Slug hentes
   ikke hardkodet — warm-upen besøker `/tjenester/`, leser første `#tjenester a`-href og
   besøker den. Oppdater filkommentaren.
3. **Uansett:** gjør testen robust i seg selv:
   - Hent hrefs med ett atomisk kall:
     `await page.evaluate(() => [...document.querySelectorAll('.container a')].map(a => (a as HTMLAnchorElement).href).filter(h => h.startsWith(location.origin)))`
     rett etter `goto(link, { waitUntil: 'load' })`.
   - Samme mønster for `#tjenester a` på forsiden.
   - `expect(...)`-meldingene skal nevne `link` (siden som ble besøkt), ikke bare `subLink`.
4. **Hvis reproduksjonen IKKE gir feil** etter 4×4 under last med kald cache: gjør likevel
   steg 3.3 (skjørheten er reell uavhengig av utløser), dropp 3.2, og skriv i
   arkiv-notatet at utløseren ikke lot seg reprodusere 2026-09-22.

**Utfall 2026-09-22:** ikke reprodusert — kald `node_modules/.vite/deps`, load 16, 8/8
grønne, ingen optimizer-/reload-linjer i dev-loggen. Steg 3.3 gjort, 3.2 droppet.

### Steg 4 — Verifikasjon (definition of done)

Alle under kunstig last (load ≳ 15):

| Sjekk | Kommando | Krav |
|-------|----------|------|
| A mekanisme | Engangs-spec i scratchpad: `page.route('**/*google*/**', r => setTimeout(() => r.continue(), 35_000))` + admin-testens kropp. Kjør mot gammel og ny ventelogikk | gammel: timeout; ny: pass |
| A dev | `playwright test tests/accessibility.spec.ts --project=chromium --repeat-each=5` og `--project="Mobile Safari"` | 35/35 begge |
| A preview (CI-stien) | `npm run build:ci && CI=1 npx playwright test tests/accessibility.spec.ts --project=chromium --repeat-each=5` (webServer = preview når `CI` er satt) | 35/35 |
| B | `playwright test tests/links.spec.ts --project=chromium --repeat-each=5`, kald `node_modules/.vite` | 15/15 |
| C | `npx vitest --run` × 3 | 51 filer grønne alle 3 |
| Full port | `/commit` Step 2.5 (npm test + coverage + E2E alle 4 prosjekter + build + audit) | grønn |

**Resultater 2026-09-22:**

| Sjekk | Resultat |
|-------|----------|
| A mekanisme | gammel (`networkidle`): timeout 30 s; ny: pass. Første utkast med `load`: også timeout → design endret (se Steg 1). |
| A dev chromium (+ B) | 45/45 under load 19–26 |
| A dev Mobile Safari | 35/35 **uten** kunstig last. Under load ~22 feiler både gammel (13/14) og ny (12/14) variant — WebKit + axe er CPU-bundet (`goto` 3–4 s, `analyze()` 4–5 s per side ved load 7), uavhengig av mekanisme A. Backlog-punkt. |
| A preview | 35/35 under load 22. `astro preview` daemoniserer nå også under agent (memory sa det motsatte), så serveren ble forhåndsstartet på 4322 og gjenbrukt med `--workers=4`. |
| B | 8/8 kald cache (repro-steget) + 45/45 over. |
| C | 3 × 1609/1609 under load 6→23. Første forsøk ved load 27 avslørte en C-variant i `getSettings.test.ts` (`sync-data.js` importert i testkroppen, ~0,6 s) — fikset med samme mock-mønster. `admin-init.test.js` (240 ms isolert) sprakk også ved 27, ikke ved ≤ 23; ikke en tung import, ikke endret. |

Coverage-kravet (80 % branch per fil) påvirkes ikke — ingen `src/`-kode utenom tester endres.

### Steg 5 — Arkivering

- TODO.md: rett det feilaktige «Rotårsak funnet 2026-09-21 … `.astro/`»-punktet i
  arkiv-teksten (skriv hva som ble tilbakevist og hva som var den faktiske årsaken).
- Legg backlog-punkt: «`tests/csp-check.spec.ts` bruker `networkidle` — bytt til
  deterministisk venting (lav prioritet, har aldri flaket)».
- Legg backlog-punkt: «a11y-tester i WebKit er CPU-bundet (axe 4–5 s/side) og timer ut
  under tung ytre last uansett ventelogikk — vurder eget timeout eller færre workere for
  webkit-prosjektene».
- Oppdater minnenotatet om Astro 7-daemon: `astro preview` daemoniserer også.

## Testbehov

Kun eksisterende tester endres; ingen nye testfiler. «Testen av testen» er
repeat-each-kjøringene under last i Steg 4 — det er den eneste måten å vise at en
flake er borte, og det er det forrige runder har manglet (2026-06-28 verifiserte kald
cache, men ikke under last, og ikke mot preview).

## Risiki og usikkerheter

1. **A: axe-resultater kan endre seg uten `networkidle`.** Hvis noe innhold rendres av JS
   *etter* `load` (f.eks. InfoBanner etter `/api/active-messages.json`), kan skannet
   treffe før/etter, og gi ulikt resultat mellom kjøringer. Mitigering: fixtures gir
   deterministisk API-svar; hvis en violation dukker opp «noen ganger», vent eksplisitt på
   det elementet — ikke på nettverket.
2. **A: `/admin` kan fortsatt oppføre seg ulikt** hvis GSI kaster feil i console som
   påvirker DOM (f.eks. «no-access»-panel). Baseline fra Steg 0 avslører det.
3. **B: hypotesen kan være feil.** Planen har en eksplisitt gren for det (Steg 3.4).
4. **C: `content.config.test.ts`** — sjekket 2026-09-22: den tester kun de håndskrevne
   `innstillinger`- og `galleri`-loaderne, aldri `glob`. Mocken er trygg der. (Lukket.)
5. **Kunstig last på utviklermaskinen** er ikke identisk med GitHub-runnere (2 vCPU).
   Preview-kjøringen med `CI=1` er nærmest vi kommer lokalt; endelig bevis for A er neste
   ~10 grønne CI-kjøringer etter merge.
