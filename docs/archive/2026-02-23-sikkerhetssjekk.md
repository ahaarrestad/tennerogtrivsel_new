# Plan: Grundig sikkerhetssjekk av hele prosjektet

> **Status: FULLFØRT**

## Bakgrunn

Det er gjort en uformell sikkerhetsgjennomgang tidligere, men mye kode er endret siden da. Denne planen dekker hele stacken: frontend, admin-panel, API-endepunkter, CSP, autentisering og dataflyt.

## Forutsetninger

- Prosjektet er en **statisk Astro-side** deployet til AWS S3 + CloudFront
- Admin-panelet er **klient-side** med Google OAuth — ingen backend-server i produksjon
- `src/middleware.ts` kjører kun i dev/SSR, **ikke** i produksjon (S3)
- `.env` er gitignored og har aldri vært committet

## Risikoområder og funn (oppdatert 27. feb 2026)

### Kritisk

Ingen kritiske funn.

### Medium

| # | Omrade | Funn | Risiko |
|---|--------|------|--------|
| M1 | HTML-attributt-escaping | Template literals i admin-moduler bruker Sheets-data direkte i `value="..."` og `<textarea>...</textarea>` uten HTML-escaping. Rammer **5 filer, 15+ injeksjonspunkter** (se detaljer under). | DOM-korrupsjon ved manipulert Sheets-data |
| M2 | Filopplasting | `uploadImage()` i `admin-client.js` (linje 228) validerer ikke MIME-type, filstorrelse eller filnavn | Vilkarlige filer kan lastes opp til Drive |
| M3 | Admin input-validering | Ingen validering pa Sheets-mutasjoner (`updateSettingByKey`, `updateTannlegeRow`, etc.) — ingen maks-lengde, range-sjekk eller type-sjekk | Data-korrupsjon, uventet oppforsel |
| M4 | `unsafe-inline` i CSP | Nodvendig for Google OAuth og Tailwind, men svekker CSP | Redusert XSS-beskyttelse |
| M5 | Token i localStorage | OAuth access token i localStorage/sessionStorage, sarbar for XSS | Token-tyveri |
| M6 | Ingen audit-logging | Admin-handlinger logges ikke — ingen sporbarhet | Vanskelig a oppdage misbruk |
| M7 | CDN-scripts uten SRI | `unpkg.com/easymde`, `cdn.jsdelivr.net/flatpickr` og `cdn.jsdelivr.net/flatpickr/l10n/no.js` lastes uten `integrity`-attributt (Subresource Integrity) i `admin/index.astro` linje 30-33. Kompromittert CDN kan injisere vilkarlig JS. | Forsyningskjede-angrep pa admin |

### Lav

| # | Omrade | Funn |
|---|--------|------|
| L1 | API-nokkel | `PUBLIC_GOOGLE_API_KEY` bor ha referer-restriksjon i Google Cloud Console |
| L2 | Offentlig API | `/api/active-messages.json` har ingen rate limiting |
| L3 | Drive query-injeksjon | Template-strenger i `gapi.client.drive.files.list` bruker filnavn fra Sheets — `findFileByName(name, folderId)` i `admin-client.js` linje 22. `name` interpoleres direkte i `q`-parameter. Ikke utnyttbart i praksis (krever kompromittert Sheets + Google API-parseren er robust), men bryter prinsippet om parametriserte sporringer. |
| L4 | Filsletting i sync | Stale filer slettes uten soft-delete/backup i `sync-data.js` linje 182-188 og 218-224 |
| L5 | Admin-side offentlig tilgjengelig | `/admin/` er tilgjengelig for alle (kun klient-side auth) |
| L6 | `repository_dispatch` uten tester | `repository_dispatch`-trigger i `deploy.yml` hopper over bade unit- og e2e-tester (linje 29, 44). Kompromittert Google Drive-innhold deployes direkte uten validering. |

### Adressert / Fungerer bra

