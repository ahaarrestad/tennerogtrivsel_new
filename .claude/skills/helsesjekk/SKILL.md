---
name: helsesjekk
description: "Use when the user asks 'funker alt?', 'hvordan er status', 'hvordan ser det ut', 'virker siden', 'helsesjekk', or otherwise wants to know whether the site, builds and security checks are OK."
disable-model-invocation: false
allowed-tools: ["Bash(gh *)", "Bash(curl *)"]
---

# Helsesjekk

Svarer på «funker alt?» med de samme sjekkene og samme tabell hver gang. Kun lesing — endrer
ingenting. Finner du noe rødt: forklar hva det er og foreslå fiks, men start ikke arbeidet uten
at brukeren ber om det.

## Viktig: issues er signalet, ikke røde kjøringer

Uptime-sjekken og vaktjobbene er **grønne også når de har funnet et problem** — funnet kommer som
en issue (etiketter `uptime`, `security-audit`, `sikkerhet-auto`, `ts7-watch`, `override-watch`,
`node-security-watch`, `node-lts-watch`, `pr-stuck`). En rød kjøring av dem betyr at selve workflowen er
ødelagt. Åpne issues er derfor den viktigste sjekken.

## Sjekker

Kjør hver kommando som et eget Bash-kall, alle parallelt. Ikke slå dem sammen med `;` eller
`&&` — worktree-isolerte økter nekter sammensatte `gh`-kommandoer.

```bash
# Siden
curl -sL -o /dev/null -w "%{http_code} %{time_total}s\n" https://www.tennerogtrivsel.no/

# Åpne issues (alle watchdog-funn havner her) og PR-er
gh issue list --state open --json number,title,labels --jq '.[] | "#\(.number) [\([.labels[].name] | join(","))] \(.title)"'
gh pr list --state open --json number,title,author --jq '.[] | "#\(.number) \(.title) (\(.author.login))"'

# Sikkerhetsvarsler
gh api --paginate "repos/ahaarrestad/tennerogtrivsel_new/dependabot/alerts?state=open" --jq '.[] | "\(.security_advisory.severity) \(.dependency.package.name) #\(.number)"'
gh api --paginate "repos/ahaarrestad/tennerogtrivsel_new/code-scanning/alerts?state=open" --jq '.[] | "\(.rule.severity) \(.rule.id) #\(.number)"'

# Siste kjøringer per workflow — én kommando per rad i tabellen
gh run list --workflow "Uptime Check" --limit 3 --json createdAt,conclusion --jq '.[] | "\(.createdAt) \(.conclusion)"'
gh run list --workflow "CI/CD" --branch main --event push --limit 3 --json createdAt,conclusion,databaseId --jq '.[] | "\(.createdAt) \(.conclusion) \(.databaseId)"'
gh run list --workflow "CI/CD" --event repository_dispatch --limit 1 --json createdAt,conclusion,databaseId --jq '.[] | "\(.createdAt) \(.conclusion) \(.databaseId)"'
gh run list --workflow "Scheduled Security Audit" --limit 3 --json createdAt,conclusion,databaseId --jq '.[] | "\(.createdAt) \(.conclusion) \(.databaseId)"'
gh run list --workflow "Dependabot Updates" --limit 5 --json createdAt,conclusion,displayTitle,databaseId --jq '.[] | "\(.createdAt) \(.conclusion) \(.databaseId) \(.displayTitle)"'
gh run list --workflow "Blocked Upgrades Watch" --limit 1 --json createdAt,conclusion,databaseId --jq '.[] | "\(.createdAt) \(.conclusion) \(.databaseId)"'
gh run list --workflow "Node Version Watch" --limit 1 --json createdAt,conclusion,databaseId --jq '.[] | "\(.createdAt) \(.conclusion) \(.databaseId)"'
gh run list --workflow "Stuck PR Watch" --event schedule --limit 1 --json createdAt,conclusion,databaseId --jq '.[] | "\(.createdAt) \(.conclusion) \(.databaseId)"'
gh run list --workflow "Auto-Rebase Open PRs" --event schedule --limit 1 --json createdAt,conclusion,databaseId --jq '.[] | "\(.createdAt) \(.conclusion) \(.databaseId)"'
gh run list --workflow codeql.yml --branch main --limit 1 --json createdAt,conclusion,databaseId --jq '.[] | "\(.createdAt) \(.conclusion) \(.databaseId)"'
```

