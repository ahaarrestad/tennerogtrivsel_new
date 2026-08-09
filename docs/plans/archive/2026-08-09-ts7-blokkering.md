# Fjern TS 7-blokkeringen i CI

**Dato:** 2026-08-09
**Type:** Kombinert spec + plan (liten infra-oppgave — se TODO.md arbeidsflyt §«veldig små oppgaver»)
**Status:** Revidert etter uavhengig review 2026-08-09 (se «Reviewfunn» nederst)

## Problem

Dependabot-gruppen `version-updates` foreslår `typescript` `^6.0.3` → `^7.0.2`. Det gjør
lockfilen uløselig, fordi **to** avhengigheter har peer-krav som utelukker TS 7:

| Pakke | Peer-krav på typescript | Siste versjon | Status |
|---|---|---|---|
| `@astrojs/check@0.9.10` | `^5.0.0 \|\| ^6.0.0` | 0.9.10 (2026-07-27) | ingen TS 7-støtte |
| `typescript-eslint@8.65.0` | `>=4.8.4 <6.1.0` | 8.66.0 | ingen TS 7-støtte |

`typescript-eslint` er den mest langsiktige blokkeringen: støtte er tracket mot TS **>= 7.1**,
ikke 7.0 (typescript-eslint#10940). Begge pakkene har dessuten *harde runtime-vakter*, ikke bare
peer-metadata — se «Verifiserte blindveier».

Resultatet er at `npm ci` feiler med `ERESOLVE` i **alle** CI-jobber på PR-en (`unit-tests`,
`lint`, `type-check`, `e2e-tests`, `build`). Se kjøring 31265708441. CI-loggen navngir bare
`@astrojs/check` fordi npm stopper på første konflikt — `typescript-eslint` kommer først fram
med `--strict-peer-deps`.

To konsekvenser:

1. De 5 andre oppdateringene i gruppe-PR-en kommer ikke gjennom — én blokkert pakke stopper
   hele gruppen.
2. Dependabot rebaser PR-en ukentlig, så feilen kommer tilbake på ubestemt tid.

Vi bruker `@astrojs/check` kun til `npm run check` → `astro check`
(`.github/workflows/deploy.yml:83`). Vi ligger på `typescript@^6.0.3`, som er fullt gyldig —
det haster ikke å få TS 7. Målet er å stoppe blødningen, ikke å oppgradere.

## Mål

1. Gruppe-PR-en `version-updates` blir grønn og mergbar uten `typescript`.
2. Når TS 7 faktisk kan tas i bruk, får vi beskjed **automatisk**, uten at noen må huske å
   sjekke.

## Akseptansekriterier

- `npm ci` går gjennom på en gjenskapt gruppe-PR (dvs. `typescript` er ikke med i den).
- `.github/dependabot.yml` har en `ignore`-regel for `typescript` `>=7` med kommentar som
  navngir **begge** blokkerende pakker og sier når regelen skal fjernes.
- En workflow kjører ukentlig og åpner en GitHub-issue første gang TS 7 både lar seg installere
  **og** faktisk fungerer med `npm run lint` og `npm run check`.
- Workflowen åpner **ikke** duplikat-issues — heller ikke hvis en tidligere issue er lukket.
- Workflowen kan trigges manuelt (`workflow_dispatch`) for å verifiseres uten å vente en uke.
- Workflowen avslutter **grønt** i normaltilstanden (fortsatt blokkert). Rødt skal bety at
  workflowen selv er ødelagt.

## Avgrensninger (non-goals)

- Vi oppgraderer **ikke** til TypeScript 7 nå.
- Vi rører ikke `ignore`-oppsettet for lambda-katalogen; den har ingen `typescript`-avhengighet.
- Ingen `--legacy-peer-deps`, `--force` eller `overrides` i CI — se «Verifiserte blindveier».
- Vi fjerner ikke `@astrojs/check` (viste seg umulig — se samme avsnitt).

## Designvalg

**Hvorfor `ignore` og ikke bare la PR-en stå rød?**
En permanent rød PR gjør CI-signalet verdiløst — man slutter å reagere på rødt. `ignore` fjerner
`typescript` fra forslaget, slik at resten av gruppen flyter.

**Hvorfor watchdog i tillegg til `ignore`?**
En `ignore`-regel uten utløpsdato blir en glemt lapp. Dependabot har ingen «vent til peers
tillater det»-mekanisme, så signalet må bygges selv. Med `typescript-eslint` tracket mot TS >= 7.1
snakker vi sannsynligvis mange måneders levetid på regelen — «glemt lapp»-risikoen er reell, ikke
teoretisk.

**Hvorfor probe med `npm install` framfor å parse peer-range?**
Å lese `peerDependencies.typescript` fra registeret tester en tilnærming til problemet. Å be npm
løse `typescript@^7` mot vårt tre tester nøyaktig den betingelsen CI feiler på, og fanger også opp
om en tredje avhengighet blokkerer (slik `typescript-eslint` var skjult bak `@astrojs/check`).

**Hvorfor `--strict-peer-deps` er ikke-forhandlbart.**
npm 11 har `strict-peer-deps=false` som default for `install`. Uten flagget degraderes ERESOLVE
til `npm warn ERESOLVE overriding peer dependency`, lockfilen skrives likevel, og proben gir
**exit 0 i dag** — watchdogen ville opprettet en falsk issue på første kjøring. Kun `npm ci`
håndhever strengt. Verifisert empirisk:

```
npm install --package-lock-only --ignore-scripts typescript@^7                    → EXIT=0
npm install --package-lock-only --ignore-scripts --strict-peer-deps typescript@^7 → EXIT=1
```

**Hvorfor proben ikke er nok alene.**
Peer-range er en proxy for om verktøyene virker. Begge blokkerende pakker har harde runtime-vakter
som slår inn selv når installasjonen lykkes. Derfor kjører workflowen `npm run lint` og
`npm run check` etter en vellykket probe, og åpner issue kun hvis alt passerer. Det gjør signalet
handlingsbart: issuen betyr «dette går faktisk grønt nå», ikke «prøv og se».

**Hvorfor egen workflow-fil og ikke en jobb i `scheduled-audit.yml`?**
Den fila heter «Scheduled Security Audit» og eier sikkerhetsskanning. En blokkert oppgradering er
ikke et sikkerhetsfunn. Ny fil navngis generisk (`blocked-upgrades-watch.yml`) så framtidige
tilsvarende blokkeringer kan legges til som egne jobber.

## Steg

### 1. `.github/dependabot.yml`

Legg `ignore` i npm-`/`-blokken (ikke lambda-blokken):

```yaml
    ignore:
      # typescript@7 gjør lockfilen uløselig og feiler `npm ci` i alle CI-jobber.
      # To blokkeringer, begge uten TS 7-støtte per 2026-08-09:
      #   @astrojs/check@0.9.10  peer "^5.0.0 || ^6.0.0"
      #   typescript-eslint@8.65 peer ">=4.8.4 <6.1.0"  (støtte tracket mot TS >=7.1)
      # Fjernes når blocked-upgrades-watch.yml åpner issue om at TS 7 er klart.
      - dependency-name: typescript
        versions: [">=7"]
```

Syntaksen er verifisert gyldig mot node-semver (`>=7` matcher 7.0.2, ikke 6.0.3) og mot GitHubs
`dependabot-options-reference`. Plassering i blokken er fri — YAML-nøkkelrekkefølge er irrelevant.

**Fallback hvis `ignore` ikke respekteres inne i en gruppe** (dependabot-core#10122 er fortsatt
åpen): bytt til `update-types: ["version-update:semver-major"]`, eller flytt `typescript` ut i en
egen gruppe så den ikke drar de andre fem med seg. Verifiseres ved at gjenskapt PR faktisk ikke
inneholder typescript.

### 2. Ny `.github/workflows/blocked-upgrades-watch.yml`

Cron `30 6 * * 1` (mandag 06:30 UTC, etter `scheduled-audit` som kjører 06:00) +
`workflow_dispatch`. Én jobb, `typescript-7`:

1. `actions/checkout` + `actions/setup-node` (node 24) — samme pinnede SHA-er som resten av repoet.
2. Guard: står `ignore`-regelen fortsatt i `dependabot.yml`? Er den borte, er det ingenting igjen
   å vokte — `::notice::` om at workflowen kan slettes, og avslutt grønt.
3. Probe: `npm install --package-lock-only --strict-peer-deps typescript@^7`.
   Exit ≠ 0 **og** outputen inneholder både `npm error code ERESOLVE` og
   `npm error … peer typescript@` → fortsatt blokkert, logg og avslutt **grønt**.
   Enhver annen feil → `::error::` og avslutt **rødt**: da er workflowen ødelagt
   (registry-nedetid, endret flaggnavn) eller konflikten handler om noe annet.
   Match på feil**koden**, ikke substrengen `ERESOLVE`: npm skriver rutinemessig
   `npm warn ERESOLVE overriding peer dependency` også når alt går bra.
4. Ved exit 0: `npm ci --ignore-scripts && npm run lint && npm run seed:fixtures &&
   npx astro sync && npm run check`. Feiler noe → `::warning::` om at peer-rangen er åpnet, men
   verktøyene ikke virker ennå, og avslutt grønt. (Samme sekvens som `type-check`-jobben i
   `deploy.yml:75-84`; krever ingen secrets — fixtures gir deterministisk innhold.)
5. Alt grønt → `gh label create ts7-watch --force`, så sjekk `gh issue list --label ts7-watch
   --state open`. Finnes en **åpen** issue, gjør ingenting. Ellers `gh issue create` med
   instruksjon om å fjerne `ignore`-regelen og denne workflowen. Dedup mot kun åpne issues er
   bevisst: lukkes issuen uten at regelen fjernes, skal påminnelsen komme igjen — og guarden i
   steg 2 sørger for at den stopper når regelen faktisk er borte.

Intet `npm ci`-steg før proben: `--package-lock-only` løser mot registeret, ikke mot et installert
tre. Verifisert at proben gir korrekt resultat i en tom katalog med kun `package.json` +
`package-lock.json`.

Permissions: `contents: read`, `issues: write`. Bruker `github.token` via `GH_TOKEN`-env — ikke
`MY_GITHUB_PAT`, som resten av repoet bruker. Avviket er bevisst (minste privilegium: watchdogen
trenger ikke skriverettigheter til PR-er) og kommenteres i fila så ingen «retter» det senere.

### 3. Gjenskap PR #433

`gh pr comment 433 --body "@dependabot recreate"` etter at endringene er på `main`. `recreate`, ikke
`rebase` — lockfilen i PR-en har sekundær skade (7 `@typescript-eslint/*`-pakker er netto fjernet
som fallout av peer-konflikten).

Merk rekkefølge: push til main trigger `dependabot-rebase.yml`, som kommenterer `@dependabot rebase`
på alle åpne dependabot-PR-er. Lander den før vår `recreate`, får vi en ekstra rød kjøring. Ufarlig
støy — alternativet er å bare lukke PR #433 og la neste ukentlige kjøring lage en ren PR.

## Konsekvens som bør bekreftes: auto-merge

`typescript` er den **eneste** major-bumpen i PR #433 — de fem andre (`dompurify` 3.4.11→3.4.13,
`marked` 18.0.7→18.0.9, `@playwright/test` 1.62.0→1.62.1, `@types/leaflet` 1.9.21→1.9.22,
`globals` 17.7.0→17.8.0) er patch/minor.

