# Plan: Dobbelt linjeskift i markdown rendres ikke som mellomrom

## Kontekst

Markdown-innhold (meldinger, admin-preview) mister avsnittsskift fordi **snarkdown** ikke lager `<p>`-tagger. Doble linjeskift (`\n\n`) konverteres til `<br />` i stedet for paragraf-elementer. CSS-en `.markdown-content.prose p { mb-6 }` treffer aldri fordi `<p>` ikke eksisterer i output.

**Berørte steder:**
1. **Meldinger på forsiden** — `messageClient.js:27` bruker `snarkdown(aktiv.content)` → ingen `<p>`-tagger
2. **Admin-preview (tjenester)** — `admin-editor-helpers.js:98` bruker snarkdown i EasyMDE `previewRender`
3. **Admin-preview (meldinger)** — `admin-editor-helpers.js:117` samme

**Ikke berørt:** Tjeneste-sider (`/tjenester/[id].astro`) bruker Astro's innebygde `render()` med remark/rehype — paragraf-håndtering fungerer korrekt der.

## Løsning: Erstatt snarkdown med marked

`snarkdown` er en minimalistisk markdown-parser (80KB) som ikke støtter paragraf-wrapping. `marked` er standard CommonMark-parser som korrekt lager `<p>`-tagger for avsnitt.

## Steg

### Steg 1: Bytt dependency
- `npm uninstall snarkdown && npm install marked`
- Oppdater `package.json`

### Steg 2: Oppdater messageClient.js
- **Fil:** `src/scripts/messageClient.js`
- Erstatt `import snarkdown from 'snarkdown'` → `import { marked } from 'marked'`
- Konfigurer marked: `marked.setOptions({ breaks: false, gfm: true })`
- Linje 27: `snarkdown(aktiv.content)` → `marked.parse(aktiv.content)`
- DOMPurify.sanitize wrapping beholdes

### Steg 3: Oppdater admin-editor-helpers.js
- **Fil:** `src/scripts/admin-editor-helpers.js`
- Erstatt `import snarkdown from 'snarkdown'` → `import { marked } from 'marked'`
- Linje 98 (tjenester preview): `snarkdown(plainText)` → `marked.parse(plainText)`
- Linje 117 (meldinger preview): `snarkdown(plainText)` → `marked.parse(plainText)`

### Steg 4: Oppdater tester
- **Filer:** Alle testfiler som mocker snarkdown:
  - `src/scripts/__tests__/messageClient.test.js`
  - `src/scripts/__tests__/admin-editor-helpers.test.js`
  - `src/scripts/__tests__/admin-module-meldinger.test.js`
  - `src/scripts/__tests__/admin-module-tjenester.test.js`
  - `src/scripts/__tests__/admin-module-bilder.test.js`
  - `src/scripts/__tests__/admin-module-tannleger.test.js`
  - `src/scripts/__tests__/admin-module-settings.test.js`
  - `src/scripts/__tests__/admin-init.test.js`
- Endre `vi.mock('snarkdown', ...)` → `vi.mock('marked', ...)`
- Mock-funksjonen returnerer `{ marked: { parse: vi.fn(html => html), setOptions: vi.fn() } }`

### Steg 5: Verifisering
- Kjør `npm run test` — alle enhetstester bestått, ≥80% branch coverage
- Kjør `npm run build` — bygget fungerer
- Kjør `npm run test:e2e` — E2E-tester bestått
- Manuell visuell sjekk: start dev-server, se at meldinger på forsiden har synlig avsnittsskift
