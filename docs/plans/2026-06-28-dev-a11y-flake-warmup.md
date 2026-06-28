# Dev-modus a11y-flake — Vite warm-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fjern den dev-only a11y-flaken («Execution context was destroyed») ved å flytte Vites dep-optimerings-reload ut av de assertende testene via en Playwright `globalSetup` som varmer rutene før testkjøring.

**Architecture:** Vites dep-optimering kjører én gang per kald dev-server og cacher i `node_modules/.vite`; reloaden skjer kun på første navigasjon. En `globalSetup` besøker hovedrutene én gang før testene, slik at reloaden er unnagjort før axe-skannet kjører. Warm-upen hoppes over i CI (som kjører `preview`, uten Vite-dev-server).

**Tech Stack:** Playwright (`@playwright/test`), Astro 5 dev-server (Vite), TypeScript.

Spec: [docs/designs/2026-06-28-dev-a11y-flake-warmup.md](../designs/2026-06-28-dev-a11y-flake-warmup.md)

## Global Constraints

- Hot-reload i utvikling SKAL bevares — ingen bytte til `preview` lokalt.
- CI-stien (`npm run preview`) SKAL være uendret og fortsatt grønn; warm-up hoppes over når `process.env.CI` er satt.
- Eksisterende `networkidle`-vente i `tests/accessibility.spec.ts` beholdes uendret.
- Ingen retry-wrapper eller timing-baserte ventelys.

---

### Task 1: Legg til Playwright globalSetup med warm-up

**Files:**
- Create: `tests/global-setup.ts`
- Modify: `playwright.config.ts` (legg til `globalSetup`-felt i `defineConfig`)

**Interfaces:**
- Consumes: `FullConfig` fra `@playwright/test` (for å lese `baseURL` fra `projects[0].use`), `chromium` fra `@playwright/test`.
- Produces: Default-eksportert `async function globalSetup(config: FullConfig): Promise<void>`. Playwright kaller denne automatisk via `globalSetup`-feltet — ingen andre tasks konsumerer den direkte.

- [ ] **Step 1: Opprett `tests/global-setup.ts`**

Ruteliste speiler rutene i `tests/accessibility.spec.ts`. CI-guard først (CI kjører `preview`, ingen Vite-optimering). `baseURL` hentes fra configen så porten følger `PORT`-env.

```typescript
import { chromium, type FullConfig } from '@playwright/test';

// Varmer dev-serveren før testkjøring: besøker hovedrutene én gang så Vites
// dep-optimering (og den påfølgende reloaden) er unnagjort FØR de assertende
// testene kjører. Uten dette kan reloaden starte midt i axe-skannet i
// accessibility.spec.ts → «Execution context was destroyed». Se
// docs/designs/2026-06-28-dev-a11y-flake-warmup.md.
//
// Hoppes over i CI: der serverer `npm run preview` et statisk prod-bygg uten
// Vite-dev-server, så ingen dep-optimering skjer.
async function globalSetup(config: FullConfig): Promise<void> {
  if (process.env.CI) return;

  const baseURL = config.projects[0]?.use?.baseURL;
  if (!baseURL) throw new Error('globalSetup: baseURL mangler i Playwright-config');

  const ruter = ['/', '/kontakt/', '/tannleger/', '/tjenester/', '/galleri/', '/admin'];

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ baseURL });
    for (const rute of ruter) {
      await page.goto(rute, { waitUntil: 'networkidle' });
    }
  } finally {
    await browser.close();
  }
}

export default globalSetup;
```

- [ ] **Step 2: Registrer globalSetup i `playwright.config.ts`**

Legg til feltet rett etter `testIgnore` (toppen av `defineConfig`-objektet):

```typescript
  testDir: './tests',
  testIgnore: ['**/csp-check.spec.ts'],
  globalSetup: './tests/global-setup.ts',
  fullyParallel: true,
```

- [ ] **Step 3: Verifiser at warm-up kjører på kald cache i dev-modus**

```bash
rm -rf node_modules/.vite
npx playwright test tests/accessibility.spec.ts
```
Expected: Alle a11y-tester PASS, ingen «Execution context was destroyed». Warm-up kjører før testene (synlig som en kort forsinkelse før første test).

- [ ] **Step 4: Gjenta på kald cache for å bekrefte stabilitet**

```bash
rm -rf node_modules/.vite && npx playwright test tests/accessibility.spec.ts
rm -rf node_modules/.vite && npx playwright test tests/accessibility.spec.ts
```
Expected: Stabilt PASS begge ganger.

- [ ] **Step 5: Verifiser CI-guard (warm-up hoppes over)**

```bash
CI=1 node -e "require('tsx/cjs'); const fn = require('./tests/global-setup.ts').default; fn({projects:[{use:{}}]}).then(()=>console.log('OK: returnerte uten å starte browser'));"
```
Expected: `OK: returnerte uten å starte browser` (ingen browser-launch, ingen baseURL-feil) — bekrefter at CI-grenen returnerer tidlig.

> Hvis `tsx` ikke er tilgjengelig som require-hook lokalt: hopp over Step 5 og verifiser CI-guarden ved kode-inspeksjon (`if (process.env.CI) return;` er første linje i funksjonen). Den fulle CI-kjøringen mot `preview` dekker dette uansett.

- [ ] **Step 6: Kjør hele lokale e2e-suiten for å bekrefte ingen regresjon**

```bash
rm -rf node_modules/.vite
npm run test:e2e   # eller: npx playwright test
```
Expected: 77/0 (eller gjeldende totalantall), ingen flaky reruns.

- [ ] **Step 7: Commit**

Commit håndteres via prosjektets `/commit`-flyt (kvalitetsport → code-review → ship). Ikke kjør rå `git commit` her — følg `start-oppgave`-flytens Fase 5–6.

## Self-Review

**1. Spec coverage:**
- Krav 1 (stabil kald-cache dev e2e) → Task 1 Step 3–4, 6.
- Krav 2 (hot-reload bevart) → Global Constraints + ingen `preview`-bytte; warm-up er kun test-runner-oppvarming.
- Krav 3 (CI uendret/grønn) → CI-guard i Step 1, verifisert Step 5.
- Krav 4 (rot-årsak, ikke symptom) → warm-up flytter reloaden ut av testene; ingen retry/timing-hack (Global Constraints).
- Komponent `tests/global-setup.ts` → Step 1. Komponent `playwright.config.ts` `globalSetup`-felt → Step 2.

**2. Placeholder scan:** Ingen TBD/TODO/«handle edge cases». All kode er konkret.

**3. Type consistency:** `globalSetup(config: FullConfig): Promise<void>`, default-eksport, matcher Playwrights forventede signatur og `globalSetup`-feltets sti-referanse i Step 2. `baseURL` leses fra `config.projects[0].use.baseURL`, som finnes i eksisterende config.

**Merknad om TDD:** Flaken er et ikke-deterministisk dev-only-artefakt uten en meningsfull deterministisk enhetstest (den reproduserer ikke pålitelig på kommando). Verifikasjon er derfor manuell kald-cache-kjøring (Step 3–4, 6) i tråd med spec-ens Definition of Done, ikke en rød/grønn TDD-syklus.
