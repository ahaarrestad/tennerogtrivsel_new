# Plan: Fiks flaky E2E-tester

## Status: Overvåker

## Kjente flaky tester

### 1. Mobilmeny-test (`sitemap-pages.spec.ts:70`)

**Symptom:** `toBeHidden()` / `toBeVisible()` feiler sporadisk på `#mobile-menu` i Mobile Chrome-prosjektet.

**Historikk:**
- 16. feb: Admin tjeneste-editor timeout (30s) — `admin.spec.ts:124` — skjedde én gang, ikke gjentatt
- 22. feb: WebKit-nettlesere manglet i CI (39 tester feilet) — **løst** med Docker-container
- 23. feb: Mobilmeny `toBeHidden()` feilet — brukte CSS-basert sjekk
- 25. feb: Fikset med `data-open`-attributt i stedet for `toBeHidden()`/`toBeVisible()`
- 26. feb: Feilet igjen på main-bygg (løst ved retrigger) — mulig at `toBeHidden()` fortsatt brukes et sted, eller at `data-open`-fiksen ikke er tilstrekkelig

**Rotårsak-hypoteser:**
1. Playwright ser `opacity-0` uten `visibility: hidden` som "visible" — Tailwind v4 genererer ikke alltid `invisible`-klassen konsistent
2. Timing-problem: CSS-transisjoner (`transition-all duration-200`) kan forsinke tilstandsendringen
3. Dev-server i CI responderer tregt under parallellkjøring (4 workers)

### 2. Admin tjeneste-editor timeout (`admin.spec.ts:124`)

**Symptom:** `locator.click: Test timeout of 30000ms exceeded` på `.edit-btn`.

**Historikk:** Skjedde én gang (16. feb), ikke gjentatt siden.

**Hypotese:** Mock-timing — `setupMocks()` kjører via `addInitScript()`, kan ha race condition med sideinnlasting.

## Neste steg

Når nok datapunkter er samlet:

1. **Samle data:** Overvåk CI-historikk for gjentatte feil. Noter testnavn, prosjekt (chromium/webkit/mobile), og feilmelding.

2. **Reproduser lokalt:** Kjør den flaky testen i loop for å reprodusere:
   ```bash
   npx playwright test sitemap-pages --project="Mobile Chrome" --repeat-each=20
   ```

3. **Fiks basert på funn:**
   - Hvis timing: legg til `await page.waitForLoadState('networkidle')` eller øk timeout for spesifikke assertions
   - Hvis CSS: fjern all CSS-basert synlighetssjekking, bruk kun `data-*`-attributter
   - Hvis mock-race: flytt `setupMocks()` til `page.route()` i stedet for `addInitScript()`

4. **Verifiser:** Kjør testen 50+ ganger lokalt og i CI uten feil før lukking.

## Konfigurasjon (nåværende)

- `retries: 0` — ingen masking av flakiness
- `trace: 'retain-on-failure'` — traces lagres for debugging
- `workers: 4` i CI
- Docker-container: `mcr.microsoft.com/playwright:v1.58.2-noble`
