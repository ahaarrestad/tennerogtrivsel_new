# Start oppgave fra Backlog / Flytt oppgave til Pågående

> Denne fila lastes av `todo`-skillen når brukeren vil **starte/flytte en oppgave fra
> Backlog**. Følg flyten nedenfor fullt ut. Til slutt ligger «Marker oppgave som fullført»,
> som Fase 5 bruker.

Når brukeren ber om å starte eller flytte en oppgave fra Backlog — **aldri gå rett til implementasjon**.

**Fase 1: Spec + plan (ALLTID først — stopp her til brukeren godkjenner)**

Hver oppgave skal ha **både** en spec (hva/hvorfor) og en plan (hvordan). Begge
opprettes/hentes og reviewes før de presenteres — ingen oppgave starter på kun én av dem.

> **§0 — det er lov å bruke hodet.** For *veldig små, trivielle* oppgaver (f.eks. en
> enkelt tekstrettelse, en ettsetnings-endring) er det greit å ta snarveier: spec og plan
> kan slås sammen til noen få linjer i én og samme planfil under `docs/plans/`, i stedet for
> to separate dokumenter. Review-kriteriene gjelder fortsatt, men kan besvares kort. Velg
> denne snarveien bevisst og nevn for brukeren at du gjør det. Er du i tvil om oppgaven er
> «liten nok» — den er det sannsynligvis ikke; lag begge ordentlig.

1. Les `TODO.md` og finn oppgaven

2. **Spec (hva/hvorfor) — opprett eller hent.**
   - Har oppgaven en spec/design-doc (lenke i TODO.md)? Les den og oppsummer.
   - Hvis ikke: lag en. Bruk `superpowers:brainstorming` for å utforske behov og krav.
     En god spec inneholder minst:
     - Problem/mål: hvilket behov løses, og hvorfor
     - Krav og akseptansekriterier (hva må være sant for at oppgaven er løst)
     - Avgrensninger / non-goals (hva er eksplisitt *ikke* med)
     - Designvalg med begrunnelse (når relevant)
   - Skriv spec til `docs/designs/YYYY-MM-DD-<topic>.md` og lenk fra oppgaven i TODO.md.

3. **Plan (hvordan) — opprett eller hent.**
   - Har oppgaven allerede en planfil (lenke i TODO.md)? Les den og presenter et sammendrag.
   - Hvis ikke: lag en plan basert på spec-en. En god plan inneholder minst:
     - Mål og avgrensninger (hva er ikke med)
     - Konkrete steg med filer som berøres
     - Testbehov og definition of done
     - Kjente risiki eller usikkerheter
   - Skriv planfilen til `docs/plans/YYYY-MM-DD-<topic>.md` og oppdater oppgaven i TODO.md med lenken.

4. **Spec- og plan-review (alltid, ny eller eksisterende)**

   Gjennomgå **både** spec og plan mot kriteriene under *før* de presenteres for brukeren.
   For hvert punkt: skriv én setning om hvordan dokumentet oppfyller det, eller hva du la til
   for å oppfylle det.

   **Spec:**
   1. Problem/mål er klart formulert (hvilket behov, hvorfor)
   2. Krav og akseptansekriterier er konkrete og etterprøvbare
   3. Avgrensninger / non-goals er eksplisitte
   4. Designvalg er begrunnet (når relevant)
   5. Ingen åpne spørsmål som blokkerer planlegging

   **Plan:**
   1. Mål og avgrensninger er klare (hva er eksplisitt *ikke* med)
   2. Konkrete steg med navn på filer som berøres
   3. Testbehov definert (hvilke tester trengs, hva er definition of done)
   4. Kjente risiki eller usikkerheter er nevnt
   5. Ingen åpne spørsmål som blokkerer implementasjon

   Hvis ett eller flere kriterier ikke er oppfylt: fyll gapet i spec/plan **nå**. Presenter
   aldri en ufullstendig spec eller plan.

5. Presenter spec og plan og vent på eksplisitt godkjenning («ok», «kjør», «ser bra ut» el.l.)
   - Ikke gå videre til Fase 2 uten godkjenning — ikke anta stilltiende samtykke
   - Juster og presenter på nytt ved tilbakemelding — gjenta til brukeren godkjenner

**Fase 2: Synk main + opprett worktree (etter godkjent spec + plan)**

