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

### Google Fonts import

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Montserrat:wght@700;800;900&display=swap" rel="stylesheet">
```

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
| h2 / section-heading | text-3xl (30px) | text-5xl (48px) | Montserrat | 800 | 1.15 | -0.025em |
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

**Regel:** `.h2` og `.section-heading` er i dag duplisert — konsolider til én klasse.
Reservér `font-black` (900) kun for h1. H2 bruker `font-extrabold` (800) for tydeligere hierarki.

> **Merk:** `line-height: 1.15` (ikke 1.1) brukes for h1/h2 for å unngå at underkanten av
> bokstaver som «g», «j», «p» klippes. Nåværende kode bruker `leading-tight` (1.25) — dette
> er en visuell endring som må implementeres eksplisitt.

### Komplett font-family-tilordning

Alle klasser som trenger eksplisitt `font-family`-deklarasjon:

| Klasse | Font |
|--------|------|
| `.h1`, `.h2`, `.h3`, `.h4` | `var(--font-heading)` |
| `.section-heading` (konsolideres med .h2) | `var(--font-heading)` |
| `.card-title`, `.card-subtitle` | `var(--font-heading)` |
| `body` | `var(--font-body)` |
| `.section-intro`, `.card-text`, `.card-link` | `var(--font-body)` |
| `.btn-primary`, `.btn-secondary` | `var(--font-body)` |
| `.nav-link` | `var(--font-body)` |

Uten eksplisitte deklarasjoner har Google Fonts-importen ingen effekt.

---

## 3. Fargepalett

### Primær-palett (slate-basert)

| Token | Verdi | Hex | Bruk |
|-------|-------|-----|------|
| `--color-brand` | slate-800 | #1e293b | Primærtekst, overskrifter |
| `--color-brand-dark` | slate-900 | #0f172a | Sterk vekt, footer-bakgrunn |
| `--color-brand-hover` | slate-600 | #475569 | Hover-tilstand og sekundærtekst (7.58:1 kontrast) |
| `--color-brand-active` | slate-100 | #f1f5f9 | Aktiv/pressed bakgrunn |
| `--color-brand-border` | slate-200 | #e2e8f0 | Kantlinjer (synligere enn før) |
| `--color-brand-light` | slate-50 | #f8fafc | Lys seksjonsbakgrunn |
| `--color-brand-message-box` | slate-100 | #f1f5f9 | Meldingsboks |
| `--color-brand-message-banner` | slate-200 | #e2e8f0 | Banner |

> **Sideeffekt på admin-panelet:** Fargetoken-endringer (spesielt `--color-brand-border`
> fra slate-100 til slate-200) påvirker admin-kort, inputs og nav. Admin-panelet har
> egne klasser (`.admin-card`, `.admin-input`) men bruker de samme token-variablene.
> Verifiser visuelt at admin ikke ser feil ut etter fargeendringer.

### Aksentfarge (teal)

| Token | Verdi | Hex | Bruk |
|-------|-------|-----|------|
| `--color-accent` | teal-700 | #0f766e | CTA-knapper, accent bar, aktiv nav |
| `--color-accent-hover` | teal-800 | #115e59 | CTA hover |
| `--color-accent-light` | teal-50 | #f0fdfa | Subtil CTA-bakgrunn |
| `--color-accent-border` | teal-200 | #99f6e4 | Aksentkantlinjer (reservert for fremtidig bruk) |

**Begrunnelse:** Teal signaliserer helse og ro, komplementerer slate, og gir 5.47:1
kontrast mot hvit (WCAG AA). Brukes **kun** for handlinger og aksenter — ikke for
overskrifter eller brødtekst.

> **Merk:** teal-700 (5.47:1) passerer WCAG AA for normal tekst (≥ 4.5:1), men er
> tett på grensen for `text-sm` (14px). Bruk teal-700 kun på knapper (≥ 14px semibold)
> og større elementer. For liten tekst på teal-bakgrunn, bruk hvit tekst.

### Semantiske farger

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
| slate-800 på hvit | ~12.6:1 | PASS |
| slate-800 på slate-50 | ~12.1:1 | PASS |
| slate-600 på hvit (hover/sekundærtekst) | 7.58:1 | PASS |
| teal-700 på hvit (CTA) | 5.47:1 | PASS |
| hvit på teal-700 (fylt CTA) | 5.47:1 | PASS |
| hvit på teal-800 (CTA hover) | 7.58:1 | PASS |
| hvit på slate-800 (footer) | ~12.6:1 | PASS |

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
- **Behold** card-progress-bar (endre farge til accent/teal)
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

| Egenskap | Før | Etter |
|----------|-----|-------|
| Primær stil | Outline (ghost) | Fylt (bg-brand text-white) |
| Avrunding | rounded-2xl | rounded-xl (12px) |
| Padding | px-6 py-3.5 | px-6 py-3 |
| Shadow | shadow-lg | shadow-sm (mindre påtrengende) |
| Focus | Ingen | focus-visible med outline |

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
  @apply bg-white/95 backdrop-blur-sm border-b border-slate-200/60;
  @apply supports-[backdrop-filter]:bg-white/80;
}
```

