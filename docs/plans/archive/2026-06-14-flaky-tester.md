# Plan: Fikse flaky tester (timing/mock-lekkasje)

**Dato:** 2026-06-14
**Oppgave:** Fikse flaky tester (timing/mock-lekkasje) — iterasjon 2 etter Drive-uavhengighet
**Mål:** Null flaky tester i CI. Fjerne ikke-deterministiske ventemønstre og rydde mot mock-lekkasje.

## Mål og avgrensninger

**Med:**
1. Fjerne `waitForLoadState('networkidle')` fra `galleri-lightbox.spec.ts` til fordel for deterministisk `page.route`-interception av `/api/active-messages.json`.
2. Skru på `clearMocks: true` i `vitest.config.ts` mot call-historikk-lekkasje.
3. (Lagt til underveis) `astro.config.mjs`: pre-bundle `marked` + `dompurify` i `optimizeDeps.include` — fjerner en dev-modus full-reload som ga flaky `accessibility.spec.ts`. Se «Funn: accessibility-flake».

**Ikke med (besluttet 2026-06-14):**
- **csp-check.spec.ts** — den er `testIgnore`-et i `playwright.config.ts` og kjøres ikke i Playwright/CI (manuell diagnostikk; `networkidle + waitForTimeout(3000)` er bevisst for å fange asynkrone CSP-brudd). Bidrar ikke til CI-flakiness → urørt.
- **`mockReset`/`restoreMocks`** — implementasjons-/spy-lekkasje er ikke påvist. Kun call-historikk-lekkasje er reell bekymring, og dekkes av `clearMocks`. Aggressiv reset ville krevd endring i 9+ filer (re-etablere `marked`/`dompurify`-mock-implementasjoner) uten påvist gevinst. Kan vurderes senere hvis en konkret flaky-test peker på dette.
- Data-/fixture-infrastruktur (ferdig i iterasjon 1, Drive-uavhengighet).
- accessibility/`setViewportSize`-punktet — **allerede løst i main** (ingen treff på `setViewportSize`/`color-contrast` i `tests/accessibility.spec.ts`; den orphaned worktreen `fix/e2e-stabile-tester` er forkastet og innholdet er i main). Fjernes bare fra TODO.
- Endring av selve appkoden (`InfoBanner`, lightbox-komponenter). Kun tester + testkonfig.

## Steg

### Steg 1 — `galleri-lightbox.spec.ts`: networkidle → page.route
Fil: `tests/galleri-lightbox.spec.ts`

**Racet (verifisert mot `InfoBanner.astro` + `messageClient.js`):** `initBanner()` kaller
`getActiveMessage()` (fetch mot `/api/active-messages.json`). Ved ingen aktiv melding kjører
den `root.classList.add('hidden')`. Hvis svaret kommer *sent* — etter at testen har tvunget
banneret synlig — skjules banneret igjen → falsk positiv. Den gamle `networkidle` ventet for å
unngå nettopp dette.

**Fiks — fulfill med en AKTIV melding (ikke tom liste):**
- Registrer **før** `page.goto`:
  ```ts
  await page.route('**/api/active-messages.json', route =>
    route.fulfill({ json: [{ title: 'Testmelding', content: 'Test',
      startDate: '2000-01-01', endDate: '2100-01-01' }] }));
  ```
  startDate/endDate spenner over enhver systemklokke → meldingen er alltid «aktiv», så appen
  selv kjører `remove('hidden')`. Da viser `initBanner` banneret uansett timing → racet borte.
  Med en aktiv melding finnes ingen kodesti der scriptet *skjuler* banneret, så Playwrights
  auto-retry på `toBeVisible()` kan aldri gi falsk positiv.
- Fjern `await page.waitForLoadState('networkidle')` (linje 14) og kommentaren om sent svar.
- Forenkle: den manuelle `page.evaluate(...)`-DOM-pirkingen som tvinger banneret synlig fjernes
  — appen viser nå banneret via ekte kodesti. **Verifisert:** `Layout.astro:83` rendrer
  `<InfoBanner/>` og `galleri.astro` bruker Layout, så `initBanner` kjører på `/galleri/`.
  Fixturens `title: 'Testmelding'` gir samme banner-tittel som dagens manuelle oppsett.
  Behold `await expect(banner).toBeVisible()`.
- Behold `firstTile.waitFor()` og resten av stacking-assertene uendret.
- **NB tom liste (`json: []`) er FEIL:** den betyr «ingen aktiv melding» → scriptet kjører
  fortsatt `add('hidden')` → samme race, bare raskere.
