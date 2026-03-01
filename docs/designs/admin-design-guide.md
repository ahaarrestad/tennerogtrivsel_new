# Design Guide — Admin-panelet

> Referansedokument for all visuell utforming av admin-grensesnittet. Alle fremtidige endringer
> i admin-panelet SKAL følge retningslinjene i dette dokumentet.

---

## 1. Designprinsipper

| Prinsipp | Beskrivelse |
|----------|-------------|
| **Profesjonell & nøytral** | Slate-palett gir et kjølig, nøytralt uttrykk som skiller admin fra den offentlige siden (stone-basert). |
| **Desktop-fokusert, mobil-vennlig** | Admin brukes primært på desktop, men alle komponenter fungerer ned til mobil. |
| **Konsistens med hovedsiden** | Delte tokens (`--color-brand`, `--color-accent`, semantiske farger) og fonter (Montserrat/Inter) sikrer visuell sammenheng. |
| **Token-drevet** | Alle farger via CSS-variabler. Ingen hardkodede hex-verdier i admin-kode. |
| **Tilgjengelighet** | 44×44px minimum touch targets, `aria-*`-attributter, `focus-visible`-ringer, native `<dialog>`. |

### Admin vs. offentlig side

| Egenskap | Offentlig side | Admin-panel |
|----------|---------------|-------------|
| Fargepalett | Stone (varm grå) | Slate (kjølig grå) |
| Bakgrunn | Hvit / stone-50 | slate-50 (`--color-admin-surface`) |
| Kanter | stone-200 | slate-200 (`--color-admin-border`) |
| Fokus | Desktop og mobil likeverdige | Desktop-primært |
| Layout | Seksjons-basert, scroll | SPA-aktig, dashboard → modul → editor |

---

## 2. Fargepalett

### Admin-spesifikke tokens

Definert i `src/styles/global.css` under `@theme`-blokken:

| Token | Tailwind-klasse | Hex | Slate-variant | Bruk |
|-------|----------------|-----|---------------|------|
| `--color-admin-surface` | `bg-admin-surface` | `#f8fafc` | slate-50 | Sidebakgrunn |
| `--color-admin-hover` | `bg-admin-hover` | `#f1f5f9` | slate-100 | Hover, pill-bakgrunn, skeleton |
| `--color-admin-border` | `border-admin-border` | `#e2e8f0` | slate-200 | Kanter, skillelinjer |
| `--color-admin-muted` | `text-admin-muted` | `#475569` | slate-600 | Sekundærtekst |
| `--color-admin-muted-light` | `text-admin-muted-light` | `#94a3b8` | slate-400 | Tertiærtekst, ikoner |

### Delte tokens fra hovedsiden

Admin bruker følgende tokens fra den offentlige paletten:

