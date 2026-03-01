# GDPR-vurdering Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminere IP-adresse-lekkasje til tredjeparter og etablere personvernerklæring for GDPR-compliance.

**Architecture:** CloudFront tile-proxy eliminerer OSM IP-lekkasje. Ny `/personvern`-side dokumenterer databehandling. Admin-panel får info-banner om localStorage. CSP ryddes for ubrukte Google Fonts-referanser.

**Tech Stack:** AWS CloudFront (eksisterende distribusjon), Astro (statisk side), Leaflet.js, Vitest, Playwright

**Design:** [plan-gdpr-vurdering-design.md](plan-gdpr-vurdering-design.md)

---

### Task 1: CloudFront tile-proxy (manuelt AWS-oppsett)

Disse stegene gjøres manuelt i AWS Console for hver CloudFront-distribusjon (test og prod).

> **Lærdom fra test2-oppsett (mars 2026):**
> - `Host` er en reservert header i CloudFront — kan **ikke** settes som custom origin header.
>   CloudFront sender automatisk `Host: tile.openstreetmap.org` til origin så lenge Origin Request Policy ikke videresender Host fra viewer.
> - CloudFront videresender hele URL-pathen til origin. `/tiles/17/...` sendes som `/tiles/17/...`,
>   men OSM forventer `/17/...`. Løsning: en CloudFront Function som stripper `/tiles`-prefix.

**Step 1: Legg til ny origin**

AWS Console → CloudFront → distribusjon → Origins → Create origin:

| Felt | Verdi |
|------|-------|
| Origin domain | `tile.openstreetmap.org` |
| Protocol | HTTPS only |
| Name | `osm-tiles` |
| Custom headers | *(ingen — la stå tomt)* |

**Step 2: Opprett CloudFront Function**

CloudFront → Functions (sidemenyen) → Create function:

| Felt | Verdi |
|------|-------|
| Name | `strip-tiles-prefix` |
| Runtime | cloudfront-js 2.0 |

Kode:

```javascript
function handler(event) {
    var request = event.request;
    request.uri = request.uri.replace(/^\/tiles/, '');
    return request;
}
```

Klikk **Save changes**, deretter **Publish**.

**Step 3: Legg til ny behavior**

CloudFront → Behaviors → Create behavior:

| Felt | Verdi |
|------|-------|
| Path pattern | `/tiles/*` |
| Origin | `osm-tiles` (fra steg 1) |
| Viewer protocol policy | Redirect HTTP to HTTPS |
| Allowed HTTP Methods | GET, HEAD |
| Restrict viewer access | No |
| Cache key and origin requests | Cache policy and origin request policy |
| Cache policy | CachingOptimized |
| Origin request policy | None |
| Compress objects automatically | Yes |
| **Function associations → Viewer request** | **CloudFront Functions** → `strip-tiles-prefix` |

**Step 4: Vent på deploy og verifiser**

Vent til distribusjonens status endres fra "Deploying" til "Enabled", deretter:

```bash
# Test (bytt domene til den aktuelle distribusjonen):
curl -sI "https://www.tennerogtrivsel.no/tiles/17/67686/37891.png" | head -5
# Forventet: HTTP/2 200, content-type: image/png
```

> **Merk:** OSM kan sende `x-blocked`-header i responsen — dette er en advarsel om bulk-tilgang,
> ikke en faktisk blokkering. For en liten nettside er dette uproblematisk.

**Step 5: Commit (ingen kodeendringer ennå — CloudFront-oppsettet er manuelt)**

---

### Task 2: Oppdater Leaflet tile URL til proxy

**Files:**
- Modify: `src/components/Kontakt.astro:178`

**Step 1: Skriv oppdatert tile URL**

I `src/components/Kontakt.astro`, endre linje 178 fra:
```js
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
```
til:
```js
L.tileLayer('/tiles/{z}/{x}/{y}.png', {
```

Attributten på linje 179 beholdes uendret (OpenStreetMap krever attribusjon uansett proxy).

