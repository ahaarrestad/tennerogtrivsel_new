# Plan: UX/Design-redesign

> Implementeringsplan basert på [design-guide.md](design-guide.md).
> Hvert steg er en selvstendig commit. Rekkefølgen er prioritert for å minimere
> merge-konflikter og gi synlig fremgang tidlig.

---

## Steg 1: Typografi — fonter og typografisk skala

**Filer:**
- `src/layouts/Layout.astro` — legg til Google Fonts preconnect + link
- `src/styles/global.css` — legg til `--font-heading`/`--font-body` i `@theme`, oppdater
  `.h1`–`.h4`, `.section-heading`, `.card-title`, `.card-subtitle`, `.card-text`,
  `.card-link`, `.section-intro`, og `body`-font
- `src/middleware.ts` — oppdater CSP `font-src` og `style-src` med `fonts.googleapis.com`
  og `fonts.gstatic.com`

**Endringer:**
1. Legg til Montserrat (700, 800, 900) + Inter (400, 500, 600) via Google Fonts
2. Definer `--font-heading` og `--font-body` i `@theme`
3. Sett `font-family: var(--font-body)` på `body`
4. Legg til `font-family: var(--font-heading)` på `.h1`, `.h2`, `.h3`, `.h4`, `.card-title`, `.card-subtitle`
5. Legg til `font-family: var(--font-body)` på `.section-intro`, `.card-text`, `.card-link`, `.btn-primary`, `.btn-secondary`, `.nav-link`
6. Differensier h1 (font-black/900) fra h2 (font-extrabold/800)
7. Endre `line-height` for h1/h2 fra `leading-tight` (1.25) til `1.15` (design-guide-spesifikasjon)
8. Konsolider `.h2` og `.section-heading` til én klasse — oppdater alle brukere inkl. `SectionHeader.astro` og `tjenester/[id].astro`
9. Oppdater CSP for Google Fonts (verifiser om `fonts.googleapis.com` allerede er tillatt i middleware.ts)

**Tester:** E2E-tester trenger ingen endring (visuell endring, ikke strukturell).

---

## Steg 2: Fargepalett — tokens og aksentfarge

**Filer:**
- `src/styles/global.css` — oppdater `@theme`-fargevariabler

**Endringer:**
1. `--color-brand-dark`: slate-800 → slate-900
2. `--color-brand-hover`: slate-500 → slate-600
3. `--color-brand-border`: slate-100 → slate-200
4. `--color-brand-message-box`: slate-300 → slate-100
5. `--color-brand-message-banner`: slate-400 → slate-200
6. Legg til `--color-accent`, `--color-accent-hover`, `--color-accent-light`, `--color-accent-border`
7. Legg til semantiske farger (success, error, info, warning)

**Tester:** Ingen strukturelle endringer — verifiser visuelt.

> **Sideeffekt:** Fargetoken-endringer påvirker admin-panelet (`.admin-card`,
> `.admin-input`, `.admin-nav` bruker `border-brand-border`). Verifiser admin-UI
> visuelt etter endring. Bruk Tailwinds innebygde `shadow-sm/md/lg/xl` — ingen
> egne skygge-tokens.

---

## Steg 3: Spacing — reduser header-margin, normaliser gaps

**Filer:**
- `src/styles/global.css` — oppdater spacing-tokens
- `src/components/Kontakt.astro` — standardiser gap
- `src/components/Tjenester.astro` — standardiser gap
- `src/components/Tannleger.astro` — standardiser gap
- `src/components/Galleri.astro` — juster gap

**Filer (tillegg):**
- `src/pages/tjenester.astro` — fjern `pb-[35vh]`-hack
- `src/pages/galleri.astro` — fjern `pb-[35vh]`-hack
- `src/pages/tannleger.astro` — fjern `pb-[35vh]`-hack

**Endringer:**
1. `--spacing-section-py-md`: 96px → 80px
2. `--spacing-header-mb`: 64px → 40px
3. `--spacing-header-mb-md`: 192px → 64px (størst visuell endring!)
4. Standardiser kort-gap til `gap-6 md:gap-8` i alle seksjoner
5. Galleri-gap til `gap-3 md:gap-4`
6. Fjern `pb-[35vh]`-hack på de 3 standalone-sidene (tjenester, galleri, tannleger) — bruk `min-h-[50vh]` på main
   - Merk: `kontakt.astro` har IKKE denne hacken — ikke legg til noe der

**Tester:** sitemap-pages.spec.ts verifiserer sidene laster OK. Kan trenge justering
av visuelle tester.

---

## Steg 4: Knapper — primær (fylt) og sekundær (outline)

