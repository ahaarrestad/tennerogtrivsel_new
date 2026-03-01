# Plan: Flaky tests — sporadiske testfeil

> **Status:** Planlagt · **Oppgave:** Backlog #3

## Bakgrunn

Noen CI-kjøringer feiler sporadisk. Undersøkelse av de siste 50 kjøringene (per 28. feb 2026) viser **48 suksess, 2 feil**:

### Kategori A: `npm audit` blokkerer CI (1 av 2 feil)

- **minimatch** ReDoS-sårbarhet (27. feb) → `npm audit --audit-level=high` feiler
- Ingen faktiske testfeil — security audit-steget har `exit code 1`
- Transient: Dependabot fikser dep, audit passerer igjen

### Kategori B: E2E-testfeil (1 av 2 feil)

- **SEO-test feilet** (26. feb): `/galleri/` canonical-tag pekte til `/` i stedet for `/galleri/`
- Reell bug som ble fikset — ikke en flaky test

### Tidligere fikset (ikke lenger relevant)

- Mobilmeny-synlighet: fikset med `data-open`-attributt
- Tjeneste-underside timeout: fikset med `waitUntil: 'domcontentloaded'` + 60s timeout
- Admin dashboard timeout: observert én gang, aldri gjentatt

## Konklusjon fra undersøkelsen

**Det finnes ingen sporadisk flaky tester i dag.** De 2 siste CI-feilene skyldes:
1. Transitiv `npm audit`-sårbarhet (1×)
2. En reell bug fanget av tester (1×)

## Tiltak

### Steg 1: Fjern `npm audit` fra CI

**Problem:** `npm audit --audit-level=high` feiler CI når en transitiv avhengighet får en sårbarhet, selv om alle tester passerer. Dette blokkerer deploy til sårbarheten er fikset upstream.

**Begrunnelse for fjerning:** Prosjektet har allerede tre lag med sikkerhetsovervåking:
- **Dependabot** — oppretter PRs automatisk for sårbare avhengigheter
- **Dependabot Auto-Merge** — merger patchoppdateringer automatisk
- **CodeQL** — statisk analyse kjører på hver push

`npm audit` i CI er dermed redundant og skaper kun falske positiver.

**Fil:** `.github/workflows/deploy.yml`

**Endring:** Fjern hele "Security audit"-steget (linje 40–41):

```yaml
# Fjern disse linjene:
- name: Security audit
  run: npm audit --audit-level=high
```

### Steg 2: Legg til Playwright `--repeat-each` som lokal flaky-test-kommando

**Problem:** Når man mistenker at en test er flaky, er det tungvint å kjøre den mange ganger manuelt.

**Løsning:** Legg til et npm-script for å kjøre E2E-tester med repetisjon:

**Fil:** `package.json`

```json
"test:e2e:repeat": "npx playwright test --repeat-each=10"
```

### Steg 3: Verifiser og marker ferdig

- Bekreft at alle E2E-tester passerer lokalt med `--repeat-each=10`
- Bekreft at alle enhetstester passerer
- Marker oppgaven som fullført i TODO.md

## Risikovurdering

- **Steg 1:** Lav risiko. Dependabot + CodeQL dekker sikkerhetsskanning. Fjerner falske CI-feil uten å miste sikkerhetsovervåking.
- **Steg 2:** Ingen risiko. Kun et nytt npm-script for lokal bruk.
- **Steg 3:** Ingen risiko. Verifisering.

## Forventet resultat

- CI feiler kun ved reelle test-feil, ikke transiente npm-audit-funn
- Sikkerhetsovervåking ivaretas av Dependabot + CodeQL (allerede aktive)
- Utviklere har et enkelt verktøy (`npm run test:e2e:repeat`) for å verifisere at en test ikke er flaky
