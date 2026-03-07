# Design: Forbedringer etter brukertesting

**Dato:** 2026-03-07
**Status:** Godkjent

## Bakgrunn

Etter brukertesting (primært på mobil) kom det fire hovedtilbakemeldinger:

1. Sticky card-stabling på mobil oppleves som "pop-up" og er uønsket
2. Tannleger-seksjonen trenger redesign
3. Tjenester-seksjonen trenger redesign med prioritert rekkefølge
4. Prisliste mangler

I tillegg: fjerne `sentralbordTekst` fra footer, og legge til prisliste-lenke i navbar + footer.

---

## 1. Fjern sticky card-stabling på mobil

### Hva
`.stack-card`-klassen i `global.css` gjør kort `position: sticky` på mobil (< 768px), med en offset som øker per kort. Dette skaper en "stabling"-effekt der kort glir oppå hverandre.

### Endring
- Fjern `position: sticky` fra `.stack-card` på mobil
- Kort vises som vanlig vertikal liste som scroller naturlig
- Desktop-grid (2-3 kolonner) forblir uendret
- Berørte seksjoner: Kontakt, Tjenester, Tannleger, Galleri

### Berørte filer
- `src/styles/global.css` — `.stack-card` media query for mobil

---

## 2. Redesign tannleger-seksjonen

### Forsiden (index.astro)
- Erstatt dagens kortraster med **én stor klikkbar boks** med fellesbilde
- Tekst: "Våre tannleger" (fra settings)
- Klikk navigerer til `/tannleger`
- Fellesbilde: placeholder inntil bildet er tatt — kan administreres via Google Drive

### /tannleger-siden
- **Nytt layout:** Små bilder i rutenett, 3 per rad (desktop), 2 per rad (mobil)
- Under hvert bilde: navn og tittel
- **Klikk:** Utvider en info-seksjon (accordion) under bildet med beskrivelsen
- Ingen animasjonseffekter (ingen sticky, ingen pop-up)
- Inspirasjon: tannlegeloftet.no

### Berørte filer
- `src/components/Tannleger.astro` — forside-komponent, ny layout med fellesbilde
- `src/pages/tannleger.astro` — ny layout med grid og accordion
- Ny asset: fellesbilde-placeholder

---

## 3. Redesign tjenester-seksjonen

### Forsiden
- Vis kun de **6 første tjenestene** basert på prioritet (fra Google Sheets)
- Faste bokser uten sticky-effekt
- Under boksene: knapp **"Klikk her for å se mer av våre tjenester"**
- Klikk på knappen viser resten av tjenestene

### Google Sheets
- Nytt felt: `priority` (heltall) i tjeneste-arket
- Tjenester sorteres etter priority-verdi
- De 6 laveste prioritetene vises umiddelbart, resten bak knappen

### sync-data / content collection
- `priority`-felt legges til i tjeneste-schema
- Sortering endres fra alfabetisk til priority-basert

### Berørte filer
- `src/components/Tjenester.astro` — vis 6 + "vis mer"-knapp
- `src/content/config.ts` — priority-felt i tjeneste-schema
- `src/scripts/sync-data.js` — hent priority fra Sheets
- Google Sheets: ny kolonne

---

## 4. Prisliste — ny side og admin-modul

### Google Sheets
- Nytt ark: `Prisliste`
- Kolonner: `Kategori`, `Behandling`, `Pris`
- Rader med samme kategori grupperes automatisk

### Ny side: `/prisliste`
- Henter data fra Google Sheets via `sync-data.js`
- Viser kategorisert tabell med overskrifter per kategori
- Ren, lesbar layout (A4-inspirert)
- Content collection: `prisliste` (JSON-data synkronisert fra Sheets)

### Admin-panel
- Ny admin-modul for prisliste
- CRUD: legge til, redigere, slette rader
- Felter: Kategori (dropdown/tekst), Behandling, Pris

### Navigasjon
- Ny lenke "Prisliste" i **navbar** og **footer**

### Berørte filer
- `src/pages/prisliste.astro` — ny side
- `src/scripts/sync-data.js` — hente prisliste-data
- `src/content/config.ts` — prisliste-schema
- `src/components/Navbar.astro` — ny menylenke
- `src/components/Footer.astro` — ny lenke + fjern sentralbordTekst
- `src/pages/admin/index.astro` — ny modul
- `src/scripts/admin-module-prisliste.js` — ny admin-modul

---

## 5. Footer-justeringer

### Endring
- Fjern `sentralbordTekst` fra footer (telefonnummer beholdes)
- Legg til lenke til `/prisliste`

### Berørte filer
- `src/components/Footer.astro`
