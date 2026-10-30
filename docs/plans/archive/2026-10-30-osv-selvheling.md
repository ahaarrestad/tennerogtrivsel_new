# OSV-selvheling — implementasjonsplan

> **For agentic workers:** Utføres inline (superpowers:executing-plans). Steg bruker `- [ ]`.

**Mål:** `scheduled-audit.yml` fikser OSV-funn automatisk (høy/kritisk straks, ellers etter 7 dagers cooldown), venter stille på
ferske fikser, og åpner issue bare for medium+ som ikke kan fikses automatisk.

**Arkitektur:**

- Beslutningslogikken ligger i et rent Node-skript, `scripts/audit-selvheling.mjs`, med
  enhetstester og dekning.
- Jobben `selvheling` erstatter `auto-fix` og kjører hver gang. Stegene:
  1. `npm audit fix --before` på begge lockfilene.
  2. OSV-skann, så en målrettet `npm update --before` for pakkene som fortsatt flagges.
  3. Vakt mot nedgradering.
  4. Nytt OSV-skann, som er fasiten.
  5. Verifisering med `npm ci` og npm-telling som i dag.
  6. Skriptet avgjør `ren`, `venter`, `varsle` eller `feil`.
  7. PR og issue som i dag, med markørbasert dedupe.
- `npm-audit`-jobben blir informativ: den rapporterer tellingen, men gjør ikke kjøringen rød.
  Det er `selvheling` som avgjør, med 7 dagers cooldown for lav/medium og straks-fiks for høy/kritisk.
- Den gjenbrukbare OSV-workflowen beholdes bare for SARIF (`fail-on-vuln: false`).

**Tech Stack:** GitHub Actions, bash, Node 24 (ingen nye avhengigheter), osv-scanner v2.7.0
(Docker-image), Vitest.

**Spec:** [docs/designs/2026-10-30-osv-selvheling.md](../designs/2026-10-30-osv-selvheling.md)

## Globale føringer

- **Cooldown:** 7 dager for lav og medium, beregnet én gang per kjøring som
  `CUTOFF=$(date -u -d '7 days ago' +%FT%TZ)` og `NAA=$(date -u +%FT%TZ)`. Begge sendes til npm
  og skriptet (`--cutoff`, `--na`), så de bruker samme tidspunkter.
- **Høy og kritisk rettes straks** (eierens beslutning 2026-10-30): for dem er grensen `NAA`, ikke
  `CUTOFF`, både i `npm update` og i `vurder`.
- **Alvorlighet:**
  - Fra `groups[].max_severity` (CVSS): under 4,0 = lav, under 7,0 = medium, under 9,0 = høy,
    ellers kritisk.
  - Er den tom, brukes `database_specific.severity` (`LOW`/`MODERATE`/`HIGH`/`CRITICAL`).
  - Er begge tomme, regnes funnet som medium.
- **Lave funn** som står igjen etter fiksforsøket, gir verken venting, issue eller rød kjøring.
- **Lockfil-endringer:** alle npm-kommandoer som endrer lockfiler, kjøres med
  `--package-lock-only --ignore-scripts`. Checkout har `persist-credentials: false`, og PAT-en
  brukes bare i push-steget.
- **Utrygge data:** data fra OSV, registry og lockfiler sendes til `run:` bare via `env:`, aldri
  som `${{ }}` inne i skriptet. Pakkenavn står i backticks i issue-tekst, så `@scope` ikke pinger
  noen.
- **Pinning:**
  - OSV-imaget pinnes på digest: `ghcr.io/google/osv-scanner-action:v2.7.0@sha256:<digest>`.
    Digesten hentes i Task 3, steg 1.
  - Kommentaren sier at imaget og SHA-en til den gjenbrukbare workflowen bumpes sammen.
- **Uendret:** `npm-audit-check.sh` og etiketten `security-audit`.
- **Ny issue-tittel:** «Sikkerhetsfunn — krever manuell fiks».
- **Avhengigheter:** skriptet bruker bare Node-standardbiblioteket. Kjør-direkte-vakten følger
  `scripts/check-branch-coverage.mjs`:
  `if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)`.

## Review-fokus

1. **Registry svarer ikke** (nettfeil eller 5xx). Det skal gi exit 2 og status `feil` med issue,
   aldri `ren`. Testen ligger i Task 2.
