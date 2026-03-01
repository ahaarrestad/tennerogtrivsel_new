# Design: Leaflet + OpenStreetMap kart

> **Status:** Godkjent

## Bakgrunn

Google Maps Embed API overfører brukerens IP-adresse til Google ved hver sidelasting — personopplysning under GDPR, uten samtykke. Erstatter iframen med Leaflet + OpenStreetMap for full cookie/GDPR-compliance.

## Beslutninger

| Valg | Beslutning | Begrunnelse |
|------|-----------|-------------|
| Kartbibliotek | Leaflet.js (npm) | Open source, ingen API-nøkkel, ingen tracking |
| Tiles | CartoDB Voyager | Moderne, profesjonelt utseende, gratis for lave volum |
| Markør | Permanent tooltip med klinikknavnet | Tydelig uten brukeraksjon |
| Veibeskrivelse | Knapp på kartet → Google Maps i ny fane | Åpner native kart-app på mobil |

## Hva endres

### Kontakt.astro — kartdelen (linje 134–144)

Erstatt Google Maps `<iframe>` med:
- `<div id="map">` i samme container-wrapper
- Client-side `<script>` som initialiserer Leaflet

### Kartoppsett

- **Tiles:** `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png`
- **Markør:** Standard Leaflet-pin med `bindTooltip('Tenner og Trivsel', { permanent: true })`
- **Koordinater:** `settings.latitude` / `settings.longitude` (allerede tilgjengelig)
- **Zoom:** 17
- **Attribusjon:** "© OpenStreetMap contributors, © CARTO"

### "Få veibeskrivelse"-knapp

Overlay eller plassert rett under kartet. Lenker til `https://www.google.com/maps/search/?api=1&query={lat},{lng}`. Bruker `btn-secondary` fra designsystemet.

### Container-styling

Beholder: `w-full h-[450px] md:h-[550px] rounded-3xl overflow-hidden shadow-xl border border-brand-border mb-20 relative z-0`

## Hva fjernes

- `mapUrl`-variabelen i Kontakt.astro frontmatter
- `googleApiKey`-referansen i Kontakt.astro (beholdes i admin-auth.js for OAuth)
- Google Maps iframe

## Avhengigheter

- **Legges til:** `leaflet` (npm)
- **Fjernes:** Ingen (API-nøkkelen brukes fortsatt av OAuth)

## Compliance-resultat

| Aspekt | Før | Etter |
|--------|-----|-------|
| IP-overføring til Google | Hver sidelasting | Kun ved klikk "Få veibeskrivelse" |
| Cookies | Tredjepartscookies fra iframe | Ingen |
| API-nøkkel for kart | Påkrevd | Ikke nødvendig |
| GDPR-status | Gap (IP uten samtykke) | Compliant |
