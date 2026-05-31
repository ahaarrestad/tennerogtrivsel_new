---
name: todo
model: sonnet
description: "Vis og administrer prosjektets TODO-liste (TODO.md). Bruk når brukeren sier 'todo', 'TODO', 'oppgaveliste', 'vis oppgaver', 'backlog', 'hva gjenstår', 'neste oppgave', 'legg til oppgave', 'ny oppgave', 'flytt oppgave', 'marker ferdig', 'start oppgave', 'begynn på', 'gjenoppta', 'fortsett med', eller spør om status på oppgaver."
disable-model-invocation: false
allowed-tools: ["Read(TODO.md)", "Read(TODO-archive.md)", "Edit(TODO.md)", "Edit(TODO-archive.md)", "Glob(docs/**)", "Read(docs/**)", "Write(docs/**)", "Bash(mv *)", "Bash(mkdir *)", "Bash(git *)", "Skill(superpowers:using-git-worktrees)", "Skill(review-loop)"]
---

# TODO-liste Skill

Administrer prosjektets TODO-liste i `TODO.md`. Listen følger et Kanban-mønster med tre seksjoner: **Pågående**, **Backlog** og **Fullført**.

## Kommandoer

Brukeren kan be om ulike handlinger. Finn ut hva de ønsker og utfør riktig steg.

---

### Vis status (standard)

Hvis brukeren bare sier "todo", "oppgaveliste" eller lignende uten spesifikk handling:

1. Les `TODO.md`
2. Presenter en oversikt:

```
## TODO-status

### Pågående
- (liste eller "Ingen oppgaver pågår")

### Backlog (X oppgaver)
1. **Kort tittel** ([plan](docs/plan-navn.md)) — kort beskrivelse
2. **Kort tittel** — *ingen plan ennå*
3. ...

Fullført historikk: se TODO-archive.md
```

Hold det kort og oversiktlig. Ikke gjenta hele filen. Inkluder alltid plan-lenken for oppgaver som har en, og merk oppgaver uten plan med «*ingen plan ennå*».

---

### Legg til oppgave

Hvis brukeren vil legge til en ny oppgave:

1. Les `TODO.md`
2. Legg alltid nye oppgaver i **Backlog** — aldri direkte i Pågående. For å starte en oppgave brukes «Start oppgave fra Backlog»-flyten som krever plan og godkjenning.
3. Legg til oppgaven med format:
   ```markdown
   - [ ] **Kort tittel** — *ingen plan ennå*
     - Beskrivelse/detaljer som underpunkter
   ```
   Plan-lenken (`([plan](docs/plans/...))`) legges til når planfilen er opprettet. Utelat den inntil da.
4. Bekreft at oppgaven er lagt til

---

### Start oppgave fra Backlog / Flytt oppgave til Pågående

Når brukeren ber om å starte eller flytte en oppgave fra Backlog — **aldri gå rett til implementasjon**.

**Fase 1: Plan (ALLTID først — stopp her til brukeren godkjenner)**

1. Les `TODO.md` og finn oppgaven
2. Har oppgaven allerede en planfil (lenke i TODO.md)?
   - **Ja:** Les planfilen og presenter et sammendrag. Spør om planen fortsatt er riktig, eller om noe skal justeres.
   - **Nei:** Lag en plan. Still avklarende spørsmål om scope, tilnærming og avgrensninger. En god plan inneholder minst:
     - Mål og avgrensninger (hva er ikke med)
     - Konkrete steg med filer som berøres
     - Testbehov og definition of done
     - Kjente risiki eller usikkerheter
   - Skriv planfilen til `docs/plans/YYYY-MM-DD-<topic>.md` og oppdater oppgaven i TODO.md med lenken.