2. **OSV-scanneren feiler** (exit 127/129/130) eller skriver tom eller ugyldig JSON. Det skal gi
   `feil` og issue, aldri `ren`, og issuen skal ikke lukkes. Testene ligger i Task 2 og Task 3.
3. **En kommentar fra en annen bruker med en falsk markør** skal ikke undertrykke varsel om nye
   funn. Testen ligger i Task 1 (markøren leses bare fra tekst som workflowen har skrevet).
4. **Backport-fiks:** installert 1.4.1, områdene `[0, 1.4.2)` og `[2.0.0, 2.0.5)`, og 1.4.2 er
   publisert i går. Det skal gi `venter`, ikke `varsle`. Testen ligger i Task 1.
5. **Målrettet `npm update` som nedgraderer** en pakke. Push skal stoppes med `feil`. Testen ligger
   i Task 2.

---

### Task 1: Rene beslutningsfunksjoner

**Filer:**
- Opprett: `scripts/audit-selvheling.mjs`
- Test: `scripts/__tests__/audit-selvheling.test.mjs`

**Grensesnitt (eksporteres, brukes i Task 2):**

Typer:
- `type Alvor = 'lav'|'medium'|'høy'|'kritisk'`
- `type Område = { introdusert: string, fikset?: string }`
- `type Funn = { id: string, pakke: string, versjon: string, katalog: string, alvor: Alvor, områder: Område[] }`
  - `id` er første GHSA blant OSV-`id` og `aliases`, ellers OSV-`id`.
  - `katalog` er lockfilens katalog relativt til roten (`.` eller `lambda/kontakt-form-handler`).
  - `områder` hentes fra `affected[].ranges[].events` for økosystemet `npm`, i rekkefølge.
- `type Vurdering = Funn & { utfall: 'venter'|'varsle'|'ignorer', aktuellFra?: string, grunn: string }`

Funksjoner:
- `alvor(score: string|undefined, dbSeverity: string|undefined): Alvor`
- `sammenlignVersjoner(a, b): -1|0|1`. Sammenligner numerisk `major.minor.patch`. En
  forhåndsversjon er lavere enn samme stabile versjon.
- `lesFunn(osv: object, rot: string): Funn[]`
  - En sårbarhet kobles til en gruppe når `groups[].ids` inneholder sårbarhetens `id`.
  - Funn dedupes på (katalog, pakke, id).
- `fiksFor(funn: Funn): string|undefined` gir `fikset` for området som inneholder `versjon`
  (`introdusert ≤ versjon < fikset`). Gir `undefined` når et slikt område ikke finnes eller ikke har
  `fikset`.
- `grense(alvor: Alvor, cutoff: Date, nå: Date): Date` gir `nå` for høy/kritisk og `cutoff` ellers.
- `vurder(funn: Funn, publisert: Record<string,string>, cutoff: Date, nå: Date): Vurdering`
  - Lav gir `ignorer`.
  - Alle sammenligninger under bruker `grense(funn.alvor, cutoff, nå)`.
  - Er `fiksFor` udefinert eller upublisert, blir utfallet `varsle` med `grunn: 'ingen fiks publisert'`.
  - Ellers er T publiseringstiden til fiksversjonen:
    - T > grense gir `venter` (kan bare skje for medium). `aktuellFra` er datoen for første daglige kjøring (06:00 UTC) på
      eller etter T + (nå − cutoff), altså T + 7 dager.
    - Ellers blir utfallet `varsle` med `grunn: 'fiks finnes, men ikke innenfor package.json-rangene (major eller override)'`.
- `unikeIder(v: Vurdering[]): string[]` er sortert og unik.
- `lagMarkør(ider: string[]): string` gir `<!-- audit-funn: ID1,ID2 -->`.
- `lesMarkør(tekster: string[]): string[]` gir unionen av alle markørene i tekstene. Kalleren
  sender bare tekster som workflowen har skrevet.
- `nyeIder(gamle: string[], nye: string[]): string[]`

