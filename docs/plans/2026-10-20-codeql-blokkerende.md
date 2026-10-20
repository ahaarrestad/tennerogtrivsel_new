# CodeQL som blokkerende sjekk — spec + plan

Liten oppgave: spec og plan i én fil (TODO.md-arbeidsflyten, §0). Revidert etter tre blinde
reviews (faktasjekk, empirisk, kald design) 2026-10-20.

## Spec

**Problem.** CodeQL kjører på hver PR, men ingen regel på main krever at den er grønn. PR #456
(2026-09-08) ble derfor auto-merget og deployet med en **high**-alert
(`js/incomplete-url-substring-sanitization`), som først ble fikset i #457. Målet er at en PR som
innfører en alvorlig sårbarhet stoppes automatisk, uten at noen må følge med — og at en stoppet
PR ikke blir liggende uten at noen får vite det.

**Krav / akseptansekriterier**
1. En PR mot main som innfører en ny CodeQL-alert med sikkerhetsalvorlighet **high eller critical**
   får `mergeStateStatus: BLOCKED`, også når alle påkrevde statussjekker er grønne. Det gjelder
   også PR-er fra auto-merge-stiene (`auto-pr.yml`, `dependabot-auto-merge.yml`,
   `scheduled-audit.yml`). `BLOCKED` brukes som proxy for at auto-merge venter. At `gh pr merge
   --auto` faktisk venter, er ikke testet direkte: det følger av GitHub-docs.
2. Regelen blokkerer også mens CodeQL-analysen pågår og når verktøyet ikke har rapportert.
   Dette hviler på GitHub-docs («Available rules for rulesets»). Det kan ikke isoleres empirisk,
   fordi `ci-ok` uansett er ferdig 1,5–2,5 min etter CodeQL.
3. Medium/low sikkerhetsalerts blokkerer ikke. Ikke-sikkerhetsalerts blokkerer kun på nivå
   `error`. Dette hviler på konfigurasjonen og GitHub-docs og testes ikke empirisk.
4. PR-er uten nye alerts merges som før, uten ekstra manuelle steg.
5. En falsk positiv kan låses opp ved å avvise alerten i Security-fanen med begrunnelse. Det er
   verifisert empirisk at dismiss gir `BLOCKED` → `CLEAN`, og veien er dokumentert i
   `docs/architecture/sikkerhet.md`.
6. **Vakt for fastlåste PR-er:** en åpen PR med auto-merge som ikke er merget etter 6 timer,
   gir én issue (etikett `pr-stuck`, @ahaarrestad) som lukkes automatisk når det ikke lenger
   finnes slike PR-er. Det dekker CodeQL-blokkering, rød `ci-ok`, hengende CodeQL og en
   codeql-action-bump som får nye spørringer. Vakta følger samme mønster som `uptime-check.yml`.

**Non-goals**
- osv-scanner gjøres **ikke** til påkrevd verktøy. Den laster opp til code scanning kun fra
  `scheduled-audit.yml` på main (schedule/workflow_dispatch) og kjører ikke på PR-er, så den
  ville blokkert alle PR-er. Dependabot- og osv-alerts blokkerer altså ikke merge; det er
  scheduled-audit og Dependabot som håndterer dem.
- Ingen opprydding i den gamle branch protection (`unit-tests`/`e2e-tests`/`build`, strict,
  enforce_admins). Det er en egen sak.
- Ingen endring for eksisterende alerts på main (0 åpne per 2026-10-20).
- `auto-pr.yml`, `dependabot-auto-merge.yml` og `scheduled-audit.yml` endres ikke, fordi
  `gh pr merge --auto` respekterer rulesettet.

**Designvalg.** Vi bruker ruleset-regelen `code_scanning` («Require code scanning results»), ikke
`CodeQL`-check-runen som påkrevd statussjekk:
- Terskelen kan settes til high_or_higher. Check-runen blir rød også på lavere nivåer.
- Regelen blokkerer mens analysen pågår og når verktøyet mangler, så auto-merge kan ikke smette
  gjennom før CodeQL er ferdig.
- Terskelen ble valgt av brukeren 2026-10-20: security `high_or_higher`, alerts `errors`.
  Alert #5 fra #456 hadde security severity high og `rule.severity` warning. Den fanges altså
  bare av `security_alerts_threshold`, og det er nok.

