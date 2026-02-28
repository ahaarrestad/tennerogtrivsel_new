# Plan: "Legg til snarvei" i admin på mobil

> **Status: FULLFØRT**

## Bakgrunn

Admin-brukere åpner admin-panelet på mobil via nettleseren. Vi vil gi dem mulighet til å legge til en snarvei på hjemskjermen slik at admin-panelet føles mer app-lignende.

## Beslutninger

- **Enkel snarvei** — Web App Manifest + install-prompt, ingen service worker
- **Toast-melding** — bruker eksisterende `showToast()`-mønster fra `admin-dialog.js`
- **Kun admin** — manifest og prompt begrenses til `/admin`
- **Etter innlogging** — prompten vises først når brukeren er logget inn
- **Én gang** — prompten vises bare hvis brukeren ikke har avvist/installert tidligere (lagres i `localStorage`)

## Steg

### 1. Opprett Web App Manifest (`public/admin-manifest.json`)

Dedikert manifest for admin (ikke den offentlige siden):

```json
{
  "name": "Tenner og Trivsel – Admin",
  "short_name": "TT Admin",
  "description": "Administrasjonspanel for Tenner og Trivsel",
  "start_url": "/admin/",
  "display": "standalone",
  "background_color": "#f8fafc",
  "theme_color": "#0d9488",
  "icons": [
    { "src": "/tt-icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/tt-icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**Ikoner:** Genereres fra eksisterende logo (`src/assets/tt-logo-2026.png`) i to størrelser (192×192 og 512×512). Legges i `public/`.

### 2. Legg til manifest og meta-tagger i admin-siden

I `src/pages/admin/index.astro` `<head>`:

```html
<link rel="manifest" href="/admin-manifest.json">
<meta name="theme-color" content="#0d9488">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="TT Admin">
<link rel="apple-touch-icon" href="/tt-icon-192.png">
```

### 3. Opprett `src/scripts/pwa-prompt.js`

Ny modul med install-prompt-logikk:

```js
import { showToast } from './admin-dialog.js';

const STORAGE_KEY = 'tt-admin-pwa-dismissed';

let deferredPrompt = null;

export function initPwaPrompt() {
  // Lytt på beforeinstallprompt (Chrome/Edge/Samsung)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });
}

export function showInstallPromptIfEligible() {
  // Allerede installert som standalone?
  if (window.matchMedia('(display-mode: standalone)').matches) return;

  // Allerede avvist?
  if (localStorage.getItem(STORAGE_KEY)) return;

  // Vis toast med install-knapp
  showInstallToast();
}

function showInstallToast() {
  // Tilpasset toast med klikkbar install-handling
  // Bruker showToast() med utvidet varighet og onClick-callback
  // Ved klikk: trigger deferredPrompt.prompt() (Android) eller vis instruksjoner (iOS)
  // Ved dismiss: sett localStorage-flagg
}

export function _resetForTesting() {
  deferredPrompt = null;
}
```

**iOS-håndtering:** Safari støtter ikke `beforeinstallprompt`. På iOS viser toasten en kort instruksjon: «Trykk Del-ikonet → Legg til på Hjem-skjerm».

**Deteksjon:** `navigator.standalone` (iOS) og `display-mode: standalone` media query (Android) brukes for å sjekke om appen allerede kjører som installert.

### 4. Integrer i admin-dashboard.js

I `updateUIWithUser()` (som kalles etter vellykket innlogging):

```js
import { showInstallPromptIfEligible } from './pwa-prompt.js';

// Etter at dashboard er vist og bruker er autentisert:
showInstallPromptIfEligible();
```

Alternativt kan det trigges fra init-scriptet i `admin/index.astro` etter login-callback.

`initPwaPrompt()` kalles ved sidelast (utenfor login-flyten) for å fange `beforeinstallprompt`-eventen tidlig.

### 5. Tester (`src/scripts/__tests__/pwa-prompt.test.js`)

Enhetstester for:

- `initPwaPrompt()` registrerer event listener
- `showInstallPromptIfEligible()` viser toast når betingelser er oppfylt
- Viser ikke toast når allerede installert (standalone mode)
- Viser ikke toast når allerede avvist (localStorage-flagg)
- Dismiss setter localStorage-flagg
- Install-klikk kaller `deferredPrompt.prompt()` (Android)
- iOS-deteksjon viser instruksjonstekst i stedet
- `_resetForTesting()` nullstiller tilstand

### 6. Generer app-ikoner

Bruk `sharp` (allerede en devDependency) til å generere ikonene fra logoen:

```bash
node -e "
const sharp = require('sharp');
sharp('src/assets/tt-logo-2026.png').resize(192,192).toFile('public/tt-icon-192.png');
sharp('src/assets/tt-logo-2026.png').resize(512,512).toFile('public/tt-icon-512.png');
"
```

Ikonene committes til `public/` (de er statiske og endres sjelden).

## Filer som endres/opprettes

| Fil | Endring |
|-----|---------|
| `public/admin-manifest.json` | **Ny** — Web App Manifest |
| `public/tt-icon-192.png` | **Ny** — App-ikon 192×192 |
| `public/tt-icon-512.png` | **Ny** — App-ikon 512×512 |
| `src/pages/admin/index.astro` | Meta-tagger + manifest-lenke i `<head>`, `initPwaPrompt()` ved sidelast |
| `src/scripts/pwa-prompt.js` | **Ny** — Install-prompt-logikk |
| `src/scripts/admin-dashboard.js` | Kall `showInstallPromptIfEligible()` etter innlogging |
| `src/scripts/__tests__/pwa-prompt.test.js` | **Ny** — ~8 enhetstester |

## Avgrensninger

- **Ingen service worker** — admin-panelet krever Google-tilkobling uansett
- **Ingen offline-støtte** — ikke relevant for dette brukstilfellet
- **Kun admin-side** — offentlig side berøres ikke
- **CSP:** Manifest-lenke krever ingen CSP-endring (same-origin fil i `public/`)