- [ ] **Steg 1: Skriv testene.** Bruk `it.each` der det passer (jf. `docs/guides/test-guide.md`).
  Testene skal minst dekke dette:
  - **`alvor`:**
    - `'3.9'` gir lav, `'4.0'` og `'6.9'` gir medium, `'7.0'` gir høy og `'9.0'` gir kritisk.
    - `('', 'LOW')` gir lav, og `('', 'HIGH')` gir høy.
    - `('', undefined)` og `('abc', undefined)` gir medium.
  - **`sammenlignVersjoner`:**
    - `6.16.1 > 6.16.0`.
    - `6.10.0 > 6.9.9`.
    - `2.0.0-beta.1 < 2.0.0`.
    - Like versjoner gir 0.
  - **`lesFunn`** med en fixture som er det empirisk innhentede qs-funnet (se Risiko), med
    `source.path` `/github/workspace/package-lock.json` og rot `/github/workspace`:
    - Gir ett funn med id `GHSA-6pq8-jhm2-2vcw`, `qs@6.16.0`, katalog `.` og alvor medium.
    - `områder` er `[{introdusert:'6.7.0', fikset:'6.16.1'}]`.
    - Et lambda-funn gir katalogen `lambda/kontakt-form-handler`.
    - `{}` og `{results:[]}` gir `[]`.
  - **`fiksFor`:**
    - qs gir `6.16.1`.
    - Backport-tilfellet i review-fokus 4 gir `1.4.2`.
    - Installert versjon utenfor alle områder gir `undefined`.
    - Et område uten `fikset` gir `undefined`.
  - **`grense`**: høy og kritisk gir `nå`, lav og medium gir `cutoff`.
  - **`vurder`** med cutoff `2026-10-23T06:00:00Z` og nå `2026-10-30T06:00:00Z` (medium hvis ikke annet står):
    - Fiks publisert `2026-10-28T23:41:47Z` gir `venter` med `aktuellFra` `2026-11-05`.
    - Fiks publisert `2026-10-25T05:00:00Z` gir `venter` med `aktuellFra` `2026-11-01` (T + 7 d =
      05:00, så samme dags kjøring tar den).
    - Fiks publisert `2026-10-14T22:06:17Z` gir `varsle` med grunnen «utenfor rangene».
    - `publisert = {}` gir `varsle` med «ingen fiks publisert».
    - Et lavt funn gir `ignorer`.
    - Backport-tilfellet med 1.4.2 publisert i går gir `venter`.
    - Et høyt funn med fiks publisert `2026-10-29T12:00:00Z` (står igjen etter fiksforsøket) gir
      `varsle`, ikke `venter`.
  - **Markører:**
    - `unikeIder` med samme id i rot og lambda gir én id.
    - `lesMarkør([lagMarkør(['B','A'])])` gir `['A','B']`.
    - `lesMarkør([lagMarkør(['A']), lagMarkør(['B'])])` gir `['A','B']`.
    - Tekst uten markør gir `[]`.
    - `nyeIder(['A'],['A','B'])` gir `['B']`.
    - `nyeIder(['A','B'],['A'])` gir `[]`.
- [ ] **Steg 2: Kjør** `npx vitest run scripts/__tests__/audit-selvheling.test.mjs`. Testene skal
  feile fordi modulen mangler.
- [ ] **Steg 3: Implementer funksjonene** i `scripts/audit-selvheling.mjs`. Toppkommentaren skal si
  hva skriptet avgjør, og at det ikke kan ha avhengigheter.
- [ ] **Steg 4: Kjør testene** på nytt. Alt skal være grønt.

### Task 2: CLI

**Filer:**
- Endre: `scripts/audit-selvheling.mjs` (legg til `main` og kjør-direkte-vakten)
- Test: `scripts/__tests__/audit-selvheling.test.mjs`

**Grensesnitt:**

`main(argv: string[], deps: { fetch, env, ut: (s) => void, feil: (s) => void, lesFil: (p) => string, leggTil: (p, s) => void }): Promise<number>`
- Returnerer exit-koden.
- Roten er `env.OSV_ROT ?? '/github/workspace'`.
- Flerlinjeverdier i GITHUB_OUTPUT bruker en tilfeldig skilletekst (`crypto.randomUUID()`).

Underkommandoer:
- `pakker <osv.json>` skriver én linje `<katalog>\t<pakke>\t<straks|vent>` per unik (katalog,
  pakke) for alle nivåer. `straks` når pakken har minst ett høyt eller kritisk funn. Gir 0.
