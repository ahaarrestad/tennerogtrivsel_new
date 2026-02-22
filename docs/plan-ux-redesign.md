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
3. Sett `font-family: var(--font-body)` på body
4. Oppdater heading-klasser til `font-family: var(--font-heading)`
5. Differensier h1 (font-black/900) fra h2 (font-extrabold/800)
6. Konsolider `.h2` og `.section-heading` til én klasse
7. Oppdater CSP for Google Fonts

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
8. Definer skygge-tokens

**Tester:** Ingen strukturelle endringer — verifiser visuelt.

---

## Steg 3: Spacing — reduser header-margin, normaliser gaps

**Filer:**
- `src/styles/global.css` — oppdater spacing-tokens
- `src/components/Kontakt.astro` — standardiser gap
- `src/components/Tjenester.astro` — standardiser gap
- `src/components/Tannleger.astro` — standardiser gap
- `src/components/Galleri.astro` — juster gap

**Endringer:**
1. `--spacing-section-py-md`: 96px → 80px
2. `--spacing-header-mb`: 64px → 40px
3. `--spacing-header-mb-md`: 192px → 64px (størst visuell endring!)
4. Standardiser kort-gap til `gap-6 md:gap-8` i alle seksjoner
5. Galleri-gap til `gap-3 md:gap-4`
6. Fjern `pb-[35vh]`-hack på standalone-sider — bruk `min-h-[50vh]` på main

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
1. `.btn-primary`: outline → fylt (`bg-brand text-white`)
2. Ny `.btn-secondary`: outline-stil (den gamle primary-stilen)
3. Avrunding: rounded-2xl → rounded-xl
4. Shadow: shadow-lg → shadow-sm
5. Legg til focus-visible-stiler
6. Legg til active-state
7. Oppdater Button.astro variant-prop

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
5. Accent corner: `w-20 h-20` → `w-16 h-16`
6. Progress bar: endre farge til `bg-accent`
7. Stacking margin: 10vh → 6vh

**Tester:** Visuell endring, ingen strukturelle testendringer forventet.

---

## Steg 6: Navbar — glassmorfisme og underline-animasjon

**Filer:**
- `src/components/Navbar.astro` — bakgrunn, høyde, lenke-stil
- `src/styles/global.css` — ny `.nav-link`-klasse med ::after underline
- `src/scripts/mobile-menu.js` — evt. slideDown-animasjon

**Endringer:**
1. Bakgrunn: `bg-brand-light` → `bg-white/95 backdrop-blur-sm`
2. Høyde: `h-20` → `h-16 md:h-20`
3. Border: `border-brand-border` → `border-slate-200/60`
4. Nav-lenker: ny `.nav-link`-klasse med underline-animasjon
5. Mobilmeny: legg til `backdrop-blur-sm` og slideDown-animasjon

**Tester:** E2E-tester for navigasjon kan trenge justering for ny høyde.

---

## Steg 7: Footer — trekolonners layout

**Filer:**
- `src/components/Footer.astro` — fullstendig omskriving
- `src/layouts/Layout.astro` — pass settings til Footer (åpningstider, adresse, etc.)

**Endringer:**
1. Bakgrunn: `bg-brand-light` → `bg-slate-800 text-white`
2. Layout: enlinje → trekolonners grid (logo+beskrivelse, kontakt, åpningstider)
3. Copyright-linje med border-t
4. Logo invertert (brightness-0 invert)
5. Responsive: 1 col mobil → 3 col md

**Tester:** Footer-innhold endres — sjekk at E2E-tester ikke sjekker spesifikk footer-tekst.

---

## Steg 8: Forsiden — informasjonsrekkefølge og mobil-synlighet

**Filer:**
- `src/pages/index.astro` — endre seksjon-rekkefølge, fjern `hidden md:block`

**Endringer:**
1. Ny rekkefølge: Hero → Tjenester → Tannleger → Galleri → Kontakt
2. Fjern `hidden md:block` på Tjenester og Tannleger
3. Oppdater variant-beregning for annenhver-mønsteret
4. Galleri: vis 4 bilder på mobil (opp fra 2)

**Tester:**
- sitemap-pages.spec.ts: sjekk at forsiden fortsatt laster OK
- seo.spec.ts: titler og metadata uendret
- Evt. nye/oppdaterte tester for seksjon-rekkefølge