3. **Plan-review (alltid, ny eller eksisterende)**

   Gjennomgå planen mot disse kriteriene *før* den presenteres for brukeren. For hvert punkt: skriv én setning om hvordan planen oppfyller det, eller hva du la til for å oppfylle det.

   1. Mål og avgrensninger er klare (hva er eksplisitt *ikke* med)
   2. Konkrete steg med navn på filer som berøres
   3. Testbehov definert (hvilke tester trengs, hva er definition of done)
   4. Kjente risiki eller usikkerheter er nevnt
   5. Ingen åpne spørsmål som blokkerer implementasjon

   Hvis ett eller flere kriterier ikke er oppfylt: fyll gapet i planfilen **nå**. Presenter aldri en ufullstendig plan.

4. Presenter planen og vent på eksplisitt godkjenning («ok», «kjør», «ser bra ut» el.l.)
   - Ikke gå videre til Fase 2 uten godkjenning — ikke anta stilltiende samtykke
   - Juster og presenter på nytt ved tilbakemelding — gjenta til brukeren godkjenner

**Fase 2: Opprett worktree (etter godkjent plan)**

5. Invoke `superpowers:using-git-worktrees` — sørger for isolert branch/worktree
6. Flytt oppgaven fra **Backlog** til **Pågående** i TODO.md
7. Bekreft hvilken branch/worktree som ble opprettet

**Fase 3: Implementasjon**

8. Start implementasjonen i henhold til godkjent plan

**Fase 4: Review-gate (ALLTID etter implementasjon — ingen unntak)**

Etter at implementasjonen er ferdig:

9. Sett følgende `/goal` i neste svar:
   ```
   /goal review-loop rapporterer REVIEW_LOOP: CLEAN
   ```
10. Invoke `review-loop` — kjører én review-pass, fikser Critical/Important issues og committer fiksen
11. `/goal`-systemet starter automatisk ny tur og kaller `review-loop` på nytt inntil betingelsen er møtt
12. Først når `/goal` bekrefter at betingelsen er møtt: foreslå `/commit`

**Forbudt:** Foreslå `/commit` før `/goal` har bekreftet at `review-loop` er ren.

---

### Gjenoppta pågående oppgave

Når brukeren vil fortsette på en oppgave som allerede er i **Pågående** (fra en tidligere sesjon):

**ALLTID første steg — ingen unntak:**

1. Kjør worktree-sjekk for å bekrefte at arbeidet skjer på riktig sted:
   ```bash
   GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
   GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
   git worktree list
   git branch --show-current
   ```
   - Hvis `GIT_DIR == GIT_COMMON`: vi er i hovedrepoet, IKKE i en worktree — stopp og korriger
   - Hvis `GIT_DIR != GIT_COMMON`: vi er allerede i en worktree — fortsett
2. Invoke `superpowers:using-git-worktrees` for å entre riktig worktree (eller opprette ny ved behov)
3. Bekreft hvilken branch/worktree som er aktiv før arbeidet begynner

**Aldri anta at worktree-oppsettet fra forrige sesjon er på plass — verifiser alltid.**

---

### Marker oppgave som fullført

Når en oppgave er ferdig:

1. Sjekk at alt er committet og pushet:
   ```bash
   git status
   git log --oneline origin/main..HEAD
   ```
   Hvis det finnes uncommittede eller upushede endringer: påminn brukeren om å kjøre `/commit` og `git review` før arkivering.
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

---

### Oppdater oppgave

Hvis brukeren vil legge til notater, deloppgaver eller endre beskrivelse:

1. Les `TODO.md`
2. Gjør den ønskede endringen
3. Bekreft oppdateringen

---

## Regler

- **Bevar formatering**: TODO.md bruker et spesifikt format med `- [ ]`/`- [x]`, bold titler og innrykk. Bevar dette.
- **Arbeidsflyt-seksjonen øverst skal ikke endres**: Den beskriver prosessen og er fast.
- **Følg arbeidsflyten i TODO.md** for plan-oppretting, arkivering og øvrige prosedyrer.
- **Spør ved tvetydighet**: Hvis det er uklart hvilken oppgave brukeren refererer til, list opp alternativene og spør.
