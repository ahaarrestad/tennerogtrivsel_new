# Arkitektur: Sikkerhet

## DOMPurify og innerHTML

All HTML som settes via `innerHTML` og som inneholder bruker- eller CMS-generert innhold, SKAL saniteres med DOMPurify. **DOMPurify fjerner alle inline event-handlere** (f.eks. `onclick="..."`). Event-lyttere MÅ derfor alltid knyttes programmatisk etter at `innerHTML` er satt — aldri som attributter i template-strenger.

```js
// Feil – onclick strippes av DOMPurify og har ingen effekt:
inner.innerHTML = DOMPurify.sanitize(`<div onclick="doSomething()">...</div>`);

// Riktig – knytt lyttere programmatisk etterpå:
inner.innerHTML = DOMPurify.sanitize(html);
inner.querySelectorAll('.my-btn').forEach(btn => {
    btn.addEventListener('click', () => doSomething());
});
```

I node-miljø (Vitest) finnes ingen DOM, så DOMPurify må mockes i testfiler:
```js
vi.mock('dompurify', () => ({ default: { sanitize: vi.fn(html => html) } }));
```

## Middleware og produksjonsmiljø

`src/middleware.ts` setter HTTP-sikkerhetsheadere (CSP, X-Frame-Options, m.fl.) og kjører i Astro dev-server og for SSR-endepunkter. **Prosjektet deployes som statiske filer til AWS S3 og har ingen kjørende server i produksjon.** Middleware påvirker derfor ikke produksjon. Dersom disse headerne skal gjelde i prod, må de konfigureres i CloudFront (Response Headers Policy) eller S3.

CSP inkluderer `blob:` i `connect-src` for å støtte thumbnail-forhåndsvisning (blob-URLer fra `getDriveImageBlob()`) i admin-panelet.

## CloudFront tile-proxy (GDPR)

Karttiles serveres via CloudFront-proxy (`/tiles/*`) for å eliminere IP-lekkasje til tredjepart. Besøkende kontakter kun eget domene.

**Tile-kilde:** CartoDB Voyager (`basemaps.cartocdn.com/rastertiles/voyager/`). Tidligere ble `tile.openstreetmap.org` brukt, men OSM blokkerer CDN-proxying (krever unik User-Agent og Referer-header, se [OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/)).

**Arkitektur:**
- **Prod:** CloudFront behavior `/tiles/*` → origin `basemaps.cartocdn.com` med CloudFront Function som omskriver `/tiles/{z}/{x}/{y}.png` til `/rastertiles/voyager/{z}/{x}/{y}.png`
- **Dev:** Vite dev server proxy i `astro.config.mjs` gjør det samme lokalt
- **Leaflet:** Tile URL er `/tiles/{z}/{x}/{y}.png` (relativ path, fungerer i begge miljøer)

**CloudFront-gotchas:**
- `Host` er reservert header — kan ikke settes som custom origin header. CloudFront sender automatisk origin-domenet som Host så lenge Origin Request Policy ikke videresender Host fra viewer.
- CloudFront videresender hele URL-pathen til origin. CloudFront Function må omskrive `/tiles`-prefix til `/rastertiles/voyager`.

