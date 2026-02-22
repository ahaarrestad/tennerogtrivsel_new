# Plan: Forbedre UX for zoom/posisjon-kontroller i admin

## Kontekst

Zoom- og posisjons-sliderne i admin-redigeringsskjemaene (tannleger + galleri) har to UX-problemer:
1. **Ingen finjustering** — det finnes kun slidere, ingen +/- knapper for presise justeringer i små steg
2. **Utilsiktet scrolling** — range-slidere fanger scroll-events på mobil, så brukeren risikerer å endre verdier når de egentlig vil scrolle forbi

Oppgaven løses iterativt med én commit per deloppgave.

## Deloppgave 1: +/- knapper for finjustering (FERDIG)

### Design

Minus-knapp (venstre) og pluss-knapp (høyre) rundt hver slider:

```
┌─────────────────────────────────────────────┐
│ Zoom (Skala)                          1.5x  │
│ [−] ═══════●══════════════════════ [+]      │
│                                             │
│ Fokuspunkt Horisontalt (X)            50%   │
│ [−] ════════════════●════════════ [+]       │
└─────────────────────────────────────────────┘
```

**Stegstørrelser:**
- Zoom: ±0.1 (20 steg over range 1.0–3.0)
- PosX/PosY: ±1 (1% per klikk)

**Knappene clampes** til sliderens min/max-verdier.

### Endringer

1. `src/pages/admin/index.astro` — Tannleger-slidere: wrappet med `div.flex` + knapper
2. `src/pages/admin/index.astro` — Galleri-slidere: identisk wrapping
3. `src/pages/admin/index.astro` — Event-binding: `.slider-step-btn` click-lyttere (begge skjemaer)
4. `src/styles/global.css` — `.slider-step-btn`-klasse

## Deloppgave 2: Hindre utilsiktet scrolling (FERDIG)

### Tiltak

1. **CSS `touch-action: pan-y`** på `input[type="range"]` — lar nettleseren håndtere vertikal scroll selv om fingeren er over en slider (mobil)
2. **`wheel`-event blokkering** — `e.preventDefault()` med `{ passive: false }` på alle range-inputs, hindrer at musescroll endrer slider-verdien (desktop)

### Endringer

1. `src/styles/global.css` — `touch-action: pan-y` på `input[type="range"]`
2. `src/pages/admin/index.astro` — `wheel` event listener på range-inputs (begge skjemaer)