**Step 2: Verifiser at bygget kompilerer**

Run: `npm run build 2>&1 | tail -5`
Expected: Build completes successfully

**Step 3: Commit**

```
feat(gdpr): bruk CloudFront-proxy for OSM karttiles

Tile-forespørsler går nå via eget domene (/tiles/*) i stedet
for direkte til tile.openstreetmap.org. Eliminerer IP-lekkasje
til tredjepart for besøkende.
```

---

### Task 3: CSP-opprydding — fjern OSM og Google Fonts

**Files:**
- Modify: `src/middleware.ts:3-16`
- Modify: `src/__tests__/middleware.test.ts:43-44`

**Step 1: Oppdater CSP i middleware.ts**

Fjern `https://tile.openstreetmap.org` fra `img-src` (linje 12) og `connect-src` (linje 16) — tiles serveres nå fra `'self'`.

Fjern `https://fonts.googleapis.com` fra `style-src` (linje 8) — fonter er self-hosted.

Fjern `https://fonts.gstatic.com` fra `font-src` (linje 10) — fonter er self-hosted.

Oppdater kommentarene til å reflektere endringene.

Etter endring skal CSP se slik ut:

```typescript
const CSP = [
    "default-src 'self'",
    // Scripts: eget domene + Google APIs + CDN-er brukt i admin-panel
    "script-src 'self' 'unsafe-inline' https://apis.google.com https://accounts.google.com https://cdn.jsdelivr.net https://unpkg.com",
    // Stiler: eget domene + CDN-er brukt i admin-panel
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com",
    // Fonter: eget domene + Font Awesome (cdnjs) + CDN-er brukt i admin-panel
    "font-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
    // Bilder: eget domene + Google Drive-preview + data: URI + blob: (preview-bilder i admin)
    "img-src 'self' data: blob: https://lh3.googleusercontent.com https://drive.google.com https://www.google.com",
    // Iframes: Google Drive + Google OAuth + GAPI iframe-kanaler (content-*.googleapis.com)
    "frame-src https://drive.google.com https://accounts.google.com https://www.google.com https://*.googleapis.com",
    // API-kall: Google APIs + OAuth + telemetri fra Google-skript (gen_204)
    "connect-src 'self' blob: https://www.googleapis.com https://content.googleapis.com https://oauth2.googleapis.com https://accounts.google.com https://apis.google.com https://www.google.com",
].join('; ');
```

**Step 2: Oppdater middleware-test**

I `src/__tests__/middleware.test.ts`, endre testen «CSP inneholder nødvendige domener for kart og auth» (linje 38-53):

- Fjern assertion for `https://tile.openstreetmap.org` (linje 44)
- Legg til ny test som verifiserer at fjernede domener IKKE er i CSP:

```typescript
it('CSP inneholder IKKE fjernede tredjepartsdomener (GDPR)', async () => {
    const handler = await importMiddleware();
    const response = await handler({}, makeNext());
    const csp = response.headers.get('Content-Security-Policy')!;

    // OSM tiles proxyes via CloudFront — skal ikke være i CSP
    expect(csp).not.toContain('tile.openstreetmap.org');
    // Fonter er self-hosted — Google Fonts skal ikke være i CSP
    expect(csp).not.toContain('fonts.googleapis.com');
    expect(csp).not.toContain('fonts.gstatic.com');
});
```

**Step 3: Kjør tester**

Run: `npx vitest run src/__tests__/middleware.test.ts`
Expected: All tests pass

**Step 4: Commit**

```
fix(gdpr): fjern OSM og Google Fonts fra CSP

OSM tiles proxyes nå via CloudFront (/tiles/*), trenger ikke
ekstern CSP-regel. Google Fonts har vært self-hosted lenge —
fjerner ubrukte CSP-referanser for å redusere angrepsflaten.
```

---

### Task 4: Opprett personvernerklæring-side

**Files:**
- Create: `src/pages/personvern.astro`

**Step 1: Opprett siden**

Bruk prosjektets `Layout.astro` og designsystem. Innholdet skal være på norsk og dekke:

