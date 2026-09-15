# Plan: Innholdsdeploy skal ikke blokkeres av avvik som ikke kan handles på

- **Dato:** 2026-09-15
- **Status:** Til godkjenning
- **Spec:** [docs/designs/2026-09-15-innholdsdeploy-blokkering.md](../designs/2026-09-15-innholdsdeploy-blokkering.md)
- **Branch:** `fix/innholdsdeploy-blokkering` (worktree opprettes i Fase 2)

## Mål og avgrensninger

**Mål:** Audit-gaten i `deploy.yml` blokkerer ikke `repository_dispatch`-stien, men funnet
rapporteres som en GitHub-issue. Scheduled audit heves fra ukentlig til daglig.

**Ikke med:** E2E-gaten, `--audit-level`-nivået i `deploy.yml`, `package.json`-gulv,
`npm audit signatures`. Begrunnelser står i spec-ens avgrensninger.

## Steg

### Steg 1 — `build`-jobben blir ikke-blokkerende på dispatch (`.github/workflows/deploy.yml`)

Audit-steget (linje ~175) får `id` og et betinget `continue-on-error`:

```yaml
      - name: Check for critical vulnerabilities
        id: audit
        # Blokkerer på push/PR, der avhengighetstreet faktisk kan endres. På
        # repository_dispatch er lockfilen identisk med den som alt kjører i prod, så en
        # blokkering hindrer bare innholdspublisering — den fjerner ingen sårbarhet.
        # Funnet går ikke tapt: steget under oppretter en issue.
        continue-on-error: ${{ github.event_name == 'repository_dispatch' }}
        run: npm audit --audit-level=critical
```

`continue-on-error` er ett av de få steg-feltene som tar imot uttrykk. Ved
`continue-on-error` blir `steps.audit.outcome` = `failure` mens `conclusion` = `success` —
det er `outcome` steg 2 leser.

### Steg 2 — rapporteringssteg i `build` (samme fil, rett etter Steg 1)

```yaml
      - name: Rapporter avvik som ikke blokkerte deployen
        if: github.event_name == 'repository_dispatch' && steps.audit.outcome == 'failure'
        # Et tapt varsel er bedre enn en blokkert innholdsdeploy — se R4 i planen.
        continue-on-error: true
        env:
          GH_TOKEN: ${{ github.token }}
          TITTEL: '[sikkerhet] Kritisk npm-avvik oppdaget under innholdsdeploy'
        run: |
          npm audit --audit-level=critical > audit.txt 2>&1 || true
          {
            echo "### Kritisk npm-avvik — deployen ble IKKE stoppet"
            echo
            echo "Innholdsdeployen fikk gå gjennom med vilje: lockfilen er uendret fra den"
            echo "som alt kjører i prod. Avviket må likevel fikses."
            echo
            echo '```'
            cat audit.txt
            echo '```'
          } >> "$GITHUB_STEP_SUMMARY"

          EKSISTERENDE=$(gh issue list --state open --limit 100 --json number,title \
            -q ".[] | select(.title == \"$TITTEL\") | .number" | head -1)
          if [ -n "$EKSISTERENDE" ]; then
            echo "Åpen issue #$EKSISTERENDE finnes allerede — oppretter ikke ny."
            exit 0
          fi

          gh issue create --title "$TITTEL" --body-file - <<BODY
          \`npm audit --audit-level=critical\` fant kritiske avvik under en innholdsdeploy
          (\`repository_dispatch: google_drive_update\`). Deployen ble **ikke** stoppet —
          se [spec]($GITHUB_SERVER_URL/$GITHUB_REPOSITORY/blob/main/docs/designs/archive/2026-09-15-innholdsdeploy-blokkering.md).

          Kjøring: $GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID

          \`\`\`
          $(cat audit.txt)
          \`\`\`
          BODY
```

Dedupliseringen bruker **eksakt tittelmatch** mot åpne issues, ikke `--search`, fordi
GitHubs tittelsøk er uskarpt og kan gi falske treff.

### Steg 3 — jobbrettigheter for `build` (samme fil)

`gh issue create` krever `issues: write`. Legg et jobbnivå-`permissions` på `build`:

```yaml
  build:
    needs: [unit-tests, e2e-tests, lint, type-check]
    permissions:
      contents: read
      issues: write
```

**Merk:** jobbnivå-`permissions` **erstatter** hele det toppnivå-settet
(`contents: read`, `pages: write`, `id-token: write`) for denne jobben. Verifisert at
`build` ikke bruker `pages`/`id-token`: stegene er checkout, setup-node, `npm ci`, de to
audit-stegene, `npm run sync`, `npm run build:ci` og `upload-artifact`. `deploy`- og
`update-lambda`-jobbene beholder toppnivå-settet uendret.

### Steg 4 — `update-lambda` blir ikke-blokkerende på dispatch (samme fil, linje ~357)