**Filer:**
- `src/styles/global.css` — ny `.btn-primary`, ny `.btn-secondary`
- `src/components/Button.astro` — legg til `variant`-støtte for 'primary'/'secondary'
- `src/components/TelefonKnapp.astro` — vurder variant
- `src/components/EpostKnapp.astro` — vurder variant
- `src/components/KontaktKnapp.astro` — vurder variant

**Endringer:**
1. `.btn-primary`: outline → fylt (`bg-brand text-white font-semibold`)
   - Merk: `font-semibold` (Inter 600) — IKKE `font-bold` (700 er ikke i Google Fonts-importen)
2. Ny `.btn-secondary`: outline-stil (den gamle primary-stilen)
3. Avrunding: rounded-2xl → rounded-xl
4. Shadow: shadow-lg → shadow-sm
5. Legg til focus-visible-stiler
6. Legg til active-state
7. Oppdater Button.astro variant-prop

**Variant-tilordning (besluttet):**
- Hero-knapper (TelefonKnapp, EpostKnapp, KontaktKnapp): alle **primær** (3 fylte knapper)
- TelefonKnapp i navbar: **sekundær variant** — beholder `pointer-events-none` på desktop
  (ikke klikkbar), klikkbar på mobil. Sekundær-stil gjør den visuelt lettere slik at
  ikke-klikkbarhet på desktop er mindre forvirrende.
- 404-side: "Til forsiden" = primær, TelefonKnapp = sekundær
- Tjeneste-detalj sidebar: TelefonKnapp + EpostKnapp = primær

**Tester:** Enhetstester for Button-komponent hvis de finnes.

---

## Steg 5: Kort-komponent — avrunding, padding, hover

**Filer:**
- `src/styles/global.css` — oppdater `.card-base`, `.card-accent-corner`, `.card-progress-bar`
- `src/components/Card.astro` — juster padding, stacking margin

**Endringer:**
1. Avrunding: rounded-3xl → rounded-2xl
2. Padding: `p-8` → `p-6 md:p-8`
3. Border: `border-brand-border` → `border-brand-border/60`
4. Hover: legg til `shadow-md` og `border-brand-border`
5. Accent corner: `w-20 h-20` → `w-16 h-16`, negativ margin `-mr-8 -mt-8` → `-mr-6 -mt-6`
6. Progress bar: endre farge til `bg-accent`
7. Stacking margin: 10vh → 6vh
8. Fokus-ring: Bruk `ring-2 ring-accent` i stedet for `outline` på kort (pga. `overflow-hidden`
   som klipper outline-offset)

**Tester:** Visuell endring, ingen strukturelle testendringer forventet.

---

## Steg 6: Navbar — glassmorfisme og underline-animasjon

**Filer:**
- `src/components/Navbar.astro` — bakgrunn, høyde, lenke-stil, logo-størrelse
- `src/styles/global.css` — ny `.nav-link`-klasse med ::after underline
- `src/scripts/mobile-menu.js` — fade-in animasjon
- `src/pages/index.astro` — oppdater `scroll-mt` for ny nav-høyde

**Endringer:**
1. Bakgrunn: `bg-brand-light` → `bg-white/95 backdrop-blur-sm`
2. Høyde: `h-20` → `h-16 lg:h-20` (bruker `lg:` breakpoint, ikke `md:`)
3. Logo: `h-16` → `h-12 lg:h-16` (plass i mobilnav)
4. Border: `border-brand-border` → `border-slate-200/60`
5. Nav-lenker: ny `.nav-link`-klasse med underline-animasjon, tekst `text-slate-600 hover:text-brand`
   - Oppdater også mobilmeny-lenker (linje 53 i Navbar.astro)
   - Koordiner med `menu-highlight.js` for aktiv-indikator
6. Mobilmeny: legg til `backdrop-blur-sm` og **fade-in** (opacity-overgang via CSS transition,
   erstatt `hidden`-class med opacity-0/opacity-100 og pointer-events-none/auto)
7. Oppdater `scroll-mt-20 md:scroll-mt-28` i `Forside.astro` til `scroll-mt-16 lg:scroll-mt-20`

**Tester:** E2E-tester for navigasjon kan trenge justering — sjekk at mobilmeny-toggle
fungerer med ny opacity-basert synlighet (ikke `hidden`-klasse).

---

## Steg 7: Footer — trekolonners layout

> **Avhenger av:** Steg 2 (farger — `bg-slate-800`, `border-slate-700`)

**Filer:**
- `src/components/Footer.astro` — fullstendig omskriving
- `src/layouts/Layout.astro` — pass settings til Footer (åpningstider, adresse, etc.)