- `nedgradert <gammel-lock> <ny-lock>`:
  - Sammenligner `packages[*].version` for nøkler som finnes i begge.
  - Skriver `<nøkkel> <gammel> → <ny>` for hver nedgradering til `feil`.
  - Gir 1 hvis noen pakke er nedgradert, ellers 0.
- `vurder <osv.json> --cutoff <ISO> --na <ISO>`:
  - Henter `https://registry.npmjs.org/<encodeURIComponent(pakke)>` én gang per pakke (lave funn
    hoppes over) og bruker `.time`. Fetch sendes uten `Accept`-header for det forkortede formatet.
  - Skriver én `::warning::`-linje per funn som venter:
    `::warning::<id> i <pakke>@<versjon> (<katalog>): venter på cooldown, fiksen blir aktuell <dato>`.
  - Skriver én linje per funn som skal varsles til `feil`.
  - Skriver til GITHUB_OUTPUT:
    - `status`: `varsle` hvis minst ett funn skal varsles, ellers `venter` hvis minst ett venter,
      ellers `ren`.
    - `varsle_ider`: kommaliste.
    - `varsle_tekst`: flerlinjeverdi med én markdown-linje per funn (id, `` `pakke@versjon` ``,
      katalog, alvor og grunn).
  - Skriver en tabell til GITHUB_STEP_SUMMARY.
  - Gir 0.
- `nye <kommaliste>`:
  - Leser JSON fra filen `env.ISSUE_JSON` (`gh issue view --json body,comments`).
  - Tar bare med `body` og kommentarer der `author.login === 'github-actions'`.
  - Skriver `nyeIder(lesMarkør(...), liste)` som kommaliste. Gir 0.
- `markør <kommaliste>` skriver `lagMarkør(liste)`. Gir 0.

Feilhåndtering:
- Exit 2 med en `::error::`-linje ved: ugyldig eller tom JSON, at `results` ikke er en liste, ukjent
  underkommando, manglende `--cutoff`, eller `fetch` som kaster eller svarer med en annen status enn
  200.
- Svar 404 tolkes som `{}`.

- [ ] **Steg 1: Skriv testene.** Kall `main` med falske `deps`, uten nett. Testene skal minst
  dekke dette:
  - **`pakker`** med en fixture for rot og lambda gir to linjer; et høyt funn gir `straks`, et
    medium `vent`.
  - **`vurder`:**
    - Fersk fiks gir 0, `status=venter`, `::warning::` og `2026-11-05`.
    - Gammel fiks gir `status=varsle`, og `varsle_ider` inneholder GHSA-id-en.
    - Ingen funn gir `status=ren`.
    - Scoped pakke: `fetch` kalles med `https://registry.npmjs.org/%40scope%2Fnavn`, og
      `varsle_tekst` har pakkenavnet i backticks.
    - `fetch` som kaster, og svar 503, gir begge 2 (review-fokus 1).
    - Svar 404 gir `varsle` med «ingen fiks publisert».
    - Ugyldig JSON, tom fil og `{"results":null}` gir alle 2 (review-fokus 2).
    - Uten `--cutoff` eller `--na` gir 2.
  - **`nedgradert`:**
    - En nedgradering gir 1 og navnet på pakken.
    - Bare oppgraderinger og nye pakker gir 0 (review-fokus 5).
  - **`nye`:**
    - Body med markøren `A` og listen `A,B` gir `B`.
    - En kommentar fra `eve` med markøren `A,B` og listen `A,B` gir `B` (review-fokus 3).
    - En kommentar fra `github-actions` med markøren `B` gir tom utskrift.
  - **Ukjent underkommando** gir 2.
- [ ] **Steg 2: Kjør testene.** De nye testene skal feile.
- [ ] **Steg 3: Implementer `main`** og kjør-direkte-vakten med ekte `fetch` og `fs`.
- [ ] **Steg 4: Kjør `npm test && npm run coverage:check`.** Alt skal være grønt, og
  `scripts/audit-selvheling.mjs` skal ha minst 80 % branch-dekning.
