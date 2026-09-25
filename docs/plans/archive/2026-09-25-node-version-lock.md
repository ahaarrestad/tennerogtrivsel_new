# Plan: Lås Node-versjonen på tvers av lokalt og CI

Spec: [docs/designs/archive/2026-09-25-node-version-lock.md](../../designs/archive/2026-09-25-node-version-lock.md)

## Mål og avgrensninger

Lås Node med `.nvmrc` som eneste kilde for CI og lokal utvikling, en
floor-range i `engines.node` som sikkerhetsnett, `engine-strict=true` for hard
håndheving, og en scheduled workflow som varsler når versjonen bør oppgraderes.

**Ikke med:** endring av `lambda/kontakt-form-handler/package.json` (ingen
`engines`-felt der, og rot-`.npmrc` gjelder ikke der — npm leser `.npmrc` fra
pakkeroten den kjører i). Lambda-*runtimen* i AWS er også utenfor.

## Avvik fra godkjent plan (oppdaget under implementasjon)

1. **Versjon 24.21.0, ikke 24.12.0.** `jsdom@30.0.1` krever `^24.15.0`. Med
   `engine-strict=true` gjelder engines-kravene også for avhengigheter, så
   24.12.0 ville fått `npm ci` til å feile i alle CI-jobber. Låst i stedet til
   24.21.0, nyeste 24 LTS («Krypton») per 2026-09-25.
2. **Gulvet i `engines` er `>=24.15.0`, ikke lik `.nvmrc`.** Gulvet
   uttrykker hva avhengighetene faktisk krever. Da kan `.nvmrc` patch-bumpes
   uten å røre `package.json`, som var intensjonen i spec-en.
3. **Watchdogen sjekker også sikkerhetsutgivelser i samme major**, ikke bare
   nyere LTS-linjer. «Oppgradert når det trengs» betyr i praksis oftest en
   sikkerhetspatch. Siden `.nvmrc` nå er eksakt, får CI *ikke* lenger
   patchene automatisk, slik den gjorde med `node-version: '24'`. Uten denne
   sjekken ville låsen gjort prosjektet mindre sikkert.
4. **Ukentlig, ikke månedlig**, fordi sikkerhetsutgivelser skal fanges innen en
   uke. Kjøringen koster ett HTTP-kall.
5. **Filnavn `node-version-watch.yml`** (ikke `node-lts-watch.yml`), fordi den
   dekker mer enn LTS. Issuene får **to etiketter**, `node-security-watch` og
   `node-lts-watch`, som dedupes hver for seg (endret etter review). En
   LTS-issue kan stå åpen i månedsvis under et major-bytte, og med én felles
   etikett ville den skjult alle sikkerhetsutgivelser i vår major i mellomtiden.
6. **`package-lock.json`** fikk `engines` i rot-oppføringen (synket med
   `npm install --package-lock-only`), så neste `npm install` ikke gir
   støy-diff.

## Steg (slik de ble gjennomført)

1. `.nvmrc`: `24.21.0`
2. `package.json`: `"engines": { "node": ">=24.15.0 <25.0.0" }` +
   tilsvarende rot-oppføring i `package-lock.json`
3. `.npmrc`: `engine-strict=true`
4. Åtte `actions/setup-node`-steg → `node-version-file: '.nvmrc'` i
   `deploy.yml` (6), `scheduled-audit.yml` (1), `blocked-upgrades-watch.yml` (1).
   Alle kjører etter `actions/checkout`, så `.nvmrc` finnes.
5. Ny `.github/workflows/node-version-watch.yml` (mandag 06:45 UTC +
   `workflow_dispatch`):
   - Leser `.nvmrc`, krever eksakt `X.Y.Z` (tåler `v`-prefiks)
   - Henter `https://nodejs.org/dist/index.json` med `curl -sSf --retry 3`
   - Feiler rødt hvis den låste versjonen ikke finnes i dataene. Da er enten
     `.nvmrc` feil eller dataformatet endret, og watchdogen skal ikke dø stille.
   - Finner nyeste `security: true`-utgivelse i samme major som er nyere enn
     den låste, og nyeste LTS-utgivelse med høyere major. Sammenligner
     numerisk, ikke som strenger.
   - Åpner én issue per funn, med etiketten `node-security-watch` eller
     `node-lts-watch`. Hver etikett dedupes mot åpne issues
     (mønsteret fra `blocked-upgrades-watch.yml`), med `github.token`
6. `blocked-upgrades-watch.yml`: egen feilgren med egen melding når proben
   feiler med `EBADENGINE` (Node for gammel under `engine-strict`) i stedet for
   `ERESOLVE`

## Testbehov / definition of done

Infrastruktur/CI-konfigurasjon, som ikke faller under 80%-coverage-kravet for
`src/scripts`/API. Verifisert slik:

- [x] `npm ci` med Node 24.12.0 feiler hardt (`EBADENGINE`, exit 1)
- [x] `npm ci` med Node 24.21.0 lykkes
- [x] `npm run lint`, `npm run check` og `npm test` (1627 tester) er grønne under 24.21.0
- [x] Alle fire berørte workflow-filer er gyldig YAML
- [x] Probe-steget er kjørt lokalt mot ekte `index.json` med sju `.nvmrc`-verdier:
      `24.21.0` → ingenting; `24.12.0` → sikkerhet `v24.18.1`; `22.22.0` →
      sikkerhet + LTS `v24.21.0 (Krypton)`; `26.10.0` → ingenting; `v24.21.0` →
      ingenting; `24` → rød (ikke eksakt); `24.99.0` → rød (finnes ikke)
- [x] Issue-steget er kjørt lokalt med falsk `gh`: riktig tittel og tekst for
      sikkerhet, LTS og begge deler (to issuer); ingen ny issue når en med
      samme etikett er åpen; en åpen LTS-issue hindrer ikke en sikkerhetsissue
- [ ] `node-version-watch.yml` kjøres via `workflow_dispatch` etter merge
      (forventet: grønn, ingen issue)
- [ ] Dependabot for `/` kjøres manuelt etter merge (Insights → Dependency
      graph → Dependabot → «Check for updates»). Jobbloggen skal ikke vise
      `EBADENGINE` eller `dependency_file_not_resolvable`.

## Kjente risiki / usikkerheter

- **`engine-strict=true` tvinger lokal oppgradering.** Lokal Node må være
  ≥24.15.0. Kjør `nvm install` i repo-roten (leser `.nvmrc`).
- **`node-version-file` er nytt i dette repoet.** Første CI-kjøring på PR-en
  verifiserer det.
- **Dependabot og `engine-strict`:** Dependabot løser lockfila med sin egen
  Node og leser repoets `.npmrc`. Ligger den Node-versjonen utenfor
  `>=24.15.0 <25.0.0`, kan både versjons- og sikkerhets-PR-er for `/` stoppe
  stille. Ikke verifisert før merge; se DoD-punktet over. Feiler det, er
  fallback å fjerne `engine-strict` (CI er uansett låst via `node-version-file`).
- **Dedup per etikett:** en åpen sikkerhetsissue for `v24.18.1` hindrer en ny
  for `v24.20.0`. Akseptert, siden issuen ber om «denne eller nyere». En
  issue som glemmes åpen etter oppgradering vil derimot skjule neste varsel;
  issue-teksten ber derfor om å lukke den i oppgraderings-PR-en.