**Endringer:**
1. Bakgrunn: `bg-brand-light` → `bg-slate-800 text-white`
2. Layout: enlinje → trekolonners grid (logo+beskrivelse, kontakt, åpningstider)
3. Copyright-linje med `border-t border-slate-700` — årstall dynamisk (`new Date().getFullYear()`)
4. Logo invertert (`filter: brightness(0) invert(1)`)
5. Responsive: 1 col mobil → 3 col md

**Datakrav:**
- Kolonne 1: Logo + kort beskrivelse fra settings (evt. hardkodet)
- Kolonne 2: Adresse, telefon, e-post — Footer henter allerede settings via `getSiteSettings()`
- Kolonne 3: Åpningstider — krever parsing av `businessHours`-feltet (samme logikk som i `Kontakt.astro`)

**Tester:** Footer-innhold endres — sjekk at E2E-tester ikke sjekker spesifikk footer-tekst.
`links.spec.ts` kan plukke opp nye lenker i footer.

---

## Steg 8: Galleri-forbedringer (mobil + visuell polish)

> **Avhenger av:** Steg 2 (farger for CTA-lenke), Steg 3 (galleri-gap)

**Filer:**
- `src/components/Galleri.astro` — mobilsynlighet, hover-effekter, avrunding, "Se alle"-lenke

**Endringer — mobilsynlighet:**
1. Seksjon-rekkefølge beholdes som i dag: Hero → Kontakt → Galleri → Tjenester → Tannleger
2. `hidden md:block` på Tjenester/Tannleger beholdes (bevisst valg — mobil fokuserer på kontakt)
3. Galleri: vis 4 bilder på mobil (opp fra 2) — endre `index >= 2` til `index >= 4`
   - Håndter edge case: færre enn 4 bilder → vis alle uten å skjule noen
4. Legg til "Se alle"-lenke til `/galleri` under galleri-grid på forsiden (kun når `!standalone`)

**Endringer — visuell polish:**
5. Galleri-bilde hover: shadow-sm → shadow-md + scale(1.03) (shadow på container, ikke bilde)
6. Avrunding: rounded-2xl → rounded-xl
7. Verifiser at `overflow-hidden` på container klipper scale korrekt

**Tester:**
- sitemap-pages.spec.ts: sjekk at forsiden fortsatt laster OK
- links.spec.ts: ny "Se alle"-lenke plukkes opp
- seo.spec.ts: titler og metadata uendret

---

## Steg 9: Heading accent bar og seksjon-detaljer

> **Avhenger av:** Steg 2 (accent-farge)

**Filer:**
- `src/styles/global.css` — `.heading-accent` farge
- `src/components/SectionHeader.astro` — evt. justeringer

**Endringer:**
1. Heading accent: `bg-brand-dark` → `bg-accent`
2. Verifiser at SectionHeader bruker oppdaterte spacing-tokens

---

## Steg 10: 404-side — forenkle og profesjonalisere

> **Avhenger av:** Steg 4 (knappestiler)

**Filer:**
- `src/pages/404.astro` — forenkle layout

**Endringer:**
1. **Fiks nestet `<main>`:** 404.astro har `<main>` inne i Layout.astros `<main>` — ugyldig HTML.
   Erstatt med `<section>` eller `<div>`.
2. Fjern overdrevne dekorative elementer (pulserende sirkler, blurrede bakgrunner)
3. Stor, blek "404" som bakgrunnselement
4. Klar overskrift + forklarende tekst
5. Fjern `!important`-overstyrninger på `section-heading` (linje 39) — bruk egen klasse
6. To CTA-er: "Til forsiden" (primær) + TelefonKnapp (sekundær)
7. Behold eventuelt subtil tannlege-humor

**Tester:** sitemap-pages.spec.ts verifiserer 404-siden. a11y-tester bør nå passere
uten nestet-main-feil.

---

## Steg 11: Tjenester-detaljside — opprydning

> **Avhenger av:** Steg 1 (typografi/section-heading), Steg 2 (farger), Steg 4 (knapper i sidebar)

**Filer:**
- `src/pages/tjenester/[id].astro` — layout-forbedringer

**Endringer:**
1. Container: legg til `max-w-6xl`
2. Brødsmulesti: legg til mellomsteg "Tjenester" med lenke til `/tjenester`
3. Fjern `!important`-overstyrninger — lag egne klasser (f.eks. `.detail-heading` for venstrejustert h1)
4. **Fiks h4-bug:** linje 78 har motstridende `text-lg` og `text-sm` — fjern `text-lg`
5. Sidebar: `p-6 bg-brand-light rounded-2xl`
6. Relaterte tjenester: justere spacing

---

## Steg 12: Tilgjengelighet — skip-link og fokus-stiler

