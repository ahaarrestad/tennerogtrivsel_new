# Plan: Raskere bygg ved Google Drive-oppdatering

> **Status: FULLFØRT**

## Bakgrunn

Når innhold oppdateres i Google Drive, trigges `repository_dispatch: google_drive_update` i CI.
Denne triggeren bygger alltid `main`-branchen, der koden allerede er testet og godkjent.
Likevel kjøres full test-suite (unit + e2e), som legger til ~3–4 min unødvendig ventetid.

## Mål

Kutte byggetid for innholdsoppdateringer fra ~4 min til ~1 min ved å hoppe over tester
som kun validerer kode (ikke innhold).

## Tiltak

### 1. Hoppe over testjobber ved `repository_dispatch`

Legge til `if`-betingelse på begge testjobber:

```yaml
unit-tests:
  if: github.event_name != 'repository_dispatch'

e2e-tests:
  if: github.event_name != 'repository_dispatch'
```

### 2. Oppdatere `build`-jobbens betingelse

Når testjobbene hoppes over (status `skipped`), vil `build` også hoppes over
med standard `needs`-oppførsel. Løsning — bruk `always()` med eksplisitt sjekk:

```yaml
build:
  needs: [unit-tests, e2e-tests]
  if: |
    always() &&
    (needs.unit-tests.result == 'success' || needs.unit-tests.result == 'skipped') &&
    (needs.e2e-tests.result == 'success' || needs.e2e-tests.result == 'skipped')
```

Dette sikrer:
- **repository_dispatch:** Tester hoppes over (skipped) → build kjører
- **push/PR:** Tester må bestå (success) → build kjører
- **Feilet test:** result == 'failure' → build blokkeres (riktig oppførsel)

### 3. Ingen endring i build-steget

`npm run build` inkluderer allerede `sync-data.js` som henter fersk data fra
Google Sheets/Drive. Ingen ekstra endringer nødvendig.

## Forventet resultat

| Trigger              | Før   | Etter  |
|----------------------|-------|--------|
| push/PR              | ~4 min | ~4 min (uendret) |
| repository_dispatch  | ~4 min | ~1 min |

## Risiko

Lav. Koden på `main` er allerede testet via push/PR-flyten. Innholdsendringer
(tekst, bilder) kan ikke introdusere kodefeil.
