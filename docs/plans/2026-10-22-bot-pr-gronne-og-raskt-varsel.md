# Plan: bot-PR-er blir grønne selv, og røde varsles straks

**Spec:** [docs/designs/2026-10-22-bot-pr-gronne-og-raskt-varsel.md](../designs/2026-10-22-bot-pr-gronne-og-raskt-varsel.md)

## Mål og avgrensninger

Planen har tre tiltak:

1. Fjern CSP-hash-porten.
2. Varsle straks når `ci-ok` ikke er grønn på en auto-merge-PR.
3. Innfør to faser for CSP under deploy, og la deploy-jobbene stå i kø.

**Ikke med:** auto-commit av hasher, push til Dependabot-branchene, varsel for PR-er uten auto-merge, automatisk rerun og nye varslingskanaler. Se specen.

Arbeidet utføres inline i én worktree, i rekkefølgen steg 0 → 1 → 2 → 3 → 4 → 5.

## Steg

### Steg 0 — IAM: `cloudfront:GetInvalidation` til CI-brukeren

CI-brukeren `githubTestDeploy` har inline-policyen `CICDDeploy`. Statementet `CloudFrontInvalidation` tillater i dag bare `cloudfront:CreateInvalidation` på `arn:aws:cloudfront::382286755083:distribution/*`. `aws cloudfront wait invalidation-completed` trenger `cloudfront:GetInvalidation`.

- Hent policyen med `aws iam get-user-policy`. Legg `cloudfront:GetInvalidation` inn i samme statement, med samme Resource. Skriv policyen tilbake med `aws iam put-user-policy`.
- Verifiser med `aws iam simulate-principal-policy` for `cloudfront:GetInvalidation` på prod-distribusjonen. Forventet svar er `allowed`.
- Oppdater IAM-listen i `docs/architecture/sikkerhet.md` under «Forutsetninger» og i `aws-infrastruktur.md`, hvis policyen er beskrevet der.
- Dette er en AWS-endring jeg gjør med CLI før merge, jf. memory. Den gjelder bare én bruker og er ufarlig, siden det er en ren lese-tilgang.

### Steg 1 — `update-cloudfront-csp.mjs`: eksporterte funksjoner, flette- og vente-modus

**Filer:**
- `scripts/update-cloudfront-csp.mjs`
- `scripts/setup-response-headers-policy.mjs`, der `GAPI_RUNTIME_HASHES` skal eksporteres
- `scripts/__tests__/update-cloudfront-csp.test.mjs` (ny)

Bygg om etter mønsteret i `setup-response-headers-policy.mjs`. Det betyr rene, eksporterte funksjoner. CLI-delen legges under `/* v8 ignore start */` og `if (import.meta.url === \`file://${process.argv[1]}\`)`, med `mkdtempSync` og `finally` for tempfila i stedet for den faste stien `/tmp/cfn-policy-update.json`.

```js
export const MAX_CSP_LENGTH = 1783; // CloudFront-grense for ContentSecurityPolicy-feltet
const HASH_TOKEN = /^'(sha256-[A-Za-z0-9+/]{43}=)'$/;

// sha256-hashene fra det FØRSTE script-src-direktivet (slik nettleseren gjør).
// Direktivnavn sammenlignes uten hensyn til store/små bokstaver. Bare tokens som er en
// hash i anførselstegn tas med, alt annet ignoreres.
export function extractScriptHashes(csp) { … }        // → string[]

// Union, sortert, uten duplikater og uten GAPI (buildScriptSrc legger den til selv).
export function mergeHashes(current, next) { … }      // → string[]

// → { csp, hashes, stale } eller null (merge og ingenting nytt).
// stale = hasher som bare er med fordi gammel HTML trenger dem (logges).
// Kaster FatalError hvis csp.length > MAX_CSP_LENGTH.
export function planCspUpdate({ currentCsp, buildHashes, merge }) { … }

// Parser CSP-en til tokens og sjekker at alle hashene finnes i script-src.
export function cspHasAllHashes(csp, hashes) { … }    // → boolean

// Poller url med HEAD. Hvert forsøk har AbortSignal.timeout(requestTimeoutMs).
// Returnerer { ok: true } | { ok: false, reason: 'timeout' | 'missing-header' }.
// Fetch-feil logges og regnes som et mislykket forsøk.
export async function waitForCsp({ fetchFn, url, hashes, intervalMs, timeoutMs, requestTimeoutMs, sleep, now }) { … }
```