`dependabot-auto-merge.yml:21` approver og auto-merger alt som ikke er `semver-major`. Når
`typescript` ignoreres, går altså denne PR-en fra «flagget for manuell review» til å bli
auto-merget uten menneskelig blikk. Det er i tråd med eksisterende policy for minor/patch-grupper —
PR-en ville aldri vært flagget hvis TS ikke lå i den — men det er verdt å være klar over.

## Testbehov / definition of done

Ingen enhetstester — endringene er ren CI-konfigurasjon uten kjørbar prosjektkode, så
80 %-dekningskravet i CLAUDE.md treffer ikke berørte filer (det er avgrenset til «kjerne-logikk
(scripts og API)»).

Verifisering i stedet:

- YAML-parse på begge filene lokalt.
- Repro av proben i en **temp-katalog** med kun `package.json` + `package-lock.json` kopiert inn:
  uten `--strict-peer-deps` skal den gi exit 0, med skal den gi exit 1. Bekrefter at flagget er
  det som gjør proben meningsfull. Kjør aldri proben i arbeidstreet — den skriver om **både**
  `package.json` (`^6.0.3` → `^7.0.2`) og `package-lock.json`.
- Etter merge: kjør workflowen via `workflow_dispatch` og bekreft at den fullfører grønt, logger
  «fortsatt blokkert», og **ikke** oppretter issue.