- [ ] **Steg 5: Røyktest mot det ekte registryet** med qs-fixturen i scratchpad:
  `GITHUB_OUTPUT=<scratch>/out GITHUB_STEP_SUMMARY=<scratch>/sum node scripts/audit-selvheling.mjs vurder <scratch>/osv.json --cutoff <nå−7d> --na <nå>`.
  - Med qs 6.16.0 og fiks 6.16.1 (publisert 2026-10-14) er forventet resultat `varsle`.
  - Med en kopi der installert versjon er 6.16.1 og området er `[6.16.1, 6.17.1)` (6.17.1 publisert
    2026-10-28T23:41:47Z) er forventet resultat `venter` med `2026-11-05`, så lenge datoen er før
    det.
  - Dette er en formatsjekk av registryet, ikke en test som legges i repoet.

### Task 3: Workflow

**Filer:**
- Endre: `.github/workflows/scheduled-audit.yml` (header-kommentar, `npm-audit`, `auto-fix` →
  `selvheling`, `close-issue`, `osv-scan`)

**Grensesnitt:** bruker CLI-en fra Task 2. Jobben `selvheling` har outputs `status`
(`ren|venter|varsle|feil`).

- [ ] **Steg 1: Hent digesten** med
  `docker buildx imagetools inspect ghcr.io/google/osv-scanner-action:v2.7.0`, eller med
  `gh api` mot ghcr. Skriv den inn i workflowen.
- [ ] **Steg 2: `osv-scan`.** Legg til `fail-on-vuln: false` med en kommentar om at jobben bare
  laster opp SARIF, og at `selvheling` avgjør.
- [ ] **Steg 3: `npm-audit`.** Begge audit-stegene skriver tellingen og `::warning::` ved N > 0, men
  feiler ikke. Ugyldig resultat fra skriptet (exit 2) feiler fortsatt jobben, slik at et ødelagt
  `osv-scanner.toml` blir synlig. Header-kommentaren sier at `selvheling` avgjør.
- [ ] **Steg 4: `selvheling`.**
  - `needs: npm-audit`, `if: ${{ !cancelled() }}`, `timeout-minutes: 15` og `outputs.status`.
  - Gi `selvheling` sitt eget OSV-skann i stedet for å lese resultatet fra `osv-scan`. Den
    gjenbrukbare jobben gir ikke exit-koden ut, så det er ikke mulig å skille funn fra feil der.
  - Hvert OSV-skann er et `run`-steg:
    `docker run --rm -v "$PWD:/github/workspace" -w /github/workspace --entrypoint osv-scanner <image@digest> scan source --config=./osv-scanner.toml --format=json --output-file=<fil> -r ./`.
    - Exit 0 eller 1 betyr OK.
    - Andre koder skriver `::error::` og setter en markør i `$GITHUB_ENV` (`OSV_FEIL=1`).
    - Steget feiler ikke selv.
    - Verifiser lokalt at `--entrypoint osv-scanner` finnes i imaget. Ellers brukes imagets egen
      entrypoint, og 128 tolkes som feil.

  Stegene i rekkefølge:
  1. Checkout (`persist-credentials: false`) og setup-node, som i dag.
  2. **Tidspunkter:** `CUTOFF` og `NAA` skrives til `$GITHUB_ENV`. Kopier `package-lock.json` og lambda-lockfila
     til `$RUNNER_TEMP` for nedgraderingsvakten.
  3. **npm audit fix:** som i dag, men med `--before="$CUTOFF"` i begge katalogene. Det retter
     alt som har en fiks eldre enn 7 dager.
  4. **OSV-skann 1** til `$RUNNER_TEMP/osv-1.json`. Hvis fila finnes og `OSV_FEIL` ikke er satt,
     kjøres `pakker` og deretter
     `(cd "$KATALOG" && npm update "$PAKKE" --package-lock-only --ignore-scripts --before="$GRENSE") || true`
     for hver linje, der `GRENSE` er `$NAA` for `straks` og `$CUTOFF` for `vent`. Slik rettes
     høy/kritisk straks uten at medium-funn i samme lockfil hopper over cooldownen.
  5. **Nedgraderingsvakt:** `nedgradert` mot begge kopiene. Exit 1 setter `NEDGRADERT=1` i
     `$GITHUB_ENV`.
  6. **OSV-skann 2** til `$RUNNER_TEMP/osv-2.json`. Det kjøres før `npm ci`, slik at `node_modules`
     ikke finnes.
  7. **Verifiser fiksen:** som i dag (`ci_ok`, `vulns`, `changed`).
  8. **Vurder** (`id: vurder`):
     - Er `OSV_FEIL` eller `NEDGRADERT` satt, eller `osv-2.json` mangler, settes `status=feil`
       med en `varsle_tekst` som sier hva som skjedde.
     - Ellers kjøres `vurder "$RUNNER_TEMP/osv-2.json" --cutoff "$CUTOFF" --na "$NAA"`. Exit 2 gir
       `status=feil`.
     - Deretter gjelder:
       - `ci_ok != true` gir `status=feil` («npm ci feiler på den fiksede lockfila»).
       - En tom `vulns` gir `status=feil` («npm audit feilet»).
       - `vulns > 0` mens OSV-status er `ren` eller `venter` gir `varsle` («npm audit finner
         høy/kritisk som OSV ikke har»).
     - Til slutt skrives `status` til jobbens output.
  9. **Push og PR:**
     - Betingelse: `changed == 'true' && status != 'feil'`.
     - PR-teksten nevner 7 dagers cooldown.
  10. **Issue:**
      - Betingelse: `if: ${{ !cancelled() && (steps.vurder.outputs.status == 'varsle' || steps.vurder.outputs.status == 'feil' || failure()) }}`.
      - Alle verdier fra steg-outputs går inn via `env:`.
      - Teksten er `varsle_tekst`, eller ved `failure()` uten status «selvheling-jobben feilet
        uventet — se loggen». Teksten avsluttes med `markør`-linjen for `varsle_ider`.
      - Finnes det ingen åpen issue, opprettes en med den nye tittelen.
      - Finnes det en åpen issue:
        - `gh issue view <nr> --json body,comments > "$RUNNER_TEMP/issue.json"`.
        - Kjør `ISSUE_JSON=… node scripts/audit-selvheling.mjs nye "$IDER"`.
        - Gir det noe, skrives en kommentar med de nye funnene og en markør for hele det
          nåværende settet.
  11. **Avslutt:** `exit 1` når status er `varsle` eller `feil`. Venting og PR gir grønt.
