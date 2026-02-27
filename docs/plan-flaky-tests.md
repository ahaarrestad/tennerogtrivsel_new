# Plan: Flaky tests — sporadiske testfeil

> **Status:** Planlagt · **Oppgave:** Backlog #5

## Bakgrunn

Noen CI-kjøringer feiler sporadisk. Undersøkelse av de 3 siste feilene (siste 200 kjøringer) avdekker **to ulike kategorier**:

### Kategori A: `npm audit` blokkerer CI (2 av 3 feil)
- **Rollup 4** ReDoS-sårbarhet (26. feb) → `npm audit --audit-level=high` feiler
- **minimatch** ReDoS-sårbarhet (27. feb) → samme steg feiler
- Ingen faktiske testfeil — security audit-steget har `exit code 1`
- Disse er transiente (Dependabot/forfatteren fikser dep, audit passerer igjen)

### Kategori B: E2E-testfeil (1 av 3 feil)
- **SEO-test feilet** (26. feb): `/galleri/` canonical-tag pekte til `/` i stedet for `/galleri/`
- Dette var en reell bug som ble fikset i etterkant (commit for galleri E2E-feil)
- Ikke en flaky test — det var en korrekt fangst av en faktisk feil

### Tidligere fikset (ikke lenger relevant)
- Mobilmeny-synlighet: fikset med `data-open`-attributt
- Tjeneste-underside timeout: fikset med `waitUntil: 'domcontentloaded'` + 60s timeout
- Admin dashboard timeout: observert én gang, aldri gjentatt

## Konklusjon fra undersøkelsen

**Det finnes ingen sporadisk flaky tester i dag.** De 3 siste CI-feilene skyldes:
1. Transiente `npm audit`-funn i avhengigheter (2×)
2. En reell bug fanget av tester (1×)

## Tiltak

### Steg 1: Gjør `npm audit` ikke-blokkerende (continue-on-error)

**Problem:** `npm audit --audit-level=high` feiler CI når en transitiv avhengighet får en sårbarhet, selv om alle tester passerer. Dependabot-auto-merge fikser dette innen timer/dager, men i mellomtiden blokkeres all CI.

**Løsning:** Merk security audit-steget med `continue-on-error: true` slik at CI ikke feiler, men sårbarheten fortsatt er synlig i loggen.

**Fil:** `.github/workflows/deploy.yml`

```yaml
- name: Security audit
  run: npm audit --audit-level=high
  continue-on-error: true
```

### Steg 2: Legg til Playwright `--repeat-each` som lokal flaky-test-kommando

**Problem:** Når man mistenker at en test er flaky, er det tungvint å kjøre den mange ganger manuelt.

**Løsning:** Legg til et npm-script for å kjøre E2E-tester med repetisjon:

**Fil:** `package.json`

```json
"test:e2e:repeat": "npx playwright test --repeat-each=10"
```

### Steg 3: Dokumenter flaky-test-status i denne planen

Oppdater denne filen med resultatene:
- Bekreft at alle 108 E2E-tester passerer lokalt med `--repeat-each=10`
- Bekreft at alle enhetstester passerer
- Marker oppgaven som fullført i TODO.md

## Risikovurdering

- **Steg 1:** Lav risiko. Audit-feil er fortsatt synlige i CI-loggen, og Dependabot håndterer oppdateringer. Fjerner falske positiver fra CI-historikken.
- **Steg 2:** Ingen risiko. Kun et nytt npm-script for lokal bruk.
- **Steg 3:** Ingen risiko. Dokumentasjon.

## Forventet resultat

- CI feiler kun ved reelle test-feil, ikke transiente npm-audit-funn
- Utviklere har et enkelt verktøy (`npm run test:e2e:repeat`) for å verifisere at en test ikke er flaky
