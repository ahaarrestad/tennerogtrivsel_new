# Design: Forbedringer etter brukertesting

**Dato:** 2026-03-07
**Status:** Delvis implementert
**Sist oppdatert:** 2026-03-07

### Fremdrift

| Seksjon | Status |
|---------|--------|
| 1. Fjern sticky card-stabling | Fullført |
| 2. Redesign tannleger-seksjonen | Fullført |
| 3. Redesign tjenester-seksjonen | Ikke startet |
| 4. Prisliste — ny side og admin-modul | Ikke startet |
| 5. Footer-justeringer | Ikke startet |

## Bakgrunn

Etter brukertesting (primært på mobil) kom det fire hovedtilbakemeldinger:

1. Sticky card-stabling på mobil oppleves som "pop-up" og er uønsket
2. Tannleger-seksjonen trenger redesign
3. Tjenester-seksjonen trenger redesign med prioritert rekkefølge
4. Prisliste mangler

I tillegg: fjerne `sentralbordTekst` fra footer, og legge til prisliste-lenke i navbar + footer.

### Dokumentasjonsoppdateringer

Følgende dokumenter må oppdateres som del av implementeringen:

**Design-guide (`docs/designs/design-guide.md`):**
- Seksjon 5.3 (Bilder): Legg til fellesbilde-kontekst for tannleger forside
- Ny seksjon 5.7: Accordion-komponent spec (`<details>`/`<summary>`)
- Seksjon 5.5 (Footer): Oppdater lenkestruktur (prisliste inn, sentralbordTekst ut)
- Seksjon 6 (Responsivt): Oppdater tannleger-grid (3 desktop / 2 mobil for ny layout)
- Seksjon 8.1 (Forsiden): Oppdater tannleger fra kort-grid til fellesbilde-boks, merk synlig på mobil
- Ny seksjon 8.6: Prisliste-side spec (kort-liste layout, mobil, typografi)

**Arkitekturdokumenter (`docs/architecture/`):**
- `bildehåndtering.md`: Legg til fellesbilde-flyt for tannleger-gruppebilde
- Ny fil `prisliste.md`: Dataflyt Sheets → sync-data → content collection → side + admin
- `sikkerhet.md`: Legg til prisliste admin-modul i berørte filer

---

## 1. Fjern sticky card-stabling på mobil

### Hva
`.stack-card`-klassen i `global.css` gjør kort `position: sticky` på mobil (< 768px), med en offset som øker per kort via `--card-index`. Dette skaper en "stabling"-effekt der kort glir oppå hverandre.

### Endring
- Fjern `position: sticky` og tilhørende `top`-beregning fra `.stack-card` på mobil
- Fjern `margin-bottom: 6vh` (mobil stabling-margin) — bruk standard `gap`-spacing fra grid
- Fjern `z-index: var(--card-index)` på mobil (unødvendig uten sticky)
- Behold `--card-index` CSS custom property — brukes fortsatt for desktop-effekter
- Kort vises som vanlig vertikal liste som scroller naturlig
- Desktop-grid (2-3 kolonner) forblir uendret
- Berørte seksjoner: Kontakt, Tjenester, Tannleger, Galleri

### `isStack`-prop i Card.astro
Proppen beholdes — den styrer desktop-oppførsel (progress-bar, z-index). Mobil-sticky fjernes
via CSS-endring, ikke komponent-endring.

### Berørte filer
- `src/styles/global.css` — `.stack-card` media query for mobil

---

## 2. Redesign tannleger-seksjonen

### Forsiden (index.astro)

**Endring fra design-guide 8.1:** Tannleger-seksjonen endres fra `hidden md:block` til
**synlig på alle skjermstørrelser**. Den nye fellesbilde-boksen er kompakt nok for mobil
og gir direkte tilgang til `/tannleger` uten navigasjonsmenyen.