6. **Synk lokal main FØR worktree.** `EnterWorktree` brancher fra `origin/main` (baseRef
   `fresh`), og lokal main må være oppdatert for den senere `merge --ff-only` i `/commit`
   Step 5:
   ```bash
   git checkout main && git pull --rebase origin main
   git log --oneline origin/main..main   # skal være tom
   ```
   - `git pull --rebase` gjør basen fersk *og* holder lokal main i sync for `--ff-only`.
   - Hvis `origin/main..main` **ikke** er tom (upushede main-commits, f.eks. en plan-commit):
     de mangler i worktreet, siden `EnterWorktree` brancher fra `origin/main`. Rebase
     worktree-branchen på lokal main rett etter opprettelse (`git rebase main`) så de blir
     med — ev. push dem først.
7. Invoke `superpowers:using-git-worktrees` — sørger for isolert branch/worktree
8. Flytt oppgaven fra **Backlog** til **Pågående** i TODO.md
9. Bekreft hvilken branch/worktree som ble opprettet

**Fase 3: Implementasjon**

10. Start implementasjonen i henhold til godkjent plan

**Fase 4: Review-gate (ALLTID etter implementasjon — ingen unntak)**

Etter at implementasjonen er ferdig:

11. Sett følgende `/goal` i neste svar:
    ```
    /goal review-loop rapporterer REVIEW_LOOP: CLEAN
    ```
12. Invoke `review-loop` — kjører én review-pass, fikser Critical/Important issues og committer fiksen
13. `/goal`-systemet starter automatisk ny tur og kaller `review-loop` på nytt inntil betingelsen er møtt

**Fase 5: Arkiver TODO (FØR commit — eksplisitt gate)**

14. Når `review-loop` er ren: marker oppgaven ferdig og arkiver den **før** `/commit`
    foreslås. Følg «Marker oppgave som fullført» nedenfor (sett `[x]`, flytt til
    `TODO-archive.md`, arkiver plan/spec, oppdater lenker). Arkivering er ikke et
    etterskritt — det er en del av å fullføre oppgaven.

**Fase 6: Commit + «ship it»**

15. Foreslå `/commit`. Commit-skillen eier all git-mekanikk: kvalitetsport → commit →
    code-review-loop → (ved godkjent push) «ship it»-sekvensen i Step 5 (rebase på lokal
    main → `merge --ff-only` → `git-review` fra main → opprydding med `ExitWorktree`).
    Rekkefølgen er kritisk: merge MÅ skje før worktreet fjernes — se `/commit` Step 5c.

**Forbudt:** Foreslå `/commit` før (a) `/goal` har bekreftet at `review-loop` er ren **og**
(b) oppgaven er arkivert (Fase 5).

---

## Marker oppgave som fullført

Når en oppgave er ferdig:

1. **Avhengig av kontekst:**
   - **Som del av den løpende flyten (Fase 5):** arkiver *nå*, før `/commit`. Arkiv-endringene
     (TODO.md, flyttede plan/spec-filer) committes sammen med resten i den påfølgende
     `/commit`. Uncommittede endringer er forventet her — ikke blokker.
   - **Frittstående (oppgave fullført i en tidligere sesjon):** sjekk først at alt er
     committet og pushet:
     ```bash
     git status
     git log --oneline origin/main..HEAD
     ```
     Hvis det finnes uncommittede eller upushede endringer: påminn brukeren om å kjøre
     `/commit` (som inkluderer «ship it») før arkivering.
2. Les `TODO.md`
3. Endre `- [ ]` til `- [x]` på oppgaven
4. Legg til et kort sammendrag av hva som ble gjort (som underpunkter), basert på kontekst fra samtalen
5. Arkiver oppgaven:
   - Flytt oppgaven fra TODO.md til TODO-archive.md
   - Flytt planfilen til `archive/`-mappen under samme katalog som den ligger i:
     - `docs/plans/` → `docs/plans/archive/`
     - `docs/superpowers/plans/` → `docs/superpowers/plans/archive/`
   - Flytt eventuelle spec/design-docs til `archive/`-mappen under samme katalog:
     - `docs/designs/` → `docs/designs/archive/`
     - `docs/superpowers/specs/` → `docs/superpowers/specs/archive/`
   - Oppdater lenker i TODO-archive.md til de nye plasseringene
6. Bekreft oppdateringen
