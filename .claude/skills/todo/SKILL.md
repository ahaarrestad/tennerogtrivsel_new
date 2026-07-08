---
name: todo
model: sonnet
description: "Vis og administrer prosjektets TODO-liste (TODO.md). Bruk når brukeren sier 'todo', 'TODO', 'oppgaveliste', 'vis oppgaver', 'backlog', 'hva gjenstår', 'neste oppgave', 'legg til oppgave', 'ny oppgave', 'flytt oppgave', 'marker ferdig', 'start oppgave', 'begynn på', 'gjenoppta', 'fortsett med', eller spør om status på oppgaver."
disable-model-invocation: false
allowed-tools: ["Read(TODO.md)", "Read(TODO-archive.md)", "Read(TODO-abandoned.md)", "Edit(TODO.md)", "Edit(TODO-archive.md)", "Edit(TODO-abandoned.md)", "Write(TODO-abandoned.md)", "Glob(docs/**)", "Read(docs/**)", "Write(docs/**)", "Read(.claude/skills/todo/references/**)", "Bash(mv *)", "Bash(mkdir *)", "Bash(git *)", "Skill(superpowers:brainstorming)", "Skill(superpowers:using-git-worktrees)", "Skill(review-loop)"]
---

# TODO-liste Skill

Administrer prosjektets TODO-liste i `TODO.md`. Listen følger et Kanban-mønster med tre seksjoner: **Pågående**, **Backlog** og **Fullført**.

## Ruting — finn riktig handling

Finn ut hva brukeren vil, og følg riktig rad. De tunge flytene ligger i egne referansefiler
for å holde denne skillen lett ved vanlig statusbruk.

| Brukeren vil … | Gjør |
|----------------|------|
| Se status / oversikt (standard) | Følg «Vis status» nedenfor (inline) |
| Legge til ny oppgave | Følg «Legg til oppgave» nedenfor (inline) |
| Oppdatere/endre en oppgave | Følg «Oppdater oppgave» nedenfor (inline) |
| Forkaste / droppe en oppgave (bruker vil *ikke* gjøre den) | Følg «Forkast oppgave» nedenfor (inline) |
| **Starte / flytte oppgave fra Backlog** | **Du MÅ først `Read references/start-oppgave.md`** og følge hele flyten der — ikke gå rett til implementasjon, ikke gjengi flyten fra hukommelsen |
| **Markere oppgave som fullført / arkivere** | **Du MÅ først `Read references/start-oppgave.md`** (delen «Marker oppgave som fullført») |
| **Gjenoppta pågående oppgave** | **Du MÅ først `Read references/gjenoppta.md`** og følge worktree-sjekken der |

Referansefilene er den autoritative kilden for disse flytene. Når en rad sier «Read … MÅ»,
les fila *før* du gjør noe annet — disse flytene har disiplin-gates (spec+plan-review,
worktree før impl., arkiver før commit) som ikke kan utføres riktig fra hukommelsen.

---

## Vis status (standard)

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

## Legg til oppgave

Hvis brukeren vil legge til en ny oppgave:

1. Les `TODO.md`
2. Legg alltid nye oppgaver i **Backlog** — aldri direkte i Pågående. For å starte en oppgave brukes «Start oppgave fra Backlog»-flyten (`references/start-oppgave.md`) som krever spec, plan og godkjenning.
3. Legg til oppgaven med format:
   ```markdown
   - [ ] **Kort tittel** — *ingen plan ennå*
     - Beskrivelse/detaljer som underpunkter
   ```
   Plan-lenken (`([plan](docs/plans/...))`) legges til når planfilen er opprettet. Utelat den inntil da.
4. Bekreft at oppgaven er lagt til

---

## Oppdater oppgave

Hvis brukeren vil legge til notater, deloppgaver eller endre beskrivelse:

1. Les `TODO.md`
2. Gjør den ønskede endringen
3. Bekreft oppdateringen

---

## Forkast oppgave

Hvis brukeren bevisst vil droppe en oppgave («jeg vil ikke gjøre denne», «dropp X», «forkast X») — altså *ikke* fullføre den, men heller ikke bare slette den sporløst:

1. Les `TODO.md` og finn oppgaven. Ved tvetydighet: list alternativene og spør.
2. Fjern oppgaven fra TODO.md (Backlog eller Pågående).
3. Legg oppgaven inn i `TODO-abandoned.md` med `[~]`-merke, dato og begrunnelse:
   ```markdown
   - [~] **Kort tittel** — *forkastet YYYY-MM-DD* ([plan](...)) ([spec](...))
     - Kort beskrivelse av hva oppgaven var
     - **Begrunnelse:** hvorfor den droppes (hva brukeren sa)
   ```
   Behold eventuelle plan-/spec-lenker. **La plan-/spec-filene ligge der de er** — de flyttes *ikke* til `archive/` (det er forbeholdt fullførte oppgaver).
4. Hvis `TODO-abandoned.md` ikke finnes ennå: opprett den med samme header-mønster som `TODO-archive.md` (tittel + kort forklaring som lenker til TODO.md og TODO-archive.md).
5. Bekreft flyttingen.

Skille mellom de tre endestasjonene:
- **Fullført** → `TODO-archive.md` (`[x]`), plan/spec flyttes til `archive/`.
- **Forkastet** → `TODO-abandoned.md` (`[~]`), plan/spec blir liggende.
- **Ren sletting** (feilopprettet e.l.) → bare fjern fra TODO.md, ingen arkivering. Bruk kun når brukeren eksplisitt ber om å slette sporløst.

---

## Regler

- **Bevar formatering**: TODO.md bruker et spesifikt format med `- [ ]`/`- [x]`, bold titler og innrykk. Bevar dette.
- **Arbeidsflyt-seksjonen øverst skal ikke endres**: Den beskriver prosessen og er fast.
- **Følg arbeidsflyten i TODO.md** for plan-oppretting, arkivering og øvrige prosedyrer.
- **Spør ved tvetydighet**: Hvis det er uklart hvilken oppgave brukeren refererer til, list opp alternativene og spør.