**CSP:** `tile.openstreetmap.org` er fjernet fra `img-src` og `connect-src` — tiles lastes nå fra `'self'`. Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`) er også fjernet — fontene er self-hosted.

## CSP-verifisering

`tests/csp-check.spec.ts` verifiserer CSP-brudd på tvers av nøkkelsider. Kjør ved endringer i `src/middleware.ts` (se `/security-audit`-skill).

## Tilgangskontroll (admin)

Admin-panelet bruker Google Drive-deling som tilgangsmodell. Brukeren autentiserer seg via Google OAuth, og `enforceAccessControl()` i `admin-dashboard.js` sjekker hvilke Google Drive-ressurser (mapper/sheets) brukeren har tilgang til.

**Modul-ressurs-mapping:**

| Modul | Krever tilgang til | Logikk |
|-------|-------------------|--------|
| Innstillinger | `SHEET_ID` | Enkel sjekk |
| Tjenester | `TJENESTER_FOLDER` | Enkel sjekk |
| Meldinger | `MELDINGER_FOLDER` | Enkel sjekk |
| Tannleger | `TANNLEGER_FOLDER` + `SHEET_ID` | Begge må være tilgjengelige |
| Bilder | `SHEET_ID` + `BILDER_FOLDER` | Begge må være tilgjengelige (fallback til kun `SHEET_ID` hvis `BILDER_FOLDER` ikke er konfigurert) |

- Kort vises (`display: flex`) eller skjules (`display: none`) basert på tilgangssjekk
- Hvis brukeren ikke har tilgang til noen ressurser, logges de ut og sendes til `/?access_denied=true`
- Tom config (ingen ressurs-IDer) utløser **ikke** utlogging — `ids.length === 0` håndteres separat
- Selve tilgangskontrollen skjer via Google Drive API (`gapi.client.drive.files.get`) — 403 = ingen tilgang

**Nøkkelfiler:** `admin-dashboard.js` (`enforceAccessControl`), `admin-client.js` (`checkAccess`, `checkMultipleAccess`), `admin-init.js` (`handleAuth`)

## HTML-escaping og programmatisk verdi-setting

Admin-editor-moduler bruker to teknikker for å hindre HTML-injeksjon fra Sheets/Drive-data:

1. **Programmatisk verdi-setting** for skjemaelementer (input, textarea): Render tomt skjema, sett verdier med `.value = data` etter innerHTML. Dette unngår HTML-parsing helt.
2. **`escapeHtml()`** for preview-tekst (h3, p, span): Escaper `<`, `>`, `"` og `&`.

```js
// Mønster for editor-skjemaer:
inner.innerHTML = `<input id="edit-name" value="">`;
document.getElementById('edit-name').value = data.name; // Sikkert

// Mønster for preview/lister:
`<h3>${escapeHtml(data.name)}</h3>`
```

**Berørte filer:** `admin-module-tannleger.js`, `admin-module-meldinger.js`, `admin-module-tjenester.js`, `admin-module-settings.js`, `admin-gallery.js`

**Referanse-implementasjon:** `admin-module-bilder.js` — bruker DOMPurify.sanitize() + programmatisk verdi-setting.

## Filopplastings-validering

`uploadImage()` i `admin-client.js` validerer:
- **MIME-type**: Kun `image/jpeg`, `image/png`, `image/webp` aksepteres
- **Filstørrelse**: Maks 10 MB

Kaller (`admin-gallery.js`) har allerede try/catch med `showToast` — feilmeldinger propagerer.

## Subresource Integrity (SRI)

Alle CDN-lastede scripts og stylesheets i `admin/index.astro` har:
- Pinnede versjoner (EasyMDE 2.20.0, Flatpickr 4.6.13, Font Awesome 4.7.0)
- `integrity="sha384-..."` hasher
- `crossorigin="anonymous"`

Dette beskytter mot forsyningskjede-angrep der et kompromittert CDN endrer filinnholdet.

## Akseptert risiko

| Funn | Begrunnelse |
|------|-------------|
| `unsafe-inline` i CSP (M4) | Nødvendig for Google OAuth og Tailwind v4. Mitigert av script-src whitelist og DOMPurify. |
| Token i localStorage (M5) | Ingen HTTPOnly-alternativ for klient-side OAuth. Mitigert av token-expiry og CSP. |
| Ingen audit-logging (M6) | Krever ekstra infrastruktur. Kan vurderes som egen oppgave. |
| `repository_dispatch` uten tester (L6) | Akseptert avveining — koden er allerede testet på main, risiko begrenset til kompromittert Drive-innhold. |
| Admin-side offentlig (L5) | Alle data/funksjonalitet krever gyldig OAuth-token. `noindex` + `robots.txt Disallow` hindrer indeksering. |

## Web Storage og modul-tilstand i tester

- Når kode under test bruker Web Storage, SKAL **begge** `localStorage.clear()` og
  `sessionStorage.clear()` kalles i `beforeEach` – ikke bare én av dem.
- `admin-client.js` har modul-nivå-variabler (`tokenClient`, `_rememberMe`, `gapiInited`,
  `gisInited`) som **ikke** nullstilles av `vi.clearAllMocks()`. Tester som er sensitive
  for denne tilstanden MÅ eksplisitt kalle de eksporterte setter-funksjonene
  (f.eks. `setRememberMe(false)`) i `beforeEach`.
