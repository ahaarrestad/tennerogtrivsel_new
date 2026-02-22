---
name: todo
description: "Vis og administrer prosjektets TODO-liste (TODO.md). Bruk når brukeren sier 'todo', 'TODO', 'oppgaveliste', 'vis oppgaver', 'backlog', 'hva gjenstår', 'neste oppgave', 'legg til oppgave', 'ny oppgave', 'flytt oppgave', 'marker ferdig', eller spør om status på oppgaver."
disable-model-invocation: false
allowed-tools: ["Read(TODO.md)", "Edit(TODO.md)", "Glob(docs/**)", "Read(docs/**)"]
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
1. Kort tittel for første oppgave
2. Kort tittel for andre oppgave
3. ...

### Fullført (Y oppgaver)
- Vis kun antall, ikke hele listen
```

Hold det kort og oversiktlig. Ikke gjenta hele filen.

---

### Legg til oppgave

Hvis brukeren vil legge til en ny oppgave:

1. Les `TODO.md`
2. Spør om oppgaven skal i **Backlog** eller **Pågående** (om ikke spesifisert)
3. Legg til oppgaven i riktig seksjon med format:
   ```markdown
   - [ ] **Kort tittel**
     - Beskrivelse/detaljer som underpunkter
   ```
4. Bekreft at oppgaven er lagt til

---

### Flytt oppgave til Pågående

Når en oppgave skal startes:

1. Les `TODO.md`
2. Flytt oppgaven fra **Backlog** til **Pågående**
3. Følg arbeidsflyten i TODO.md:
   - Lag en plan først (eller bekreft at plan finnes)
   - Still avklarende spørsmål hvis noe er uklart
4. Bekreft flyttingen

---

### Marker oppgave som fullført

Når en oppgave er ferdig:

1. Les `TODO.md`
2. Endre `- [ ]` til `- [x]` på oppgaven
3. Flytt oppgaven fra **Pågående** til **Fullført**
4. Legg til et kort sammendrag av hva som ble gjort (som underpunkter), basert på kontekst fra samtalen
5. Bekreft oppdateringen

---

### Oppdater oppgave

Hvis brukeren vil legge til notater, deloppgaver eller endre beskrivelse:

1. Les `TODO.md`
2. Gjør den ønskede endringen
3. Bekreft oppdateringen

---

## Regler

- **Bevar formatering**: TODO.md bruker et spesifikt format med `- [ ]`/`- [x]`, bold titler og innrykk. Bevar dette.
- **Ikke slett fullførte oppgaver**: De er historikk og skal forbli i Fullført-seksjonen.
- **Arbeidsflyt-seksjonen øverst skal ikke endres**: Den beskriver prosessen og er fast.
- **Planer under `/docs`**: Hvis en oppgave har en plan, link til den (f.eks. `([plan](docs/plan-navn.md))`).
- **Spør ved tvetydighet**: Hvis det er uklart hvilken oppgave brukeren refererer til, list opp alternativene og spør.
