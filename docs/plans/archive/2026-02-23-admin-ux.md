# Plan: Design- og UX-gjennomgang av admin-panelet

> **Status: FULLFØRT** — 10 steg fullført

## Kontekst

Admin-panelet er en SPA (`src/pages/admin/index.astro`, ~1800 linjer) med 5 moduler (Innstillinger, Tjenester, Meldinger, Tannleger, Bilder). Det bruker CSS-klasser i `src/styles/global.css` (linje 448-586) og genererer HTML via template-strenger i JS-moduler.

**Hovedproblemer:**
- Farger bruker direkte Tailwind `slate-*` i stedet for CSS-tokens (bryter med token-drevet design)
- PWA-temafarge er `#0d9488` (teal) — har ingenting med merkevaren å gjøre
- Layout shift (CLS) ved innlogging og modulveksling — innhold hopper på skjermen
- Toggle-switcher, statusmerker og knapper har duplisert inline-kode
- Inkonsistent spacing og fokus-stiler på tvers av moduler

**Tilnærming:** Pragmatisk — admin er intern, så funksjon > piksel-perfeksjon. Iterative steg som hver er uavhengig committbare.

---

## Steg

### Steg 1: Fiks layout shift (CLS) — scroll til toppen ved viewbytte

**Problem:** `<main>` har `justify-center` som sentrerer login-boksen, men etter innlogging hopper innholdet fordi dashboardet er mye større. `enforceAccessControl` viser/skjuler kort asynkront og skaper ytterligere hopp.

**Endringer:**
- `<main>`: Bytt fra `justify-center` til `justify-start` etter innlogging (eller bruk `justify-center` kun på login-containeren via wrapper)
- Legg til `window.scrollTo(0, 0)` i `openModule()` og `closeModule()`
- Gi dashboard-kortene en fast initial synlighet (alle synlige → `enforceAccessControl` skjuler de uten tilgang)

**Filer:** `src/pages/admin/index.astro`, `src/scripts/admin-dashboard.js`

---

### Steg 2: Definer admin-fargetokens i global.css

**Problem:** Admin bruker `bg-slate-50`, `text-slate-600`, `border-slate-200` direkte — ikke via CSS-variabler. Endringer i designsystemet treffer ikke admin.

**Endringer:** Legg til i `@theme`-blokken:
```
--color-admin-surface: #f8fafc    (slate-50)
--color-admin-muted: #64748b      (slate-500)
--color-admin-muted-light: #94a3b8 (slate-400)
--color-admin-border: #e2e8f0     (slate-200)
--color-admin-hover: #f1f5f9      (slate-100)
```
Oppdater de ~15 admin-CSS-klassene til å bruke disse tokens.

**Fil:** `src/styles/global.css`

---

### Steg 3: Erstatt inline slate-farger i index.astro

**Problem:** ~60 forekomster av `text-slate-*`, `bg-slate-*`, `border-slate-*` i HTML-malen og inline script.

**Endringer:** Mekanisk erstatning av slate → admin-tokens i template-HTML og script-blokken. Google OAuth SVG-farger beholdes som de er (tredjeparts merkevare).

**Fil:** `src/pages/admin/index.astro`

---

### Steg 4: Erstatt inline slate-farger i JS-moduler

**Problem:** ~50 forekomster av slate-farger i template-strenger i admin-dashboard.js, admin-dialog.js, admin-gallery.js, pwa-prompt.js.

**Endringer:** Samme mekaniske erstatning som steg 3. PWA-knappens teal-farge → brand-token.

**Filer:** `src/scripts/admin-dashboard.js`, `src/scripts/admin-dialog.js`, `src/scripts/admin-gallery.js`, `src/scripts/pwa-prompt.js`

---

### Steg 5: Flytt toggle-switch til CSS-klasser med `data-active`

**Problem:** Toggle-koden (track, dot, label) gjentas 6+ steder i index.astro og admin-dashboard.js. `setToggleState()` toggler 6+ klasser på 3 elementer.

**Endringer:**
- Nye CSS-klasser `.toggle-track`, `.toggle-dot`, `.toggle-label` med `[data-active="true"]` / `[data-active="false"]` varianter
- `setToggleState()` forenkles til å sette `data-active`-attributt
- Fjern dupliserte `classList.toggle`-kall (6 kall → 1 attributt-sett)

