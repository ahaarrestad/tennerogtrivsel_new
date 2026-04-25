# CDN til npm — EasyMDE og Flatpickr Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flytt EasyMDE, Flatpickr og Font Awesome fra CDN til npm slik at alle admin-avhengigheter versjonsstyres via `package-lock.json` og admin-siden ikke gjør nettleserkall til eksterne CDN-er.

**Architecture:** EasyMDE og Flatpickr installeres som npm-pakker og importeres i admin-sidens `<script>`-blokk. De tilordnes `window.EasyMDE` og `window.flatpickr` for bakoverkompatibilitet med `admin-editor-helpers.js`, som leser disse verdiene lazily (inne i funksjoner, ikke på modulnivå). Font Awesome fjernes ved å konfigurere EasyMDE med inline SVG-ikoner på hvert toolbar-element via `icon`-proppen (støttet fra EasyMDE 2.18+).

**Tech Stack:** Astro 5, Vite, EasyMDE (npm), Flatpickr (npm)

---

### Task 1: Installer npm-pakker og etabler baseline

**Files:**
- Modify: `package.json` (automatisk av npm)

- [ ] **Step 1: Installer pakkene**

```bash
npm install easymde flatpickr
```

Forventet: `added X packages` uten feil.

- [ ] **Step 2: Verifiser at pakkene er lagt til**

```bash
grep -E '"easymde"|"flatpickr"' package.json
```

Forventet output inkluderer to linjer med versjonsnumre for `easymde` og `flatpickr`.

- [ ] **Step 3: Kjør testsuite for baseline**

```bash
npm test
```

