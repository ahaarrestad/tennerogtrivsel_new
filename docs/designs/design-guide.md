# Design Guide — Tenner og Trivsel

> Referansedokument for all visuell utforming av nettsiden. Alle fremtidige endringer SKAL
> følge retningslinjene i dette dokumentet.

---

## 1. Designprinsipper

| Prinsipp | Beskrivelse |
|----------|-------------|
| **Profesjonell & tillitvekkende** | Designet skal signalisere medisinsk profesjonalitet med en moderne, varm touch. |
| **Mobil-først** | All styling skrives for mobil først, med progressive `md:`/`lg:` utvidelser. |
| **Konsistens** | Én spacing-skala, én fargepalett, én typografisk skala — brukes overalt. |
| **Tilgjengelighet (a11y)** | WCAG AA minimum. Kontrast ≥ 4.5:1 for tekst, ≥ 3:1 for store elementer. |
| **Innhold først** | Vis *hvem vi er* og *hva vi tilbyr* før vi ber om kontakt. |
| **Mindre er mer** | Reduser visuell støy. Bruk whitespace strategisk, ikke overdrevet. |
| **Token-drevet design** | Alle farger, fonter og spacing settes via CSS-variabler i `global.css`. Komponenter bruker tokens — aldri hardkodede fargeverdier. |

### Målgruppe
Pasienter (eksisterende og potensielle) som søker tannhelsetjenester. Aldersgruppe 25-65+.
Nettsiden skal bygge tillit raskt og gjøre det enkelt å ta kontakt.

---

## 2. Typografi

### Fonter

| Rolle | Font | Fallback |
|-------|------|----------|
| **Headings** | Montserrat | ui-sans-serif, system-ui, sans-serif |
| **Body / UI** | Inter | ui-sans-serif, system-ui, sans-serif |

**Begrunnelse:** Montserrat matcher logoens geometriske, bold sans-serif-stil. Inter er
designet for skjermlesbarhet og gir god kontrast til Montserrat i brødtekst.

### Font-hosting (self-hosted)

Fontene self-hostes som woff2-filer under `/public/fonts/` for best ytelse (ingen
tredjepartsavhengighet, ingen ekstra DNS-oppslag, full cache-kontroll via CloudFront).

**Filer som trengs:**
- `public/fonts/montserrat-v26-latin-700.woff2`
- `public/fonts/montserrat-v26-latin-800.woff2`
- `public/fonts/montserrat-v26-latin-900.woff2`
- `public/fonts/inter-v18-latin-regular.woff2`
- `public/fonts/inter-v18-latin-500.woff2`
- `public/fonts/inter-v18-latin-600.woff2`

