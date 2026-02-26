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

## Plan

Jobbes selvstendig uten avklaringer underveis.

### Steg 1: Reproduser lokalt

Kjør de mistenkte flaky testene i loop for å bekrefte at de faktisk er flaky:

```bash
npx playwright test sitemap-pages --project="Mobile Chrome" --repeat-each=50
```

Hvis ingen feil etter 50 kjøringer, utvid til 100 eller prøv andre prosjekter (chromium, webkit). Hvis testene aldri feiler lokalt, sjekk CI-historikk for kontekst (hvilken jobb, hvilken assertion, trace-output).

### Steg 2: Analyser feilmønster

Basert på reprodusering eller CI-data:
- Identifiser nøyaktig hvilken assertion som feiler
- Sjekk om feilen er timing-relatert (CSS-transisjon, sideinnlasting) eller logikk-relatert
- Les relevant testkode og komponentkode for å forstå mekanismen

### Steg 3: Fiks

Mulige løsninger avhengig av funn:
- **Timing:** `await page.waitForLoadState('networkidle')`, eller øk timeout for spesifikke assertions
- **CSS-synlighet:** Fjern all CSS-basert synlighetssjekking (`toBeHidden`/`toBeVisible`), bruk kun `data-*`-attributter
- **Mock-race:** Flytt `setupMocks()` til `page.route()` i stedet for `addInitScript()`

### Steg 4: Verifiser fiksen

Kjør den fiksede testen i loop for å bekrefte stabilitet:

```bash
npx playwright test <testfil> --project="Mobile Chrome" --repeat-each=100
```

Krav: 0 feil på 100 kjøringer før oppgaven regnes som ferdig.

### Steg 5: Kvalitetssjekk

Kjør full testsuite (enhetstester + E2E + build) for å sikre at fiksen ikke brekker noe annet.

## Konfigurasjon (nåværende)

- `retries: 0` — ingen masking av flakiness
- `trace: 'retain-on-failure'` — traces lagres for debugging
- `workers: 4` i CI
- Docker-container: `mcr.microsoft.com/playwright:v1.58.2-noble`