1. Behandlingsansvarlig (klinikkens navn og kontaktinfo fra `settings`)
2. Besøkende — ingen persondata samles inn, ingen cookies, ingen analytics
3. Karttiles — serveres via eget domene (CloudFront-proxy), ingen IP til tredjepart
4. "Få veibeskrivelse" — ekstern lenke til Google Maps, brukerens aktive valg
5. Admin-panel — Google OAuth (e-post, navn, bilde), token i localStorage/sessionStorage, CDN-ressurser
6. Ansattprofilbilder — vises med samtykke
7. Tredjepartstjenester — lenker til personvernerklæringene til Google, OpenStreetMap, jsdelivr, unpkg, cdnjs
8. Kontaktinfo for spørsmål

```astro
---
import Layout from '../layouts/Layout.astro';
import { getSiteSettings } from '../scripts/getSettings';
import { getSectionClasses } from '../scripts/sectionVariant';

const settings = await getSiteSettings();
const { sectionBg } = getSectionClasses('brand');
---
<Layout title="Personvernerklæring – Tenner og Trivsel" description="Personvernerklæring for tennerogtrivsel.no">
    <section class={`section-container ${sectionBg}`}>
        <div class="section-content prose prose-brand max-w-3xl mx-auto">
            <h1 class="section-heading">Personvernerklæring</h1>
            <p class="text-sm text-brand-muted">Sist oppdatert: mars 2026</p>

            <h2>Behandlingsansvarlig</h2>
            <p>
                Tenner og Trivsel<br>
                {settings.adresse1}, {settings.adresse2}<br>
                Telefon: {settings.phone1}
            </p>

            <h2>Hvilke data samler vi inn?</h2>
            <p>
                Nettsiden vår samler <strong>ikke</strong> inn personopplysninger fra besøkende.
                Vi bruker ingen analyseverktøy, sporingsteknologi eller informasjonskapsler (cookies).
            </p>

            <h2>Karttjeneste</h2>
            <p>
                Kontaktsiden viser et kart fra OpenStreetMap. Kartbildene (tiles) lastes via vår
                egen server (CloudFront-proxy), slik at din IP-adresse <strong>ikke</strong> sendes
                til OpenStreetMap eller andre tredjeparter.
            </p>

            <h2>Eksterne lenker</h2>
            <p>
                Knappen «Få veibeskrivelse» åpner Google Maps i en ny fane. Dette skjer
                kun når du selv klikker på lenken. Ved å følge lenken forlater du vår
                nettside og blir underlagt
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Googles personvernerklæring</a>.
            </p>

            <h2>Ansattprofiler</h2>
            <p>
                Nettsiden viser navn, tittel, beskrivelse og bilde av ansatte ved klinikken.
                Dette gjøres med samtykke fra de ansatte, og er basert på
                behandlingsgrunnlaget «samtykke» (GDPR art. 6 nr. 1 bokstav a).
            </p>

            <h2>Administrasjonspanel</h2>
            <p>
                Klinikkens ansatte kan logge inn i et administrasjonspanel via Google OAuth.
                Ved innlogging lagres følgende i nettleserens lagringsområde (localStorage eller sessionStorage):
            </p>
            <ul>
                <li>Autentiseringstoken fra Google</li>
                <li>Navn, e-postadresse og profilbilde (fra Google-kontoen)</li>
            </ul>
            <p>
                Denne informasjonen lagres kun lokalt i nettleseren og slettes ved utlogging
                eller når nettleserøkten avsluttes (avhengig av «Husk meg»-valget).
            </p>
            <p>
                Admin-panelet laster ressurser fra følgende CDN-tjenester, som mottar
                administratorens IP-adresse:
            </p>
            <ul>
                <li><a href="https://www.jsdelivr.com/terms/privacy-policy-jsdelivr-net" target="_blank" rel="noopener noreferrer">jsDelivr</a></li>
                <li><a href="https://www.unpkg.com" target="_blank" rel="noopener noreferrer">unpkg</a></li>
                <li><a href="https://cdnjs.cloudflare.com/" target="_blank" rel="noopener noreferrer">cdnjs (Cloudflare)</a></li>
            </ul>

            <h2>Kontakt</h2>
            <p>
                Har du spørsmål om personvern? Ta kontakt med oss på telefon {settings.phone1}
                {settings.showEmail === "ja" && settings.email && (
                    <span> eller e-post <a href={`mailto:${settings.email}`}>{settings.email}</a></span>
                )}.
            </p>
        </div>
    </section>
</Layout>
```

