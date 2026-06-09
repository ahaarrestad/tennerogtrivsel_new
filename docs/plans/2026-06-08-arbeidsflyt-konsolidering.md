# Plan: Konsolidering av arbeidsflyt (skills, hooks, memory)

**Dato:** 2026-06-08
**Oppgave:** Gjøre TODO-oppgaveflyten selvgående og deterministisk — fjerne duplisering,
flytte «hvordan/rekkefølge» fra feedback-minner inn i skills/hooks, og lukke gjenstående gap.
**Opprinnelse:** Brukerønske om at en TODO-oppgave skal kunne gjennomføres skikkelig og
selvstendig uten at brukeren må mase om de samme reglene gang på gang.

## Mål og avgrensninger

Gjøre den eksisterende orkestreringen (som allerede stort sett ligger i `todo`-skillen)
til **én håndhevet sannhetskilde**, slik at flyten «glir av seg selv». I dag er reglene
spredt over `todo`-skill + `commit`-skill + ~10 feedback-minner, og håndhevingen hviler på
at agenten *husker* minnene.

**Ikke med:**
- Endring av selve `git-review`-scriptet (`~/bin/git-review`) — det fungerer som det skal.
- Endring av kvalitetsporten (tester/coverage/e2e/build/audit) i commit Step 2.5 — beholdes.
- Endring av PR-/review-modellen på GitHub-siden.
- Ny funksjonalitet i selve nettstedet.

## Avgjørelser (fra brainstorming 2026-06-08)

1. **Push-modell:** Merge til **lokal main**, kjør `git-review` derfra. Gir lineær
   historikk og clean tree.
2. **Hook-nivå:** Blokker rå `git push` + **advar** (ikke blokker) ved `git commit` på `main`.
3. **Permissions:** Kjør `/fewer-permission-prompts` som egen, etterfølgende prosess.
4. **«Ship it» legges i `/commit` Step 5**, slik at ALT git fortsatt går via /commit
   (jf. [[feedback_git_workflow]]).

## Den kanoniske flyten (mål-tilstand)

```
1.  /todo start  →  plan  →  plan-review (5 kriterier, finnes alt)  →  brukergodkjenning
2.  SYNK MAIN:  git checkout main && git pull --rebase origin main      ← NYTT
3.  Opprett worktree fra synket main  →  flytt oppgave til Pågående
4.  Implementer (TDD / subagent)
5.  review-loop til CLEAN
6.  ARKIVER TODO (marker ferdig + flytt til archive + arkiver plan)     ← FØR commit
7.  /commit: kvalitetsport → commit → code-review-loop til CLEAN
8.  Rebase worktree på LOKAL main → merge --ff-only → ExitWorktree       ← NYTT (clean tree)
9.  Brukergodkjenning  →  git-review fra main  →  PR  →  pull
```

## Konkrete steg

### A. `todo`-skill — orkestrering som sannhetskilde
Fil: `.claude/skills/todo/SKILL.md`
- **Fase 2 (worktree):** Legg til synk-main-steg *før* `superpowers:using-git-worktrees`:
  `git checkout main && git pull --rebase origin main`. Begrunnelse inline (to grunner):
  (a) `EnterWorktree` brancher fra `origin/main` (fresh), og det er **`fetch`-delen** av
  pull som gjør den basen fersk; (b) lokal main må være oppdatert for den senere
  `merge --ff-only` i Step 8.
- **Arkiver-TODO som eksplisitt gate** (nytt nummerert steg) *før* `/commit` foreslås —
  i dag kun et minne ([[feedback_oppgaveflyt]]).
- **Ny avslutningsfase** som beskriver «ship it»-sekvensen, men delegerer selve
  git-mekanikken til `/commit` Step 5 (under).

### B. `commit`-skill — «ship it» + deduplisering
Fil: `.claude/skills/commit/SKILL.md`
- **Step 4.5 (code review):** Erstatt den inline-kopierte reviewer-prompten med en
  referanse til delt fil (se D).
- **Step 2.5 / Step 5 (dev:secure-oppstart):** Trekk ut den **dupliserte** bash-blokken
  (2 fulle boot-blokker: Step 2.5 E2E + Step 5 push) til ett referert script
  (f.eks. `.claude/skills/_shared/start-secure-server.sh`) og kall det fra begge steder.
- **Step 5 (push → «ship it»):** Utvid til full sekvens når push er godkjent:
  1. I worktree: `git rebase main` (rebase på **lokal** main, ikke bare origin/main).
  2. Merge `--ff-only` inn i lokal main — **se kjent risiko under** ang. hvor merge kjøres fra.
  3. `ExitWorktree` (fjern worktree → clean tree).
  4. `git-review` fra main.

