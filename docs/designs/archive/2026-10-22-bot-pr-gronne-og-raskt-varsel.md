# Bot-PR-er blir grønne selv, og røde varsles straks

**Dato:** 2026-10-22 · **TODO:** «Audit-PR-er skal bli grønne selv, og fastlåste bot-PR-er skal varsles raskere»

## Problem

Målet er at siden virker og er trygg uten at eieren må følge med. Hendelsen 2026-10-21 viste tre svakheter:

1. **Bot-PR-er kan ikke bli grønne.** Auto-fiks-PR #511 fra `scheduled-audit.yml` bumpet vite. Ny rolldown endret galleriets lightbox-script og dermed CSP-hashen. PR-en endret bare lockfila, så steget «Verify CSP hashes are in sync» i `deploy.yml` stoppet den for godt. Det samme rammer alle Dependabot-PR-er som bumper vite, rolldown eller Astro.
2. **Varselet kom 6,5 timer for sent.** `stuck-pr-watch.yml` regner en PR som fastlåst først etter 6 timer med auto-merge på, og kjører bare hver 3. time. En rød bot-PR gir ingen e-post.
3. **Deploy kan blokkere inline-scripts et par minutter.** Prod-deploy laster opp ny HTML (S3-synk og invalidering) før CloudFront-CSP-en får de nye hashene. Endres en inline-script-hash, blokkerer CSP-en scriptet for besøkende i mellomtiden.

## Funn som former løsningen

CSP-hash-porten var aldri et sikkerhetsforsvar. Den sjekker bare at den innsjekkede fila stemmer med bygget, og alle steder som påvirker prod regenererer hashene:

- **Prod-deploy** kjører `generate-csp-hashes.mjs` på `dist` før `update-cloudfront-csp.mjs`.
- **`dev:secure`** og **`dev:secure:fixtures`** kjører `build:ci && generate-csp-hashes` før `astro dev`.

Den innsjekkede fila leses ellers bare på to steder:

- **Middleware i vanlig `npm run dev`.** En utdatert fil kan blokkere `is:inline`-scripts lokalt. Løsningen er å kjøre `npm run generate-csp-hashes` etter et bygg.
- **`scripts/setup-response-headers-policy.mjs`,** som kjøres manuelt og sjelden. Det kan skrive utdaterte hasher til prod-policyen. Neste deploy retter det, men skriptet skal advare.

Den reelle tillitsgrensen for CSP-en er alt som skriver til `dist` under bygget: avhengigheter og Drive-innhold. Deploy hasher og tillater alle inline-scripts i `dist`. CSP-en beskytter mot injeksjon i nettleseren, ikke i bygget. Kontrollene mot ondsinnede avhengigheter er audit, cooldown, signaturverifisering i `fetch-metadata` og at major-oppdateringer ikke auto-merges. Porten var aldri en av dem.

## Krav og akseptansekriterier

### Tiltak 1 — Fjern CSP-hash-porten

- Steget «Verify CSP hashes are in sync» og `safe.directory`-linja i `deploy.yml` er fjernet.
- En PR som bare endrer lockfila, men gir andre inline-script-hasher, får grønn `ci-ok`.
- Etter merge og deploy har prod CSP med hashene fra den nye builden.
- Den innsjekkede `csp-hashes.json` beholdes, og den er bare et lokalt dev-hjelpemiddel. Viser `git status` den som endret etter `dev:secure`, er endringen korrekt og skal committes sammen med neste vanlige endring. Det står i `sikkerhet.md`.
- `setup-response-headers-policy.mjs` skriver en tydelig advarsel om at hashene må regenereres før kjøring (`npm run build:ci && npm run generate-csp-hashes`). Det samme står i `aws-infrastruktur.md`.
- `sikkerhet.md` beskriver tillitsgrensen fra avsnittet «Funn som former løsningen».