CLI-delen har tre moduser:

- **Ingen flagg (sluttoppdatering):** som i dag. Den skriver ut antall hasher før og etter.
- **`--merge`:** henter policyen og kjører `planCspUpdate({ merge: true })`.
  - Ved `null` skriver den «CSP har allerede alle nye hasher — ingen oppdatering» og avslutter med `exit 0`.
  - Ellers oppdaterer den policyen og skriver ut antallet gamle (`stale`) og nye hasher.
- **`--wait-for <url>`:** leser `csp-hashes.json` (forutsetter at generate har kjørt) og kaller `waitForCsp` uten GAPI. Den poller hvert 15. sekund i opptil 5 minutter, med 10 sekunders timeout per forespørsel.
  - Når CSP-en er på plass: `exit 0`.
  - Ved `timeout`: `::warning::` og `exit 0`.
  - Ved `missing-header` i siste forsøk: `::error::CSP-header mangler` og `exit 0`. Steget skal ikke stoppe deploy, men feilen skal være synlig.

`setup-response-headers-policy.mjs` får to endringer:
- `GAPI_RUNTIME_HASHES` eksporteres.
- CLI-delen skriver en advarsel om at `csp-hashes.json` må være regenerert (`npm run build:ci && npm run generate-csp-hashes`). Bare tekst, ingen logikkendring.

**Tester:** bruk `it.each` der det passer, og `vi.mock('node:child_process')` som i setup-testen.

- `extractScriptHashes`:
  - Henter hashene fra en ekte CSP bygd med `buildCspString(buildScriptSrc([...]))`.
  - Ignorerer `'self'`, URL-er, `'unsafe-inline'`, `'sha384-…'`, hasher uten anførselstegn, feil lengde, hasher med etterfølgende linjeskift og hasher i andre direktiver.
  - Tom streng og manglende `script-src` gir `[]`.
  - Ved to `script-src`-direktiver brukes det første.
  - `SCRIPT-SRC` med store bokstaver gjenkjennes.
- `mergeHashes`: union uten duplikater, sortert, med GAPI fjernet.
- `planCspUpdate`:
  - Sluttoppdatering gir nye hasher og GAPI.
  - Fletting gir gamle og nye hasher, og `stale` er riktig.
  - Fletting der alle nye hasher allerede er med gir `null`.
  - Tom build-liste gir `FatalError`.
  - For lang CSP gir `FatalError` med lengden i meldingen.
- `cspHasAllHashes`: gir sann og usann. Gir usann for `null` og tom header. Gir usann når en hash bare finnes i et annet direktiv.
- `waitForCsp` med falsk `fetchFn`, `sleep` og `now`:
  - Lykkes på første forsøk.
  - Lykkes etter to forsøk.
  - Timeout gir `{ ok: false, reason: 'timeout' }`.
  - Manglende header gir `missing-header`.
  - Fetch-feil og avbrutt forespørsel regnes som et forsøk, uten krasj.
  - `signal` sendes med.
- **Mål:** ≥ 80 % branch coverage på fila. CLI-blokka er ignorert.

### Steg 2 — `deploy.yml`: to-fase-CSP, concurrency og timeout

**Fil:** `.github/workflows/deploy.yml`, prod-delen av deploy-jobben.

Deploy-jobben får to nye innstillinger:

```yaml
    # Én deploy om gangen. Flettingen og sluttoppdateringen av CSP-en må ikke blandes
    # mellom to deploys (push og Drive-dispatch kan overlappe), ellers kan prod ende med
    # HTML fra den ene og hasher fra den andre.
    concurrency:
      group: deploy-prod
      cancel-in-progress: false
    timeout-minutes: 30
```

Mellom «Generate CSP hashes from build output» og «Deploy to S3 PROD-SE» legges to steg inn:

```yaml
      # Fase 1 av 2: CSP-en må tillate både gammel og ny HTML mens S3-synken og
      # invalideringen pågår. Ellers får besøkende ny HTML med gammel CSP i noen minutter,
      # og inline-scripts med nye hasher blokkeres. De gamle hashene som beholdes tilhører
      # scripts som var lovlige rett før. Er de nye hashene allerede med, gjør steget ingenting.
      - name: Pre-publish CloudFront CSP (gamle + nye hasher)
        run: node scripts/update-cloudfront-csp.mjs --merge
        env:
          CLOUDFRONT_POLICY_ID: ${{ secrets.CLOUDFRONT_CSP_POLICY_ID }}

      - name: Vent til ny CSP er ute på edge
        run: node scripts/update-cloudfront-csp.mjs --wait-for https://www.tennerogtrivsel.no/
```

