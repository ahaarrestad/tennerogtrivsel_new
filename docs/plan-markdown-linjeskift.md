# Plan: Dobbelt linjeskift i markdown rendres ikke som mellomrom

**Status: Fullført**

## Kontekst

Markdown-innhold (meldinger, admin-preview) mistet avsnittsskift fordi **snarkdown** ikke laget `<p>`-tagger. Doble linjeskift (`\n\n`) ble konvertert til `<br />` i stedet for paragraf-elementer. CSS-en `.markdown-content.prose p { mb-6 }` traff aldri fordi `<p>` ikke eksisterte i output.

**Berørte steder:**
1. **Meldinger på forsiden** — `messageClient.js:27` brukte `snarkdown(aktiv.content)`
2. **Admin-preview (tjenester)** — `admin-editor-helpers.js:98` brukte snarkdown i EasyMDE `previewRender`
3. **Admin-preview (meldinger)** — `admin-editor-helpers.js:117` samme

**Ikke berørt:** Tjeneste-sider (`/tjenester/[id].astro`) bruker Astro's innebygde `render()` med remark/rehype — fungerte korrekt allerede.

## Løsning: Erstattet snarkdown med marked

`snarkdown` var en minimalistisk markdown-parser (80KB) uten paragraf-wrapping. Erstattet med `marked`, standard CommonMark-parser som korrekt lager `<p>`-tagger.

## Gjennomførte steg

### Steg 1: Byttet dependency
- `npm uninstall snarkdown && npm install marked`

### Steg 2: Oppdaterte messageClient.js
- `import snarkdown from 'snarkdown'` → `import { marked } from 'marked'`
- `snarkdown(aktiv.content)` → `marked.parse(aktiv.content)`
- DOMPurify.sanitize wrapping beholdt

### Steg 3: Oppdaterte admin-editor-helpers.js
- `import snarkdown from 'snarkdown'` → `import { marked } from 'marked'`
- Begge `previewRender`-funksjoner: `snarkdown(plainText)` → `marked.parse(plainText)`

### Steg 4: Oppdaterte tester
- 7 testfiler: `vi.mock('snarkdown', ...)` → `vi.mock('marked', ...)`
- Mock: `{ marked: { parse: vi.fn(text => '<p>' + text + '</p>') } }`

### Steg 5: Verifisert
- 816+ enhetstester bestått, ≥80% branch coverage for alle filer
- Bygg OK (`npm run build:ci`)
