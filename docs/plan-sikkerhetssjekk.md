# Plan: Grundig sikkerhetssjekk av hele prosjektet

## Bakgrunn

Det er gjort en uformell sikkerhetsgjennomgang tidligere, men mye kode er endret siden da. Denne planen dekker hele stacken: frontend, admin-panel, API-endepunkter, CSP, autentisering og dataflyt.

## Forutsetninger

- Prosjektet er en **statisk Astro-side** deployet til AWS S3 + CloudFront
- Admin-panelet er **klient-side** med Google OAuth — ingen backend-server i produksjon
- `src/middleware.ts` kjører kun i dev/SSR, **ikke** i produksjon (S3)
- `.env` er gitignored og har aldri vært committet

## Risikoområder og funn (oppdatert feb 2026)

### 🔴 Kritisk

Ingen kritiske funn.

### 🟡 Medium

| # | Område | Funn | Risiko |
|---|--------|------|--------|
| M1 | HTML-attributt-escaping | Template literals i admin-moduler bruker Sheets-data direkte i `value="..."` og `<textarea>...</textarea>` — ingen HTML-escaping. Eksempel: `value="${t.name}"` i `admin-module-tannleger.js`. En `</textarea><script>...` payload i Sheets-tekst ville bryte textarea-strukturen. | DOM-korrupsjon ved manipulert Sheets-data |
| M2 | Filopplasting | `uploadImage()` i `admin-client.js` validerer ikke MIME-type, filstørrelse eller filnavn | Vilkårlige filer kan lastes opp til Drive |
| M3 | Admin input-validering | Ingen validering på Sheets-mutasjoner (`updateSettingByKey`, `updateTannlegeRow`, etc.) — ingen maks-lengde, range-sjekk eller type-sjekk | Data-korrupsjon, uventet oppførsel |
| M4 | `unsafe-inline` i CSP | Nødvendig for Google OAuth og Tailwind, men svekker CSP | Redusert XSS-beskyttelse |
| M5 | Token i localStorage | OAuth access token i localStorage/sessionStorage, sårbar for XSS | Token-tyveri |
| M6 | Ingen audit-logging | Admin-handlinger logges ikke — ingen sporbarhet | Vanskelig å oppdage misbruk |

### 🟢 Lav

| # | Område | Funn |
|---|--------|------|
| L1 | API-nøkkel | `PUBLIC_GOOGLE_API_KEY` bør ha referer-restriksjon i Google Cloud Console |
| L2 | Offentlig API | `/api/active-messages.json` har ingen rate limiting |
| L3 | Drive query-injeksjon | Template-strenger i `gapi.client.drive.files.list` bruker filnavn fra Sheets — `findFileByName(item.image, ...)`. Ikke utnyttbart i praksis, men bryter prinsippet om parametriserte spørringer. |
| L4 | Filsletting i sync | Stale filer slettes uten soft-delete/backup |
| L5 | Admin-side offentlig tilgjengelig | `/admin/` er tilgjengelig for alle (kun klient-side auth) |

### ✅ Adressert / Fungerer bra

- **CloudFront Response Headers Policy** satt opp på test-siden (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) — prod følger med CloudFront prod-oppgaven
- **DOMPurify** brukes konsekvent på all `innerHTML` med CMS-data
- **Event-handlere** knyttes programmatisk etter sanitering (aldri inline)
- **npm audit**: 0 sårbarheter, alle deps oppdaterte
- **OAuth-flyt**: Korrekt implementert med token-expiry, logout ved 401/403, auto-retry
- **Numerisk validering** i `sync-data.js`: scale [1.0–3.0], posisjon [0–100]
- **`valueInputOption: 'RAW'`** forhindrer formel-injeksjon i Sheets
- **robots.txt** disallower `/admin`

## Gjennomføringsplan

### Steg 1: HTML-attributt-escaping i template literals (M1)

**Hva:** Legg til en liten `escapeHtml()`-hjelpefunksjon og bruk den i alle steder der Sheets-data settes inn i HTML-attributter eller textarea-innhold.

**Berørte filer:**
- `src/scripts/admin-module-settings.js` — `value="${setting.value}"` i input-felt
- `src/scripts/admin-module-tannleger.js` — `value="${t.name}"`, `value="${t.title}"`, `value="${t.image}"`, `>${t.description}</textarea>`
- `src/scripts/admin-module-bilder.js` — verifiser at galleri-data er sikret
- `src/scripts/admin-module-meldinger.js` — verifiser at meldingsdata er sikret
- `src/scripts/admin-editor-helpers.js` — verifiser template literals med data