«Invalidate CloudFront cache PROD» skal ta vare på ID-en og vente:

```yaml
        run: |
          ID=$(aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID_PROD }} \
            --paths "/*" --query Invalidation.Id --output text)
          echo "Invalidering $ID — venter til den er ferdig før CSP fase 2"
          aws cloudfront wait invalidation-completed \
            --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID_PROD }} --id "$ID" \
            || echo "::warning::Invalidering $ID ikke bekreftet ferdig — fase 2 kjører likevel"
```

Kommentaren på «Update CloudFront CSP hashes» blir: «Fase 2 av 2: fjerner hashene som bare gammel HTML trengte. Kjører etter at invalideringen er ferdig, så gammel HTML er ute av edge-cachen.»

### Steg 3 — Fjern CSP-hash-porten

**Filer:**
- `.github/workflows/deploy.yml` (e2e-tests-jobben)
- `scripts/generate-csp-hashes.mjs` (bare kommentaren)
- `docs/architecture/sikkerhet.md`
- `docs/architecture/aws-infrastruktur.md`

Endringer:

- **`deploy.yml`:** slett «Verify CSP hashes are in sync». `safe.directory`-linja brukes bare der (`f1c8389`), så den går med.
- **`generate-csp-hashes.mjs`:** sorteringskommentaren (l. 41–43) skal ikke lenger vise til porten. Sorteringen beholdes for stabile differ.
- **`sikkerhet.md`, «Automatisk CSP-oppdatering i CI»:**
  - Beskriv de to fasene og concurrency.
  - Forklar hvorfor den innsjekkede fila ikke trenger å være i sync, og at en endring etter `dev:secure` skal committes sammen med neste vanlige endring.
  - Beskriv tillitsgrensen (spec, «Funn»).
  - Legg `cloudfront:GetInvalidation` til IAM-listen.
  - Erstatt «Lokal oppdatering … Commit» med teksten over.
- **`aws-infrastruktur.md`:** ved kjøring av `setup-response-headers-policy.mjs`, regenerer hashene først.

### Steg 4 — `stuck-pr-watch.yml`: straksvarsel

**Filer:**
- `.github/workflows/stuck-pr-watch.yml`
- `.github/workflows/deploy.yml` (kommentar på `ci-ok`-jobben)

Ny trigger:

```yaml
  workflow_run:
    workflows: ['CI/CD']
    types: [completed]
```

- **Jobb-`if`:** `github.event_name != 'workflow_run' || github.event.workflow_run.event == 'pull_request'`.
- **«Finn»-steget:** `gh pr list … --json number,title,url,autoMergeRequest,mergeStateStatus,statusCheckRollup`, sendt videre til **`jq -r --arg grense "$GRENSE" -f filter.jq`**. Filteret ligger i en heredoc i steget. Da slipper vi apostrof-escaping i bash og interpolasjon av `$GRENSE` i jq-koden.
  ```jq
  .[] | select(.autoMergeRequest != null)
      | ([.statusCheckRollup[]? | select(.name == "ci-ok") | .conclusion // ""]
         | map(select(. != "" and . != "SUCCESS" and . != "NEUTRAL" and . != "SKIPPED")) | first) as $roed
      | select($roed != null or .autoMergeRequest.enabledAt <= $grense)
      | "- #\(.number) \(.url) — `\(.title | gsub("`"; "'"))` — "
        + (if $roed != null then "`ci-ok`: \($roed)"
           else "mergeStateStatus `\(.mergeStateStatus)`, auto-merge på siden \(.autoMergeRequest.enabledAt)" end)
  ```
- **Issue-teksten:** første linje blir «… fant PR-er med auto-merge som er røde eller ikke merget». Listen med vanlige årsaker får «`ci-ok` ikke grønn» øverst.
- **Toppkommentaren** i workflowen beskriver begge triggerne.
- **`concurrency: stuck-pr-watch`** og rettighetene blir som før. Ingen `actions/checkout`, ingen artefakter, og ingen `github.event.workflow_run.*` i `run:`.
- **`deploy.yml`, `ci-ok`-jobben:** legg til kommentaren «`stuck-pr-watch.yml` matcher på dette jobbnavnet — endres det, slutter straksvarselet å virke.»