- **CloudFront Response Headers Policy** satt opp pa test-siden (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) — prod folger med CloudFront prod-oppgaven
- **DOMPurify** brukes konsekvent pa all `innerHTML` med CMS-data i lister (dashboard: meldinger, tjenester, tannleger, galleri) og i bilder-editoren
- **Event-handlere** knyttes programmatisk etter sanitering (aldri inline)
- **npm audit**: 0 sarbarheter, alle deps oppdaterte (verifisert 27. feb 2026)
- **OAuth-flyt**: Korrekt implementert med token-expiry, logout ved 401/403, auto-retry via `admin-api-retry.js`
- **Numerisk validering** i `sync-data.js` via `parseImageConfig()`: scale [1.0-3.0], posisjon [0-100]
- **`valueInputOption: 'RAW'`** forhindrer formel-injeksjon i Sheets
- **robots.txt** disallower `/admin` (dynamisk generert via `generate-robots.js`)
- **`noindex, nofollow`** meta-tag pa admin-siden (`admin/index.astro` linje 18)
- **CodeQL** kjorer ukentlig + pa push/PR — statisk sikkerhetsanalyse av JS/TS
- **Dependabot** + auto-merge (kun minor/patch) + required status checks
- **Bilder-modul (M1-delvis adressert):** `admin-module-bilder.js` bruker DOMPurify.sanitize() pa editor-HTML og setter verdier programmatisk (linje 72, 176-191) — dette er det sikre monsteret som de andre modulene bor folge
- **Backup ved sletting:** `backupToSlettetSheet()` tar kopi for permanent sletting av tannleger
- **Service account scopes:** `sync-data.js` bruker `spreadsheets.readonly` + `drive.readonly` — minste privilegium

## Detaljert kartlegging: M1 — HTML-attributt-escaping

Følgende steder setter Sheets/Drive-data direkte inn i template literals uten escaping:

**`admin-module-tannleger.js` (IKKE sanitert, INGEN DOMPurify)**
- Linje 82: `value="${t.image}"` — bildefilnavn fra Sheets
- Linje 90: `value="${t.name}"` — navn fra Sheets
- Linje 94: `value="${t.title}"` — tittel fra Sheets
- Linje 98: `>${t.description}</textarea>` — beskrivelse fra Sheets (textarea-innhold)
- Linje 109: `${t.scale}x` — numerisk, lav risiko
- Linje 168: `${t.name || 'Navn'}` — i h3-element (preview)
- Linje 170: `${t.title || 'Tittel'}` — i p-element (preview)
- Linje 171: `${t.description || '...'}` — i p-element (preview)

**`admin-module-meldinger.js` (IKKE sanitert)**
- Linje 75: `value="${msgData.title || ''}"` — tittel fra Drive
- Linje 83: `value="${msgData.startDate || ''}"` — dato fra Drive (lav risiko, datoformat)
- Linje 90: `value="${msgData.endDate || ''}"` — dato fra Drive (lav risiko)
- Linje 95: `>${msgData.content || ''}</textarea>` — innhold fra Drive (textarea)

**`admin-module-tjenester.js` (IKKE sanitert)**
- Linje 69: `value="${data.title || ''}"` — tittel fra Drive
- Linje 73: `>${data.ingress || ''}</textarea>` — ingress fra Drive (textarea)
- Linje 77: `>${body}</textarea>` — markdown-innhold fra Drive (textarea)

**`admin-module-settings.js` (IKKE sanitert)**
- Linje 115: `${label}` — beskrivelse fra Sheets
- Linje 121: `>${setting.value}</textarea>` — verdi fra Sheets (textarea)
- Linje 122: `value="${setting.value}"` — verdi fra Sheets (input)

**`admin-dashboard.js` (sanitert med DOMPurify — OK)**
- Linje 416, 478, 543, 681: Sheets/Drive-data i listevisninger — DOMPurify.sanitize() brukes
- Linje 423, 482, 548, 690-691: data-attributter — DOMPurify.sanitize() brukes

**`admin-gallery.js` (IKKE sanitert)**
- Linje 41: `${img.name}` — filnavn fra Drive i hover-overlay
- Linje 48: `${img.name}` — filnavn fra Drive i placeholder

**Merk:** `admin-module-bilder.js` er det gode eksempelet — den bruker DOMPurify.sanitize() pa editor-HTML og setter verdier programmatisk etter rendering. De andre modulene bor folge samme monster.

## Gjennomforingsplan

### Steg 1: HTML-attributt-escaping og programmatisk verdi-setting (M1)

**Hva:** Fikse alle 15+ injeksjonspunkter i editor-modulene. To tiltak:
1. For lister/preview (h3, p, span): Legg til `escapeHtml()` hjelpefunksjon
2. For editor-skjemaer (input, textarea): Folgbilder-modulens monster — render tomt skjema med DOMPurify, sett verdier programmatisk etterpat

