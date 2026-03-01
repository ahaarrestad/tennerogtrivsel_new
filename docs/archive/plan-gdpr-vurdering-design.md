# Design: Full GDPR-vurdering av prosjektet

> **Status:** Godkjent — klar for implementeringsplan
> **Dato:** 2026-03-01
> **Tilnærming:** Defensiv (B)

## Bakgrunn

Prosjektet er en statisk Astro-nettside for en tannklinikk, hostet på AWS S3 med CloudFront. Ingen brukerdata samles inn direkte (ingen skjema, ingen analytics, ingen cookies). Eneste GDPR-risiko er IP-adresser som automatisk sendes til tredjeparter.

### Funn fra kartlegging

| Kilde | Hvem rammes | Trigger | IP sendes til | Risiko |
|-------|------------|---------|---------------|--------|
| OSM-tiles | Alle besøkende (kontaktside) | Automatisk sidelasting | OpenStreetMap Foundation | **HØY** |
| "Få veibeskrivelse"-lenke | Kun ved klikk | Brukerens valg | Google | Lav (bevisst valg) |
| Admin CDN (jsdelivr, unpkg, cdnjs) | Kun admin | Innlogging | CDN-leverandører | Lav (admin) |
| Admin Google OAuth | Kun admin | Innlogging | Google | Lav (admin, samtykke) |

**Ikke-risiko:**
- Fonter: Self-hosted woff2 — ingen IP-lekkasje
- Ingen analytics, tracking pixels eller cookies for vanlige besøkende
- "Få veibeskrivelse" er en vanlig hyperlink — brukerens aktive valg, GDPR-uproblematisk

## Design

### 1. CloudFront tile-proxy (eliminerer OSM IP-lekkasje)

Legg til ny origin og behavior i **eksisterende** CloudFront-distribusjon for `www.tennerogtrivsel.no`:

- **Ny origin:** `tile.openstreetmap.org` (HTTPS)
- **Ny behavior:** Path pattern `/tiles/*` → OSM-origin, CachingOptimized
- **Leaflet-oppdatering:** Tile URL endres fra `https://tile.openstreetmap.org/{z}/{x}/{y}.png` til `/tiles/{z}/{x}/{y}.png`
- **CSP-oppdatering:** Fjern `tile.openstreetmap.org` fra `img-src` og `connect-src`

**Resultat:** Besøkende kontakter kun eget domene via CloudFront. Ingen IP overføres til OSM.

### 2. Personvernerklæring (`/personvern`)

Ny Astro-side med innhold:

1. **Behandlingsansvarlig** — Tenner og Trivsel, kontaktinfo
2. **Data vi behandler:**
   - Ingen personopplysninger samles inn fra besøkende
   - Karttiles serveres via eget domene
   - "Få veibeskrivelse" åpner Google Maps (brukerens valg, Googles vilkår)
3. **Admin-panel:**
   - Google OAuth-autentisering (e-post, navn, profilbilde)
   - Token lagres i nettleserens localStorage/sessionStorage
   - CDN-ressurser fra jsdelivr, unpkg, cdnjs (IP synlig)
4. **Ansattprofilbilder** — vises med innhentet samtykke
5. **Tredjepartstjenester** — lenker til deres personvernerklæringer
6. **Kontaktinfo** for personvernspørsmål

**Footer-lenke:** Legg til "Personvern" i footeren med lenke til `/personvern`.

### 3. Admin info-banner (localStorage-transparens)

Kort informasjonstekst under innloggingsknappen i admin-panelet:

> "Ved innlogging lagres autentiseringstoken i nettleseren din. Les mer i vår [personvernerklæring](/personvern)."

### 4. CSP-opprydding

Fjern ubrukte referanser i `src/middleware.ts`:
- `fonts.googleapis.com` fra `style-src`
- `fonts.gstatic.com` fra `font-src`

Disse er rester fra før fontene ble self-hosted.

## Utenfor scope

- DPIA (Data Protection Impact Assessment) — ikke påkrevd for denne risikoprofilen
- Cookie-banner — ingen cookies settes for vanlige besøkende
- Self-hosting av admin CDN-avhengigheter — akseptabelt for admin-brukere
- Formelt behandlingsregister (art. 30) — kan vurderes senere
