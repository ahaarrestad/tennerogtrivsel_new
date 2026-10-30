# Spec: Security Audit — OSV-funn fikses automatisk eller varsles

TODO-oppgave 15. Dato: 2026-10-30.

## Hvorfor

Eieren av siden vil ha en side som virker og er trygg, og vil selv være minst mulig involvert.
Det betyr to ting: problemer skal fikses av seg selv der det går, og eieren skal bare få beskjed
når det trengs en menneskelig beslutning. Mindre støy er et uttalt ønske.

Hullet i dag: `scheduled-audit.yml` heler seg selv bare for `npm audit` med høy/kritisk. OSV-jobben
(`osv-scan`) laster bare opp SARIF. Den 2026-10-28 ble kjøringen rød fordi OSV fant `qs@6.16.0`
(GHSA-6pq8-jhm2-2vcw, medium). Det kom ingen issue, ingen PR og ingen Dependabot-alert. Funnet ble
bare oppdaget fordi eieren kjørte `/helsesjekk` manuelt. Det ble fikset for hånd i PR #524.

En rød kjøring uten issue er det verste av to verdener: den er støy for den som ser på
Actions-fanen, og den er stille for den som stoler på issues (slik `/helsesjekk` gjør).

## Mål

1. OSV-funn som har en fiks innenfor dagens `package.json`-ranger, fikses automatisk med samme
   PR-mekanisme som i dag (`auto/npm-audit-fix`, auto-merge, CI avgjør).
2. Automatiske fikser for lav og medium respekterer en cooldown på 7 dager. Høy og kritisk
   rettes straks, uten cooldown, slik som i dag (eierens beslutning 2026-10-30).
3. Eieren får en issue **bare** når et funn på medium eller høyere ikke kan fikses automatisk.
4. Kjøringen er rød bare når noe faktisk krever handling eller workflowen selv er ødelagt.

## Ikke-mål

- OSV i PR-CI eller i deploy-gaten. Deploy-gaten (`--audit-level=critical`) er uendret.
- Automatiske major-bump eller `overrides` i `package.json`. Det forblir en manuell beslutning.
- Endringer i `dependabot.yml` eller cooldown-verdiene der.
- Nye varslingskanaler (e-post, Slack). Issue med `@ahaarrestad` er kanalen.
- Fiks av andre økosystemer enn npm. Repoet har bare npm-lockfiler.

## Anti-mål (feil selv om det «virker»)

- En issue eller rød kjøring for noe eieren ikke kan gjøre noe med (for eksempel et lavt funn uten
  fiks, eller en fiks som bare venter på cooldown).
- En automatisk fiks som drar inn en versjon nyere enn cooldownen tillater.
- Install-scripts som kjører mens en token er tilgjengelig.
- At issuen lukkes mens en av sjekkene fortsatt finner noe som skal varsles.

## Regler (avgjort med eieren)

| Situasjon | Hva skjer | Kjøring | Issue |
|-----------|-----------|---------|-------|
| Ingen funn | ingenting | grønn | lukkes |
| Funn (alle nivåer) med fiks som er eldre enn cooldownen | auto-fix-PR | grønn | nei |
| Høy/kritisk med fiks innenfor rangene (uansett alder) | auto-fix-PR straks | grønn | nei |
| Medium med fiks, men fiksen er nyere enn cooldownen | vent, advarsel med datoen fiksen blir aktuell | grønn med `::warning::` | nei |
| Samme, men datoen er passert og funnet står fortsatt | som «ingen fiks» under | | |
| Medium/høy/kritisk uten automatisk fiks (major, override, ingen fiks, `npm ci` feiler) | issue | rød | ja |
| Lav som står igjen etter fiksforsøket (uten fiks, utenfor rangene eller venter) | ingenting (synlig i Security-fanen) | grønn | nei |
| `npm audit` eller OSV-scanneren selv feiler | issue (som i dag) | rød | ja |

- **Cooldown:** 7 dager for lav og medium, via `--before=<nå − 7 dager>`. *Mitt valg:* én flat
  verdi; Dependabot har 3 dager for patch og 30 for major, men major-bump gjøres aldri automatisk.
- **Høy og kritisk rettes straks** (eierens beslutning): ingen `--before`, ingen venting. Står et
  høyt eller kritisk funn igjen etter fiksforsøket, blir det issue.
- **Issuen lukkes** først når både npm-auditen og OSV-sjekken er grønne (eller bare har funn som
  regnes som grønne etter tabellen over).
- **Unntak** i `osv-scanner.toml` gjelder fortsatt for begge sjekkene, med obligatorisk
  `ignoreUntil`.

## Empirisk grunnlag for `--before`

Testet 2026-10-29 i en kopi med den gamle lockfila (qs 6.16.0):

- `npm audit` kjenner advisoryen (moderate, `fixAvailable: true`), selv om den først ble funnet av OSV.
- `--before=2026-10-23T00:00:00Z` endret bare qs, 6.16.0 → 6.16.1. Ingen andre pakker ble endret,
  selv om lockfila inneholder nyere pakker.
- `--before=2026-10-10T00:00:00Z` endret ingenting og nedgraderte ingenting. `npm audit` sa
  fortsatt `fixAvailable: true`. Dermed kan «venter på cooldown» skilles fra «ingen fiks».

