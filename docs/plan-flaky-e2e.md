# Plan: Fiks flaky E2E-tester

## Status: Fullført

## Kjente flaky tester

### 1. Mobilmeny-test (`sitemap-pages.spec.ts:83`)

**Symptom:** `toBeHidden()` / `toBeVisible()` feilet sporadisk på `#mobile-menu` i Mobile Chrome-prosjektet.

**Løsning (25. feb):** Erstattet CSS-basert synlighetssjekk med `data-open`-attributt.

**Verifisert (26. feb):** 0 feil av 550 kjøringer med `--repeat-each=50`. Fiksen holder.

### 2. Tjeneste-undersider-test (`sitemap-pages.spec.ts:27`)

**Symptom:** `page.goto()` timeout (30s) og `net::ERR_ABORTED` under parallell last i Mobile Chrome.

**Rotårsak:** Testen looper gjennom alle tjeneste-undersider sekvensielt med `page.goto()`. Standard 30s testtimeout er for kort når dev-serveren er under last. `waitUntil: 'load'` (default) venter på alle ressurser, mens `domcontentloaded` er tilstrekkelig for denne testen.

**Fiks:**
1. `test.setTimeout(60_000)` — dobbel timeout for sekvensielle side-navigasjoner
2. `page.goto(link, { waitUntil: 'domcontentloaded' })` — raskere navigasjon, trenger ikke vente på alle ressurser

**Verifisering:**
- Før fiks: 4 feil av 550 kjøringer (0.7%)
- Etter fiks: 0 feil av 1100 kjøringer (100 repeats × 11 tester)
- Full testsuite: 84 E2E + 787 enhetstester bestått

### 3. Admin tjeneste-editor timeout (`admin.spec.ts:124`)

**Symptom:** `locator.click: Test timeout of 30000ms exceeded` på `.edit-btn`.

**Status:** Skjedde én gang (16. feb), ikke gjentatt siden. Trolig transient — overvåkes ikke videre.

## Konfigurasjon

- `retries: 0` — ingen masking av flakiness
- `trace: 'retain-on-failure'` — traces lagres for debugging
- `workers: 4` i CI
- Docker-container: `mcr.microsoft.com/playwright:v1.58.2-noble`
