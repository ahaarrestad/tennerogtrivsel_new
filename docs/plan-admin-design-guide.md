# Plan: Lag design guide for admin-grensesnittet

## Mål

Dokumenter admin-panelets design-system i `docs/admin-design-guide.md` — tilsvarende `docs/design-guide.md` for den offentlige siden. Guiden skal fungere som referanse for all fremtidig admin-utvikling.

## Bakgrunn

Admin-panelet har allerede et konsistent design-system definert i `src/styles/global.css` (linje ~470–727) med egne CSS-variabler (`--color-admin-*`), ~40 CSS-klasser (`admin-*`), og et klart mønster for moduler, skjemaer, dialoger og animasjoner. Systemet er **udokumentert** — denne oppgaven samler det i ett referansedokument.

## Leveranse

Én fil: `docs/admin-design-guide.md`

## Dokumentstruktur

### 1. Designprinsipper
- Admin vs. offentlig side: Slate-palett (profesjonell, nøytral) vs. Stone-palett (varm, tillitvekkende)
- Mobil-vennlig men desktop-fokusert (admin brukes primært på desktop)
- Konsistens med hovedsiden via delte tokens (`--color-brand`, `--color-accent`, semantiske farger)

### 2. Fargepalett
- **Admin-spesifikke tokens** (`--color-admin-surface/hover/border/muted/muted-light`) — Slate-basert
- **Delte tokens** fra hovedsiden (`--color-brand`, `--color-accent`, semantiske farger)
- Tabell: token → verdi → hex → bruk
- WCAG-kontrastsjekk for admin-kombinasjoner

### 3. Typografi
- Deler fonter med hovedsiden (Montserrat headings, Inter body)
- Admin-spesifikke typografi-klasser: `.admin-title`, `.admin-subtitle`, `.admin-description`, `.admin-info-text`, `.admin-label`
- Tabell: klasse → font → vekt → størrelse → bruk

### 4. Layout
- Arkitektur-diagram: Nav → Dashboard/Modul-innhold
- `.admin-layout` — Flexbox full-height med `admin-surface` bakgrunn
- `.admin-nav` / `.admin-nav-container` — Sticky top-nav med logo, brukerpille, hjem-lenke
- `.admin-dashboard-container` — Max-width container
- `.admin-module-grid` — 1-kolonne mobil / 2-kolonner desktop
- Breakpoints: Primært md (768px) for grid-bytte

### 5. Kort (Cards)
- `.admin-card` — Standard kort med hvit bakgrunn, rounded-2xl, shadow-sm
- `.admin-card-interactive` — Klikkbart kort med hover-effekt
- `.admin-card-header` — Header-variant, sentrert tekst
- `.admin-card-chevron` — Høyrepil-indikator
- `.admin-card-count` — Badge for antall elementer

### 6. Knapper
- `.admin-btn-secondary` — Outline-knapp
- `.admin-btn-cancel` — Avbryt-knapp (uppercase, bred)
- `.admin-btn-danger` — Rødt fare-variant
- `.admin-icon-btn` — Ikon-knapp (44×44 min touch target)
- `.admin-icon-btn-danger` — Rød ikon-variant
- `.admin-icon-btn-reorder` — Dra-håndtak

### 7. Skjemaelementer
- `.admin-label` — Label med uppercase, tracking-wider
- `.admin-input` — Standard input/textarea med focus ring
- `.admin-field-container` — Wrapper for label + input med hover-effekt
- `.admin-alert-error` — Feilmelding i skjema
- Toggle-switch: `.toggle-track` + `.toggle-dot` + `.toggle-label`
- Range/slider: `.slider-step-btn` + native range input
- Markdown-editor: EasyMDE med admin-tilpasset toolbar-styling
- Datepicker: Flatpickr integrasjon

### 8. Status og varsler
- **Status-piller:** `.admin-status-pill` med `.admin-status-dot` (active/planned/expired)
- **Save bar:** `.admin-save-bar` med 4 tilstander (changed/saving/saved/error)
- **Toast:** `showToast(message, type)` — error/success/info, fixed bottom-right
- **Confirm dialog:** `showConfirm(options)` — native `<dialog>` med backdrop-blur
- **Auth-banner:** `showBanner()` — amber varsling for utløpt autentisering

### 9. Navigasjon
- `.admin-breadcrumb` — Dynamisk brødsmuler med tilbake-knapp
- `.admin-user-pill` — Brukerinfo med dropdown
- Dashboard-kort som modulnavigasjon

### 10. Animasjoner
- `admin-skeleton-shimmer` — Skeleton-loader gradient
- `admin-save-bar-in` — Slide-in for save bar
- `admin-fade-in` — View-transition fade
- `.admin-view-enter` — Trigger-klasse for fade-animasjon

### 11. Modaler
- Image picker: Native `<dialog>`, grid-galleri, drag-and-drop upload
- Confirm dialog: Native `<dialog>`, backdrop-blur, destructive-variant
- Mønster: `modal.showModal()` / `modal.close()`

### 12. Tilgjengelighet
- Alle knapper har `aria-label`
- Toggle: `role="switch"` + `aria-checked`
- Toast-container: `aria-live="polite"` + `role="status"`
- Native `<dialog>` for modale dialoger (Escape lukker)
- Fokus: `focus-visible:outline-2 outline-offset-2`
- SVG-ikoner: `aria-hidden="true"`

### 13. Modulmønster (utviklerveiledning)
- Listevisning → Rediger → Lagre → Tilbake
- Auto-save med debounce (1.5s)
- Skeleton-loader ved lasting
- DOMPurify for all `.innerHTML`
- Bildehåndtering: `resolveImagePreview()` + CSS transforms for crop

## Steg

| # | Handling | Estimat |
|---|----------|---------|
| 1 | Skriv `docs/admin-design-guide.md` basert på strukturen over | Hoveddel |
| 2 | Oppdater `TODO.md` — legg til plan-lenke på oppgaven | Liten |

## Avgrensning

- **Ingen kodeendringer** — dette er ren dokumentasjon
- Refererer til eksisterende klasser/tokens, foreslår ikke nye
- Dekker ikke detaljert JS-API-dokumentasjon (kun UI-mønstre)
