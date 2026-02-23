# Plan: Grundig sikkerhetssjekk av hele prosjektet

## Bakgrunn

Det er gjort en uformell sikkerhetsgjennomgang tidligere, men mye kode er endret siden da. Denne planen dekker hele stacken: frontend, admin-panel, API-endepunkter, CSP, autentisering og dataflyt.

## Forutsetninger

- Prosjektet er en **statisk Astro-side** deployet til AWS S3 + CloudFront
- Admin-panelet er **klient-side** med Google OAuth — ingen backend-server i produksjon
- `src/middleware.ts` kjører kun i dev/SSR, **ikke** i produksjon (S3)
- `.env` er gitignored og har aldri vært committet

## Risikoområder og funn (fra kartlegging)

### 🔴 Kritisk

Ingen kritiske funn. `.env` er korrekt gitignored og aldri committet.

### 🟡 Medium

| # | Område | Funn | Risiko |
|---|--------|------|--------|
| M1 | CSP i produksjon | Middleware-headere (CSP, X-Frame-Options, m.fl.) kjører **ikke** i S3-produksjon. Ingen CloudFront Response Headers Policy konfigurert. | XSS/clickjacking-beskyttelse mangler i prod |
| M2 | `unsafe-inline` i CSP | Nødvendig for Google OAuth og Tailwind, men svekker CSP | Redusert XSS-beskyttelse |
| M3 | Admin input-validering | Ingen validering på Sheets-mutasjoner (`updateSettingByKey`, `updateGalleriRow`, etc.) — verdier sendes rett til API | Data-korrupsjon ved kompromittert token |
| M4 | Filopplasting | `uploadImage()` validerer ikke MIME-type eller filstørrelse | Vilkårlige filer kan lastes opp til Drive |
| M5 | Token i localStorage | OAuth access token i localStorage/sessionStorage, sårbar for XSS | Token-tyveri |
| M6 | Ingen audit-logging | Admin-handlinger logges ikke — ingen sporbarhet | Vanskelig å oppdage misbruk |

### 🟢 Lav

| # | Område | Funn |
|---|--------|------|
| L1 | API-nøkkel | `PUBLIC_GOOGLE_API_KEY` bør ha referer-restriksjon i Google Cloud Console |
| L2 | Offentlig API | `/api/active-messages.json` har ingen rate limiting |
| L3 | Drive query-injeksjon | Template-strenger i `gapi.client.drive.files.list` query — ikke utnyttbart men dårlig praksis |
| L4 | Filsletting i sync | Stale filer slettes uten soft-delete/backup |
| L5 | Admin-side offentlig tilgjengelig | `/admin/` er tilgjengelig for alle (kun klient-side auth) |

### ✅ Fungerer bra

- **DOMPurify** brukes konsekvent og korrekt på all innerHTML med CMS-data
- **Event-handlere** knyttes programmatisk etter sanitering (aldri inline)
- **npm audit**: 0 sårbarheter, alle deps oppdaterte
- **OAuth-flyt**: Korrekt implementert med token-expiry, logout ved 401/403
- **Numerisk validering** i sync-data.js: scale [1.0–3.0], posisjon [0–100]
- **`valueInputOption: 'RAW'`** forhindrer formel-injeksjon i Sheets
- **robots.txt** disallower `/admin`

## Gjennomføringsplan

### Steg 1: CloudFront Response Headers Policy (M1)

**Hva:** Dokumentere hvilke sikkerhetsheadere som trengs i CloudFront, og lage en oppskrift for å konfigurere dem.

**Detaljer:**
- CSP (identisk med middleware.ts)
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`

**Leveranse:** Dokumentasjon med AWS CLI-kommandoer eller CloudFormation-snippet.

**Merknad:** Selve CloudFront-konfigurasjonen gjøres manuelt av eier — dette steget produserer kun dokumentasjon.

---

### Steg 2: Input-validering i admin-mutasjoner (M3)

**Hva:** Legg til klient-side validering før data sendes til Google Sheets API.

**Filer:** `src/scripts/admin-client.js`, `src/scripts/admin-dashboard.js`

**Valideringer:**
- Tekstfelter: maks lengde (f.eks. 255 tegn for titler, 2000 for beskrivelser)
- Numeriske felter: range-sjekk (scale 1.0–3.0, posisjon 0–100)
- Boolske felter: kun `true`/`false`/`'TRUE'`/`'FALSE'`
- Returnerer bruker-synlig feilmelding ved ugyldig input

**Tester:** Enhetstester for valideringsfunksjoner.

---

### Steg 3: Filopplastings-validering (M4)

**Hva:** Valider filtype og størrelse ved opplasting.

**Fil:** `src/scripts/admin-client.js` → `uploadImage()`

**Valideringer:**
- Tillatte MIME-typer: `image/jpeg`, `image/png`, `image/webp`
- Maks filstørrelse: 10 MB
- Filnavn-sanitering: fjern spesialtegn

**Tester:** Enhetstester for valideringslogikk.

---

### Steg 4: Google API-nøkkel restriksjon (L1)

**Hva:** Verifisere og dokumentere at `PUBLIC_GOOGLE_API_KEY` har riktige restriksjoner.

**Sjekkliste:**
- HTTP referer-restriksjon til produksjonsdomenet
- API-scope begrenset til Sheets + Drive
- Kvotegrenser satt

**Leveranse:** Dokumentasjon med verifikasjonssteg. Selve endringen gjøres i Google Cloud Console.

---

### Steg 5: Sikkerhetstester (ny)

**Hva:** Utvide testsuiten med sikkerhetsfokuserte tester.

**Tester:**
- CSP-header inneholder forventede direktiver (eksisterende `csp-check.spec.ts` — verifiser at den dekker alle krav)
- DOMPurify saniterer XSS-payloads korrekt i meldingsvisning
- Admin-funksjoner avviser ugyldig input (fra steg 2–3)
- Token-håndtering: utløpt token trigrer re-auth

---

### Steg 6: Dokumentasjon og oppsummering

**Hva:** Skriv en sikkerhetsrapport med funn, tiltak og gjenstående risiko.

**Innhold:**
- Sammendrag av gjennomgangen
- Tiltak utført (med commit-referanser)
- Akseptert risiko (med begrunnelse)
- Anbefalinger for fremtiden (audit-logging, rate limiting)

---

## Avhengigheter mellom steg

```
Steg 1 (CloudFront docs)  — uavhengig
Steg 2 (input-validering) — uavhengig
Steg 3 (filopplasting)    — uavhengig
Steg 4 (API-nøkkel)       — uavhengig
Steg 5 (tester)           — avhenger av steg 2 og 3
Steg 6 (dokumentasjon)    — avhenger av alle foregående
```

Steg 1–4 kan gjøres i vilkårlig rekkefølge.

## Utenfor scope

- **Audit-logging (M6):** Krever et lagringssted (ekstra Sheets-fane, CloudWatch, etc.) — bør vurderes som egen oppgave
- **Rate limiting (L2):** Krever CloudFront/WAF-konfigurasjon — tas med i CI/CD-forbedringer
- **Token i localStorage (M5):** Akseptert begrensning — ingen HTTPOnly-alternativ for klient-side OAuth. Mitigert av token-expiry og CSP.
- **`unsafe-inline` (M2):** Nødvendig for Google OAuth og Tailwind v4. Kan ikke fjernes uten å bryte funksjonalitet.