## Akseptansekriterier

1. Gitt en lockfil med et medium-funn som har en fiks eldre enn 7 dager: kjøringen åpner eller
   oppdaterer auto-fix-PR-en, er grønn, og åpner ingen issue.
2. Gitt et medium-funn der eneste fiks er nyere enn 7 dager: ingen PR, ingen issue, kjøringen er
   grønn, og loggen/sammendraget har en advarsel med datoen fiksen blir aktuell. Gitt et høyt
   eller kritisk funn med en fiks publisert i går: auto-fix-PR i samme kjøring.
3. Gitt et medium-funn uten fiks innenfor rangene: issue med etiketten `security-audit`, som sier
   hvilket funn og hvorfor det ikke kunne fikses.
4. Gitt bare lave funn uten fiks: grønn kjøring, ingen issue.
5. Åpen `security-audit`-issue lukkes ikke så lenge OSV-sjekken har et funn som etter tabellen
   skal varsle.
6. Fiks for lav/medium bruker `--before`; høy/kritisk gjør det ikke.
7. SARIF lastes fortsatt opp til Security-fanen.
8. Beslutningslogikken (nivå → handling, cooldown-dato, lukking) ligger i et skript med
   enhetstester etter mønsteret i `.github/scripts/dependabot-rebase.sh` og
   `scripts/__tests__/dependabot-rebase.test.mjs`, og møter dekningskravet.
9. `/helsesjekk` (`.claude/skills/helsesjekk/SKILL.md`) kjenner venteadvarselen og viser den som ⚠️
   med datoen, ikke som ❌. `docs/architecture/sikkerhet.md` beskriver den nye flyten.
10. Verifisert i GitHub etter merge med `workflow_dispatch`: grønn kjøring på dagens rene main.

## Svakheter og tiltak

1. **OSV og npm audit bruker ulike databaser.** npm audit kan mangle en advisory som OSV har.
   Tiltak: OSV kjøres på nytt på den fiksede lockfila og er fasiten for om funnet er borte.
   OSV-funn som npm audit ikke kjenner, får en målrettet `npm update` (se «Overlatt til
   byggeren»).
2. **`--before`-oppførselen** er en dokumentert npm-opsjon og verifisert empirisk (se over).
   Tiltak: uansett hva `npm audit fix` gjør, avgjøres venting av publiseringstiden til fiksversjonen
   i registry, ikke av npm. En fiks som er pushet for tidlig, ville vært synlig i PR-diffen.
3. **Flere automatisk mergede lockfil-endringer.** Samme beskyttelse som i dag: cooldown,
   `--ignore-scripts`, `persist-credentials: false`, full CI og CodeQL-porten.
4. **`npm audit fix` kan endre flere pakker enn den sårbare**, innenfor rangene. Akseptert;
   `--before` begrenser hva som kan komme inn.
5. **YAML er vanskelig å teste.** Tiltak: beslutningslogikken i et testet skript, YAML-en bare
   kobler sammen.

## Overlatt til byggeren

- Hvordan OSV kjøres for å få både SARIF og maskinlesbart resultat (for eksempel egen jobb med
  osv-scanner-CLI og JSON, ved siden av eller i stedet for den gjenbrukbare workflowen). Kravet er
  at lave funn uten fiks ikke gjør kjøringen rød, og at SARIF fortsatt lastes opp.
- Hvordan datoen for «fiksen blir aktuell» regnes ut (for eksempel publiseringstid fra
  `npm view <pakke> time` + 7 dager).
- Skriptspråk (bash eller Node) og navn på skript og jobber.
- **Mitt valg:** alvorlighet er det strengeste av CVSS-score (lav < 4,0) og GitHubs nivå (endret etter review, så npm audit og OSV er enige om hva som er høyt). Funn uten alvorlighet
  behandles som medium, så de varsles heller enn å forsvinne.
- **Mitt valg:** venteadvarselen skrives som `::warning::` og i jobbsammendraget, ikke som issue.
- **Mitt valg — OSV-funn som `npm audit` ikke kjenner:** de skal ikke gå rett til issue, siden det
  ville gi støy for noe som bare venter på cooldown. Etter `npm audit fix` prøves en målrettet
  `npm update <pakke> --before=…` for pakkene OSV fortsatt flagger. Står funnet igjen, slås OSVs
  `fixed`-versjon opp med `npm view <pakke> time`: publisert innenfor cooldownen gir venting,
  ellers eller uten fiks innenfor rangene gir det issue (medium+). OSV på den fiksede lockfila er
  fasiten.
- **Mitt valg — nye funn når issuen allerede er åpen:** issuen får en kommentar når settet med
  funn som skal varsles endrer seg (nye GHSA-id-er). Funn-id-ene lagres i en skjult markør i
  issue-teksten eller kommentaren, så samme sett ikke kommenteres hver dag.
- **Mitt valg — npm-auditen beholder terskelen høy/kritisk.** `npm-audit-check.sh` endres ikke.
  OSV dekker alle nivåer og avgjør medium/lav. `npm audit --json` brukes også til `fixAvailable`.