**Filer:** `src/styles/global.css`, `src/pages/admin/index.astro`, `src/scripts/admin-dashboard.js`

---

### Steg 6: Semantiske tokens for status-indikatorer

**Problem:** Statusmerker i meldinger bruker hardkodede `bg-green-100 text-green-700`, `bg-blue-100 text-blue-700` etc.

**Endringer:**
- Nye CSS-klasser `.admin-status-active`, `.admin-status-planned`, `.admin-status-expired`
- Erstatt inline statusklasser i `loadMeldingerModule()`

**Filer:** `src/styles/global.css`, `src/scripts/admin-dashboard.js`

---

### Steg 7: Konsistente knapper — ekstraher ikon-knapper til CSS

**Problem:** Edit/delete/reorder-knapper har identiske lange klasselister gjentatt i hver modul.

**Endringer:**
- Nye CSS-klasser `.admin-icon-btn` og `.admin-icon-btn-danger`
- Fjern `!py-4 !px-8 !rounded-2xl` overrides fra cancel-knapper
- Erstatt inline klasser i admin-dashboard.js og index.astro

**Filer:** `src/styles/global.css`, `src/pages/admin/index.astro`, `src/scripts/admin-dashboard.js`

---

### Steg 8: Konsistent fokus-stil og spacing

**Problem:** Admin bruker `focus:ring-4 focus:ring-brand/5` (knapt synlig). Spacing varierer mellom `gap-3`/`gap-4`/`gap-6`.

**Endringer:**
- `.admin-input`: `focus:ring-2 focus:ring-brand/20` (subtilt synlig)
- Normaliser list item gap til `gap-4`, formfelt `space-y-6`
- Seksjonsdelere → `border-admin-border`

**Filer:** `src/styles/global.css`, `src/pages/admin/index.astro`, `src/scripts/admin-dashboard.js`

---

### Steg 9: EasyMDE- og PWA-opprydding

**Problem:** Hardkodede hex-farger i `<style is:global>` og `admin-manifest.json`.

**Endringer:**
- EasyMDE: `#e2e8f0` → `var(--color-admin-border)`, `#f8fafc` → `var(--color-admin-surface)`
- PWA manifest: `theme_color` → `#292524` (brand), `background_color` → `#fafaf9`
- Meta theme-color → `#292524`

**Filer:** `src/pages/admin/index.astro`, `public/admin-manifest.json`

---

### Steg 10: Responsiv polering og tilgjengelighet

**Problem:** Noen touch-targets er for små, toggle mangler `role="switch"`.

**Endringer:**
- Toggle: `role="switch"`, `aria-checked` (oppdateres av `setToggleState()`)
- Loading-spinnere: `role="status"`, `aria-label="Laster..."`
- Toast max-width: `max-w-[calc(100vw-3rem)]` for 320px skjermer
- Image picker: `w-[90vw]` → `w-full mx-4`

**Filer:** `src/pages/admin/index.astro`, `src/scripts/admin-dashboard.js`, `src/scripts/admin-dialog.js`

---

## Avhengigheter

```
Steg 1 (CLS)        — uavhengig
Steg 2 (tokens)      — uavhengig, men grunnlag for steg 3-4
Steg 3 (astro slate) — avhenger av steg 2
Steg 4 (JS slate)    — avhenger av steg 2
Steg 5-10            — uavhengige av hverandre, men bør komme etter 2-4
```

## Nøkkelfiler
- `src/styles/global.css` (admin-klasser linje 448-586, @theme-blokk linje 50-86)
- `src/pages/admin/index.astro` (~1800 linjer, hele admin-SPA)
- `src/scripts/admin-dashboard.js` (modul-renderere)
- `src/scripts/admin-dialog.js` (toast/confirm)
- `src/scripts/admin-gallery.js` (bildegalleri)
- `src/scripts/pwa-prompt.js` (PWA-installering)
- `public/admin-manifest.json` (PWA-manifest)

## Verifisering
- Etter hvert steg: `npm run build` + visuell sjekk av admin (desktop og mobil)
- Kjør `npm test` for å verifisere at ingen tester brekker
- Steg 1: Manuell test — logg inn, åpne modul, gå tilbake — ingen hopping
- Steg 5: Verifiser at toggle-switcher fungerer i alle moduler
- Steg 10: Kjør Playwright a11y-tester (`accessibility.spec.ts`)