---

## Steg 9: Heading accent bar og seksjon-detaljer

**Filer:**
- `src/styles/global.css` — `.heading-accent` farge
- `src/components/SectionHeader.astro` — evt. justeringer

**Endringer:**
1. Heading accent: `bg-brand-dark` → `bg-accent`
2. Verifiser at SectionHeader bruker oppdaterte spacing-tokens

---

## Steg 10: 404-side — forenkle og profesjonalisere

**Filer:**
- `src/pages/404.astro` — forenkle layout

**Endringer:**
1. Fjern overdrevne dekorative elementer (pulserende sirkler, blurrede bakgrunner)
2. Stor, blek "404" som bakgrunnselement
3. Klar overskrift + forklarende tekst
4. To CTA-er: "Til forsiden" (primær) + TelefonKnapp
5. Behold eventuelt subtil tannlege-humor

**Tester:** sitemap-pages.spec.ts verifiserer 404-siden.

---

## Steg 11: Tjenester-detaljside — opprydning

**Filer:**
- `src/pages/tjenester/[id].astro` — layout-forbedringer

**Endringer:**
1. Container: legg til `max-w-6xl`
2. Brødsmulesti: legg til mellomsteg "Tjenester"
3. Fjern `!important`-overstyrninger
4. Sidebar: `p-6 bg-brand-light rounded-2xl`
5. Relaterte tjenester: justere spacing

---

## Steg 12: Tilgjengelighet — skip-link og fokus-stiler

**Filer:**
- `src/layouts/Layout.astro` — skip-link
- `src/styles/global.css` — globale fokus-stiler
- `src/components/Card.astro` — focus-visible
- `src/components/Navbar.astro` — focus-visible på nav-lenker

**Endringer:**
1. Legg til skip-link i Layout.astro
2. Legg til `id="main-content"` på `<main>`
3. Fokus-ring: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand`
4. Aktiv nav-indikator: underline (ikke bare fargeendring)

**Tester:** a11y-tester kan oppdateres for å verifisere skip-link.

---

## Steg 13: Galleri-forbedringer

**Filer:**
- `src/components/Galleri.astro` — vis flere bilder på mobil, hover-effekt

**Endringer:**
1. Vis 4 bilder på mobil i stedet for 2
2. "Se alle"-lenke til /galleri på forsiden
3. Galleri-bilde hover: shadow-sm → shadow-md + scale(1.03)
4. Avrunding: rounded-2xl → rounded-xl

---

## Steg 14: CLAUDE.md-oppdatering

**Filer:**
- `CLAUDE.md` — legg til referanse til design-guide

**Endringer:**
1. Legg til seksjon som linker til `docs/design-guide.md`
2. Presiser at alle visuelle endringer skal følge design-guiden

---

## Avhengigheter

```
Steg 1 (typografi)     ─┐
Steg 2 (farger)        ─┼─→ Steg 5 (kort) ──→ Steg 8 (forside-rekkefølge)
Steg 3 (spacing)       ─┤                  ──→ Steg 13 (galleri)
Steg 4 (knapper)       ─┘
                              Steg 6 (navbar) ──→ Steg 12 (a11y)
                              Steg 7 (footer)
                              Steg 9 (accent bar)
                              Steg 10 (404)
                              Steg 11 (tjeneste-detalj)
                              Steg 14 (CLAUDE.md) — sist
```

Steg 1-4 kan gjøres i vilkårlig rekkefølge. Steg 5-13 bygger på tokens fra 1-4.
Steg 14 gjøres til slutt.

---

## Teststrategi

- **Etter hvert steg:** Kjør `npm run build` + visuell inspeksjon
- **Etter steg 8 (forside-endring):** Kjør full E2E-suite
- **Etter steg 12 (a11y):** Kjør a11y-tester
- **Før endelig commit:** Kjør kvalitetssjekk (quality gate)
- **E2E-tester som kan påvirkes:**
  - `sitemap-pages.spec.ts` — sidene skal fortsatt laste OK
  - `seo.spec.ts` — metadata uendret
  - `links.spec.ts` — lenker uendret
  - `csp-check.spec.ts` — CSP oppdatert for Google Fonts (steg 1)
