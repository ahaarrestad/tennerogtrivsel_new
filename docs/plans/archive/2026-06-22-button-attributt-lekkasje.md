# Button.astro: attributt-lekkasje til `<span>` (spec + plan)

> Liten, triviell oppgave — spec og plan er slått sammen i én fil per TODO-arbeidsflyt §0.

## Spec (hva/hvorfor)

### Problem/mål
`Button.astro` videresender alle ukjente props via `{...rest}` til det rendrede
elementet. `Tag` velges dynamisk:

- `interactive={false}` → `<span>`
- `href` satt → `<a>`
- ellers → `<button>`

Interaktive attributter (`type`, `disabled`, `target`, `rel`) ligger i `...rest` og
lekker dermed til tagger som ikke støtter dem:

- `type`/`disabled` på `<a>` og `<span>` → ugyldig HTML
- `target`/`rel` på `<button>` og `<span>` → ugyldig HTML

Flagget av Gemini-review på PR #380 (alvorlighet: medium).

### Krav / akseptansekriterier
1. `type` og `disabled` settes **kun** på `<button>`.
2. `target` og `rel` settes **kun** på `<a>`.
3. Ingen av disse fire attributtene rendres på `<span>` (`interactive={false}`).
4. Eksisterende oppførsel for `href`, `variant`, `class`, `aria-label` og slots er uendret.
5. Eksisterende kall (`KontaktKnapp`, `MessageButton`, `TelefonKnapp`) rendrer likt som før.

### Avgrensninger / non-goals
- Endrer ikke `Props`-grensesnittet (samme props tilbys utad).
- Ingen nye varianter eller funksjoner.
- Ingen kjente kall trigger feilen i dag — dette er robusthet, ikke en aktiv bug.

### Designvalg
Destrukturér `type`, `disabled`, `target`, `rel` eksplisitt ut av `Astro.props` slik at de
**ikke** lenger ligger i `...rest`, og sett dem betinget per tag via `class:list`-stil
attributt-spredning. Astro rendrer ikke attributter med verdi `undefined`, så betinget
verdi (`Tag === 'button' ? type : undefined`) er en ren og idiomatisk måte å gate dem på.

## Plan (hvordan)

### Berørte filer
- `src/components/Button.astro` — eneste kodeendring.

### Steg
1. Destrukturér `type`, `disabled`, `target`, `rel` eksplisitt i frontmatter slik at de
   fjernes fra `...rest`.
2. På `<Tag>`: sett
   - `type={Tag === 'button' ? type : undefined}`
   - `disabled={Tag === 'button' ? disabled : undefined}`
   - `target={Tag === 'a' ? target : undefined}`
   - `rel={Tag === 'a' ? rel : undefined}`
3. Behold `href={interactive ? href : undefined}` og resten uendret.

### Testbehov / definition of done (TDD — brukerkrav)
- Oppgaven gjøres **test-drevet**. Prosjektet har ingen `.astro`-komponenttester ennå, så
  vi innfører en Vitest-test som rendrer `Button.astro` via Astros
  `experimental_AstroContainer` og asserter på rendret HTML.
- Røde tester først (skal feile mot dagens kode):
  1. `interactive={false}` + `type`/`disabled`/`target`/`rel` → `<span>` uten noen av dem.
  2. `href` satt + `type`/`disabled` → `<a>` uten `type`/`disabled` (men med `target`/`rel`).
  3. Default (`<button>`) + `target`/`rel` → `<button>` uten `target`/`rel` (men med `type`/`disabled`).
  4. Regresjonsvern: `variant`, `class` og `aria-label` rendres som før på riktig tag.
- DoD: alle nye tester grønne, `npx astro check` grønn, full `build:ci` går gjennom, og
  eksisterende e2e (`accessibility`, `telefon-tab-rekkefolge`, `links`) er uendret grønn.
- Coverage: `Button.astro` er en presentasjonskomponent; de nye testene dekker alle tre
  tag-grenene + lekkasje-gating.

### Kjente risiki / usikkerheter
- Lav risiko: endringen fjerner attributter som ingen nåværende kall sender, så rendret
  output for dagens bruk er identisk.
- `class:list` + betinget attributt-spredning er etablert Astro-mønster; ingen kjent
  fallgruve.

---

## Review-sjekk (utført før presentasjon)

**Spec:**
1. Problem/mål klart — attributt-lekkasje til feil tagger, kilde PR #380.
2. Akseptansekriterier etterprøvbare — 5 konkrete punkter om hvilke attributter på hvilke tagger.
3. Non-goals eksplisitte — ingen API-endring, ingen nye funksjoner, ikke aktiv bug.
4. Designvalg begrunnet — eksplisitt destrukturering + betinget verdi, med Astro-`undefined`-oppførsel som rasjonale.
5. Ingen åpne spørsmål — løsningsmønster er gitt i TODO og bekreftet mot koden.

**Plan:**
1. Mål/avgrensning klart — kun `Button.astro`, robusthet ikke ny funksjon.
2. Konkrete steg med fil — `src/components/Button.astro`, eksakte attributt-uttrykk.
3. Testbehov definert — forklart hvorfor ingen ny enhetstest, DoD via astro check + build + e2e + manuell HTML-inspeksjon.
4. Risiki nevnt — lav, identisk output for dagens kall.
5. Ingen blokkerende åpne spørsmål.