Vakta er tatt med fordi en blokkert PR ellers er stille. Uten den ville en Dependabot- eller
sikkerhetsfiks-PR stoppe uten at noen merket det, og det strider mot målet om å være minst
mulig involvert. Den sjekker «auto-merge på og fortsatt åpen etter 6 t», ikke årsaken. Dermed
fanger den alle varianter av fastlåsing med én enkel regel. Normalt merges en auto-merge-PR på
under 5 minutter.

## Plan

Steg 2 og 4 er skriving utenfor repoet. Før hvert av dem stopper jeg, viser nøyaktig hva som
skal skje og venter på eksplisitt godkjenning.

1. **Backup** (strippet til felter PUT godtar):
   ```bash
   gh api repos/ahaarrestad/tennerogtrivsel_new/rulesets/11887929 \
     --jq '{name,target,enforcement,conditions,rules,bypass_actors}' > <scratchpad>/ruleset-backup.json
   ```
2. **⏸ Godkjenning, deretter endre rulesettet «Status Checks» (id 11887929)** med
   `gh api -X PUT`. PUT erstatter `rules`-arrayen, så payloaden bygges med jq fra backupen
   (eksisterende `deletion`, `non_fast_forward`, `required_status_checks` [build, ci-ok] uendret)
   pluss:
   ```json
   {"type": "code_scanning", "parameters": {"code_scanning_tools": [
     {"tool": "CodeQL", "security_alerts_threshold": "high_or_higher", "alerts_threshold": "errors"}]}}
   ```
   Verktøynavnet `CodeQL` er bekreftet fra `code-scanning/analyses` (`.tool.name`). Les
   rulesettet tilbake og sammenlign med backupen med `jq`-diff: kun den nye regelen skal være
   lagt til.
3. **Repo-endringer i worktree → PR via `/commit`** (denne PR-en er også kontrollprøven for
   kriterium 4: den skal merges automatisk med regelen aktiv):
   - `.github/workflows/stuck-pr-watch.yml` (ny):
     - Kjøres hver 3. time og ved `workflow_dispatch` med input `min_age_hours` (standard 6).
       Inputen gjør det mulig å teste med 0.
     - Bruker `gh pr list --state open --json number,title,url,autoMergeRequest,mergeStateStatus` og
       filtrerer på `autoMergeRequest.enabledAt` eldre enn grensen (ikke `updatedAt`, som
       kommentarer nullstiller).
     - Etikett `pr-stuck`. Finnes det treff og ingen åpen issue, opprettes én (dedupe). Er det
       ingen treff, lukkes åpne `pr-stuck`-issues.
     - Kjøringen er grønn i begge tilfeller. Permissions er `contents: read`,
       `pull-requests: read` og `issues: write`.
   - `.github/workflows/codeql.yml`: `timeout-minutes: 360` → `30`. Analysen tar ~1 min, så en
     hengende kjøring skal feile raskt i stedet for å holde PR-en i 6 t. En feilet analyse
     blokkerer fortsatt, og der tar vakta over.
   - `docs/architecture/sikkerhet.md`, rett etter avsnittet «PR-porten er `ci-ok`, ikke `build`»:
     - Ny seksjon om CodeQL-porten: regel-JSON-en, terskel og hva den *ikke* dekker.
       - Den gjelder kun CodeQL, ikke osv/Dependabot.
       - Kun alerts der alle linjene ligger i PR-diffen teller. En ny dataflyt-sink i uendret kode
         blokkerer altså ikke.
     - At det er to beskyttelseslag: rulesettet (build + ci-ok + code_scanning) og den klassiske
       branch protection.
     - At regelen kan kreve resultater også for main-hodet.
     - Dismiss-vei med konkrete grunner: «False positive», «Used in tests», «Won't fix», alltid
       med kommentar.
     - **Nødopplåsing:** Settings → Rules → «Status Checks» → fjern code scanning-regelen eller
       sett enforcement til `Evaluate`, alternativt PUT med backup-JSON-en.
   - Samme fil: oppdater «CI avgjør om den merges» til «CI og CodeQL», nevn CodeQL i
     Dependabot-tabellen, og legg `stuck-pr-watch.yml` inn i «Selvhelende drift»-tabellen.
   - Legg `pr-stuck` inn i etikettlista i `/helsesjekk`.
   - Kvalitetsport: workflow-filene er ikke dokumentasjon, så porten kjøres.
