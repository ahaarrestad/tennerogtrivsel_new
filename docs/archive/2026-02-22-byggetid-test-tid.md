# Plan: Optimalisere byggetid og test-tid i CI

> **Status: FULLFØRT**

## Kontekst

Pipeline bruker i dag ~4 minutter fra push til deploy. E2E-jobben er flaskehalsen (~3m 15s), der Playwright OS-avhengigheter tar 33-53s selv med browser-cache, og selve testene tar 110-133s. Build-jobben kjører på en separat runner bare for å kjøre `astro build` (~10s), men bruker ~15-20s på overhead (checkout, npm ci, runner-oppstart).

**Målte tider (gjennomsnitt over 6 kjøringer):**

| Jobb | Tid | Flaskehals-steg |
|------|-----|-----------------|
| unit-tests | ~19s | (ikke flaskehals) |
| e2e-tests | ~195s | PW OS-deps: 33-53s, tester: 110-133s |
| build | ~27s | npm ci: 6s, astro build: 10s |
| deploy | ~10s | (ikke flaskehals) |

## Endringer (3 stk)

### 1. Playwright Docker-container i stedet for browser-installasjon
**Fil:** `.github/workflows/deploy.yml`

Bytt e2e-jobben til `mcr.microsoft.com/playwright:v1.58.2-noble` container. Eliminerer alle browser-install/cache-steg (5 steg → 0 steg).

**Forventet besparelse:** 25-45s

### 2. Slå sammen build inn i e2e-jobben
**Fil:** `.github/workflows/deploy.yml`

E2E-jobben har allerede synkroniserte data — legg til `npx astro build` + artifact-upload etter testene. Fjern den separate `build`-jobben. Deploy venter på `unit-tests` + `e2e-and-build`.

**Forventet besparelse:** 15-20s (eliminerer hel runner-oppstart + npm ci)

### 3. Øk Playwright workers og reduser retries
**Fil:** `playwright.config.ts`

- `workers`: 2 → 4 (ubuntu-latest har 2 vCPU, men testene er I/O-bundet)
- `retries`: 2 → 1 (raskere feilrapportering, 1 retry er fortsatt safety net)

**Forventet besparelse:** 30-40s på testkjøring

## Forventet resultat

| | Nå | Etter |
|---|---|---|
| E2E + build | ~195s + ~27s = ~222s | ~130-150s |
| Total pipeline | ~4 min | ~2:30-3:00 min |
| Besparelse | — | ~25-35% |

## Filer som endres

1. `.github/workflows/deploy.yml` — Omstrukturerer jobs, Docker-container, fjerner build-jobb
2. `playwright.config.ts` — workers 2→4, retries 2→1

## Verifisering

1. Push til `review/**`-branch → auto-PR → sjekk at CI passerer
2. Sammenlign faktiske jobb-tider med nåværende baseline
3. Verifiser at alle 3 browser-prosjekter fortsatt kjører
4. Verifiser at deploy-artifact inneholder korrekt `dist/`

## Vurdert og forkastet

- **Sharding**: For lite test-suite (117 tester) — overhead > besparelse
- **Delt npm ci**: artifact upload/download (269 MB) tar lengre enn npm ci (6s)
- **E2E-test-konsolidering**: Utsatt til egen oppgave (se backlog)
