# TODO – Tenner og Trivsel

> Denne filen holdes oppdatert underveis. Kryss av oppgaver med `[x]` når de er ferdige.

### Arbeidsflyt
- **Før vi starter på en oppgave:** Lag alltid en plan først. Still avklarende spørsmål hvis noe er uklart.
- Planen skrives som notater under oppgaven før implementering begynner.
- Flytt oppgaven til «Pågående» når planen er godkjent og arbeidet starter.
- **Lever i små, iterative forbedringer** — minst én commit per oppgave. Store oppgaver brytes ned i deloppgaver som hver committes for seg.
- **Planer lagres under `/docs`** og oppgaven skal alltid ha en lenke til planen: `([plan](docs/plan-navn.md))`.
- Flytt oppgaven til «Fullført» når den er ferdig.
- **Arkivering:** Når en oppgave er fullført, flytt oppgaven fra TODO.md til [TODO-archive.md](TODO-archive.md) og planfilen fra `docs/` til `docs/archive/`.

## Pågående

- [ ] **Cache-Control og grønn hosting — gjør siden nesten «karbon-negativ»** ([plan](docs/plan-cache-control-gronn-hosting.md))
  - ~~Steg 1–3 for TEST: Cache-Control, invalidering, verifisering~~ ✓
  - ~~Steg 4 for TEST: Regionflytt til eu-north-1~~ ✓ (manuelt)
  - Steg 1–4 for PROD: gjenstår

## Backlog

- [ ] **Sett opp CloudFront på produksjon (www.tennerogtrivsel.no)** ([plan](docs/plan-cloudfront-prod.md))
  - Samme oppsett som test-siden, tilpasset produksjonsdomenet
  - SSL-sertifikat (ACM us-east-1), CloudFront-distribusjon med OAC, cache-policy, DNS-pekere
  - Gjenbruk Response Headers Policy og CloudFront Function fra test
  - Oppdater deploy-workflow for prod-bucket
  - 7 steg: ACM-sertifikat, CF-distribusjon, headere, S3-policy, DNS, deploy-workflow, verifisering

- [ ] **Sjekk hvordan sidene fungerer på iPhone** ([plan](docs/plan-sjekk-iphone.md))
  - Legg til Mobile Safari (iPhone 14) i Playwright-config
  - Kjør testsuite, fiks Safari-spesifikke feil
  - Viewport/safe-area forbedringer, dialog-fallback, sticky-verifisering
  - 6 steg: Playwright-config, testfeil-fiks, viewport, dialog, sticky, kvalitetssjekk

- [ ] **Flere domener på samme CloudFront (hybrid)** ([plan](docs/plan-multi-domene-cloudfront.md))
  - 3 www-domener direkte på CloudFront (ingen redirect), 3 apex redirecter til sin egen www-variant
  - Ett ACM-sertifikat med alle 6 domener, DNS hos eksisterende registrar
  - 9 steg: ACM-sertifikat, DNS-validering, CloudFront CNAMEs, www DNS-records, apex-redirect, Google OAuth origins, Maps API referrere, fjern S3-buckets, verifisering
  - Kostnad: $0/mnd ekstra

- [ ] **Lag design guide for admin-grensesnittet**
  - Dokumenter hvordan admin-panelet ser ut i dag: fargetokens, klasser, mønstre og komponenter
  - Tilsvarende `docs/design-guide.md` for den offentlige siden, men for admin
  - Dekk: admin CSS-variabler (`--admin-*`), CSS-klasser (`admin-card`, `admin-icon-btn`, etc.), status-klasser, layout-mønstre, skjemafelter, save bar, toast/dialogs

- [ ] **Flaky tests — sporadiske testfeil** ([plan](docs/plan-flaky-tests.md))
  - Undersøkt: ingen reelle flaky tester funnet — 3 siste CI-feil skyldes npm audit (2×) og en reell bug (1×)
  - Steg 1: Gjør `npm audit` ikke-blokkerende (`continue-on-error: true`)
  - Steg 2: Legg til `test:e2e:repeat`-script for lokal flaky-verifisering
  - Steg 3: Verifiser med `--repeat-each=10` og dokumenter

- [ ] **Dev-Test-Prod miljø oppsett** ([plan](docs/plan-dev-test-prod.md))
    - Deployment-kontroll: push til main → test, manuell dispatch → prod, Google Drive-oppdatering → prod
    - Legg til `workflow_dispatch` input i deploy.yml for å velge miljø (test/prod/both)
    - `repository_dispatch` alltid til prod, push til main alltid til test
    - Samme Google Sheet/Drive for alle miljøer — ingen dataduplisering

## Fullført

Se [TODO-archive.md](TODO-archive.md) for alle fullførte oppgaver.

