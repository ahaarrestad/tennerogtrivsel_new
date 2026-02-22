# Plan: Optimalisere bygg, tester og deploy for raskere feedback-loop

**Status:** Fullført

## Kontekst

Prosjektet hadde to GitHub Actions-workflows (`ci.yml` og `deploy.yml`) som begge kjørte unit-tester og E2E-tester. På push til main ble begge trigget, noe som betydde at alle tester ble kjørt dobbelt.

## Gjennomførte endringer

### 1. Slått sammen ci.yml og deploy.yml til én workflow

- Slettet `ci.yml`
- Omstrukturert `deploy.yml` til 4 jobber:
  - `unit-tests` + `e2e-tests` (kjører parallelt)
  - `build` (venter på begge test-jobbene)
  - `deploy` (kun ved push til main / dispatch)
- `npm audit` flyttet inn i `unit-tests`-jobben
- Miljøvariabler definert på workflow-nivå for å unngå duplisering

### 2. Ekskludert csp-check fra CI

- `testIgnore: ['**/csp-check.spec.ts']` i `playwright.config.ts`
- Testen er dokumentert som manuell og har 3s `waitForTimeout` per side

### 3. Økt Playwright-workers fra 1 til 2

- `workers: process.env.CI ? 2 : undefined` i `playwright.config.ts`
- GitHub Actions-runnere har 2 vCPU — passer godt med 2 workers

### 4. Skilt sync fra dev-server-oppstart i CI

- Nytt `dev:nosync`-script i `package.json` (`astro dev` uten sync)
- CI-betinget webServer-kommando i `playwright.config.ts`
- Eksplisitt `npm run sync`-steg i workflow før E2E-tester

## Filer endret

| Fil | Endring |
|-----|---------|
| `.github/workflows/ci.yml` | Slettet |
| `.github/workflows/deploy.yml` | Omstrukturert med parallelle jobber |
| `playwright.config.ts` | testIgnore, workers: 2, CI-betinget webServer |
| `package.json` | Nytt `dev:nosync`-script |