### Steg 5 — TODO og helsesjekk

- **`TODO.md`:** flytt oppgaven til Pågående i fase 2, med lenker til spec og plan.
- **`.claude/skills/helsesjekk/SKILL.md`:** Stuck PR Watch kjører nå også etter hver PR-CI. Terskelen på 12 timer for en utdatert vakt gjelder fortsatt, fordi cron er gulvet.

## Testbehov og definition of done

- Enhetstestene fra steg 1 er grønne, og `update-cloudfront-csp.mjs` har ≥ 80 % branch coverage.
- `/quality-gate` er grønn: lint, unit, coverage, E2E, build og audit.
- `docker run --rm -v "$PWD:/repo:ro" -w /repo rhysd/actionlint:1.7.7 -no-color -oneline .github/workflows/deploy.yml .github/workflows/stuck-pr-watch.yml` gir ingen nye funn. Baseline er 7 info-funn fra shellcheck i `deploy.yml`: SC2086 på l. 195 og 507, og SC2016 ×5 på l. 208. Linjenumrene flytter seg.
- jq-filteret fra steg 4 er kjørt lokalt mot syntetisk JSON med seks PR-er:
  - rød `ci-ok`
  - `ci-ok` med `TIMED_OUT`
  - gammel og grønn
  - fersk og grønn
  - `ci-ok` som pågår
  - uten auto-merge
  
  Bare de tre første skal komme ut. Filteret er også kjørt mot ekte `gh pr list --state all`.
- **Review:** `review-loop`, pluss en **ekstra uavhengig sikkerhetsreview** av diffen (egen agent, bare diff og repo) med fokuspunktene fra specen.
- **Etter merge** gjør jeg dette selv:
  - `gh workflow run stuck-pr-watch.yml -f min_age_hours=6` for å se at cron- og dispatch-veien fortsatt virker.
  - Sjekke at **neste** PR-CI etter merge starter en `workflow_run`-kjøring som er grønn. `workflow_run` bruker fila fra main, så denne PR-en utløser den ikke selv.
  - Ved neste Dependabot-PR: sjekke at `workflow_run`-kjøringen er grønn, det vil si at den har skrivetoken.
  - Sjekke deploy-loggen fra merge-commiten:
    - fase 1 sier «ingen oppdatering», siden hashene er uendret
    - ventesteget lykkes
    - invalideringen meldes ferdig
    - fase 2 kjører
  - `curl -sI https://www.tennerogtrivsel.no/` viser CSP med de samme hashene som builden pluss GAPI.

## Risiko og usikkerhet

- **Dependabot og `workflow_run`.** Ifølge dokumentasjonen gir `workflow_run` skrivetoken også når det var Dependabot som utløste CI, og `permissions:` gjelder. Det er verifisert i dokumentasjonen, men ikke empirisk. Blir det likevel rødt for Dependabot, er fallbacken et `if` på `github.event.workflow_run.actor.login` som hopper over issue-stegene med en notice. Da varsles Dependabot-PR-er via cron etter 6 timer, som i dag. Vi bytter ikke til `MY_GITHUB_PAT`, fordi det gir unødvendig brede rettigheter.
- **Propagering kan måles feil.** Én HEAD-forespørsel fra runneren treffer én edge, og andre edges kan henge etter. Ventingen gjør vinduet mindre, men lukker det ikke garantert. Det gjelder bare deploys som endrer hasher.
- **Deploy feiler mellom fase 1 og 2.** Da blir de gamle hashene liggende til neste vellykkede deploy. De tilhører scripts som nettopp var lovlige. Gjentatte feil kan hope opp hasher, men lengdesjekken stopper før S3-synk. Jobben blir rød og synlig.
- **Concurrency gjør at deploys står i kø.** En Drive-endring kan vente noen minutter på en pågående deploy. Det er akseptabelt.
- **`wait invalidation-completed` legger 1–5 minutter til deploy.** Den har innebygd timeout (20 s × 30). Ved feil gis en advarsel, ikke stopp.
- **Policyen deles med test-distribusjonen.** Fase 1 utvider bare CSP-en, og det er ufarlig.
- **`ci-ok` kan spoofes** av en PR som lager en sjekk med samme navn. Det gir bare falske varsler, og var mulig fra før med den påkrevde sjekken.
- **`ci-ok`-navnet er hardkodet i vakta.** Det dekkes av kommentaren på jobben (steg 4).