- [ ] **Steg 5: `close-issue`.**
  - `needs: [npm-audit, selvheling]`.
  - `if: ${{ !cancelled() && needs.npm-audit.result == 'success' && needs.selvheling.result == 'success' && (needs.selvheling.outputs.status == 'ren' || needs.selvheling.outputs.status == 'venter') }}`.
  - Kommentaren: «Ingen funn krever handling lenger — lukkes automatisk.»
- [ ] **Steg 6: Oppdater header-kommentaren** så den beskriver flyten og at `ren` gjelder lockfila
  i PR-en. Om PR-en så feiler CI, fanges det av `stuck-pr-watch.yml`.
- [ ] **Steg 7: Lint lokalt** med `npx --yes actionlint@1.7.7 .github/workflows/scheduled-audit.yml`,
  eller `docker run rhysd/actionlint` hvis npx-pakken ikke finnes. Forventet: ingen feil.
- [ ] **Steg 8: Røyktest lokalt.** Kjør docker-kommandoen fra steg 4 mot lockfila fra før #524
  (`git show 4bfc5df:package-lock.json`) i scratchpad. Forventet: exit 1. Kjør så
  `vurder --cutoff <nå−7d> --na <nå>`. Forventet: `varsle`.
- [ ] **Steg 9: Commit** Task 1–3 via `/commit` uten push.

### Task 4: Dokumentasjon og helsesjekk

**Filer:**
- Endre: `docs/architecture/sikkerhet.md`:
  - Raden for `scheduled-audit.yml` ved linje 400.
  - Kjent-risiko-punktet om cooldown ved linje 411.
  - `osv-scan`-raden ved linje 496.
  - Avsnittet «OSV Scanner vs. npm audit» ved linje 502.
- Endre: `.claude/skills/helsesjekk/SKILL.md`:
  - Security Audit-kommandoen ved ca. linje 42.
  - Tolkningen ved ca. linje 64.
  - Tabellraden ved linje 92.

- [ ] **Steg 1: Oppdater `sikkerhet.md`.**
  - Beskriv flyten og tabellen fra spec-en, 7 dagers cooldown, at `npm-audit` er informativ,
    markør-dedupe og nedgraderingsvakten.
  - Fjern påstanden om at `npm audit fix` kan dra inn versjoner forbi cooldownen.