- Etter merge: `@dependabot recreate` på PR #433, bekreft at typescript er ute og CI er grønn.

## Risiki og usikkerheter

- **`ignore` × `groups`:** dependabot-core#10122 («Ignore is not respecting in a group
  dependencies») er fortsatt åpen. Fallback beskrevet i steg 1.
- **Falsk positiv i proben:** npm kan i teorien legge en nestet `typescript@6` under en av
  pakkene og `7` i rot. Verifiseringssteget (lint + astro check) fanger dette, siden begge
  verktøyene sjekker den faktisk lastede TS-versjonen.
- **Glemt opprydding:** hvis begge blokkerende pakker forsvinner fra prosjektet, blir `ignore` og
  workflowen død vekt. Nevnes i issue-teksten som del av oppryddingen.
- **Utestet bash:** dedup- og issue-logikken har ingen automatisert test. `workflow_dispatch`
  dekker den lykkelige normaltilstanden; issue-grenen testes først når den faktisk fyrer.

## Verifiserte blindveier

Testet empirisk under review — skriv dem ikke opp igjen som «gode idéer» senere:

**`overrides` i package.json.** Satte `typescript: ^7.0.2` + `overrides` mot `$typescript` for
`@astrojs/check`, `typescript-eslint`, `@typescript-eslint/eslint-plugin` og `.../parser`.
Installasjonen lykkes (`npm ci` exit 0, TS 7.0.2 installert) — men:

