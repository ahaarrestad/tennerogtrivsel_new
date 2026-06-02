# Plan: Varsling ved supply chain-angrep

**Dato:** 2026-06-02
**Oppgave:** Backlog — Varsling ved supply chain-angrep

## Bakgrunn

Prosjektet har allerede:
- `dependabot.yml` konfigurert for npm + github-actions + lambda (ukentlig, security-updates gruppert)
- CI kjører `npm audit signatures` + `npm audit --audit-level=critical` ved hver push/PR

**Gapet:** Audit kjører kun ved push/PR. En ny CVE for en pakke som allerede er installert oppdages ikke før neste push. Dependabot alerts og automated security fixes er heller ikke verifisert aktivert.

## Mål

- Tette gapet mellom «audit ved push» og «audit kontinuerlig»
- Verifisere og aktivere Dependabot alerts/auto-fix via GitHub CLI
- Legge til scheduled workflow som varsler ukentlig selv uten kodeendringer
- Sette opp osv-scanner som læringsformål (gratis, Google-vedlikeholdt)
- Dokumentere hele oppsettet i `docs/architecture/sikkerhet.md`

## Ikke i scope

- Betalte tjenester (Snyk Pro, Socket.dev Pro)
- Endringer i produksjonskode
- Slack/webhook-varsling — GitHub e-post holder

## Steg

### Steg 1: Verifiser og aktiver Dependabot via gh CLI

Fil som opprettes/endres: ingen (API-kall, idempotente)

```bash
# Sjekk status (204 = aktivert, ikke-null exit = ikke aktivert)
gh api --include repos/ahaarrestad/tennerogtrivsel_new/vulnerability-alerts
gh api --include repos/ahaarrestad/tennerogtrivsel_new/automated-security-fixes

# Aktiver (begge idempotente — trygt å kjøre selv om allerede aktivert)
gh api --method PUT repos/ahaarrestad/tennerogtrivsel_new/vulnerability-alerts
gh api --method PUT repos/ahaarrestad/tennerogtrivsel_new/automated-security-fixes
```

`--include` viser HTTP-statuslinjen så man ser tydelig om det er 204 (aktivert) eller 404 (ikke aktivert). Disse kalles én gang manuelt og dokumenteres som «aktivert» i sikkerhet.md.

### Steg 2: Scheduled audit-workflow

Fil: `.github/workflows/scheduled-audit.yml` (ny)

Kjøres ukentlig (mandag morgen). Innhold:
- `npm audit --audit-level=high` på main-repo
- `npm audit --audit-level=high` i `lambda/kontakt-form-handler`
- Feiler workflow ved funn → GitHub sender e-post til repo-eier automatisk

**Merk:** `--audit-level=high` er bevisst strengere enn `--audit-level=critical` i deploy.yml. Scheduled-workflow er et tidlig varslingssystem mens deploy.yml er den harde gaten. Juster ned til `--audit-level=critical` ved for mye støy fra dev-avhengigheter.

### Steg 3: osv-scanner i scheduled workflow

Legges inn i samme `scheduled-audit.yml` som Steg 2, som eget job.

Bruker offisielt reusable workflow fra `google/osv-scanner-action` — den direkte action-filen (`action.yml`) har ikke `runs:`-seksjon og skal ikke brukes direkte.

```yaml
jobs:
  osv-scan:
    uses: google/osv-scanner-action/.github/workflows/osv-scanner-reusable.yml@9a498708959aeaef5ef730655706c5a1df1edbc2 # v2.3.8
    permissions:
      security-events: write
      contents: read
      actions: read
    with:
      scan-args: |-
        -r
        ./
```

`-r ./` scanner rekursivt og fanger begge `package-lock.json`-filer (root og `lambda/kontakt-form-handler`) automatisk — ingen separat steg for lambda nødvendig. SARIF-resultater lastes opp til GitHub Security-fanen automatisk.

- Sammenligner mot OSV-databasen (bredere enn npm advisory)
- Feiler ved funn (standard behavior — ingen `--fail-on`-flag finnes i CLI)
- Gratis og open source
- Læringsformål: se hva OSV fanger vs. `npm audit`

### Steg 4: Dokumentasjon

Fil: `docs/architecture/sikkerhet.md` — legg til nytt avsnitt «Supply chain varsling» som beskriver:
- Hva Dependabot dekker
- Hva scheduled-audit.yml gjør, og forskjellen fra deploy.yml
- Hva osv-scanner gjør og hvorfor det er inkludert
- Hva som bevisst er utelatt (Snyk Pro, Socket.dev) og hvorfor

## Testbehov

- Verifiser at `scheduled-audit.yml` passerer på en clean branch (manuell dispatch via `workflow_dispatch`)
- Ingen unit-tester (konfigurasjon og dokumentasjon)

## Kjente risiki

- `npm audit --audit-level=high` kan gi støy ved moderate sårbarheter i dev-avhengigheter — se Steg 2 for justeringsstrategi
- osv-scanner er nytt verktøy: første kjøring kan avdekke funn som allerede er håndtert av `npm audit`; disse må vurderes manuelt
- Workflow-jobben for osv-scanner krever `permissions: security-events: write` for SARIF-opplasting — mangler dette feiler opplastingen stille

## Definition of done

- `gh api`-kallene er kjørt og Dependabot alerts/auto-fix er bekreftet aktivert (HTTP 204)
- `scheduled-audit.yml` kjører clean på main via manuell dispatch
- `docs/architecture/sikkerhet.md` er oppdatert med supply chain-avsnittet
