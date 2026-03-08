# Plan: Gjennomgang av admin-seksjonsnavn

**Dato:** 2026-03-08
**Status:** Godkjent design

## Mål

Gjennomgå og oppdatere admin-panelets seksjonsnavn for å gi et konsistent "tannklinikk-univers" med leken humor som også er forståelig for ikke-fagfolk.

## Designvalg

- Alle kortnavn er **substantiv** for konsistent stil
- Beskrivelsene er korte og rett på sak
- Klinikkmetaforen holder seg gjennom hele rekken

## Endringer

### Dashboard (beholdes uendret)

- **Tittel:** "Behandlingsrommet"
- **Undertittel:** "Her pleier vi innholdet slik at nettsiden alltid viser seg fra sin beste side."

### Seksjonskort (dashboard)

| # | Seksjon | Før (kortnavn) | Etter (kortnavn) | Etter (beskrivelse) |
|---|---------|----------------|-------------------|----------------------|
| 1 | Innstillinger | "Ta en rutinesjekk" | "Rutinesjekken" | "Telefonnumre, åpningstider og nettsidetitler." |
| 2 | Tjenester | "Finpuss behandlingene" | "Finpussen" | "Rediger tekst og innhold for tannhelsetjenestene." |
| 3 | Meldinger | "Heng opp oppslag" | "Oppslagstavla" | "Lag og administrer aktive meldinger og infobannere." |
| 4 | Tannleger | "Puss på profilene" | "Tannlegekrakken" | "Oppdater ansattinfo og last opp nye portretter." |
| 5 | Bilder | "Røntgengalleriet" | "Røntgenbildene" | "Forsidebilde og galleri med zoom og utsnitt." |
| 6 | Prisliste | "Juster prisene" | "Takstlista" | "Administrer priser for alle behandlinger." |

### Modultitler (undersider)

Når man klikker på et kort vises modultittelen i `#module-title`. Disse oppdateres til å matche kortnavnene:

| # | Før (modultittel) | Etter (modultittel) |
|---|-------------------|---------------------|
| 1 | "Innstillinger" | "Rutinesjekken" |
| 2 | "Tjenester" | "Finpussen" |
| 3 | "Meldinger" | "Oppslagstavla" |
| 4 | "Tannleger" | "Tannlegekrakken" |
| 5 | "Bilder" | "Røntgenbildene" |
| 6 | "Prisliste" | "Takstlista" |

Funksjonelle subheadings inne i modulene (f.eks. "Rediger profil", "Forhåndsvisning", "Ny prisrad") beholdes uendret — de beskriver handlinger, ikke seksjoner.

## Berørte filer

- `src/pages/admin/index.astro` — kortoverskrifter og beskrivelser (linje ~134–168)
- `src/scripts/admin-init.js` — modultittel-mapping (linje ~135–141)

## Implementeringssteg

1. Oppdater de 6 kortoverskriftene i `src/pages/admin/index.astro`
2. Oppdater de tilhørende beskrivelsene i `src/pages/admin/index.astro`
3. Oppdater modultittel-mappingen i `src/scripts/admin-init.js`
4. Verifiser at admin-siden rendrer korrekt (`npm run build`)
5. Kjør eksisterende tester for å sikre at ingenting brekker