CodeQL hentes på filnavn: navnet «CodeQL» finnes to ganger (vår `codeql.yml` og GitHubs
dynamiske), så `--workflow "CodeQL"` feiler.

## Tolkning

- **Uptime:** OK = ingen åpen `uptime`-issue **og** siste kjøring er under ~8 timer gammel
  (GitHub dropper mange timeskjøringer, så ~4 per døgn og hull på 6 timer er normalt). Eldre enn det → ⚠️, vakta kan
  ha stoppet. Uptime-issuen dekker også kart-tiles (CARTO-nøkkelen) og tomt innhold fra
  Drive/Sheets — les funnlinjene i issuen, de sier hva som er galt.
- **Dependabot Updates:** kjøringene gjelder ulike pakker/kataloger. Er den nyeste kjøringen rød,
  eller en rød kjøring ikke etterfulgt av en grønn for samme `displayTitle`-område, er den åpen.
- **Andre rader:** den **nyeste** kjøringen avgjør. En eldre rød etterfulgt av grønn er løst —
  nevn den kort, ikke som et åpent problem.
- **Rød og åpen:** hent årsaken med `gh run view <id> --log-failed` (begrens til relevante linjer).
- **Gammelt Drive-bygg** er normalt — det betyr bare at ingen har endret innhold siden.
- **Vaktjobbene** (Blocked Upgrades Watch, Node Version Watch) kjører mandager; en kjøring på
  inntil 8 dager er normal.
  Stuck PR Watch kjører hver 3. time og hører til samme rad; eldre enn ~12 timer → ⚠️.
  Den kjører også etter hver PR-CI (`workflow_run`) og varsler da straks om rød `ci-ok` på en
  auto-merge-PR. Kommandoen henter derfor bare cron-kjøringer (`--event schedule`) — ellers
  ville workflow_run-kjøringene skjule at cron har stoppet. Blant workflow_run-kjøringene er
  `skipped` (CI som ikke er PR, f.eks. push til main) og `cancelled` (køen fortrenger ventende
  kjøringer) normalt.
  Auto-Rebase Open PRs hører også til raden: timeskjøringen (`--event schedule`) prøver
  `BEHIND`-PR-er på nytt. Eldre enn ~4 timer eller `conclusion` ≠ `success` → ⚠️. Den er grønn
  også når den har kommentert eller eskalert; loggen viser hva den gjorde.
- **CI/CD-deploy `cancelled`:** deploy-jobben har én-om-gangen-kø; en ventende deploy avbrytes
  når en nyere kommer. Normalt så lenge en senere kjøring er grønn.

## Svar

Én linje først: **«Alt virker»** eller **«N ting trenger oppmerksomhet»**. Deretter tabellen,
alltid med alle radene:

```
| Sjekk              | Status                                                   |
|--------------------|----------------------------------------------------------|
| Siden              | ✅ 200 (0,2 s)                                            |
| Uptime             | ✅ ingen uptime-issue · siste sjekk <tid> siden           |
| Deploy (CI/CD)     | ✅ siste på main grønn <dato>                             |
| Drive-bygg         | ✅ siste <dato> grønn                                     |
| Security Audit     | ✅ grønn <dato> · 0 Dependabot-varsler · 0 CodeQL-varsler  |
| Dependabot         | ✅ siste kjøringer grønne                                 |
| Vaktjobber         | ✅ grønne <dato>, ingen watch-issues                      |
| CodeQL             | ✅ grønn <dato>                                           |
| Issues / PR-er     | ✅ ingen åpne                                             |
```

- ❌ = rødt og uløst (med én setning om årsaken), ⚠️ = trenger en vurdering (åpen
  watchdog-issue, Dependabot-PR som ikke auto-merges, utdatert vakt), ✅ = OK.
- Avslutt med hva brukeren eventuelt må gjøre. Er svaret «ingenting», si det.