**Berørte filer:**
- `src/scripts/admin-module-tannleger.js` — 8 injeksjonspunkter, innfor `editTannlege()`
- `src/scripts/admin-module-meldinger.js` — 4 injeksjonspunkter, innfor `editMelding()`
- `src/scripts/admin-module-tjenester.js` — 3 injeksjonspunkter, innfor `editTjeneste()`
- `src/scripts/admin-module-settings.js` — 3 injeksjonspunkter, innfor `loadSettingsModule()`
- `src/scripts/admin-gallery.js` — 2 injeksjonspunkter, `img.name` i linje 41 og 48

**Referanse-implementasjon (admin-module-bilder.js linje 72-191):**
```javascript
// 1. Render skjema med tomme placeholder-verdier
inner.innerHTML = DOMPurify.sanitize(`
    <input type="text" id="edit-title" value="" class="admin-input">
    <textarea id="edit-desc" class="admin-input"></textarea>
`);
// 2. Sett verdier programmatisk (sikkert — ingen HTML-parsing)
document.getElementById('edit-title').value = item.title || '';
document.getElementById('edit-desc').value = item.description || '';
```

**escapeHtml for kontekster der programmatisk setting ikke er mulig (lister, preview):**
```javascript
export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
```
Plasseres i `admin-editor-helpers.js` og eksporteres.

**Tester:** Enhetstester som verifiserer at `<`, `>`, `"`, `&` i Sheets-data ikke bryter HTML-struktur.

---

### Steg 2: Filopplastings-validering (M2)

**Hva:** Valider filtype og storrelse ved opplasting.

**Fil:** `src/scripts/admin-client.js` -> `uploadImage()` (linje 228)

**Implementasjon:** Legg til validering **for** FormData-opprettelse:
```javascript
export async function uploadImage(folderId, file) {
    // Validering
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
    const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

    if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error(`Ugyldig filtype: ${file.type}. Kun JPEG, PNG og WebP er tillatt.`);
    }
    if (file.size > MAX_SIZE) {
        throw new Error(`Filen er for stor (${(file.size / 1024 / 1024).toFixed(1)} MB). Maks 10 MB.`);
    }
    // ... eksisterende upload-logikk
}
```

**Kaller (admin-gallery.js linje 86-90)** har allerede `try/catch` med `showToast` — feilmeldingen fra `throw` vil propagere dit.

**Tester:** Enhetstester for alle valideringer (feil MIME, for stor, OK-fil).

---

### Steg 3: Input-validering i admin-mutasjoner (M3)

**Hva:** Legg til klient-side validering for data sendes til Google Sheets API.

**Filer:**
- `src/scripts/admin-module-tannleger.js` -> `updatePreview()` (linje 280-319) der auto-save skjer
- `src/scripts/admin-module-settings.js` -> via `saveSingleSetting()` i `admin-dashboard.js`

**Valideringer (ny hjelpefunksjon i `admin-editor-helpers.js`):**
```javascript
export function validateSheetInput(value, { maxLength = 255, type = 'text' } = {}) {
    if (type === 'text' && value.length > maxLength) {
        return `Maks ${maxLength} tegn (har ${value.length})`;
    }
    if (type === 'number') {
        const n = parseFloat(value);
        if (isNaN(n)) return 'Ma vare et tall';
    }
    return null; // OK
}
```

**Spesifikke grenser:**
- Tannleger: navn/tittel maks 255, beskrivelse maks 2000
- Innstillinger: verdi maks 2000
- Numeriske felter: allerede begrenset av `<input type="range" min/max>` i HTML — programmatisk bekreftelse

**Tester:** Enhetstester for valideringsfunksjonen.

---

### Steg 4: SRI pa CDN-scripts (M7)

**Hva:** Legg til `integrity` og `crossorigin="anonymous"` pa alle CDN-lastede scripts i admin.

**Fil:** `src/pages/admin/index.astro` (linje 29-33)

**Berørte script-tags:**
```html
<script src="https://unpkg.com/easymde/dist/easymde.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>
<script src="https://cdn.jsdelivr.net/npm/flatpickr/dist/l10n/no.js"></script>
```
Og tilsvarende CSS-lenke:
```html
<link rel="stylesheet" href="https://unpkg.com/easymde/dist/easymde.min.css">
```

**Implementasjon:** Generer SRI-hasher med `openssl dgst -sha384 -binary < fil | openssl base64 -A` eller bruk https://www.srihash.org/. Alternativt: pin til spesifikke versjoner og bruk `npm`-pakker i stedet for CDN.