4. **⏸ Godkjenning, deretter empirisk probe** (uten `git push`, alt via GitHub API, etter at PR-en
   fra steg 3 er merget):
   1. Opprett branch `test/codeql-gate` fra main (ikke under `review/**`). Legg til
      `scripts/codeql-gate-probe.js` med #456-formen inne i en funksjon:
      ```js
      export function velgReferer(request) {
        var host = ((request.headers.host && request.headers.host.value) || '').toLowerCase();
        return host.indexOf('aarrestad.com') !== -1 ? 'test' : 'prod';
      }
      ```
      Åpne en PR **uten** auto-merge.
   2. Forvent at CodeQL rapporterer `js/incomplete-url-substring-sanitization` (high) på PR-en og
      at `gh pr view --json mergeStateStatus` er `BLOCKED` etter at `ci-ok` og `build` er grønne.
      Det verifiserer kriterium 1.
   3. Test vakta: `gh workflow run stuck-pr-watch.yml -f min_age_hours=0` uten auto-merge på
      PR-en gir ingen issue. Deretter aktiveres auto-merge på probe-PR-en, og en ny kjøring skal
      åpne en `pr-stuck`-issue. Så slås auto-merge av igjen (`gh pr merge --disable-auto`), og en
      ny kjøring skal lukke issuen. Det verifiserer kriterium 6. Auto-merge er av før neste steg.
   4. Kausal sjekk: dismiss probe-alerten («Used in tests», kommentar «CodeQL-gate-probe, #13»).
      Forvent `BLOCKED` → `CLEAN`. Det verifiserer kriterium 5 og viser at det var regelen som
      blokkerte.
   5. Lukk PR-en uten merge og slett branchen. Alerten hører til branchen og forsvinner med den.
   - Feiler proben, rulles rulesettet tilbake med backupen, og docs rettes i en oppfølgings-PR.
5. **Arkiver** TODO-oppgaven og planen etter at proben er grønn, med `/commit` → review → push.

TODO og arkiv havner dermed i en egen liten docs-PR etter proben. Den første PR-en kan ikke
arkivere en oppgave som ikke er verifisert.

**Filer:** `.github/workflows/stuck-pr-watch.yml` (ny), `.github/workflows/codeql.yml`,
`docs/architecture/sikkerhet.md`, `.claude/skills/helsesjekk/SKILL.md`,
`TODO.md`, `TODO-archive.md` og denne planen.
GitHub-rulesettet endres utenfor repoet.

**Test / definition of done**
- Rulesettet inneholder `code_scanning`-regelen med riktig terskel, og øvrige regler er uendret
  (jq-diff mot backup).
- PR-en fra steg 3 merges automatisk med regelen aktiv.
- Probe-PR-en var `BLOCKED` med high-alert og ble `CLEAN` etter dismiss. Den er ryddet bort.
- Vakta åpnet og lukket `pr-stuck`-issuen i proben.
- Kvalitetsporten er grønn for PR-en fra steg 3. Arkiv-PR-en er kun docs, så porten hoppes
  over der.

**Risiko**
- *CodeQL feiler eller henger på en PR* (GitHub-utfall) → PR-en blokkeres. Det aksepteres: kjør
  jobben på nytt. Timeout på 30 min gir rask feil, og vakta varsler etter 6 t.
- *Falske positiver stopper deployen.* Avbøtes av terskelen (kun high+), den dokumenterte
  dismiss-veien og nødopplåsingen.
- *codeql-action-bump med nye spørringer* kan finne en high i eksisterende kode. Den teller bare
  hvis alle linjene ligger i diffen, og bump-PR-en endrer bare workflow-filen. Blir den
  likevel blokkert, varsler vakta.
- *Uverifisert: resultater for main-hodet.* Docs sier at det trengs resultater for både commit
  og ref. En feilet CodeQL-kjøring på main kan derfor tenkes å blokkere alle PR-er. Vakta
  fanger det, og løsningen er å kjøre CodeQL på main på nytt.
- *PUT erstatter hele `rules`* → payloaden bygges fra backupen, diffes etterpå, og backupen er
  tilbakerulling.
- *Dependabot-PR-er som kun gjelder `github_actions`:* CodeQL kjører begge språk på alle PR-er
  (ingen `paths`-filter). Det er bekreftet på de siste 40 PR-ene, så det blir ingen
  «mangler resultat»-blokkering.
- *Vakta selv:* den måler tid siden auto-merge ble slått på (`enabledAt`). En PR som får
  auto-merge slått av og på igjen, starter klokka på nytt. Det aksepteres.