Last ned fra [google-webfonts-helper](https://gwfh.mranftl.com/fonts) eller direkte
fra Google Fonts API (velg woff2-format).

**@font-face i global.css:**
```css
@font-face {
  font-family: 'Montserrat';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url('/fonts/montserrat-v26-latin-700.woff2') format('woff2');
}
/* ... tilsvarende for 800, 900, Inter 400/500/600 */
```

> **Merk:** Self-hosting eliminerer behovet for CSP-endringer for `fonts.googleapis.com`
> og `fonts.gstatic.com`. Ingen `preconnect`-lenker nødvendig.

### Font-vekter

| Font | Vekt | Bruk |
|------|------|------|
| Montserrat 900 (Black) | `font-black` | h1, hero-tittel |
| Montserrat 800 (ExtraBold) | `font-extrabold` | h2, section-heading |
| Montserrat 700 (Bold) | `font-bold` | h3, h4, card-title |
| Inter 600 (SemiBold) | `font-semibold` | Knapper, labels |
| Inter 500 (Medium) | `font-medium` | Nav-lenker, undertekst |
| Inter 400 (Regular) | `font-normal` | Brødtekst, paragrafer |

### Typografisk skala

| Element | Mobil | Desktop | Font | Vekt | Line-height | Letter-spacing |
|---------|-------|---------|------|------|-------------|----------------|
| h1 | text-4xl (36px) | text-6xl (60px) | Montserrat | 900 | 1.15 | -0.025em |
| h2 (`.h2`) | text-3xl (30px) | text-5xl (48px) | Montserrat | 800 | 1.15 | -0.025em |
| h3 / card-title | text-2xl (24px) | text-3xl (30px) | Montserrat | 700 | 1.25 | normal |
| h4 | text-lg (18px) | text-lg (18px) | Montserrat | 700 | 1.4 | 0.05em, uppercase |
| body-lg / section-intro | text-lg (18px) | text-lg (18px) | Inter | 400 | 1.75 | normal |
| body | text-base (16px) | text-base (16px) | Inter | 400 | 1.75 | normal |
| body-sm / card-text | text-sm (14px) | text-base (16px) | Inter | 400 | 1.625 | normal |
| caption | text-xs (12px) | text-xs (12px) | Inter | 500 | 1.5 | 0.025em |
| button | text-sm (14px) | text-sm (14px) | Inter | 600 | normal | 0.025em |
| nav-link | text-base (16px) | text-base (16px) | Inter | 500 | normal | normal |

### CSS theme-tokens

```css
@theme {
    --font-heading: 'Montserrat', ui-sans-serif, system-ui, sans-serif;
    --font-body: 'Inter', ui-sans-serif, system-ui, sans-serif;
}
```

**Regel:** `.section-heading` er konsolidert inn i `.h2` — bruk kun `.h2`.
Reservér `font-black` (900) kun for h1. H2 bruker `font-extrabold` (800) for tydeligere hierarki.

> **Merk:** `line-height: 1.15` (ikke 1.1) brukes for h1/h2 for å unngå at underkanten av
> bokstaver som «g», «j», «p» klippes. Nåværende kode bruker `leading-tight` (1.25) — dette
> er en visuell endring som må implementeres eksplisitt.
>
> **Test grundig** med Montserrat 800/900 og norsk tekst som inneholder g/j/p/y
> (f.eks. «Tjenester og priser», «Forebyggende behandling»). Klipping er mest synlig
> på mørk bakgrunn og ved store fontstørrelser (h1 60px).

### Komplett font-family-tilordning

Alle klasser som trenger eksplisitt `font-family`-deklarasjon:

| Klasse | Font |
|--------|------|
| `.h1`, `.h2`, `.h3`, `.h4` | `var(--font-heading)` |
| ~~`.section-heading`~~ (fjernet, bruk `.h2`) | `var(--font-heading)` |
| `.card-title`, `.card-subtitle` | `var(--font-heading)` |
| `body` | `var(--font-body)` |
| `.section-intro`, `.card-text`, `.card-link` | `var(--font-body)` |
| `.btn-primary`, `.btn-secondary` | `var(--font-body)` |
| `.nav-link` | `var(--font-body)` |

Uten eksplisitte deklarasjoner har `@font-face`-deklarasjonene ingen effekt.

---

## 3. Fargepalett

### Designprinsipp: Token-drevet fargestyring

**Alle farger styres via CSS-variabler (tokens) i `src/styles/global.css`.** Ingen
komponent skal bruke hardkodede fargeverdier (hex/rgb) eller Tailwind-fargeklasser
som `text-slate-600` direkte. Bruk i stedet de semantiske token-klassene:
`text-brand`, `bg-brand-light`, `border-brand-border`, `bg-accent`, osv.

Fordelen er at **hele fargepaletten kan byttes ved å endre ~15 linjer i global.css**,
uten å røre noen komponentfiler. Dette gjør det enkelt å justere paletten i etterkant.

```css
/* Eksempel: Alle fargevariabler samlet i @theme i global.css */
@theme {
    --color-brand: #292524;
    --color-accent: #44403c;
    /* ... osv. */
}
```

> **Regel:** Hvis du trenger en farge i en komponent, sjekk om det finnes et token
> for den. Hvis ikke, vurder om tokenet bør opprettes i global.css. Hardkodede
> fargeverdier i `.astro`-filer er et code smell.

### Primær-palett (stone — varm grå)

| Token | Verdi | Hex | Bruk |
|-------|-------|-----|------|
| `--color-brand` | stone-800 | #292524 | Primærtekst, overskrifter |
| `--color-brand-dark` | stone-900 | #1c1917 | Sterk vekt, footer-bakgrunn |
| `--color-brand-hover` | stone-600 | #57534e | Hover-tilstand og sekundærtekst (7.2:1 kontrast) |
| `--color-brand-active` | stone-100 | #f5f5f4 | Aktiv/pressed bakgrunn |
| `--color-brand-border` | stone-200 | #e7e5e4 | Kantlinjer |
| `--color-brand-light` | stone-50 | #fafaf9 | Lys seksjonsbakgrunn |
| `--color-brand-message-box` | stone-100 | #f5f5f4 | Meldingsboks |
| `--color-brand-message-banner` | stone-200 | #e7e5e4 | Banner |

**Begrunnelse:** Stone-paletten er varm grå — objektivt fargeløs, men med en nesten
umerkelig varm undertone som gir ro og kvalitet uten å virke klinisk. Inntrykket er
sofistikert og profesjonelt, passende for en tannklinikk som skal bygge tillit.

> **Sideeffekt på admin-panelet:** Fargetoken-endringer påvirker admin-kort, inputs
> og nav. Admin-panelet har egne klasser (`.admin-card`, `.admin-input`) men bruker
> de samme token-variablene. **Eksplisitt verifisering av admin-panelet er påkrevd
> etter fargeendringer** — sjekk at kort, inputs, navigasjon og modaler ser korrekte ut.

### Aksentfarge (stone-700 — mørk varm grå)

| Token | Verdi | Hex | Bruk |
|-------|-------|-----|------|
| `--color-accent` | stone-700 | #44403c | CTA-knapper, accent bar, aktiv nav |
| `--color-accent-hover` | stone-800 | #292524 | CTA hover |
| `--color-accent-light` | stone-50 | #fafaf9 | Subtil CTA-bakgrunn |
| `--color-accent-border` | stone-300 | #d6d3d1 | Aksentkantlinjer |

**Begrunnelse:** Aksent-fargen er en mørkere variant av samme stone-palett — ikke en
egen farge. CTA-knapper skilles fra øvrig innhold via mørkere fyllfarge, forsterkede
skygger (`shadow-md` i hvile, `shadow-lg` på hover), og hover-løft (`-translate-y-px`).
Kontrasten hvit-på-stone-700 er 8.1:1 (solid WCAG AA).

### Semantiske farger (beholdes — funksjonelle, ikke dekorative)

| Token | Verdi | Hex | Kontrast vs. hvit |
|-------|-------|-----|-------------------|
| `--color-success` | green-700 | #15803d | 5.02:1 |
| `--color-success-light` | green-50 | #f0fdf4 | — |
| `--color-error` | red-700 | #b91c1c | 6.47:1 |
| `--color-error-light` | red-50 | #fef2f2 | — |
| `--color-info` | blue-700 | #1d4ed8 | 6.70:1 |
| `--color-info-light` | blue-50 | #eff6ff | — |
| `--color-warning` | amber-700 | #b45309 | 5.02:1 |
| `--color-warning-light` | amber-50 | #fffbeb | — |

### WCAG-kontrastsjekk

| Kombinasjon | Ratio | Status |
|-------------|-------|--------|
| stone-800 på hvit | 13.1:1 | PASS |
| stone-800 på stone-50 | ~12.5:1 | PASS |
| stone-600 på hvit (hover/sekundærtekst) | 7.2:1 | PASS |
| hvit på stone-700 (fylt CTA) | 8.1:1 | PASS |
| hvit på stone-800 (CTA hover, footer) | 13.1:1 | PASS |
| hvit på stone-900 (footer bg) | ~15.0:1 | PASS |

### Skygge-system

Bruk Tailwinds innebygde `shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl` direkte.
Ingen egne skygge-tokens — Tailwinds defaults er tilstrekkelige.

| Tailwind-klasse | Bruk |
|-----------------|------|
| `shadow-sm` | Kort i hvile, knapper |
| `shadow-md` | Kort hover, input fokus |
| `shadow-lg` | CTA-knapper, hero-bilde |
| `shadow-xl` | Modaler, mobilmeny |

---

## 4. Spacing-system

4px-basert skala. Bruk Tailwind-spacing-klasser konsekvent.

### Spacing-tokens

| Token | Verdi | Tailwind | Bruk |
|-------|-------|----------|------|
| `--spacing-section-y` | 64px | py-16 | Seksjon vertikal padding (mobil) |
| `--spacing-section-y-md` | 80px | py-20 | Seksjon vertikal padding (desktop) |
| `--spacing-header-mb` | 40px | mb-10 | Seksjonsheader margin-bottom (mobil) |
| `--spacing-header-mb-md` | 64px | mb-16 | Seksjonsheader margin-bottom (desktop) |
| `--spacing-card-padding` | 32px | p-8 | Kort innvendig padding (desktop) |
| `--spacing-card-padding-sm` | 24px | p-6 | Kort innvendig padding (mobil) |
| `--spacing-card-gap` | 24px | gap-6 | Kort-grid gap (mobil) |
| `--spacing-card-gap-md` | 32px | gap-8 | Kort-grid gap (desktop) |

### Viktige endringer fra nåværende

| Egenskap | Før | Etter | Begrunnelse |
|----------|-----|-------|-------------|
| Seksjon-padding desktop | py-24 (96px) | py-20 (80px) | Litt strammere |
| Header margin-bottom desktop | 192px (!) | 64px | Enormt redusert — innhold føltes frakoblet |
| Header margin-bottom mobil | 64px | 40px | Noe strammere |
| Kort-gap (standardisert) | 24-40px (varierer) | 24-32px (gap-6 md:gap-8) | Konsistent |
| Galleri-gap | gap-4 md:gap-6 | gap-3 md:gap-4 | Tettere mosaikk |

### Container

```css
.layout-container {
  @apply container mx-auto px-4 md:px-6 lg:px-8;
  /* max-width: 1280px (Tailwind default xl) */
}
```

Bruk `max-w-6xl` (1152px) for tekst-tungt innhold (tjeneste-detaljsider).

---

## 5. Komponent-spesifikasjoner

### 5.1 Kort (Card)

```css
.card-base {
  @apply bg-white p-6 md:p-8 rounded-2xl;
  @apply border border-brand-border/60 shadow-sm;
  @apply flex flex-col relative overflow-hidden;
  @apply transition-all duration-300;
  @apply hover:shadow-md hover:border-brand-border;
}
```

| Egenskap | Før | Etter |
|----------|-----|-------|
| Avrunding | rounded-3xl (24px) | rounded-2xl (16px) |
| Padding mobil | p-8 | p-6 |
| Border | border-brand-border | border-brand-border/60 (mykere) |
| Hover shadow | shadow-sm (uendret) | shadow-md (synlig løft) |

- **Behold** card-accent-corner (reduser fra w-20 h-20 til w-16 h-16, juster negativ margin fra `-mr-8 -mt-8` til `-mr-6 -mt-6`)
- **Behold** card-progress-bar (endre farge til `bg-accent`)
- **Mobil stacking:** Behold, men reduser margin-bottom fra 10vh til 6vh

> **Merk `overflow-hidden`:** `.card-base` har `overflow-hidden` som klipper
> `focus-visible:outline-offset-2`. Løsning: Bruk `outline-offset-[-2px]` (inset)
> på kort, eller bytt til `ring-2` som ikke påvirkes av overflow.

### 5.2 Knapper

**Primær (fylt):**
```css
.btn-primary {
  @apply inline-flex items-center justify-center gap-2;
  @apply px-6 py-3 rounded-xl whitespace-nowrap min-w-fit;
  @apply bg-brand text-white font-semibold text-sm;
  @apply shadow-sm transition-all duration-200;
  @apply hover:bg-brand-dark hover:shadow-md hover:-translate-y-px;
  @apply focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand;
  @apply active:translate-y-0 active:shadow-sm;
}
```

**Sekundær (outline):**
```css
.btn-secondary {
  @apply inline-flex items-center justify-center gap-2;
  @apply px-6 py-3 rounded-xl whitespace-nowrap min-w-fit;
  @apply border border-brand-border text-brand font-semibold text-sm bg-transparent;
  @apply transition-all duration-200;
  @apply hover:bg-brand-light hover:border-brand;
  @apply focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand;
}
```

**Accent (mørk CTA):**
```css
.btn-accent {
  @apply inline-flex items-center justify-center gap-2;
  @apply px-6 py-3 rounded-xl whitespace-nowrap min-w-fit;
  @apply bg-accent text-white font-semibold text-sm;
  @apply shadow-md transition-all duration-200;
  @apply hover:bg-accent-hover hover:shadow-lg hover:-translate-y-px;
  @apply focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent;
  @apply active:translate-y-0 active:shadow-sm;
}
```

**Begrunnelse for 3 varianter:** Accent-varianten brukes for primære handlinger
(ring oss, bestill time). Uten fargekontrast kompenseres visuelt hierarki med
forsterkede skygger (`shadow-md` i hvile, `shadow-lg` på hover) og hover-løft.
Primær (stone-800) brukes for navigasjonshandlinger. Sekundær (outline) brukes for
nedtonet støttehandlinger.

| Egenskap | Før | Etter |
|----------|-----|-------|
| Primær stil | Outline (ghost) | Fylt (bg-brand text-white) |
| Avrunding | rounded-2xl | rounded-xl (12px) |
| Padding | px-6 py-3.5 | px-6 py-3 |
| Shadow | shadow-lg | shadow-sm (mindre påtrengende) |
| Focus | Ingen | focus-visible med outline |
| Ny: accent | — | Fylt stone-700 (bg-accent text-white) med forsterkede skygger for CTA |

**Variant-tilordning:**

| Kontekst | Knapp | Variant |
|----------|-------|---------|
| Hero | TelefonKnapp | **accent** (hovedhandling) |
| Hero | EpostKnapp | sekundær |
| Hero | KontaktKnapp | sekundær |
| Navbar | TelefonKnapp | sekundær (`pointer-events-none` desktop) |
| 404-side | "Til forsiden" | primær |
| 404-side | TelefonKnapp | sekundær |
| Tjeneste-sidebar | TelefonKnapp | **accent** |
| Tjeneste-sidebar | EpostKnapp | **accent** |

### 5.3 Bilder

| Kontekst | Avrunding | Aspect ratio | Ramme | Skygge |
|----------|-----------|-------------|-------|--------|
| Hero | rounded-2xl | 16/10 | border-4 border-white | shadow-lg |
| Galleri | rounded-xl | 4/3 | ingen | shadow-sm → shadow-md hover |
| Tannleger | rounded-full | 1/1 (sirkel) | border-4 border-white | shadow-md |
| Tjeneste-detalj | rounded-xl | fritt | ingen | shadow-sm |

### 5.4 Navbar

```css
nav {
  @apply bg-white/95 backdrop-blur-sm border-b border-brand-border/60;
  @apply supports-[backdrop-filter]:bg-white/80;
}
```

- Glassmorfisme-effekt når sticky
- Høyde: h-16 (mobil) / h-20 (desktop, fra `lg:` breakpoint)
- Logo: `h-12` på mobil (plass i h-16 nav), `h-16` fra lg
- Nav-lenker med underline-animasjon:

```css
.nav-link {
  @apply text-base font-medium text-brand-hover hover:text-brand;
  @apply relative py-1 transition-colors duration-200;
  font-family: var(--font-body);
}
.nav-link::after {
  content: '';
  @apply absolute bottom-0 left-0 w-0 h-0.5 bg-accent transition-all duration-300;
}
.nav-link:hover::after,
.nav-link[aria-current="page"]::after {
  @apply w-full;
}
```

- Mobilmeny: `backdrop-blur-sm` + fade-in animasjon (opacity-overgang via CSS transition,
  erstatter `hidden`-toggle i `mobile-menu.js`)
- Hamburger-ikon: `text-brand-hover` (matcher nav-link-fargen, ikke brand)

### 5.5 Footer

Trekolonners layout med mørk bakgrunn:

```
┌─────────────────────────────────────────────────────┐
│  bg-brand-dark text-white py-12 md:py-16            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ Logo +   │  │ Kontakt  │  │ Åpnings- │          │
│  │ Beskriv. │  │ info     │  │ tider    │          │
│  └──────────┘  └──────────┘  └──────────┘          │
│─────────────────────────────────────────────────────│
│  border-t border-accent                             │
│  © 2026 Tenner og Trivsel                           │
└─────────────────────────────────────────────────────┘
```

- 1 kolonne på mobil, 3 kolonner fra md
- Kolonne 1: Logo (invertert via `filter: brightness(0) invert(1)`) + kort beskrivelse (fra settings)
- Kolonne 2: Adresse, telefon, e-post (fra settings, samme datakilde som Kontakt-seksjonen)
- Kolonne 3: Åpningstider (fra settings, krever parsing av `businessHours`-feltet)
- Copyright-linje under med `border-t border-accent` — årstall dynamisk (`new Date().getFullYear()`)

### 5.6 Seksjon-header

```css
.section-header-centered {
  @apply text-center mx-auto max-w-4xl;
  margin-bottom: var(--spacing-header-mb);   /* 40px mobil */
}
@media (min-width: 768px) {
  .section-header-centered {
    margin-bottom: var(--spacing-header-mb-md);  /* 64px desktop */
  }
}
```

- Heading accent bar: Endre fra `bg-brand-dark` til `bg-accent`

---

## 6. Responsivt design

### Breakpoints (Tailwind default)

| Breakpoint | Bredde | Rolle |
|------------|--------|-------|
| base | < 640px | Mobil (standard) |
| sm | 640px | Stor mobil |
| md | 768px | Tablet — primært bruddpunkt |
| lg | 1024px | Desktop — sekundært bruddpunkt |
| xl | 1280px | Bred desktop |

### Responsiv oppførsel per komponent

| Komponent | Mobil (< md) | Tablet (md-lg) | Desktop (lg+) |
|-----------|-------------|----------------|---------------|
| Navbar | h-16, hamburger | h-16, hamburger | h-20, inline-lenker |
| Hero | Stacked (bilde under tekst) | Stacked | Side-by-side 2-col |
| Kort-grid | 1 col, stacking | 2 cols | 3 cols |
| Galleri-grid | 2 cols (4 synlige) | 3 cols | 4 cols |
| Footer | 1 col stacked | 3 cols | 3 cols |
| Tjeneste-sidebar | Full bredde under | Full bredde under | Sticky sidebar |

### Grid-system per innholdstype

| Innhold | Mobil | md | lg | Gap |
|---------|-------|----|----|-----|
| Kontakt-kort | 1 col | 2 cols | 3-4 cols | gap-6 |
| Tjenester-kort | 1 col (stack) | 2 cols | 3 cols | gap-6 md:gap-8 |
| Tannleger-kort | 1 col (stack) | 2 cols | 3 cols | gap-6 md:gap-8 |
| Galleri-bilder | 2 cols | 3 cols | 4 cols | gap-3 md:gap-4 |

---

## 7. Tilgjengelighet (WCAG AA)

### Krav

- **Kontrast:** ≥ 4.5:1 for normal tekst, ≥ 3:1 for stor tekst (≥ 18px bold / ≥ 24px regular)
- **Fokus-stiler:** Alle interaktive elementer MÅ ha synlig `focus-visible` ring
- **Skip-link:** Legg til "Hopp til hovedinnhold"-lenke i Layout.astro
- **Semantisk HTML:** Korrekt heading-hierarki (h1 → h2 → h3), landmarks (nav, main, footer)
- **Bilder:** Meningsfulle `alt`-tekster, dekorative med `aria-hidden="true"`
- **Aktiv tilstand:** Bruk mer enn bare fargeendring (underline, ikon, vekt)

### Fokus-ring standard

```css
/* Alle interaktive elementer */
focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand
```

### Skip-link

```html
<a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:text-brand focus:font-semibold">
  Hopp til hovedinnhold
</a>
```

---

## 8. Side-spesifikke retningslinjer

### 8.1 Forsiden (index.astro)

**Informasjonsrekkefølge (uendret):**
1. Hero (velkomst + bilde + CTA-er)
2. Kontakt (mest etterspurt — skal være umiddelbart tilgjengelig)
3. Galleri (klinikken visuelt)
4. Tjenester (kun desktop — tilgjengelig via meny på mobil)
5. Tannleger (kun desktop — tilgjengelig via meny på mobil)

**Begrunnelse:** Erfaring viser at kontaktinformasjon er det mest etterspurte. Kontakt
plasseres derfor rett etter hero for å minimere klikk/scroll.

**Mobil-synlighet:** Tjenester og Tannleger forblir `hidden md:block` på forsiden.
Dette er et bevisst valg — på mobil nås de via navigasjonsmenyen som peker til
standalone-sidene `/tjenester` og `/tannleger`. Dette holder mobilopplevelsen
fokusert på det viktigste: kontaktinfo og visuelt inntrykk.

**Galleri på mobil:** Vis 4 bilder (opp fra 2) med "Se alle" CTA-lenke.

### 8.2 Standalone-sider

Alle standalone-sider bruker `variant="white"` (uendret). Konsistent hvit bakgrunn.

### 8.3 404-siden

Profesjonell og enkel:
- Stor, blek "404" som bakgrunnselement
- Tydelig overskrift og forklarende tekst
- To handlingsknapper: "Til forsiden" (primær) + TelefonKnapp (sekundær)
- Fjern overdrevne dekorative elementer (pulserende sirkler)
- **Fiks nestet `<main>`:** 404.astro har egen `<main>` inne i Layout.astros `<main>` —
  ugyldig HTML. Bruk `<section>` eller `<div>` i stedet.

### 8.4 Tjenester/[id] (detaljside)

- Container: `max-w-6xl` for optimal lesebredde
- Brødsmulesti med mellomsteg: Forside → Tjenester → [Tittel] (link til `/tjenester`)
- Fjern `!important`-overstyrninger — bruk egne CSS-klasser (f.eks. `.detail-heading` for venstrejustert h1)
- Sidebar: `p-6 bg-brand-light rounded-2xl` med CTA-knapper i **accent-variant**
- **Fiks h4-bug:** linje 78 har motstridende `text-lg` og `text-sm` — fjern `text-lg`

### 8.5 Komponenter utenfor scope

Følgende komponenter er **uendret** av redesignet og trenger ingen spesifikasjon:
- **InfoBanner** — beholdes som i dag (påvirkes indirekte av fargetoken-endringer)
- **Dynamisk meldingsboks** (Forside.astro) — beholdes, bruker `--color-brand-message-box/banner`
- **Kontakt-seksjonen** — beholdes som i dag. Påvirkes indirekte av spacing-endringer
  (steg 3) og fargetoken-endringer (steg 2). Verifiser visuelt etter disse stegene.

---

## 9. Hover- og interaksjonstilstander

| Element | Standard | Hover | Fokus | Active |
|---------|----------|-------|-------|--------|
| Primærknapp | bg-brand shadow-sm | bg-brand-dark shadow-md -translate-y-px | outline-2 outline-brand | translate-y-0 |
| Accentknapp | bg-accent shadow-md | bg-accent-hover shadow-lg -translate-y-px | outline-2 outline-accent | translate-y-0 |
| Sekundærknapp | border-brand-border bg-transparent | bg-brand-light border-brand | outline-2 outline-brand | — |
| Kort | border-brand-border/60 shadow-sm | border-brand-border shadow-md | outline-2 outline-accent | — |
| Nav-lenke | text-brand-hover | text-brand + underline | outline-2 outline-brand | — |
| Galleri-bilde | shadow-sm | shadow-md + scale(1.03) | outline-2 outline-accent | — |
| Heading accent | bg-accent (statisk) | — | — | — |

---

## 10. Ytelse

- **Fonter:** Self-hosted woff2-filer fra `/fonts/` (~50-70 KB totalt)
  - Ingen tredjepartsavhengighet (Google Fonts CDN)
  - Ingen ekstra DNS-oppslag — serveres direkte fra CloudFront
  - Full cache-kontroll (immutable caching med hashed filnavn eller lang max-age)
- **font-display: swap** for umiddelbar tekstvisning
- **Bilder:** Astro Image-komponent med lazy loading (galleri) og eager loading (hero, above-fold)
- **CSS:** Tailwind v4 med tree-shaking — kun brukte klasser i produksjon