### Tiltak 2 — Varsle straks når en auto-merge-PR blir rød

- `stuck-pr-watch.yml` trigges i tillegg av `workflow_run` når «CI/CD» er ferdig for en `pull_request`.
- En PR regnes som fastlåst hvis den har auto-merge på og **enten** sjekken `ci-ok` er ferdig med en annen konklusjon enn `SUCCESS`, `NEUTRAL` eller `SKIPPED`, **eller** auto-merge har vært på i minst `min_age_hours` (uendret, standard 6).
  - Den første regelen fanger `FAILURE`, `TIMED_OUT`, `CANCELLED`, `STARTUP_FAILURE` og `ACTION_REQUIRED`.
  - Den siste regelen fanger fortsatt `BEHIND`, CodeQL og lignende.
  - En `ci-ok` som kjører (konklusjon tom) regnes ikke som rød. `statusCheckRollup` viser bare siste kjøring per sjekknavn, så en grønn ny kjøring fjerner den røde.
- Funn gir samme `pr-stuck`-issue som i dag, med @ahaarrestad i teksten og dedupe mot åpne issues. Teksten oppgir årsaken per PR: «`ci-ok`: <konklusjon>» eller tiden auto-merge har vært på.
- Issuen lukkes automatisk når en senere kjøring ikke finner noe. Det kan være cron eller `workflow_run` etter en grønn CI-kjøring.
- Workflowen sjekker aldri ut eller kjører kode fra PR-en. Den laster ikke ned artefakter, og bruker ikke `head_branch` eller `display_title` i `run:`. Den bruker bare `gh` og `jq` mot API-et med `GITHUB_TOKEN`.
- **Akseptanse:** en rød `ci-ok` på en auto-merge-PR gir issue innen få minutter etter at CI er ferdig, ikke etter 6–9 timer.

### Tiltak 3 — Ny CSP med både gamle og nye hasher under deploy

- `update-cloudfront-csp.mjs` får to nye moduser:
  - `--merge` leser `script-src`-hashene i den gjeldende policyen, slår dem sammen med hashene fra builden og skriver tilbake. Endrer ikke sammenslåingen noe, gjøres ingen oppdatering.
  - `--wait-for <url>` venter til den nye CSP-en er synlig i prod.
- Fra den gjeldende policyen tas bare tokens på formen `'sha256-<44 tegn base64>'` fra det første `script-src`-direktivet med. Alt annet ignoreres.
- Blir CSP-strengen lengre enn CloudFronts grense (1783 tegn), feiler skriptet med en tydelig melding før noe er lastet opp. Unntak (lagt til etter review): går bare fletting med gamle hasher over grensen, dropper fase 1 de gamle med en advarsel, så oppsamlede hasher ikke låser alle senere deploys.
- `deploy.yml`, rekkefølgen i deploy-jobben:
  1. Generate CSP hashes
  2. **Flett** (`--merge`)
  3. **Vent på ny CSP** (`--wait-for https://www.tennerogtrivsel.no/`)
  4. S3-synk
  5. Invalidering av `/*`
  6. **Vent til invalideringen er ferdig**
  7. IndexNow
  8. Sluttoppdatering, bare nye hasher
  9. Tiles-invalidering
- Ventingen i punkt 3 varer i opptil 5 minutter, med 10 sekunders timeout per forespørsel. Ved timeout skrives `::warning::`, og deploy fortsetter. Mangler CSP-headeren helt i svaret, skrives `::error::`, men deploy fortsetter.
- Ventingen i punkt 6 bruker `aws cloudfront wait invalidation-completed`. Feiler den, skrives `::warning::`, og sluttoppdateringen kjører likevel.
- Deploy-jobben får `concurrency: { group: deploy-prod, cancel-in-progress: false }`, så to deploys aldri fletter steg inn i hverandre. Den får også `timeout-minutes: 30`.
- **Akseptanse:** ved en deploy som endrer hasher, har CloudFront både gamle og nye hasher fra før første HTML-fil lastes opp, til invalideringen er ferdig. Etter deploy har policyen bare de nye hashene pluss GAPI.