**Tester:** Visuell verifisering at admin-editor og datepicker fortsatt fungerer.

---

### Steg 5: Google API-nokkel restriksjon (L1)

**Hva:** Verifisere og dokumentere at `PUBLIC_GOOGLE_API_KEY` har riktige restriksjoner.

**Sjekkliste:**
- HTTP referer-restriksjon til produksjonsdomenet + testdomenet
- API-scope begrenset til Sheets + Drive
- Kvotegrenser satt

**Leveranse:** Dokumentasjon med verifikasjonssteg. Selve endringen gjores manuelt i Google Cloud Console.

---

### Steg 6: Sikkerhetstester

**Hva:** Utvide testsuiten med sikkerhetsfokuserte tester.

**Tester:**
- `escapeHtml()` — verifiser at `<`, `>`, `"`, `&` escapes korrekt, null/undefined handteres
- `uploadImage()` — avviser ikke-bilder, for store filer
- `validateSheetInput()` — maks-lengde, type-sjekk
- DOMPurify saniterer XSS-payloads korrekt i meldingsvisning (eksisterende `messageClient.test.js`, verifiser dekning)
- Verifiser at editor-modulene setter verdier programmatisk (integrasjonstest)

---

### Steg 7: Dokumentasjon og oppsummering

**Hva:** Oppdater `docs/architecture/sikkerhet.md` med funn, tiltak og gjenstande risiko.

**Innhold:**
- Sammendrag av gjennomgangen
- Tiltak utfort (med commit-referanser)
- Akseptert risiko (med begrunnelse)
- Anbefalinger for fremtiden (audit-logging, rate limiting)

---

## Avhengigheter mellom steg

```
Steg 1 (HTML-escaping)      — uavhengig, PRIORITET 1
Steg 2 (filopplasting)      — uavhengig
Steg 3 (input-validering)   — uavhengig
Steg 4 (SRI)                — uavhengig
Steg 5 (API-nokkel)         — uavhengig (manuelt)
Steg 6 (tester)             — avhenger av steg 1, 2 og 3
Steg 7 (dokumentasjon)      — avhenger av alle foregende
```

Steg 1-5 kan gjores i vilkarlig rekkefolge, men steg 1 bor prioriteres da det er det mest konkrete HTML-sikkerhetsproblemet med flest berørte filer.

## Utenfor scope

- **Audit-logging (M6):** Krever et lagringssted (ekstra Sheets-fane, CloudWatch, etc.) — bor vurderes som egen oppgave
- **Rate limiting (L2):** Krever CloudFront/WAF-konfigurasjon — handteres som del av CloudFront prod-oppgaven
- **Token i localStorage (M5):** Akseptert begrensning — ingen HTTPOnly-alternativ for klient-side OAuth. Mitigert av token-expiry, CSP og Google token auto-revoke.
- **`unsafe-inline` (M4):** Nodvendig for Google OAuth (`accounts.google.com`-scripts krever det) og Tailwind v4 (inline style-injeksjon). Kan ikke fjernes uten a bryte funksjonalitet. Mitigert av `script-src` whitelist og DOMPurify.
- **Drive query-injeksjon (L3):** Risikoen er praktisk talt null (krever kompromittert Sheets-tilgang og Google API-parseren er robust). Kan adresseres som del av input-validering i steg 3 ved a sanitere filnavn for de brukes i query-strenger.
- **CloudFront prod-headere:** Handteres av backlog-oppgave 1 (CloudFront prod), ikke denne oppgaven.
- **repository_dispatch uten tester (L6):** Akseptert avveining — byggetid for innholdsoppdateringer er kritisk (ned fra 4 min til 1 min). Koden som bygges er allerede testet pa main. Risikoen er begrenset til at kompromittert Drive-innhold (markdown/bilder) deployes uten e2e-sjekk.
- **Filsletting i sync (L4):** Akseptert — sync-data kjorer kun i CI/build, og sletter kun lokale filer som ikke lengre finnes i Drive. Tannleger har backup via `backupToSlettetSheet()`. Drive har papirkurv med 30 dagers gjenoppretting.
- **Admin-side offentlig tilgjengelig (L5):** Akseptert — admin er rent klient-side, all data/funksjonalitet krever gyldig Google OAuth-token. Sideinnlasting uten auth viser kun innloggingsskjema. `noindex/nofollow` + `robots.txt` Disallow forhindrer indeksering.
