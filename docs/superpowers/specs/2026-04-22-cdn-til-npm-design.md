# Design: Flytt CDN-avhengigheter til npm

**Dato:** 2026-04-22  
**Oppgave:** Teknisk og sikkerhetsgjennomgang — avhengighetsreduksjon

## Bakgrunn

Admin-siden laster tre biblioteker fra eksterne CDN-er ved kjøretid: EasyMDE (unpkg.com), Flatpickr (jsdelivr.net) og Font Awesome 4.7.0 (cdnjs.cloudflare.com). Selv om SRI-hasher er på plass og sikrer integritet, medfører CDN-lasting at:

- Admin-brukerens IP lekker til tre tredjeparter
- Avhengighetene lever utenfor `package-lock.json` og versjonskontrollen
- Font Awesome 4.7.0 (fra 2016) er en utdatert, unødvendig ekstern avhengighet

npm-avhengighetene (`leaflet`, `marked`, `dompurify`, Google APIs m.fl.) er alle velbegrunnede og endres ikke.

## Mål

- Eliminere alle eksterne nettleserkall fra admin-siden
- Versjonsstyre EasyMDE og Flatpickr via `package-lock.json`
- Fjerne Font Awesome som avhengighet

## Arkitektur

### Endringer i `admin/index.astro`

**Fjernes (5 CDN-tagger):**
- `<link>` + `<script>` for EasyMDE 2.20.0 fra unpkg.com
- `<link>` + `<script>` × 2 for Flatpickr 4.6.13 fra jsdelivr.net (inkl. norsk locale)
- `<link>` for Font Awesome 4.7.0 fra cdnjs.cloudflare.com

**Legges til:**
```js
// I <script>-blokken i admin/index.astro
import EasyMDE from 'easymde';
import flatpickr from 'flatpickr';
import { Norwegian } from 'flatpickr/dist/l10n/no.js';
import 'easymde/dist/easymde.min.css';
import 'flatpickr/dist/flatpickr.min.css';

flatpickr.localize(Norwegian);
window.EasyMDE = EasyMDE;
window.flatpickr = flatpickr;

import '../../scripts/admin-init.js';
```

Vite (via Astro) bundler CSS-importene og inkluderer dem i bygget.

**Flyttes:**
EasyMDE CSS-override (`<style is:global>`) flyttes fra `admin/index.astro` til `src/styles/global.css` under en `.EasyMDEContainer`-selektor.

### Kompatibilitet med eksisterende kode

`admin-editor-helpers.js` leser `window['EasyMDE']` og `window['flatpickr']` ved kjøretid (ikke ved modulinitialisering). Window-assignmentene i `<script>`-blokken kjøres ved sideinnlasting — lenge før editor-modulene aktiveres ved brukerinteraksjon. Ingen endringer i `admin-editor-helpers.js`, tester eller andre admin-scripts er nødvendige.

### Font Awesome — erstatning med SVG-ikoner

EasyMDE 2.18+ støtter `icon`-prop (SVG HTML-streng) på egendefinerte toolbar-knapper. Toolbar i `createEasyMDE()` endres fra streng-liste til objekt-liste for alle ikonknapper:

```js
toolbar: [
  { name: 'bold', action: EasyMDE.toggleBold, icon: '<svg>...</svg>', title: 'Fet' },
  { name: 'italic', action: EasyMDE.toggleItalic, icon: '<svg>...</svg>', title: 'Kursiv' },
  // osv.
  '|',
  'preview', 'side-by-side', 'fullscreen',  // disse bruker egne CSS-klasser, ikke FA
  '|',
  'guide'
]
```

SVG-ikoner hentes fra Heroicons (MIT-lisens) — enkle, lesbare ikoner for: bold, italic, heading, quote, unordered-list, ordered-list, link, image.

## Nye pakker

```
npm install easymde flatpickr
```

Ingen pakker fjernes fra `package.json` (EasyMDE og Flatpickr var ikke der fra før).

## Berørte filer

| Fil | Endring |
|---|---|
| `package.json` | Legg til `easymde`, `flatpickr` |
| `src/pages/admin/index.astro` | Fjern 5 CDN-tagger, legg til npm-import i `<script>`, flytt CSS-override |
| `src/scripts/admin-editor-helpers.js` | Bytt toolbar fra strenger til SVG-objekt-liste |
| `src/styles/global.css` | Legg til EasyMDE CSS-override |

## Utenfor scope

- npm-avhengigheter (leaflet, marked, dompurify, Google APIs) — ingen endringer
- Google APIs (`apis.google.com/js/api.js`, `accounts.google.com/gsi/client`) — disse kan ikke self-hostes da de er en del av Google OAuth-flyten
- Tester for `admin-editor-helpers.js` — ingen API-endring, eksisterende tester er gyldige

## Manuell testsjekkliste

Etter implementering — verifiser i nettleser (ikke bare tester):

**Admin-innlasting:**
- [ ] `http://localhost:4321/admin` laster uten konsollfeil
- [ ] Ingen nettverksforespørsler til `unpkg.com`, `cdn.jsdelivr.net` eller `cdnjs.cloudflare.com` (Network-fanen i DevTools)
- [ ] EasyMDE CSS-stiler er synlige (toolbar vises, CodeMirror-editor har riktig border/bakgrunn)
- [ ] Flatpickr CSS-stiler er synlige (kalender har riktig utseende)

**EasyMDE toolbar-ikoner:**
- [ ] Alle 8 ikonknapper (bold, italic, heading, quote, lister ×2, link, bilde) viser SVG-ikoner
- [ ] Skilletegn (`|`) vises mellom grupper
- [ ] Preview, side-by-side og fullscreen-knapper viser sine egne ikoner (ikke SVG fra oss)
- [ ] Guide-knapp er synlig

**EasyMDE funksjonalitet:**
- [ ] Åpne Finpussen (tjenester) → rediger en tjeneste → editor vises og er skrivbar
- [ ] Bold/italic/heading virker (tekst formateres)
- [ ] Preview-modus viser rendret Markdown
- [ ] Åpne Oppslagstavla (meldinger) → rediger en melding → editor vises

**Flatpickr funksjonalitet:**
- [ ] Åpne Oppslagstavla → rediger en melding → start- og sluttdato-felter viser kalender ved klikk
- [ ] Norsk locale er aktiv (måneder og dager på norsk)
- [ ] Valgt dato lagres korrekt

**CSS-override:**
- [ ] EasyMDE toolbar har `border-top-left-radius` og `border-top-right-radius` (avrundede hjørner)
- [ ] CodeMirror-editor har `border-bottom-left-radius` og `border-bottom-right-radius`
- [ ] Farger følger admin-designsystemet (`--color-admin-border`, `--color-admin-surface`)

## Akseptert gjenværende risiko

| Ressurs | Begrunnelse for å beholde |
|---|---|
| `apis.google.com/js/api.js` | Påkrevd av Google OAuth/GAPI — ingen erstatning |
| `accounts.google.com/gsi/client` | Påkrevd av Google Identity Services — ingen erstatning |