**Step 2: Verifiser at siden bygger**

Run: `npm run build 2>&1 | tail -10`
Expected: Build includes `/personvern/index.html`

**Step 3: Commit**

```
feat(gdpr): legg til personvernerklæring-side

Ny /personvern-side som dekker: ingen datainnsamling fra besøkende,
CloudFront-proxied karttiles, ekstern lenke til Google Maps,
admin OAuth/localStorage, ansattbilder med samtykke.
```

---

### Task 5: Legg til footer-lenke til personvernerklæringen

**Files:**
- Modify: `src/components/Footer.astro:80-82`

**Step 1: Legg til lenke i copyright-linjen**

I `src/components/Footer.astro`, endre copyright-seksjonen (linje 80-82) fra:

```html
<div class="border-t border-accent mt-10 pt-6 text-center text-white/50 text-xs">
    <p>&copy; {currentYear} Tenner og Trivsel</p>
</div>
```

til:

```html
<div class="border-t border-accent mt-10 pt-6 text-center text-white/50 text-xs">
    <p>&copy; {currentYear} Tenner og Trivsel · <a href="/personvern" class="hover:text-white transition-colors underline">Personvern</a></p>
</div>
```

**Step 2: Verifiser visuelt**

Run: `npm run dev` og sjekk footeren i nettleseren.

**Step 3: Commit**

```
feat(gdpr): legg til personvern-lenke i footer
```

---

### Task 6: Admin info-banner om localStorage

**Files:**
- Modify: `src/pages/admin/index.astro:119-120` (etter login-knappen)

**Step 1: Legg til info-tekst under innloggingsknappen**

I `src/pages/admin/index.astro`, etter `</button>` på linje 119, legg til:

```html
            <p class="text-xs text-admin-muted text-center mt-2">
                Ved innlogging lagres autentiseringstoken i nettleseren din.
                <a href="/personvern" class="underline hover:text-white transition-colors">Les vår personvernerklæring</a>.
            </p>
```

**Step 2: Verifiser visuelt**

Run: `npm run dev` og sjekk admin-panelet i nettleseren.

**Step 3: Commit**

```
feat(gdpr): admin info-banner om localStorage-bruk
```

---

### Task 7: Oppdater E2E-tester og verifiser

**Files:**
- Modify: `tests/csp-check.spec.ts:6` (legg til `/personvern` i PAGES)
- Modify: `tests/seo.spec.ts` (legg til personvern-side om relevant)

**Step 1: Legg til /personvern i CSP-sjekk**

I `tests/csp-check.spec.ts`, endre linje 6:

```typescript
const PAGES = ['/', '/admin', '/kontakt', '/personvern'];
```

**Step 2: Kjør alle unit-tester**

Run: `npx vitest run`
Expected: All tests pass

**Step 3: Verifiser bygg**

Run: `npm run build`
Expected: Build succeeds, includes `/personvern/index.html`

**Step 4: Commit**

```
test(gdpr): legg til personvern-side i E2E CSP-sjekk
```

---

### Task 8: Oppdater TODO.md og arkiver

**Files:**
- Modify: `TODO.md`
- Modify: `TODO-archive.md`

**Step 1: Flytt oppgaven til «Fullført» i TODO.md**

Fjern GDPR-oppgaven fra Backlog og legg til i Fullført (eller flytt til TODO-archive.md per prosjektets arbeidsflyt).

**Step 2: Commit**

```
chore: marker GDPR-vurdering som fullført
```
