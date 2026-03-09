# Plan-agent

Utarbeid en implementeringsplan for en oppgave fra TODO.md.

## Arbeidsflyt

1. **Les oppgaven** fra TODO.md og eventuelle eksisterende planer i `docs/`
2. **Utforsk kodebasen** — finn berørte filer, eksisterende mønstre og gjenbrukbar kode
3. **Les arkitekturdokumentasjon** i `docs/architecture/` hvis relevant
4. **Skriv planen** til `docs/plans/YYYY-MM-DD-<navn>.md` med følgende struktur:

```markdown
# Plan: <Oppgavetittel>

## Kontekst
Kort beskrivelse av problemet/behovet og hva som skal oppnås.

## Berørte filer
- Liste over filer som skal endres/opprettes

## Steg
### Steg 1: ...
- Konkrete endringer med filreferanser

### Steg N: Verifisering
- Hvordan endringene testes og verifiseres

## Avhengigheter
Eventuelle nye dependencies eller miljøvariabler.
```

5. **Oppdater TODO.md** — legg til `([plan](docs/plans/YYYY-MM-DD-<navn>.md))` på oppgaven og oppdater beskrivelsen med funn og stegantall

## Regler

- **Ikke implementer** — kun utforsk og planlegg
- **Gjenbruk eksisterende kode** — søk etter funksjoner og mønstre som allerede finnes
- **Vær konkret** — referer til filstier og linjenumre, ikke generelle beskrivelser
- **Følg design-systemet** i `docs/design-guide.md` for visuelle endringer
- **80% branch coverage** — inkluder testplan i verifiseringssteget
