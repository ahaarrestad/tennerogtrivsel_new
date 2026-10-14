---
name: status
description: "Use when the user asks 'funker alt?', 'status', 'hvordan ser det ut', 'virker siden', 'helsesjekk', or otherwise wants to know whether the site, builds and security checks are OK."
disable-model-invocation: false
allowed-tools: ["Bash(gh *)", "Bash(curl *)", "Bash(date *)"]
---

# Status — helsesjekk

Svarer på «funker alt?» med de samme sjekkene og samme tabell hver gang. Kun lesing — endrer
ingenting. Finner du noe rødt: forklar hva det er og foreslå fiks, men start ikke arbeidet uten
at brukeren ber om det.

## Sjekker

Kjør hver kommando som et eget Bash-kall, alle parallelt. Ikke slå dem sammen med `;` eller
`&&` — worktree-isolerte økter nekter sammensatte `gh`-kommandoer.

```bash
# 1. Siden
curl -sL -o /dev/null -w "%{http_code} %{time_total}s\n" https://www.tennerogtrivsel.no/

# 2. Uptime: fordeling av de siste 20 kjøringene
gh run list --workflow "Uptime Check" --limit 20 --json conclusion \
  --jq '[.[].conclusion] | group_by(.) | map("\(.[0]): \(length)") | join(", ")'

# 3. Kjøringer siste 7 dager, unntatt grønne uptime-sjekker (røde og pågående er det som teller)
gh run list --limit 100 --json workflowName,conclusion,status,createdAt,event,databaseId \
  --jq '.[] | select(.workflowName != "Uptime Check" or .conclusion != "success")
        | "\(.createdAt) \(.workflowName) [\(.event)] \(.status) \(.conclusion) \(.databaseId)"'

# 4. Åpne Dependabot-varsler
gh api "repos/ahaarrestad/tennerogtrivsel_new/dependabot/alerts?state=open" \
  --jq '.[] | "\(.security_advisory.severity) \(.dependency.package.name) #\(.number)"'

# 5. Åpne issues og PR-er
gh issue list --state open --json number,title,labels --jq '.[] | "#\(.number) \(.title)"'
gh pr list --state open --json number,title,author --jq '.[] | "#\(.number) \(.title) (\(.author.login))"'

# 6. Siste bygg trigget fra Drive (SyncOnEdit, scripts/apps-script/SyncOnEdit.gs)
gh run list --workflow CI/CD --event repository_dispatch --limit 1 --json createdAt,conclusion \
  --jq '.[] | "\(.createdAt) \(.conclusion)"'
```

Filtrer resultatet fra 3 til de siste 7 dagene selv. En rød kjøring som senere er etterfulgt av en
grønn kjøring av **samme workflow** er løst — nevn den, men ikke som et åpent problem. Er en rød
kjøring nyest for sin workflow, er den åpen: hent årsaken med `gh run view <id> --log-failed`
(begrens til de relevante linjene).

## Svar

Én linje først: **«Alt virker»** eller **«N ting trenger oppmerksomhet»**. Deretter tabellen,
alltid med alle radene:

```
| Sjekk              | Status                                              |
|--------------------|-----------------------------------------------------|
| Siden              | ✅ 200 (0,2 s)                                       |
| Uptime             | ✅ 20/20 grønne                                      |
| Deploy (CI/CD)     | ✅ siste på main grønn <dato>                        |
| Security Audit     | ✅ grønn <dato>                                      |
| Dependabot         | ✅ siste kjøring grønn · 0 åpne varsler              |
| Vaktjobber         | ✅ Blocked Upgrades / Node Version Watch grønne       |
| Issues / PR-er     | ✅ ingen åpne                                         |
| Drive-bygg         | ✅ siste <dato> grønn                                 |
```

- ❌ = rødt og uløst (med én setning om årsaken), ⚠️ = trenger en vurdering (f.eks. åpen
  Dependabot-PR som ikke auto-merges, issue fra en vaktjobb), ✅ = OK.
- Et gammelt Drive-bygg er normalt — det betyr bare at ingen har endret innhold siden.
- Avslutt med hva brukeren eventuelt må gjøre. Er svaret «ingenting», si det.