## Avgrensninger (ikke med)

- Auto-fiks-jobben regenererer eller committer ikke hasher. Det trengs ikke når porten er borte.
- Ingen push til Dependabot-branchene. Det ville stoppe Dependabots rebase og auto-merge (jf. #472).
- Rød CI på bot-PR-er **uten** auto-merge (for eksempel Dependabot-major) er ikke med. `dependabot-auto-merge.yml` flagger dem allerede for manuell review.
- Er en `pr-stuck`-issue allerede åpen, legges en ny fastlåst PR ikke til i den. Eieren følger da allerede med.
- Ingen automatisk rerun av flaky CI før varsel. En flaky E2E gir én e-post, og det er akseptert.
- Lukker en cron-kjøring issuen mens noen kjører CI på nytt, og den nye kjøringen også blir rød, kommer det en ny issue. Det er akseptert.
- Test-distribusjonen (utkommentert i `deploy.yml`) deler policy med prod og får samme CSP. HTML-en der er ikke oppdatert, og det er uendret fra i dag.
- Varsling utenfor GitHub-issues (push, Slack) er ikke med.
- Ingen informativ hash-diff i PR-ens step summary. Den har ingen mottaker.

## Designvalg

- **Fjerne porten i stedet for å committe hasher automatisk.** Ett lite inngrep løser både audit-fiksen og Dependabot. Auto-commit ville bare løst audit-fiksen, og ville trengt PAT-push til Dependabot-branchene for resten.
- **Beholde fila innsjekket i stedet for å gitignore den.** Typesjekk, build og vanlig `astro dev` importerer den. Er den gitignorert, trenger en fersk klon et ekstra genereringssteg.
- **Varsel via `workflow_run` i den eksisterende vakta.** Det gjenbruker issue-, dedupe- og auto-lukk-logikken som helsesjekken allerede leser. `workflow_run` kjører med workflow-fila fra default-branchen. Ifølge GitHub-dokumentasjonen har den skrivetoken også når det var Dependabot som utløste CI, og den eksplisitte `permissions: issues: write` gjelder. Det verifiseres empirisk etter merge.
- **To faser rundt S3-synken.** Med bare nye hasher før synken blokkeres gammel HTML i cachen. Med bare nye hasher etter synken blokkeres ny HTML. Unionen fungerer i begge retninger og gjelder bare mens deploy-jobben kjører. Sluttoppdateringen venter til invalideringen er ferdig, så gammel HTML er borte fra edge når de gamle hashene fjernes.
- **Vente på propagering med en reell sjekk.** Et policy-bytte propagerer asynkront. En HEAD-forespørsel mot prod med hash-sjekk er billig og gjør vinduet målbart. Timeout gir advarsel i stedet for feil, slik at en treg propagering aldri stopper en deploy.

## Sikkerhet

Endringen berører CSP i prod og en workflow med `issues: write`. Den får derfor en ekstra, uavhengig sikkerhetsreview av diffen i tillegg til den vanlige reviewen (eierens ønske 2026-10-22). Planen ble sikkerhetsreviewet 2026-10-22. Funnene om concurrency, timeouts, lengdegrense og konklusjoner er tatt inn ovenfor.

Reviewen av diffen ser spesielt på:

- om flette-modus kan slippe inn andre tokens enn hasher i `script-src`
- hva som skjer om deploy feiler mellom flettingen og sluttoppdateringen (gamle hasher blir liggende til neste vellykkede deploy, og det er ikke et nytt angrepspunkt)
- injeksjon via PR-tittel i issue-teksten
- at deploy-jobben fortsatt bare kjører Node-skript uten npm-avhengigheter, slik at ingen npm-kode får AWS-nøklene
