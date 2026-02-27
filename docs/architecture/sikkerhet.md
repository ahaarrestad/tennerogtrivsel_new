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
| Bilder | `SHEET_ID` | Enkel sjekk |

- Kort vises (`display: flex`) eller skjules (`display: none`) basert på tilgangssjekk
- Hvis brukeren ikke har tilgang til noen ressurser, logges de ut og sendes til `/?access_denied=true`
- Tom config (ingen ressurs-IDer) utløser **ikke** utlogging — `ids.length === 0` håndteres separat
- Selve tilgangskontrollen skjer via Google Drive API (`gapi.client.drive.files.get`) — 403 = ingen tilgang

**Nøkkelfiler:** `admin-dashboard.js` (`enforceAccessControl`), `admin-client.js` (`checkAccess`, `checkMultipleAccess`), `admin-init.js` (`handleAuth`)

## Web Storage og modul-tilstand i tester

- Når kode under test bruker Web Storage, SKAL **begge** `localStorage.clear()` og
  `sessionStorage.clear()` kalles i `beforeEach` – ikke bare én av dem.
- `admin-client.js` har modul-nivå-variabler (`tokenClient`, `_rememberMe`, `gapiInited`,
  `gisInited`) som **ikke** nullstilles av `vi.clearAllMocks()`. Tester som er sensitive
  for denne tilstanden MÅ eksplisitt kalle de eksporterte setter-funksjonene
  (f.eks. `setRememberMe(false)`) i `beforeEach`.