- Erstatt dagens kortraster med **én stor klikkbar boks** med fellesbilde
- Tekst: "Våre tannleger" (fra settings)
- Klikk navigerer til `/tannleger`
- Fellesbilde: placeholder inntil bildet er tatt — kan administreres via Google Drive

**Styling (følger design-guide tokens):**

```css
/* Fellesbilde-boks — bruker card-base tokens */
.tannleger-hero-link {
  @apply block rounded-2xl overflow-hidden;
  @apply border border-brand-border/60 shadow-sm;
  @apply transition-all duration-300;
  @apply hover:shadow-md hover:border-brand-border;
  @apply focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand;
}
```

- Bilde: `rounded-xl`, `aspect-[16/9]` (bredformat, viser gruppebilde)
- Overlay-tekst: Montserrat 800 (h2-stil), `text-white` med mørk gradient
- Hover: `shadow-md` + border-endring (konsistent med `.card-base` hover fra design-guide 5.1)

**Annenhver-mønster:** Tannleger beholder sin variant-prop (brand/white) fra `index.astro`s
dynamiske beregning (arkitektur: seksjonsbakgrunner.md).

**Bildehåndtering:** Fellesbildet følger samme flyt som forsidebildet — lagres i
Google Drive `BILDER_FOLDER`, synkes av `sync-data.js`, refereres i innstillinger eller
en dedikert rad i galleri-arket med `type='fellesbilde'`.

### /tannleger-siden

- **Nytt layout:** Rutenett med `rounded-xl` bilder (ikke `rounded-full` sirkler)
- Grid: `grid-cols-2` mobil, `grid-cols-3` desktop (`md:`), `gap-6 md:gap-8`
- Under hvert bilde: navn (Montserrat 700, `.card-title`-størrelse) og tittel (Inter 400, `.card-subtitle`)
- Bilder bruker `imageConfig` (scale, posX, posY) for riktig crop-posisjonering
- Bildestørrelse: `aspect-[3/4]` (portrett), `rounded-xl`, `object-fit: cover`

**Accordion — native `<details>`/`<summary>` HTML:**

```html
<div class="tannlege-card">
  <img src="..." alt="..." class="rounded-xl aspect-[3/4] object-cover w-full" />
  <details>
    <summary class="btn-secondary mt-3 w-full text-center cursor-pointer">
      <span class="font-heading font-bold">Navn</span>
      <span class="text-brand-hover text-sm">Tittel</span>
    </summary>
    <div class="mt-3 text-sm leading-relaxed text-brand-hover">
      Beskrivelse...
    </div>
  </details>
</div>
```

- Bruker `btn-secondary`-styling på `<summary>` for konsistens med knapp-varianter
- Ingen JavaScript nødvendig — native HTML gir tilgjengelighet (tastatur, skjermleser) gratis
- CSS-animasjon for åpning via `details[open]`-selektor
- Ingen animasjonseffekter (ingen sticky, ingen pop-up)
- Inspirasjon: tannlegeloftet.no

### Berørte filer
- `src/components/Tannleger.astro` — forside-komponent, ny layout med fellesbilde
- `src/pages/tannleger.astro` — ny layout med grid og accordion
- `src/pages/index.astro` — fjern `hidden md:block` wrapper rundt Tannleger
- `src/styles/global.css` — accordion-styling (`.tannlege-card`, `details`/`summary` reset)
- Ny asset: fellesbilde-placeholder i `src/assets/`

---

## 3. Redesign tjenester-seksjonen

### Arkitektur: Priority via markdown frontmatter

> **Viktig:** Tjenester synkes som markdown-filer fra Google Drive via `syncMarkdownCollection()`,
> IKKE fra Google Sheets. Priority-feltet legges til som **frontmatter** i markdown-filene.
> Admin-modulen (`admin-module-tjenester.js`) må oppdateres til å skrive `priority`-feltet
> i frontmatter ved redigering.