```
npx eslint .    → Error: typescript-eslint does not support TS 7.0.
                  (typescript-eslint#10940 tracker støtte for TS >=7.1)
npx astro check → The TypeScript module loaded (found 7.0.2) does not expose the programmatic
                  API that `astro check` relies on. ... run with 6.x.
                  (withastro/roadmap#1321)
```

`overrides`/`--legacy-peer-deps`/`--force` flytter feilen fra install-tid til kjøretid. Ingen gevinst.

**Fjerne `@astrojs/check` til fordel for innebygd type-sjekk i Astro 7.** Finnes ikke. Repoet
kjører Astro `^7.1.6`, og `node_modules/astro/dist/cli/check/index.js` er en tynn wrapper som
`getPackage("@astrojs/check", ...)` og feiler med «The `@astrojs/check` and `typescript` packages
are required for this command to work». Å fjerne pakken fjerner type-sjekken, ikke konflikten — og
`typescript-eslint` blokkerer uansett.

## Reviewfunn som er innarbeidet

Uavhengig review 2026-08-09 fant to kritiske feil i første plan-utkast:

1. **Proben ga exit 0 i dag** — watchdogen ville fyrt falsk issue på første kjøring og lært
   mottakeren opp til å ignorere signalet. Fikset med `--strict-peer-deps`.
2. **`typescript-eslint` var ikke nevnt** — analysen tilskrev hele blokkeringen til
   `@astrojs/check`, og oppfølgingsavsnittet påsto feilaktig at konflikten forsvinner hvis den
   pakken fjernes.

I tillegg innarbeidet: unødvendig `npm ci` før proben fjernet, `package.json`-mutasjon
presisert, fallback for `ignore` × `groups`, auto-merge-konsekvensen dokumentert,
cron-tidspunkt satt.

Andre review-runde (etter implementering) fant to måter watchdogen kunne dø stille på —
begge fikset i workflowen:

1. **Enhver feil ble tolket som «fortsatt blokkert».** Registry-nedetid, et npm-flagg som
   bytter navn, eller en borte `typescript@7` ga alle grønn kjøring med `ready=false`.
   Proben krever nå `ERESOLVE` i outputen for å konkludere «blokkert» — ellers rødt.
   Feiler lint/check etter at peer-rangen har åpnet seg, logges det som `::warning::`.
2. **Dedup mot `--state all` gjorde varselet til engangs.** Lukket noen issuen uten å fjerne
   `ignore`-regelen, sa watchdogen aldri fra igjen. Nå dedupes det kun mot **åpne** issues,
   og jobben avbryter tidlig med `::notice::` hvis `ignore`-regelen er borte fra
   `dependabot.yml` — det er da workflowen selv skal slettes.

Tredje runde fant at begge fiksene var for løse, og at den ene innførte en ny stille
dødsmåte:

- `grep -q 'ERESOLVE'` traff også `npm warn ERESOLVE overriding peer dependency`, som npm
  skriver rutinemessig — også i dagens ekte probe-output. En urelatert fatal feil etter en
  slik warn-linje ville altså fortsatt blitt lest som «fortsatt blokkert». Nå kreves
  `npm error code ERESOLVE` **og** `npm error … peer typescript@`.
- Guard-grepen `dependency-name: typescript` bommet på den fullt gyldige siterte formen
  `- dependency-name: "typescript"` → jobben ville avsluttet med `::notice::` og aldri sagt
  fra igjen. Mønsteret er nå ankret med `grep -qE`, og treffer verken `typescript-eslint`
  eller en utkommentert regel.

Verifisert med stubbet `npm` at alle seks grener oppfører seg riktig (ekte typescript-konflikt
→ `ready=false`; warn-ERESOLVE + nettverksfeil → exit 1; ERESOLVE på en annen pakke → exit 1;
ETARGET → exit 1; lint-feil → `ready=false` + warning; alt grønt → `ready=true`), at
guard-mønsteret treffer dagens fil og den siterte formen men ikke `typescript-eslint` eller en
utkommentert regel, og med ekte `npm` at dagens tilstand gir `ready=false` uten å røre
`package.json`.