| Token | Bruk i admin |
|-------|-------------|
| `--color-brand` (#292524) | Primærtekst, overskrifter, hover-target for knapper |
| `--color-brand-dark` (#1c1917) | Ingen direkte bruk — arves via `.btn-primary` |
| `--color-brand-hover` (#57534e) | Subtitle hover-tilstand |
| `--color-brand-border` (#e7e5e4) | Kortkanter, nav border-bottom |
| `--color-brand-light` (#fafaf9) | Ikon-knapp bakgrunn, felt-container border |
| `--color-brand-active` (#f5f5f4) | Kort hover border-farge |

### Semantiske farger

Brukes for status og varsler — samme tokens som offentlig side:

| Token | Hex | Bruk i admin |
|-------|-----|-------------|
| `--color-success` | `#15803d` | Lagret-status, aktiv-pille |
| `--color-error` | `#b91c1c` | Feilmeldinger, fare-knapper |
| `--color-info` | `#1d4ed8` | Planlagt-status |
| `--color-warning` | `#b45309` | Endret-status (save bar) |

### WCAG-kontrastsjekk (admin-kombinasjoner)

| Kombinasjon | Ratio | Status |
|-------------|-------|--------|
| `--color-brand` (#292524) på `--color-admin-surface` (#f8fafc) | ~14.5:1 | PASS |
| `--color-admin-muted` (#475569) på hvit | ~7.0:1 | PASS |
| `--color-admin-muted-light` (#94a3b8) på hvit | ~3.0:1 | PASS (kun store elementer) |
| Hvit på `--color-brand` (knapper) | ~13.1:1 | PASS |

> **Merk:** `--color-admin-muted-light` har marginal kontrast (3.0:1). Bruk kun for
> dekorativ tekst, ikoner og tertiær info — aldri for handlingsbar tekst.

---

## 3. Typografi

Admin deler fonter med hovedsiden: **Montserrat** (headings) og **Inter** (body). Begge
self-hosted woff2. Se `docs/design-guide.md` for font-detaljer.

### Admin-spesifikke typografi-klasser

| Klasse | Font | Vekt | Størrelse | Andre egenskaper | Bruk |
|--------|------|------|-----------|-----------------|------|
| `.admin-title` | Montserrat | 900 (black) | text-xl → text-5xl (responsiv) | uppercase, tracking-tight | Sidetitler, modul-headers |
| `.admin-subtitle` | Montserrat | 700 (bold) | text-base → text-2xl (responsiv) | leading-snug, mb-2 | Kort-titler på dashboard |
| `.admin-description` | Inter (arvet) | 400 | arvet | text-admin-muted, mb-3, grow | Kort-beskrivelser |
| `.admin-info-text` | Inter (arvet) | 400 | text-sm → text-base | italic, text-admin-muted | Hjelpetekst, infomeldinger |
| `.admin-label` | Inter (arvet) | 700 (bold) | text-xs | uppercase, tracking-wider, mb-2 | Skjema-labels |

### Responsiv typografi for `.admin-title`

```
Mobil:    text-xl   (20px)
sm:       text-2xl  (24px)
md:       text-3xl  (30px)
lg:       text-5xl  (48px)
```

---

## 4. Layout

### Arkitektur

```
<html class="h-full bg-admin-surface">
<body class="admin-layout">
  ├── <nav class="admin-nav">           ← Sticky top-nav
  │     └── .admin-nav-container        ← Flex: logo | bruker-pill + hjem
  │
  └── <main class="flex-grow flex flex-col items-center p-4">
        ├── #login-container            ← .admin-login-box (vises før innlogging)
        ├── #dashboard                  ← .admin-dashboard-container (vises etter login)
        │     ├── .admin-card-header    ← Velkommen-header
        │     └── .admin-module-grid    ← 2-kolonners dashboard-kort
        │
        └── #module-container           ← .admin-dashboard-container (modulvisning)
              ├── .admin-breadcrumb     ← Navigasjon: Dashboard / Modul / Editor
              └── .admin-card           ← Modulinnhold
```

### Layout-klasser

| Klasse | CSS | Bruk |
|--------|-----|------|
| `.admin-layout` | `h-full flex flex-col bg-admin-surface text-brand` | Body wrapper — full høyde, flexbox |
| `.admin-nav` | Sticky top-0, bg-white, border-b, h-20 (sm: h-28) | Toppmeny |
| `.admin-nav-container` | Container, mx-auto, px-4, flex justify-between | Nav innhold |
| `.admin-dashboard-container` | Container, mx-auto, px-4, py-4 (md: py-8), space-y | Hoved-container for dashboard og moduler |
| `.admin-module-grid` | Grid 1-col (md: 2-col), gap-5 | Dashboard-kortrutenett |

### Breakpoints

Admin bruker Tailwinds standard breakpoints, men primært:

| Breakpoint | Endring |
|------------|---------|
| **sm** (640px) | Større padding, fontstørrelser, nav-elementer |
| **md** (768px) | Grid 1→2 kolonner, ekstra spacing |
| **lg** (1024px) | Tittel-fontstørrelse øker til text-5xl |

---

## 5. Kort (Cards)

### `.admin-card` — Standard innholdskort

```css
.admin-card {
    @apply bg-white p-5 sm:p-6 rounded-2xl shadow-sm
           border border-brand-border transition-all duration-300;
}
```

Brukes for modulinnhold (editor-wrapper, innstillinger).

### `.admin-card-interactive` — Klikkbart kort

```css
.admin-card-interactive {
    @apply bg-white p-4 sm:p-5 rounded-2xl shadow-sm
           border border-brand-border transition-all duration-300
           hover:shadow-md hover:border-brand-active
           flex flex-col cursor-pointer;
    &:focus-visible {
        @apply outline-2 outline-offset-2 outline-brand;
    }
}
```

Brukes for listevisning (tjenester, meldinger, tannleger, galleri) og dashboard-kort.

### `.admin-card-header` — Sentrert header-kort

```css
.admin-card-header {
    @apply bg-white p-5 sm:p-6 rounded-2xl shadow-sm
           border border-brand-border transition-all duration-300 text-center;
}
```

Brukes for velkomst-headeren på dashboardet.

### Kort-hjelpeklasser

| Klasse | Bruk |
|--------|------|
| `.admin-card-chevron` | Høyrepil (`›`) i klikkbare kort. Text-3xl, text-brand/40, hover: translate-x-1 |
| `.admin-card-count` | Badge under kort-tittel med elementtelling. Text-xs, text-admin-muted-light |

### Interaksjon

Kort med `.group`-klasse trigrer animasjoner:
- **Chevron:** `text-brand/40` → `text-brand translate-x-1` ved hover/focus
- **Subtitle:** `text-brand` → `text-brand-hover` via `group-hover:text-brand-hover`

---

## 6. Knapper

### Admin-spesifikke knapper

| Klasse | Stil | Hover | Bruk |
|--------|------|-------|------|
| `.admin-btn-secondary` | bg-admin-surface, border, text-brand, text-xs | bg-brand, text-white | Sekundærhandlinger |
| `.admin-btn-cancel` | Lik secondary, men py-4 px-8, uppercase tracking-widest | bg-brand, text-white | Avbryt-knapper |
| `.admin-btn-danger` | bg-white, border-red-100, text-red-500, text-xs | bg-red-50 | Farehandlinger (slett) |

### Ikonknapper (44×44 minimum touch target)

| Klasse | Bakgrunn | Tekst | Hover | Bruk |
|--------|----------|-------|-------|------|
| `.admin-icon-btn` | bg-brand-light/30 | text-brand | bg-brand, text-white | Rediger |
| `.admin-icon-btn-danger` | bg-red-50 | text-red-400 | bg-red-500, text-white | Slett |
| `.admin-icon-btn-reorder` | bg-admin-hover | text-admin-muted-light | bg-brand, text-white | Opp/ned piler (reorder) |

Alle ikonknapper: `min-w-[44px] min-h-[44px] p-2.5 rounded-xl transition-all`.

### Delte knapper fra hovedsiden

Admin bruker også `.btn-primary` fra den offentlige paletten for primærhandlinger:
- Innloggingsknapp
- «Prøv igjen»-knapper
- Modulaksjon-knapper (f.eks. «Legg til behandling»)

---

## 7. Skjemaelementer

### `.admin-label`

```css
.admin-label {
    @apply font-bold text-brand text-xs uppercase tracking-wider block mb-2;
}
```

### `.admin-input`

```css
.admin-input {
    @apply w-full p-3 rounded-xl border border-admin-border outline-none
           focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all text-sm;
}
```

Brukes for `<input>` og `<textarea>`.

### `.admin-field-container`

```css
.admin-field-container {
    @apply flex flex-col gap-1.5 p-4 sm:p-5 rounded-2xl
           border border-brand-light bg-white
           hover:border-brand-active transition-colors;
}
```

Wrapper for label + input-par. Gir visuell gruppering med hover-effekt.

### `.admin-alert-error`

```css
.admin-alert-error {
    @apply text-red-500 font-bold p-4 bg-red-50 rounded-2xl;
}
```

Feilmelding i skjema og modulfeilhåndtering.

### Toggle-switch

Drevet av `data-active`-attributt på foreldreelementet:

| Klasse | Standard | `[data-active="true"]` |
|--------|----------|----------------------|
| `.toggle-track` | bg-admin-muted-light, h-5 w-10, rounded-full | bg-green-500 |
| `.toggle-dot` | bg-white, h-3.5 w-3.5, translate-x-0 | translate-x-5 |
| `.toggle-label` | text-[10px], text-admin-muted | text-green-700 |

Mønster: `<button role="switch" aria-checked="true|false" data-active="true|false">`

### Slider (range input)

- **Step-knapper:** `.slider-step-btn` — 40×40, bg-admin-hover, hover:bg-brand
- **Range input:** `touch-action: pan-y` hindrer utilsiktet scrolling
- Brukes for zoom/utsnitt i bilderedigering

### Markdown-editor (EasyMDE)

Tredjepartsbibliotek med admin-tilpasset styling:

```css
.EasyMDEContainer .editor-toolbar {
    border-radius: 12px 12px 0 0;
    border-color: var(--color-admin-border);
    background: var(--color-admin-surface);
}
.EasyMDEContainer .CodeMirror {
    border-radius: 0 0 12px 12px;
    border-color: var(--color-admin-border);
    font-family: ui-monospace, ...;
}
```

### Datepicker (Flatpickr)

Tredjepartsbibliotek med norsk locale (`no.js`). Standard Flatpickr-styling, ingen egne overrides.

---

## 8. Status og varsler

### Status-piller

Brukes i meldingsmodulen for å vise aktiv/planlagt/utløpt status:

| Klasse | Bakgrunn | Tekst | Border | Bruk |
|--------|----------|-------|--------|------|
| `.admin-status-active` | bg-green-100 | text-green-700 | border-green-200 | Aktive meldinger |
| `.admin-status-planned` | bg-blue-100 | text-blue-700 | border-blue-200 | Planlagte meldinger |
| `.admin-status-expired` | bg-admin-hover | text-admin-muted | border-admin-border | Utløpte meldinger |

**Pille-base:** `.admin-status-pill` — text-[9px] uppercase, px-2 py-0.5, rounded-full, border, flex items-center gap-1.5.

**Status-prikker:**

| Klasse | Farge | Animasjon |
|--------|-------|-----------|
| `.admin-status-dot-active` | bg-green-500 | animate-pulse |
| `.admin-status-dot-planned` | bg-blue-500 | ingen |
| `.admin-status-dot-expired` | bg-admin-muted-light | ingen |

### Save bar

Fixed bottom bar som viser auto-save status:

```css
.admin-save-bar {
    @apply fixed bottom-6 left-1/2 z-50
           flex items-center gap-2 px-5 py-3 rounded-2xl
           shadow-xl border font-bold text-sm;
    transform: translateX(-50%);
    animation: admin-save-bar-in 300ms ease-out;
}
```

| Tilstand | Klasse | Farger |
|----------|--------|--------|
| Endret | `.admin-save-bar-changed` | bg-amber-50, text-amber-700, border-amber-200 |
| Lagrer | `.admin-save-bar-saving` | bg-blue-50, text-blue-700, border-blue-200 |
| Lagret | `.admin-save-bar-saved` | bg-green-50, text-green-700, border-green-200 |
| Feil | `.admin-save-bar-error` | bg-red-50, text-red-600, border-red-200 |

### Toast

Non-blocking notifikasjoner via `showToast(message, type)` fra `admin-dialog.js`:

| Type | Bakgrunn | Ikon | Tekst |
|------|----------|------|-------|
| `error` | bg-red-50 border-red-200 | text-red-500 | text-red-800 |
| `success` | bg-green-50 border-green-200 | text-green-500 | text-green-800 |
| `info` | bg-amber-50 border-amber-200 | text-amber-500 | text-amber-800 |

Container: `#admin-toast-container` — fixed bottom-6 right-6, `aria-live="polite"`, `role="status"`.
Standard varighet: 5 sekunder. Lukkes med X-knapp eller timeout.

### Confirm-dialog

`showConfirm(message, options)` — returnerer `Promise<boolean>`:

- Native `<dialog>` med `backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm`
- Rounded-2xl, shadow-2xl, max-w-md
- Avbryt-knapp (`.admin-btn-secondary`) + Bekreft-knapp (`.btn-primary`)
- Destruktiv variant: rød bekreft-knapp (`bg-red-600 hover:bg-red-700`)
- Escape lukker (via native dialog `cancel`-event)
- Fokus settes til Avbryt-knappen (safe default)

### Auth-expired banner

`showAuthExpired(container, onLogin)` — amber banner med lås-ikon:

- `border-amber-200 bg-amber-50`, `role="alert"`
- «Økten din er utløpt» + «Logg inn»-knapp
- Prepend til container-elementet

---

## 9. Navigasjon

### `.admin-nav`

Sticky toppmeny:

```css
.admin-nav {
    @apply bg-white border-b border-brand-border
           sticky top-0 z-[100] h-20 sm:h-28 flex items-center;
}
```

Innhold: Logo + «Admin»-tekst (venstre) | Bruker-pill + Hjem-lenke (høyre).

### `.admin-user-pill`

```css
.admin-user-pill {
    @apply bg-admin-hover hover:bg-admin-border
           px-3 py-1.5 sm:px-4 sm:py-2 rounded-full
           border border-admin-border transition-colors
           flex items-center gap-2 shrink-0;
}
```

Viser brukerens navn + logout-ikon. Klikk logger ut.

### `.admin-breadcrumb`

Dynamisk brødsmulesti:

```
Dashboard / Meldinger (3) / Rediger oppslag
```

| Klasse | Stil | Bruk |
|--------|------|------|
| `.admin-breadcrumb` | flex, items-center, gap-2, text-xs | Container |
| `.admin-breadcrumb-back` | font-bold, uppercase, tracking-wider, cursor-pointer | Tilbake-knapp med pil |
| `.admin-breadcrumb-sep` | text-admin-muted-light | `/`-separator |
| `.admin-breadcrumb-current` | font-bold, uppercase, tracking-wider, bg-transparent | Gjeldende side |
| `.admin-item-count` | text-admin-muted-light | Elementtelling i parentes |

`[data-clickable="true"]` på `.admin-breadcrumb-current` gjør den klikkbar (for modul → listevisning).

### Dashboard-kort som navigasjon

Dashboard bruker `.admin-card-interactive` med `.group`-klasse.
Kort-klikk delegeres til edit-knappen via `bindCardClickDelegation()`.

---

## 10. Animasjoner

### Keyframes

Definert i `src/styles/global.css`:

| Animasjon | Keyframes | Bruk |
|-----------|-----------|------|
| `admin-skeleton-shimmer` | Gradient-glidning 200% → -200% | Skeleton-loadere |
| `admin-save-bar-in` | opacity 0→1 + translateY(1rem→0) | Save bar slide-in |
| `admin-fade-in` | opacity 0→1 + translateY(8px→0) | View-transition ved modulbytte |

### Skeleton-loadere

Brukes mens data hentes fra API:

| Klasse | Bruk |
|--------|------|
| `.admin-skeleton` | Generell shimmer-blokk (rounded-lg) |
| `.admin-skeleton-text` | Tekst-placeholder (h-0.75rem, rounded-md) |
| `.admin-skeleton-card` | Kort-wrapper med border for skeleton-innhold |

Genereres via `renderSkeletonCards(count, { withThumbnail })` i `admin-dashboard.js`.

### View-transition

`.admin-view-enter` trigger `admin-fade-in` (200ms ease-out).
Brukes ved `applyViewEnter()` for å animere modulinnhold ved navigasjon.

---

## 11. Modaler

### Image picker

Native `<dialog>` med:
- `backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm`
- `w-[90vw] max-w-4xl max-h-[85vh]`
- Sticky header med «Velg bilde» + lukke-knapp
- Upload-seksjon: drag-and-drop/klikk med dashed border og spinner-overlay
- Galleri-grid: `grid-cols-2 sm:3 md:4 lg:5 gap-4`

### Confirm-dialog

Se [Status og varsler → Confirm-dialog](#confirm-dialog).

### Mønster

```javascript
// Åpne modal
document.getElementById('image-picker-modal').showModal();

// Lukke modal
document.getElementById('image-picker-modal').close();
```

Native `<dialog>` gir gratis:
- Escape lukker
- Backdrop-klikk (med riktig event-håndtering)
- Focus trapping
- `aria-modal` automatisk

---

## 12. Tilgjengelighet

| Komponent | Implementasjon |
|-----------|---------------|
| **Ikonknapper** | `aria-label` på alle, f.eks. `aria-label="Rediger"` |
| **Toggle** | `role="switch"` + `aria-checked="true/false"` |
| **Toast-container** | `aria-live="polite"` + `role="status"` |
| **Toast-elementer** | `role="alert"` |
| **Auth-banner** | `role="alert"` |
| **Modale dialoger** | Native `<dialog>` — Escape lukker automatisk |
| **Fokus-ringer** | `focus-visible:outline-2 outline-offset-2 outline-brand` (globalt) |
| **SVG-ikoner** | `aria-hidden="true"` |
| **Loading-spinner** | `role="status" aria-label="Laster innhold"` |
| **Breadcrumb** | `<nav aria-label="Brødsmule">` |
| **Dashboard-kort** | `role="link" tabindex="0" aria-label="Gå til..."` |
| **Touch targets** | Minimum 44×44px på alle ikonknapper |
| **Lukke-knapper** | `aria-label="Lukk"` på modale X-knapper |

---

## 13. Modulmønster (utviklerveiledning)

### Navigasjonsflyt

```
Login → Dashboard → Modulliste → Editor → (Lagre) → Tilbake til liste
```

### Listevisning

Alle moduler følger samme mønster:

1. Vis skeleton-loader (`renderSkeletonCards()`)
2. Hent data fra Google Drive / Sheets
3. Rendre liste med `.admin-card-interactive`-kort
4. Bind klikk-delegering (`bindCardClickDelegation()`)
5. Last thumbnails asynkront (`loadThumbnails()`)
6. Trigger `applyViewEnter()` for fade-animasjon

### Editor

1. Skjuler listevisning, viser redigeringsfelter
2. Auto-save med debounce (1.5 sekunder)
3. Save bar viser status (endret → lagrer → lagret / feil)
4. Stille verifisering mot Sheets etter lagring

### Feilhåndtering

`handleModuleError(err, context, container, onRetry)`:

| Feiltype | Handling |
|----------|---------|
| `auth` | Vis auth-expired banner med re-login |
| `retryable` | «Nettverksfeil — sjekk forbindelsen» + «Prøv igjen» |
| Annet | «Noe gikk galt med {context}» + «Prøv igjen» |

### Sikkerhet

- **DOMPurify:** All `.innerHTML` med brukerdata saniteres via `DOMPurify.sanitize()`
- DOMPurify stripper `onclick`-attributter — bruk `addEventListener` etter render
- Kort-klikk delegeres via `bindCardClickDelegation()` istedenfor inline handlers

### Bildehåndtering

- `resolveImagePreview()` + CSS transforms for crop/zoom preview
- `object-position` og `transform: scale()` for utsnitt
- Thumbnails lastes asynkront som blob-URLer fra Google Drive

---

## 14. Login-skjerm

### `.admin-login-box`

```css
.admin-login-box {
    @apply bg-white p-6 sm:p-10 rounded-3xl shadow-xl
           border border-brand-border max-w-md w-full
           text-center space-y-8;
}
```

### `.admin-login-icon-box`

```css
.admin-login-icon-box {
    @apply w-20 h-20 bg-brand-light rounded-2xl
           flex items-center justify-center mx-auto mb-6;
}
```

Innhold: Logo, `.admin-title` «Velkommen», beskrivelse, «Husk meg»-checkbox, Google-innloggingsknapp (`.btn-primary w-full py-4`).

---

## Filreferanser

| Fil | Innhold |
|-----|---------|
| `src/styles/global.css` | Alle admin CSS-klasser og tokens (linje ~470–727) |
| `src/pages/admin/index.astro` | Eneste admin-side (SPA), HTML-struktur |
| `src/scripts/admin-dialog.js` | Toast, confirm, auth-banner, inline-banner |
| `src/scripts/admin-dashboard.js` | Modullasting, skeleton, hjelpefunksjoner |
| `src/scripts/admin-init.js` | Initialisering, routing, auth-flyt |
| `src/scripts/admin-module-*.js` | Modulspesifikke editorer |