- **Payload-schema verifisert** mot `src/pages/api/active-messages.json.ts`: returnerer nøyaktig
  `{ title, startDate, endDate, content }` — fixturen matcher eksakt, ingen manglende felt.

### Steg 2 — `vitest.config.ts`: `clearMocks`
Fil: `vitest.config.ts`

- Legg til i `test`-blokken:
  ```ts
  clearMocks: true,
  ```
- `clearMocks` nullstiller kun mock-*historikk* (`mock.calls`/`mock.results`) før hver test —
  **ikke** implementasjoner. `vi.mock`-factory-implementasjoner (`marked.parse`,
  `DOMPurify.sanitize`) består, så ingen fallout som med `mockReset`.
- 22 testfiler kaller allerede `vi.clearAllMocks()` manuelt i `beforeEach`; den globale flaggen
  gjør disse redundante (harmløst) og gir samme nullstilling til de øvrige.
- Kjør full vitest-suite for å bekrefte grønt — forventet ingen endringer i testfiler.
  Skulle en test mot formodning være avhengig av at historikk *lekker* mellom tester (anti-
  mønster), rettes den testen, ikke konfigurasjonen.

## Funn: accessibility-flake (oppdaget under full-suite-verifisering)

Full Playwright-suite avdekket at `accessibility.spec.ts` (UU på `/tannleger/` + `/tjenester/`,
chromium) flakrer under parallell last — **ikke** forårsaket av endringene over.

**Rotårsak (verifisert via Playwright-trace):** axe-skannet feiler med "Execution context was
destroyed" fordi dev-serveren utfører en *andre dokument-navigasjon* midt i skann. Delvis kilde:
Vite optimerte `marked`/`dompurify` (klient-deps via InfoBanner på alle sider) on-demand ved
første sidelast og tvang full-reload. `@vite/client` + begge deps ble hentet 2×.

**Avgjørende test:** mot `npm run preview` (prod-bygget som CI kjører) er testen **stabil** —
70/70 grønn, retries=0, repeat-each=10. Flaken er altså et rent `astro dev`-artefakt og **når
aldri CI**. Målet «null flaky i CI» er dermed oppfylt for denne testen.

**Tiltak (besluttet — alternativ A):**
- `astro.config.mjs` `optimizeDeps.include` += `marked`, `dompurify` → pre-bundling fjerner
  dep-optimaliserings-reloaden (dev-only forbedring, null prod-effekt). Reduserte flaken fra
  ~3 % til ~1 %.
- En sjelden residual dev-navigasjon gjenstår (ingen `[vite] page reload`-logg, ingen
  redirect/SW/iframe). Siden den ikke når CI og oppgavens formål er å *fjerne* timing-vent,
  gjeninnføres **ikke** `networkidle` i accessibility-testen. Forklarende kommentar lagt i
  `tests/accessibility.spec.ts`.

## Testbehov og definition of done
- `npm test` (vitest): grønn. Ingen ny kildekode introduseres, så `clearMocks` påvirker ikke coverage av kjernefiler; 80 %-kravet gjelder uendret.
- **CI-stien (`npm run preview`)**: full Playwright grønn på alle prosjekter — dette er fasiten for «null flaky i CI».
- Determinisme-bevis: `galleri-lightbox --repeat-each=10` grønn (40/40); `accessibility --repeat-each=10` mot preview grønn (70/70).
- Ingen `networkidle` igjen i CI-kjørte specs (`galleri-lightbox` ryddet; `csp-check` CI-ignored og urørt; accessibility uendret mht. ventemønster).
- TODO-punktet oppdatert: accessibility-`setViewportSize`-delpunktet markert løst, oppgaven arkivert per todo-skill Fase 5.

## Kjente risiki og usikkerheter
- **`clearMocks` lav risiko:** nullstiller kun historikk, ikke implementasjoner. Forventet null endringer i testfiler. Eneste teoretiske fallout: en test som (feilaktig) er avhengig av at mock-historikk lekker mellom tester — da rettes testen.
- **Steg 1 page.route:** den aktive meldingen må ha datoer som spenner over enhver systemklokke (2000→2100) for å være robust mot `vi.useFakeTimers` og CI-tidssone. Innebygd i fiksen.
- **Determinisme bevises, ikke antas:** `--repeat-each=10` på galleri-lightbox er gaten mot å erklære racet løst.

## Ingen åpne spørsmål
Begge scope-beslutninger (csp-check droppes, `clearMocks`-only) er avklart. Resten er entydig.