**Frontmatter-eksempel:**
```markdown
---
title: Tannbleking
ingress: Profesjonell tannbleking for et hvitere smil
active: true
priority: 3
---
Detaljert beskrivelse...
```

### Forsiden
- Vis kun de **6 første tjenestene** basert på priority (lavest verdi = høyest prioritet)
- Faste bokser uten sticky-effekt
- Under boksene: `btn-secondary`-knapp **"Klikk her for å se mer av våre tjenester"**
- Klikk på knappen viser resten av tjenestene (client-side JS toggle, `hidden`-klasse)
- Alternativt: lenk til `/tjenester` for full liste

### sync-data / content collection
- `priority`-felt (heltall, default `99`) legges til i tjeneste-schema i `config.ts`
- `syncMarkdownCollection()` trenger ingen endring — frontmatter parses automatisk av Astro
- Sortering i komponent endres fra `localeCompare` til `priority`-basert

### Berørte filer
- `src/components/Tjenester.astro` — vis 6 + "vis mer"-knapp (`btn-secondary`)
- `src/content/config.ts` — `priority`-felt i tjeneste-schema (`z.number().default(99)`)
- Admin: `src/scripts/admin-module-tjenester.js` — legg til priority-felt i editor
- Google Drive: oppdater frontmatter i eksisterende .md-filer med priority-verdi

**Merk:** `sync-data.js` trenger **ingen** endring — markdown-filer synkes som-de-er fra Drive,
og Astro parser frontmatter automatisk ved content collection-lasting.

---

## 4. Prisliste — ny side og admin-modul

### Google Sheets
- Nytt ark: `Prisliste`
- Kolonner: `Kategori`, `Behandling`, `Pris`
- Rader med samme kategori grupperes automatisk
- **API-kall SKAL bruke `valueRenderOption: 'UNFORMATTED_VALUE'`** for Pris-kolonnen
  (norsk locale gjør `1500` → `"1 500"` med formattert verdi — ref CLAUDE.md)

### Ny side: `/prisliste`
- Henter data fra Google Sheets via `sync-data.js`
- **Standalone-side bruker `variant="white"`** (design-guide 8.2)
- Content collection: `prisliste` (JSON-data synkronisert fra Sheets)
- Layout: `max-w-4xl` container (lesbar bredde)

**Mobil-layout — kort-liste (ikke tabell):**

```
┌─────────────────────────────┐
│ h3: Kategori (Montserrat 700)│
├─────────────────────────────┤
│ Behandling 1          kr XXX│
│ ─────────────────────────── │
│ Behandling 2          kr XXX│
│ ─────────────────────────── │
│ Behandling 3          kr XXX│
└─────────────────────────────┘

┌─────────────────────────────┐
│ h3: Neste kategori          │
├─────────────────────────────┤
│ ...                         │
└─────────────────────────────┘
```

- Hver kategori rendres som et kort (`.card-base`-tokens: `bg-white rounded-2xl border shadow-sm`)
- Kategorioverskrift: Montserrat 700 (`font-heading font-bold text-xl`), padding `p-5`
- Rader: `flex justify-between`, `border-b border-brand-border/60 last:border-0`
- Behandlingsnavn: Inter 400 (`text-base`)
- Pris: Inter 600 (`font-semibold text-base`), høyrejustert
- Gap mellom kategorikort: `gap-6 md:gap-8` (standard kort-gap fra design-guide)

**Desktop:** Samme kort-liste-layout, men med `md:grid md:grid-cols-2`-mulighet for
kategorikortene dersom det er mange kategorier.

### Print-versjon

Prislisten skal kunne skrives ut pent for opphenging på veggen (venteværelse, resepsjon etc.).