**Implementasjon:**
```javascript
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
```

**Tester:** Enhetstester som verifiserer at `<`, `>`, `"`, `'`, `&` i Sheets-data ikke bryter HTML-struktur.

---

### Steg 2: Filopplastings-validering (M2)

**Hva:** Valider filtype og størrelse ved opplasting.

**Fil:** `src/scripts/admin-client.js` → `uploadImage()`

**Valideringer:**
- Tillatte MIME-typer: `image/jpeg`, `image/png`, `image/webp`
- Maks filstørrelse: 10 MB
- Filnavn-sanitering: fjern spesialtegn (behold kun `[a-zA-Z0-9._-]`)
- Returner bruker-synlig feilmelding via `showToast(..., 'error')` ved avvisning

**Tester:** Enhetstester for alle tre valideringer.

---

### Steg 3: Input-validering i admin-mutasjoner (M3)

**Hva:** Legg til klient-side validering før data sendes til Google Sheets API.

**Filer:** `src/scripts/admin-client.js`, evt. i module-filene før kall

**Valideringer:**
- Tekstfelter: maks lengde (255 tegn for korte felter, 2000 for beskrivelser)
- Numeriske felter: range-sjekk (scale 1.0–3.0, posisjon 0–100)
- Boolske felter: kun `true`/`false`/`'TRUE'`/`'FALSE'`
- Returnerer bruker-synlig feilmelding ved ugyldig input

**Tester:** Enhetstester for valideringsfunksjoner.

---

### Steg 4: Google API-nøkkel restriksjon (L1)

**Hva:** Verifisere og dokumentere at `PUBLIC_GOOGLE_API_KEY` har riktige restriksjoner.

**Sjekkliste:**
- HTTP referer-restriksjon til produksjonsdomenet
- API-scope begrenset til Sheets + Drive
- Kvotegrenser satt

**Leveranse:** Dokumentasjon med verifikasjonssteg. Selve endringen gjøres manuelt i Google Cloud Console.

---

### Steg 5: Sikkerhetstester (ny)

**Hva:** Utvide testsuiten med sikkerhetsfokuserte tester.

**Tester:**
- `escapeHtml()` — verifiser at spesialtegn escapes korrekt
- `uploadImage()` — avviser ikke-bilder, for store filer, ugyldige filnavn
- Input-validering — maks-lengde, range, type avvises med forventet feilmelding
- DOMPurify saniterer XSS-payloads korrekt i meldingsvisning (eksisterende `messageClient.test.js`, verifiser dekning)
- Verifiser at `csp-check.spec.ts` dekker alle CSP-direktiver i `middleware.ts`

---

### Steg 6: Dokumentasjon og oppsummering

**Hva:** Skriv en oppdatert sikkerhetsrapport med funn, tiltak og gjenstående risiko.

**Innhold:**
- Sammendrag av gjennomgangen
- Tiltak utført (med commit-referanser)
- Akseptert risiko (med begrunnelse)
- Anbefalinger for fremtiden (audit-logging, rate limiting)

---

## Avhengigheter mellom steg

```
Steg 1 (HTML-escaping)      — uavhengig
Steg 2 (filopplasting)      — uavhengig
Steg 3 (input-validering)   — uavhengig
Steg 4 (API-nøkkel)         — uavhengig
Steg 5 (tester)             — avhenger av steg 1, 2 og 3
Steg 6 (dokumentasjon)      — avhenger av alle foregående
```

Steg 1–4 kan gjøres i vilkårlig rekkefølge, men steg 1 bør prioriteres da det er det mest konkrete HTML-sikkerhetsproblemet.

## Utenfor scope

- **Audit-logging (M6):** Krever et lagringssted (ekstra Sheets-fane, CloudWatch, etc.) — bør vurderes som egen oppgave
- **Rate limiting (L2):** Krever CloudFront/WAF-konfigurasjon
- **Token i localStorage (M5):** Akseptert begrensning — ingen HTTPOnly-alternativ for klient-side OAuth. Mitigert av token-expiry og CSP.
- **`unsafe-inline` (M4):** Nødvendig for Google OAuth og Tailwind v4. Kan ikke fjernes uten å bryte funksjonalitet.
- **Drive query-injeksjon (L3):** Risikoen er praktisk talt null (krever kompromittert Sheets-tilgang og Google API-parseren er robust), men kan adresseres som del av input-validering i steg 3.
- **CloudFront prod-headere:** Håndteres av backlog-oppgave 1 (CloudFront prod), ikke denne oppgaven.