Samme `id: audit` + `continue-on-error`-uttrykk som Steg 1, men **uten** rapporteringssteg:
jobben auditerer samme lockfile i samme kjøring som `build`, så en issue til ville vært
duplikatstøy. En kort kommentar i YAML-en sier hvorfor.

### Steg 5 — daglig scheduled audit (`.github/workflows/scheduled-audit.yml`)

```yaml
    - cron: '0 6 * * *' # daglig 06:00 UTC
```

### Steg 6 — dokumentasjon (`docs/architecture/sikkerhet.md`)

To avsnitt må oppdateres, begge er i dag direkte motsagt av endringen:

- **«npm-pakkesignatur-verifisering og audit-gate»** (linje ~310–324): YAML-utdraget vises
  uten `continue-on-error`, og teksten sier at gaten «feiler bygget». Legg til at gaten er
  betinget, og hvorfor.
- **«Kontinuerlig varsling — scheduled audit»** (linje ~339–350): tabellraden sier
  «ukentlig mandag 06:00 UTC». Endres til daglig. Avsnittet identifiserer allerede gapet
  («en ny CVE for en pakke som allerede er installert oppdages ikke før neste push») — det
  er nettopp gapet som traff 2026-09-15, og det bør nevnes eksplisitt.

### Steg 7 — TODO.md

- Flytt oppgaven fra Backlog til Pågående med spec- og plan-lenke.
- Legg observasjonen fra kjøring `35022298679` til under «Stabiliser ustabile tester»:
  `accessibility.spec.ts › Admin` feilet i CI (ikke bare lokalt), også ved retry, og blokkerte
  `build`/`deploy`/`update-lambda` på main. Det hever prioriteten på den oppgaven.

## Testbehov og definition of done

Endringen er ren CI-konfigurasjon — ingen kildekode berøres, så enhets- og E2E-dekning er
uendret. Kvalitetsporten kjøres likevel i `/commit` for å bekrefte at ingenting har flyttet
seg.

| # | Verifisering |
|---|--------------|
| V1 | YAML-en parser: `python3 -c "import yaml,sys; yaml.safe_load(open(f))"` på begge workflow-filene |
| V2 | Kvalitetsporten i `/commit` er grønn (unit + coverage + E2E + build + audit) |
| V3 | Etter merge: `push`-kjøringen på main er grønn, og `build`/`deploy`/`update-lambda` kjører som før (AK5) |
| V4 | Etter merge: en `repository_dispatch` fullfører og deployer (AK1, happy path) — enten ved en reell Drive-endring, eller `gh api repos/:owner/:repo/dispatches -f event_type=google_drive_update` |
| V5 | Feilgrenen (AK2–AK4) — se «Risiki» under; verifiseres ved gjennomlesing, eventuelt empirisk hvis brukeren vil |

**Definition of done:** AK1–AK7 i spec-en er oppfylt, V1–V4 er grønne, `review-loop`
rapporterer `REVIEW_LOOP: CLEAN`, og oppgaven er arkivert (Fase 5) før `/commit`.

## Kjente risiki og usikkerheter

**R1 — feilgrenen er vanskelig å teste realistisk.** Rapporteringssteget fyrer kun når
auditen faktisk feiler *på dispatch-stien*. Det krever et ekte kritisk avvik. En
`repository_dispatch` kjører alltid på default-branchen, så feilgrenen kan ikke prøves ut på
en feature-branch. Empirisk verifisering krever to midlertidige commits på main (bytt
audit-kommandoen til noe som avslutter med 1, dispatch, observer, revert). **Anbefaling:**
hopp over det. Logikken er seks linjer, og kostnaden er to støy-commits på main. Brukeren
avgjør — dette er det eneste åpne valget i planen.

**R2 — `continue-on-error` med uttrykk.** Feltet støtter uttrykk, men skrivefeil gir stille
feil: et uttrykk som evaluerer til tom streng tolkes som `false`, og da blokkerer gaten som
før. Det ville vist seg som en blokkert dispatch — altså dagens oppførsel, ikke noe verre.
Fanges av V4.

**R3 — jobbnivå-`permissions` erstatter toppnivået.** Utelates `contents: read` i Steg 3,
feiler `actions/checkout`. Mitigert av at V3 kjører hele `build`-jobben etter merge.

**R4 — `gh issue create` kan feile** (rate limit, rettigheter). Steget har ikke
`continue-on-error`, så en feil her gjør `build` rød og stopper deployen — stikk i strid med
formålet. **Tiltak:** steget får `continue-on-error: true`. Et tapt varsel er bedre enn en
blokkert innholdsdeploy, og funnet ligger uansett i jobbsammendraget.

**R5 — issue-støy over tid.** Dedupliseringen hindrer duplikater mens issuen er **åpen**.
Lukkes den uten at avviket fikses, opprettes en ny ved neste dispatch. Det er ønsket
oppførsel: lukket issue = «håndtert».
