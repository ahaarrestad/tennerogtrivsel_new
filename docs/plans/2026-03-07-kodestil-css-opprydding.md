# Plan: Kodestil og CSS-opprydding

## Maal

Rydde opp i CSS og kodestil: fjerne udefinerte/ubrukte klasser, konsolidere duplikater, erstatte inline styles med utility-klasser, og sikre at koden folger design-guide.md.

## Tilnaerming

Kategori-for-kategori paa tvers av kodebasen. En commit per kategori. Moderat scope — fiks feil og erstatt inline styles, men ikke nye CSS-tokens for arbitrary values som map-hoyder eller z-index.

## Commits

### Commit 1: fix: erstatt udefinerte CSS-klasser

**Filer:**
- `src/pages/tannleger.astro` — `bg-brand-surface` -> `bg-brand-light` (linje ~37)
- `src/components/Tannleger.astro` — `bg-brand-surface` -> `bg-brand-light` (linje ~45)
- `src/pages/galleri.astro` — fjern `text-heading` og `text-body` fra class-attributter (linje ~22-23)

**Verifisering:**
- `/tannleger` — placeholder-bakgrunn paa kort uten bilde skal ha synlig lys farge
- `/galleri` — overskrift skal ha riktig farge og storrelse

---

### Commit 2: refactor: konsolider section-heading til h2

**Filer:**
- `src/styles/global.css` — fjern `.section-heading`-definisjonen (linje ~203-208)
- Alle komponenter som bruker `section-heading` — erstatt med `h2`

**Verifisering:**
- Alle sider med seksjonsoverskrifter — skal se identiske ut som for

---

### Commit 3: refactor: erstatt inline font-family styles med utility-klasser

**Filer:**
- `src/styles/global.css` — legg til `.font-heading` og `.font-body` om de ikke finnes (sjekk Tailwind v4 forst)
- `src/components/Footer.astro` — erstatt `style="font-family: var(--font-heading)"` med class (linje ~40, ~71)
- `src/pages/tjenester/[id].astro` — erstatt inline font-family (linje ~49, ~74)
- `src/components/Forside.astro` — erstatt inline `style="background-color: ...; color: ..."` med token-klasser (linje ~66, ~71)

**Verifisering:**
- Footer — "Kontakt" og "Aapningstider" skal ha Montserrat-font
- `/tjenester/[en tjeneste]` — brodtekst i Inter, overskrifter i Montserrat
- Forsiden — meldingsboks skal ha riktig bakgrunnsfarge og tekstfarge

---

### Commit 4: refactor: erstatt Tailwind arbitrary values

**Filer:**
- `src/components/Tannleger.astro` — `font-[800]` -> `font-extrabold` (linje ~51)
- `src/components/Kontakt.astro` — `rounded-3xl` -> `rounded-2xl` (linje ~133)

**Verifisering:**
- `/tannleger` — fellesbilde-tekst skal vaere bold
- `/kontakt` — kartet skal ha avrundede hjorner (litt mindre enn for)

---

### Commit 5: chore: fjern ubrukte CSS-klasser

**Filer:**
- `src/styles/global.css` — fjern `.brand-text` og `.layout-container`

**Verifisering:**
- Alle sider — ingen visuell endring

---

### Commit 6: docs: oppdater design-guide.md

**Filer:**
- `docs/designs/design-guide.md` — fjern/oppdater punkter om section-heading-duplikat og andre problemer vi har fikset

**Verifisering:**
- Les gjennom filen, bekreft at den reflekterer faktisk tilstand