Alle tester skal passere. Noter antall for sammenligning i Task 5.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: installer easymde og flatpickr som npm-avhengigheter"
```

---

### Task 2: Flytt EasyMDE CSS-override til global.css

`admin/index.astro` har en `<style is:global>`-blokk med EasyMDE-stiler. Den flyttes til `src/styles/global.css` (der alle andre globale stiler bor) og fjernes fra Astro-filen.

**Files:**
- Modify: `src/styles/global.css`
- Modify: `src/pages/admin/index.astro`

- [ ] **Step 1: Legg til EasyMDE-stiler i global.css**

Åpne `src/styles/global.css` og legg til på slutten av filen:

```css
/* EasyMDE editor — admin-designsystem */
.EasyMDEContainer .editor-toolbar {
    border-top-left-radius: 12px;
    border-top-right-radius: 12px;
    border-color: var(--color-admin-border);
    background: var(--color-admin-surface);
}
.EasyMDEContainer .CodeMirror {
    border-bottom-left-radius: 12px;
    border-bottom-right-radius: 12px;
    border-color: var(--color-admin-border);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
.EasyMDEContainer .editor-preview-active-side {
    border-color: var(--color-admin-border);
}
```

- [ ] **Step 2: Fjern `<style is:global>`-blokken fra admin/index.astro**

I `src/pages/admin/index.astro`, slett hele denne blokken (ca. linje 39–55):

```html
<style is:global>
    .EasyMDEContainer .editor-toolbar {
        border-top-left-radius: 12px;
        border-top-right-radius: 12px;
        border-color: var(--color-admin-border);
        background: var(--color-admin-surface);
    }
    .EasyMDEContainer .CodeMirror {
        border-bottom-left-radius: 12px;
        border-bottom-right-radius: 12px;
        border-color: var(--color-admin-border);
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    }
    .EasyMDEContainer .editor-preview-active-side {
        border-color: var(--color-admin-border);
    }
</style>
```

- [ ] **Step 3: Commit**

```bash
git add src/styles/global.css src/pages/admin/index.astro
git commit -m "refactor: flytt EasyMDE CSS-override fra admin/index.astro til global.css"
```

---

### Task 3: Erstatt CDN-tagger med npm-imports i admin/index.astro

**Files:**
- Modify: `src/pages/admin/index.astro`

- [ ] **Step 1: Fjern alle 5 CDN-tagger fra `<head>`**

I `src/pages/admin/index.astro`, slett disse linjene (kommentar + 5 tagger, ca. linje 29–37 etter Task 2):

```html
<!-- Editor & Datepicker assets (pinned versions + SRI) -->
<link rel="stylesheet" href="https://unpkg.com/easymde@2.20.0/dist/easymde.min.css" integrity="sha384-3AvV7152TgYAMYdGZPqG9BpmSH2ZW6ewTDL0QV5PyNkl19KMI+yLMdJz183N8A2d" crossorigin="anonymous">
<script src="https://unpkg.com/easymde@2.20.0/dist/easymde.min.js" integrity="sha384-YDXeUfPZ4SP6vJpnF+ZMmf4B1bax6yd4Q/aNbkvLidRD843hPG5RE67M0IYT4LOq" crossorigin="anonymous"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.css" integrity="sha384-RkASv+6KfBMW9eknReJIJ6b3UnjKOKC5bOUaNgIY778NFbQ8MtWq9Lr/khUgqtTt" crossorigin="anonymous">
<script src="https://cdn.jsdelivr.net/npm/flatpickr@4.6.13" integrity="sha384-5JqMv4L/Xa0hfvtF06qboNdhvuYXUku9ZrhZh3bSk8VXF0A/RuSLHpLsSV9Zqhl6" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/l10n/no.js" integrity="sha384-UOy25oJXKTxZ3z0Um6Yb4fWFI5XUD2EyyvYe66gTjPVh8m++j41++hDI0V/8nel6" crossorigin="anonymous"></script>

<!-- Icons for EasyMDE -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css" integrity="sha384-wvfXpqpZZVQGK6TAh5PVlGOfQNHSoD2xbE+QkPxCAFlNEevoEH3Sl0sibVcOQVnN" crossorigin="anonymous">
```

- [ ] **Step 2: Erstatt `<script>`-blokken nederst i `<body>`**

Finn den eksisterende `<script>`-blokken (siste blokk i body):

```html
<script>
    import '../../scripts/admin-init.js';
</script>
```

Erstatt den med:

```html
<script>
    import EasyMDE from 'easymde';
    import flatpickr from 'flatpickr';
    import { Norwegian } from 'flatpickr/dist/l10n/no.js';
    import 'easymde/dist/easymde.min.css';
    import 'flatpickr/dist/flatpickr.min.css';
    import '../../scripts/admin-init.js';

    flatpickr.localize(Norwegian);
    window.EasyMDE = EasyMDE;
    window.flatpickr = flatpickr;
</script>
```

**Merk:** ES-modulimports er hoisted — de evalueres før script-kroppen. `admin-init.js` bruker `window.EasyMDE` og `window.flatpickr` lazily (kun inne i funksjoner som kalles ved brukerinteraksjon), så rekkefølgen er ikke kritisk: alle module-evalueringer fullføres synkront før noen brukerinteraksjon kan skje.

- [ ] **Step 3: Verifiser at ingen CDN-tagger gjenstår**

```bash
grep -n "unpkg.com\|jsdelivr.net\|cdnjs.cloudflare.com\|font-awesome" src/pages/admin/index.astro
```

Forventet output: ingen treff.

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/index.astro
git commit -m "feat: erstatt CDN-avhengigheter med npm-imports for EasyMDE og Flatpickr"
```

---

### Task 4: Erstatt EasyMDE toolbar med SVG-ikoner

Font Awesome leverte ikoner til EasyMDE-toolbaren via CSS-klasser (`fa fa-bold` etc.). Nå konfigureres hvert toolbar-element med inline SVG via `icon`-proppen (EasyMDE 2.18+).

**Files:**
- Modify: `src/scripts/admin-editor-helpers.js`

- [ ] **Step 1: Kjør eksisterende tester som baseline**

```bash
npm test -- --reporter=verbose src/scripts/__tests__/admin-editor-helpers.test.js
```

Alle tester skal passere.

- [ ] **Step 2: Erstatt `createEasyMDE`-funksjonen**

I `src/scripts/admin-editor-helpers.js`, finn `createEasyMDE`-funksjonen (linje 116–130) og erstatt den med:

```js
function createEasyMDE(minHeight = "250px") {
    const EasyMDEGlobal = window['EasyMDE'];
    if (typeof EasyMDEGlobal === 'undefined') return null;

    const toolbar = [
        { name: 'bold', action: EasyMDEGlobal.toggleBold, title: 'Fet', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>' },
        { name: 'italic', action: EasyMDEGlobal.toggleItalic, title: 'Kursiv', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>' },
        { name: 'heading', action: EasyMDEGlobal.toggleHeadingSmaller, title: 'Overskrift', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16"/><path d="M4 6v12"/><path d="M20 6v12"/></svg>' },
        '|',
        { name: 'quote', action: EasyMDEGlobal.toggleBlockquote, title: 'Sitat', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>' },
        { name: 'unordered-list', action: EasyMDEGlobal.toggleUnorderedList, title: 'Punktliste', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>' },
        { name: 'ordered-list', action: EasyMDEGlobal.toggleOrderedList, title: 'Nummerert liste', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>' },
        '|',
        { name: 'link', action: EasyMDEGlobal.drawLink, title: 'Lenke', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>' },
        { name: 'image', action: EasyMDEGlobal.drawImage, title: 'Bilde', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' },
        '|',
        { name: 'preview', action: EasyMDEGlobal.togglePreview, title: 'Forhåndsvisning', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' },
        { name: 'side-by-side', action: EasyMDEGlobal.toggleSideBySide, title: 'Side om side', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="18"/><rect x="14" y="3" width="7" height="18"/></svg>' },
        { name: 'fullscreen', action: EasyMDEGlobal.toggleFullScreen, title: 'Fullskjerm', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>' },
        '|',
        { name: 'guide', action: 'https://www.markdownguide.org/basic-syntax/', title: 'Markdown-guide', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' },
    ];

    return new EasyMDEGlobal({
        element: document.getElementById('edit-content'),
        spellChecker: false,
        status: false,
        minHeight,
        placeholder: "Skriv innholdet her...",
        toolbar,
        previewRender: (plainText) => {
            return `<div class="markdown-content prose">${DOMPurify.sanitize(marked.parse(plainText))}</div>`;
        }
    });
}
```

- [ ] **Step 3: Kjør tester igjen**

```bash
npm test -- --reporter=verbose src/scripts/__tests__/admin-editor-helpers.test.js
```

Alle tester skal fortsatt passere.

- [ ] **Step 4: Commit**

```bash
git add src/scripts/admin-editor-helpers.js
git commit -m "feat: erstatt Font Awesome-toolbar med SVG-ikoner i EasyMDE"
```

---

### Task 5: Verifiser full testsuite og bygg

**Files:** (ingen endringer)

- [ ] **Step 1: Kjør full testsuite**

```bash
npm test
```

Antall passerende tester skal være ≥ baseline fra Task 1.

- [ ] **Step 2: Verifiser bygget**

```bash
npm run build:ci
```

Forventet: bygget fullføres uten feil. Astro/Vite bundler EasyMDE og Flatpickr CSS inn i outputen.

---

### Task 6: Manuell testing i nettleser

- [ ] **Step 1: Start dev-server**

```bash
npm run dev:nosync
```

- [ ] **Step 2: Kjør testsjekkliste**

Åpne `http://localhost:4321/admin` og verifiser:

**Nettverkskall:**
- [ ] Network-fanen i DevTools: ingen forespørsler til `unpkg.com`, `jsdelivr.net` eller `cdnjs.cloudflare.com`

**Visuell lastning:**
- [ ] Siden laster uten konsollfeil
- [ ] EasyMDE CSS er aktiv (editor vises med korrekte border/bakgrunn)
- [ ] Flatpickr CSS er aktiv (kalender har styling)

**EasyMDE toolbar:**
- [ ] Alle 8 ikonknapper (bold, italic, heading, quote, punktliste, nummerert liste, lenke, bilde) viser SVG-ikoner
- [ ] Skilletegn (`|`) mellom grupper er synlige
- [ ] Preview, side-by-side, fullscreen og guide er synlige

**Funksjonalitet:**
- [ ] Åpne Finpussen → rediger en tjeneste → editor er skrivbar, bold/italic virker, preview fungerer
- [ ] Åpne Oppslagstavla → rediger en melding → editor er skrivbar
- [ ] Start- og sluttdato-felter åpner kalender med norsk locale (måneder/dager på norsk)
- [ ] Valgt dato lagres riktig

**CSS-override:**
- [ ] EasyMDE toolbar har avrundede topp-hjørner
- [ ] CodeMirror har avrundede bunn-hjørner
- [ ] Farger følger admin-designsystemet

- [ ] **Step 3: Stopp dev-server**

---

### Task 7: Oppdater TODO.md og avslutt

**Files:**
- Modify: `TODO.md`

- [ ] **Step 1: Legg til plan-lenke i TODO.md**

I `TODO.md`, finn oppgaven "Teknisk og sikkerhetsgjennomgang — avhengighetsreduksjon" og oppdater den slik:

```markdown
- [ ] **Teknisk og sikkerhetsgjennomgang — avhengighetsreduksjon** ([plan](docs/superpowers/plans/2026-04-22-cdn-til-npm.md))
  - Gjennomgå alle npm-avhengigheter: hva kan vi lage selv, hva bør vi beholde?
  - Mål: redusere trusselflaten mot supply chain-angrep
  - Vurder sikkerheten i autentisering, API-kall og tredjepartsintegrasjoner
  - Leveranse: rapport med konkrete anbefalinger (fjern / bytt ut / behold med begrunnelse)
```

- [ ] **Step 2: Commit via `/commit`-skillen**

Kjør `/commit`-skillen for å stage alle gjenværende endringer, generere commit-melding og sende til code review.