- [ ] **Steg 2: Oppdater helsesjekken.**
  - Legg til `gh run view <nyeste Security Audit-id>`.
  - Match på teksten «venter på cooldown» under ANNOTATIONS. Runner-image-notiser ignoreres.
    GitHub viser maks 10 advarsler per steg, men det holder.
  - Venting vises som ⚠️ med pakke og dato. Eieren trenger ikke gjøre noe; er funnet ikke løst
    etter datoen, kommer issuen av seg selv.
- [ ] **Steg 3: Commit** via `/commit` uten push.

### Task 5: Review, arkivering og verifisering etter merge

- [ ] **Steg 1:** `review-loop` til den er ren, deretter Fase 5 (arkivering) og `/commit` med
  push-godkjenning.
- [ ] **Steg 2: Etter merge** (`/commit` 5d):
  - Kjør `gh workflow run scheduled-audit.yml`.
  - Forventet: grønn kjøring og `selvheling` med `status=ren`.
  - Ingen ny issue, og `osv-scan` er grønn (SARIF er lastet opp).
  - Sjekk i loggen at OSV-skannene ga exit 0, og at `pakker` var tom.

## Testbehov og ferdig-definisjon

- Enhetstestene i Task 1 og 2 er grønne, og `scripts/audit-selvheling.mjs` har ≥ 80 % branch-dekning.
- `/quality-gate` er grønn.
- actionlint er ren.
- Røyktestene i Task 2 steg 5 og Task 3 steg 8 gir forventet status.
- Etter merge er dispatch grønn, og det er ingen åpne `security-audit`-issues.
- Akseptansekriteriene 1–4 krever et ekte sårbart funn for å kjøres ende-til-ende. De dekkes av
  enhetstestene og røyktesten med den gamle qs-lockfila. Koblingen i workflowen dekkes av actionlint
  og dispatchen.

## Risiko og usikkerhet

- **Empirisk verifisert 2026-10-30** med osv-scanner v2.7.0 (binær og Docker-image) på lockfila fra
  4bfc5df:
  - `source.path` er `/github/workspace/package-lock.json`.
  - qs-funnet har `id` GHSA-6pq8-jhm2-2vcw, `aliases` `[CVE-2026-110816]`, området
    `introduced 6.7.0 / fixed 6.16.1`, `database_specific.severity` MODERATE og `max_severity` `"6.3"`.
  - En ren eller unntatt skanning gir `results: []` og exit 0. Lockfiler uten funn er ikke med.
  - `npm update qs --before=2026-10-23` endret bare qs, og `--before=2026-10-10` endret ingenting.
    Uten `--before` ble det 6.17.1.
  - Exit-koder fra kilden: 0 = rent, 1 = funn, 127 = generell feil, 128 = ingen pakker, 129 = API,
    130 = ugyldig config.
  - `gh issue view --json author,comments` på en workflow-issue viser `author.login`
    `app/github-actions` for selve issuen og `github-actions` for kommentarene. Body tas alltid med,
    siden bare workflowen og repo-eieren kan endre den.
- **Imaget pinnes på digest i et `run`-steg,** og Dependabot ser ikke den pinningen. Kommentaren
  sier at det bumpes sammen med SHA-en til den gjenbrukbare workflowen. Glemmes det, kjører
  `selvheling` en eldre scanner, men databasen er fortsatt fersk (den hentes ved kjøring).
- **Daglig kjøring av `selvheling`** koster ca. 3 minutter Actions-tid. Det er akseptert.
- **`npm update <pakke>` på en transitiv pakke** holder seg innenfor foreldrenes ranger. Klarer den
  det ikke, viser OSV-skann 2 det. Nedgraderingsvakten stopper det tilfellet der den går feil vei.
- **Høy/kritisk som krever at en forelderpakke bumpes:** `npm audit fix` kjøres med `--before`, og
  `npm update <pakke>` kan bare bumpe innenfor foreldrenes ranger. Et høyt funn der fiksen er yngre
  enn 7 dager og krever en ny forelderversjon, blir derfor issue i stedet for auto-fiks. Det er
  sjeldent, og du får beskjed. Ikke sendt i stillhet.
- **`ren`** betyr at lockfila i PR-en er ren, ikke main. Feiler PR-en, fanges det av
  `stuck-pr-watch.yml`.