> **Avhenger av:** Steg 4 (knapper), Steg 5 (kort), Steg 6 (navbar)

**Filer:**
- `src/layouts/Layout.astro` — skip-link + `id="main-content"`
- `src/styles/global.css` — globale fokus-stiler
- `src/components/Card.astro` — focus-visible (ring, ikke outline — pga. overflow-hidden)
- `src/components/Navbar.astro` — focus-visible på nav-lenker
- `src/components/Button.astro` — verifiser focus-visible fra Steg 4
- `src/components/TelefonKnapp.astro` — focus-visible
- `src/components/EpostKnapp.astro` — focus-visible

**Endringer:**
1. Legg til skip-link i Layout.astro (før navbar-wrapper)
2. Legg til `id="main-content"` på `<main>`
3. Standard fokus-ring: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand`
4. **Kort-fokus:** Bruk `focus-visible:ring-2 focus-visible:ring-accent` (ikke outline) fordi
   `.card-base` har `overflow-hidden` som klipper outline-offset
5. Aktiv nav-indikator: underline (koordiner med `menu-highlight.js`)
6. Verifiser at ALLE interaktive elementer har synlig fokusring

**Tester:** a11y-tester kan oppdateres for å verifisere skip-link.

---

## Steg 13: CLAUDE.md-oppdatering

**Filer:**
- `CLAUDE.md` — legg til referanse til design-guide

**Endringer:**
1. Legg til seksjon som linker til `docs/design-guide.md`
2. Presiser at alle visuelle endringer skal følge design-guiden

---

## Avhengigheter

```
Steg 1 (typografi)     ─┐
Steg 2 (farger)        ─┼─→ Steg 5 (kort)
Steg 3 (spacing)       ─┤
Steg 4 (knapper)       ─┘

Steg 2 (farger) ───────→ Steg 7 (footer)
                ───────→ Steg 8 (galleri)
                ───────→ Steg 9 (accent bar)

Steg 4 (knapper) ──────→ Steg 10 (404)
Steg 1+2+4 ────────────→ Steg 11 (tjeneste-detalj)
Steg 4+5+6 ────────────→ Steg 12 (a11y)
Steg 6 (navbar) ───────→ Steg 12 (a11y)

Steg 13 (CLAUDE.md) — sist
```

Steg 1-4 kan gjøres i vilkårlig rekkefølge (ingen innbyrdes avhengigheter).
Steg 5-12 bygger på tokens fra 1-4 — se eksplisitte avhengigheter over.
Steg 13 gjøres til slutt.

> **Merk:** Tidligere steg 13 (galleri-forbedringer) er slått sammen med steg 8
> for å unngå duplisering. Planen har nå 13 steg (ikke 14).

---

## Teststrategi

- **Etter hvert steg:** Kjør `npm run build` + visuell inspeksjon
- **Etter steg 6 (navbar):** Kjør mobilmeny E2E-tester (sjekk at toggle fungerer med ny animasjon)
- **Etter steg 8 (galleri):** Kjør full E2E-suite
- **Etter steg 12 (a11y):** Kjør a11y-tester
- **Før endelig commit:** Kjør kvalitetssjekk (quality gate)

### E2E-tester som kan påvirkes

| Testfil | Berørte steg | Spesifikke bekymringer |
|---------|-------------|----------------------|
| `sitemap-pages.spec.ts` | 3, 5, 6, 8, 10, 11 | `.card-base`/`.h3`-sjekk, `bg-white`-sjekk, mobilmeny-toggle |
| `csp-check.spec.ts` | 1 | Google Fonts CSP (verifiser at allerede tillatt) |
| `accessibility.spec.ts` | 4, 6, 7, 10, 12 | Knapp-kontrast, nestet main (fikses), skip-link |
| `seo.spec.ts` | Ingen | Metadata uendret |
| `links.spec.ts` | 7, 8 | Nye lenker i footer og "Se alle" i galleri |

## Beslutninger tatt under review

| Beslutning | Valg | Begrunnelse |
|-----------|------|-------------|
| Hero CTA-varianter | Alle tre primær | Bruker ønsker konsistent tyngde |
| TelefonKnapp i nav | Sekundær variant | Ikke klikkbar på desktop, klikkbar på mobil — outline-stil er mer passende |
| Mobilmeny-animasjon | Fade-in (opacity) | Enklere enn slideDown, god nok UX-forbedring |
| Skygge-tokens | Tailwind innebygd | Bruker foretrekker innebygd funksjonalitet, ingen egne tokens |
| line-height h1/h2 | 1.15 (ikke 1.1) | Unngår klipping av underkant på norske bokstaver |
| Steg 8+13 sammenslåing | Slått sammen til steg 8 | Fjernet duplisering |