- Glassmorfisme-effekt når sticky
- Høyde: h-16 (mobil) / h-20 (desktop, fra `lg:` breakpoint)
- Logo: `h-12` på mobil (plass i h-16 nav), `h-16` fra lg
- Nav-lenker med underline-animasjon:

```css
.nav-link {
  @apply text-base font-medium text-slate-600 hover:text-brand;
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

### 5.5 Footer

Trekolonners layout med mørk bakgrunn:

```
┌─────────────────────────────────────────────────────┐
│  bg-slate-800 text-white py-12 md:py-16             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ Logo +   │  │ Kontakt  │  │ Åpnings- │          │
│  │ Beskriv. │  │ info     │  │ tider    │          │
│  └──────────┘  └──────────┘  └──────────┘          │
│─────────────────────────────────────────────────────│
│  border-t border-slate-700                          │
│  © 2026 Tenner og Trivsel                           │
└─────────────────────────────────────────────────────┘
```

- 1 kolonne på mobil, 3 kolonner fra md
- Kolonne 1: Logo (invertert via `filter: brightness(0) invert(1)`) + kort beskrivelse (fra settings)
- Kolonne 2: Adresse, telefon, e-post (fra settings, samme datakilde som Kontakt-seksjonen)
- Kolonne 3: Åpningstider (fra settings, krever parsing av `businessHours`-feltet)
- Copyright-linje under med `border-t border-slate-700` — årstall dynamisk (`new Date().getFullYear()`)

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

- Heading accent bar: Endre fra `bg-brand-dark` til `bg-accent` (teal)

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
- Sidebar: `p-6 bg-brand-light rounded-2xl` med CTA-knapper
- **Fiks h4-bug:** linje 78 har motstridende `text-lg` og `text-sm` — fjern `text-lg`

### 8.5 Komponenter utenfor scope

Følgende komponenter er **uendret** av redesignet og trenger ingen spesifikasjon:
- **InfoBanner** — beholdes som i dag (påvirkes indirekte av fargetoken-endringer)
- **Dynamisk meldingsboks** (Forside.astro) — beholdes, bruker `--color-brand-message-box/banner`

---

## 9. Hover- og interaksjonstilstander

| Element | Standard | Hover | Fokus | Active |
|---------|----------|-------|-------|--------|
| Primærknapp | bg-brand shadow-sm | bg-brand-dark shadow-md -translate-y-px | outline-2 outline-brand | translate-y-0 |
| Sekundærknapp | border-brand-border bg-transparent | bg-brand-light border-brand | outline-2 outline-brand | — |
| Kort | border-brand-border/60 shadow-sm | border-brand-border shadow-md | outline-2 outline-accent | — |
| Nav-lenke | text-slate-600 | text-brand + underline | outline-2 outline-brand | — |
| Galleri-bilde | shadow-sm | shadow-md + scale(1.03) | outline-2 outline-accent | — |
| Heading accent | bg-accent (statisk) | — | — | — |

---

## 10. Ytelse

- **Fonter:** Variable fonts via Google Fonts (~50-70 KB totalt, woff2)
- **font-display: swap** for umiddelbar tekstvisning
- **preconnect** til fonts.googleapis.com og fonts.gstatic.com
- **Bilder:** Astro Image-komponent med lazy loading (galleri) og eager loading (hero, above-fold)
- **CSS:** Tailwind v4 med tree-shaking — kun brukte klasser i produksjon
