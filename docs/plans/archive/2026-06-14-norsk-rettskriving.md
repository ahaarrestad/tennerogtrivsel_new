# Plan: Norsk rettskriving i dokumentasjon

**Dato:** 2026-06-14
**Kilde:** Backlog-oppgave fra PR-review #367/#368

## Mål og avgrensninger

Rette et sett konkrete stavefeil og konsistensbrister i to dokumentfiler — rent kosmetisk/konsistens, ingen funksjonell endring. Alt annet i samme filer er utenfor scope.

## Filer og konkrete endringer

### `docs/architecture/sikkerhet.md`

| Linje | Fra | Til |
|-------|-----|-----|
| 122 | «scanner `dist/**/*.html`» | «skanner `dist/**/*.html`» |
| 297 | «på root og `lambda/kontakt-form-handler`» | «i rotmappen og `lambda/kontakt-form-handler`» |
| 298 | «scanner begge `package-lock.json` rekursivt» | «skanner begge `package-lock.json`-filene rekursivt» |
| 300 | «Nivå-forskjell» | «Nivåforskjell» (sammensatt ord, ingen bindestrek) |
| 300 | «Scheduled-workflow er» | «Scheduled-workflowen er» (bestemt form) |

### `TODO-archive.md`

Grep-verifisert: oppføringen ligger nå på linje 69 (ikke 17 slik task-beskrivelsen oppga — arkivet har vokst siden oppgaven ble skrevet).

| Linje | Fra | Til |
|-------|-----|-----|
| 69 | «eget job i» | «egen jobb i» (anglisisme → bokmål; «jobb» er hankjønn → «egen», ikke «eget») |
| 69 | «— scanner begge» | «— skanner begge» |

## Testbehov og definition of done

- Alle 5 tekstbytter gjort
- `npm run build:ci` passerer (ingen tekst i disse filene påvirker build)
- Vitest og E2E uberørt (docs-only-endringer)
- DoD: ren `git diff` som kun viser de spesifiserte endringene, ingen andre

## Risiki og usikkerheter

- Svært lav risiko — ren søk-erstatt i Markdown
- Linjenumrene kan avvike marginalt hvis filen er endret siden oppgaven ble skrevet — Edit-verktøyet bruker streng-matching, ikke linjenummer, så dette er ikke noe problem i praksis