- **Print-knapp** på siden: `btn-secondary` med print-ikon, kaller `window.print()`
- **`@media print`-stylesheet** i `prisliste.astro` (eller `global.css`):
  - Skjul navbar, footer, print-knapp og andre UI-elementer
  - Vis klinikkens logo (fra `innstillinger`) sentrert øverst
  - Klinikknavn (Montserrat 700) under logoen
  - Valgfri undertekst: "Prisliste gjeldende fra [dato]" (fra Sheets eller statisk)
  - Kategorikort rendres som rene lister uten shadow/border (sparevennlig)
  - `page-break-inside: avoid` på kategorikort for å unngå at én kategori deles over to sider
  - Svart tekst på hvit bakgrunn, ingen fargebakgrunner
  - Passende marger for A4-format
- **Ingen ekstra side/rute** — print-layout er ren CSS over eksisterende `/prisliste`-side

### Content collection schema

```typescript
// config.ts
const prislisteSchema = z.object({
  kategori: z.string(),
  behandling: z.string(),
  pris: z.union([z.string(), z.number()]),  // Kan være tekst ("Fra 500,-") eller tall
});
```

### sync-data.js

Ny funksjon `syncPrisliste()`:
- Leser `Prisliste!A2:C` med `valueRenderOption: 'UNFORMATTED_VALUE'`
- Mapper til `{ kategori, behandling, pris }` per rad
- Skriver til `src/content/prisliste.json`
- Følger eksisterende mønster fra `syncGalleri()` / `syncInnstillinger()`

### Admin-panel

- Ny admin-modul for prisliste
- **Auto-save med debounce** (1.5s) — konsistent med andre admin-moduler
- Save bar viser status (endret → lagrer → lagret / feil)
- CRUD: legge til, redigere, slette rader
- Felter: Kategori (dropdown/tekst), Behandling, Pris
- **Sikkerhet:** `escapeHtml()` for preview-tekst, programmatisk `.value`-setting for
  input-felter (ref arkitektur/sikkerhet.md). DOMPurify for eventuell HTML-rendering.
- Følger admin-modulmønster fra admin-design-guide seksjon 13

### Navigasjon

- Ny lenke "Prisliste" i **navbar** — plasseres **etter Tjenester, før Tannleger**:
  `Forside → Kontakt → Galleri → Tjenester → Prisliste → Tannleger`
- `mobileHref: '/prisliste'` (standalone-side, ingen ankerlenke)
- Ny lenke i **footer** — kolonne 2 (kontaktinfo), under eksisterende lenker

### Berørte filer
- `src/pages/prisliste.astro` — ny side
- `src/scripts/sync-data.js` — ny `syncPrisliste()`-funksjon
- `src/content/config.ts` — prisliste-schema
- `src/components/Navbar.astro` — ny menylenke (etter Tjenester)
- `src/components/Footer.astro` — ny lenke + fjern sentralbordTekst
- `src/pages/admin/index.astro` — ny modul-kort på dashboard
- `src/scripts/admin-module-prisliste.js` — ny admin-modul
- `src/scripts/admin-client.js` — nye API-funksjoner for prisliste CRUD
- `docs/architecture/prisliste.md` — ny arkitekturdokumentasjon

---

## 5. Footer-justeringer

### Endring
- Fjern `sentralbordTekst` fra footer (telefonnummer beholdes)
  - `sentralbordTekst` vises i dag som `text-white/50 text-xs` under telefonnummer
  - Fjernes helt — ingen erstatning
- Legg til lenke til `/prisliste` i kolonne 2 (kontaktinfo)

### Berørte filer
- `src/components/Footer.astro`

---

## Implementeringsrekkefølge (anbefalt)

1. **Fjern sticky stabling** (seksjon 1) — minst risiko, isolert CSS-endring
2. **Footer-justeringer** (seksjon 5) — enkelt, avhenger ikke av andre oppgaver
3. **Tjenester redesign** (seksjon 3) — krever frontmatter-endring + admin-oppdatering
4. **Tannleger redesign** (seksjon 2) — større endring, forside + egen side
5. **Prisliste** (seksjon 4) — ny side + admin-modul, mest omfattende

Hver oppgave committes separat per TODO.md-arbeidsflyt.