### C. Hooks — deterministisk sikkerhetsnett
Filer: `.claude/settings.local.json` (hooks-blokk) + `.claude/hooks/git-guard.sh`
- `PreToolUse` på `Bash`, script som leser kommandoen:
  - Matcher `git push` (men ikke `git-review`) → **deny** med melding «Bruk git-review via /commit».
  - Matcher `git commit` mens `git rev-parse --abbrev-ref HEAD` == `main` → **tillat**, men
    skriv ⚠-advarsel «du committer på main — er du i worktree?».
- Hold scriptet idempotent og rask; ingen sideeffekter utover exit-kode + stderr-melding.

### D. Delt reviewer-prompt
Fil: `.claude/skills/_shared/reviewer-prompt.md` (ny)
- Inneholder den felles «Senior Code Reviewer»-prompten (prosjektregler + git-range-mal).
- `review-loop` og `commit` Step 4.5 refererer denne i stedet for å kopiere den.

### E. Memory-opprydding
Mappe: `~/.claude/projects/-home-asbjorn-IdeaProjects-tennerogtrivsel2/memory/`
- Slå sammen `feedback_git_workflow.md` + `feedback_review_before_push.md` → ett minne
  (regel + hvorfor; «hvordan» ligger nå i skill + hook).
- Slå sammen `feedback_worktree.md` + `feedback_worktree_file_copy.md` +
  `feedback_worktree_rebase_before_push.md` → ett `feedback_worktree_flow.md` som peker til
  todo-skillen.
- Slett `feedback_e2e_before_commit.md` som eget minne (håndheves av commit Step 2.5) —
  behold leksjonen som én linje i det sammenslåtte git-minnet.
- Oppdater `MEMORY.md`-indeksen tilsvarende.

### F. Permissions (egen prosess, kjøres til slutt)
- Kjør `/fewer-permission-prompts` for å skanne transcripts og foreslå en ryddet,
  frekvenssortert allowlist. Fjern søppel-oppføringer (`Bash(done)`, `Bash(do echo:*)`,
  enkeltstående `sed -n`-snippets) i `settings.local.json`.

## Testbehov / Definition of done

Dette er meta-tooling (skills/hooks/memory), ikke kjernekode — 80%-coverage-porten gjelder
ikke. Verifisering i stedet:
- **Hook:** Manuell test — `git push` blokkeres med riktig melding; `git commit` på main gir
  advarsel men kjøres; `git commit` i worktree er stille OK; `git-review` blokkeres ikke.
- **Deduplisering:** `review-loop` og `commit` produserer identisk reviewer-prompt fra den
  delte filen; dev:secure-blokken finnes kun ett sted.
- **Skill-flyt:** Tørrkjør den kanoniske flyten mentalt mot en backlog-oppgave — hvert steg
  har en eier (skill eller hook), ingen steg hviler kun på et minne.
- **Memory:** `MEMORY.md` peker kun til eksisterende filer; ingen døde lenker; antall
  feedback-minner redusert fra 10 → ~6.

## Kjente risiki / usikkerheter

- **Merge fra worktree mens main er utsjekket:** Git tillater ikke samme branch i to
  worktrees. `git merge --ff-only <branch>` inn i main må derfor kjøres fra **primær-treet**
  (`git -C <primær-repo> merge --ff-only <branch>`), ikke inni worktreet. Den nøyaktige
  mekanikken (og om `ExitWorktree` kan gjøre noe av dette) avklares i implementasjonsplanen.
- **PR auto-merge-strategi (forutsetning som må bekreftes FØRST):** Hele «merge til lokal
  main»-modellen forutsetter at PR-en merges inn i `origin/main` med **bevarte SHA-er**
  (rebase- eller ff-merge). Ved **squash-merge** får origin/main nye SHA-er → lokal main
  divergerer → neste `git pull --rebase` gir duplikat-commits eller konflikt. Historikken
  ser SHA-bevarende ut (individuelle commit-meldinger, ingen `(#NN)`-squash-suffiks).
  **Verifisert 2026-06-09:** repoet har *alle tre* strategier aktivert (merge/rebase/squash),
  så SHA-bevaring er ikke håndhevet på repo-nivå — utfallet avgjøres av det som auto-merger
  PR-en. Implementasjonssteget MÅ finne hvilken workflow/action som auto-merger og bekrefte
  (eller pinne) rebase/ff. Hvis squash er påkrevd:
  revurder push-modellen (kjør `git-review` fra worktree i stedet, jf. alternativ 2 i
  brainstormingen).
- **Hook-falske positiver:** Match presist på `git push` til branch. `git-review` sin
  interne `git push` er en subprosess inni scriptet — aldri et eget Bash-verktøykall — så
  `PreToolUse` ser den aldri og kan ikke blokkere den. Vær obs på legitime edge-cases
  (f.eks. `git push --tags`) hvis slike finnes.
- **Plan-review finnes allerede** i todo-skillen (Fase 1, steg 3) — sjekk at vi ikke
  dupliserer, men styrker/sikrer at den faktisk trigges (rotårsak: oppgaver startes ikke
  alltid via `/todo`).
