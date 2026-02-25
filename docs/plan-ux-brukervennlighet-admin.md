# Plan: UX- og brukervennlighetsgjennomgang av admin-panelet

## Kontekst

Admin-panelet har allerede vært gjennom en design/a11y-gjennomgang (tokens, CSS-opprydding, ARIA, CLS-fiks). Denne oppgaven fokuserer på **brukervennlighet for den daglige brukeren** — en tannklinikk-resepsjonist eller tannlege som bruker admin-panelet på mobil eller desktop.

Hovedproblemene identifisert:
- **Orientering**: Brukeren vet ikke hvilken modul de er i, eller hvor mange elementer som finnes
- **Opplevd ytelse**: Ingen skeleton-loadere — tom flate mens data hentes
- **Feilmeldinger**: Generiske ("Lagring feilet") uten kontekst eller veiledning
- **Lagrestatus**: Bittesmå inline-indikatorer som er lette å overse
- **Berøringsmål**: Knapper under WCAG 44×44px minimum på mobil
- **Overganger**: Brå bytte mellom dashboard/modul/editor uten animasjon

## Steg (7 steg, uavhengige og separat committbare)

### ✅ Steg 1: Modul-header med brødsmuler og elementtelling
**Impakt: HØY** — Mest desorienterende problem i dag.

Nåværende: Tilbake-knapp er en pil uten label. Ingen brødsmuler. Ingen elementtelling i lister.

Endringer:
- `index.astro`: Erstatt tilbake-knapp-området med brødsmule: `[←] Dashboard / Modulnavn (N elementer)`
- `admin-init.js`: `openModule()` setter brødsmule-tekst
- `admin-dashboard.js`: Hver `loadXxxModule()` oppdaterer elementtelling etter datalasting
- `admin-module-settings.js`: Samme mønster for innstillinger
- `global.css`: Nye klasser `.admin-breadcrumb`, `.admin-item-count`

Filer: `index.astro`, `admin-init.js`, `admin-dashboard.js`, `admin-module-settings.js`, `global.css`

---

### ✅ Steg 2: Skeleton-loadere for modulinnhold
**Impakt: HØY** — I dag ser brukeren bare "Henter..." med pulse-animasjon.

Endringer:
- `admin-dashboard.js`: Ny hjelpefunksjon `renderSkeletonCards(count)` som returnerer HTML for placeholder-kort som matcher formen til ekte kort (thumbnail + tekstlinjer + knapper)
- Erstatt alle `'Henter ...'`-strenger med passende skeleton-HTML
- `admin-module-settings.js`: Innstillings-spesifikk skeleton (label + input gjentatt 4×)
- `global.css`: Nye klasser `.admin-skeleton`, `.admin-skeleton-text`, `.admin-skeleton-card`

Filer: `admin-dashboard.js`, `admin-module-settings.js`, `global.css`

---

### ✅ Steg 3: Kontekstuelle feilmeldinger med veiledning
**Impakt: HØY** — Generiske feilmeldinger gir brukeren ingen hjelp.

Nåværende: `showToast("Kunne ikke laste oppslag", "error")` — hva skal brukeren gjøre?

Endringer:
- Bruk `classifyError()` fra `admin-api-retry.js` i alle catch-blokker:
  - **Auth-feil**: "Økten din er utløpt. Logg inn på nytt." + login-knapp
  - **Nettverksfeil**: "Nettverksfeil — sjekk internettforbindelsen og prøv igjen."
  - **Andre feil**: "Noe gikk galt med [kontekst]. Prøv igjen eller kontakt administrator."
- `admin-dialog.js`: Ny `showAuthExpired()` — prominent banner øverst med login-knapp
- Alle modulfiler: Oppdater catch-blokker med kontekstuell info (elementnavn, operasjon)

Filer: `admin-dashboard.js`, `admin-dialog.js`, `admin-module-tjenester.js`, `admin-module-meldinger.js`, `admin-module-tannleger.js`, `admin-module-bilder.js`, `admin-module-settings.js`

---

### ✅ Steg 4: Tydelig lagrestatus-feedback
**Impakt: MIDDELS-HØY** — Auto-save-status er `text-[10px]` og forsvinner etter 5 sekunder.

Endringer:
- `admin-editor-helpers.js`: Nye funksjoner `showSaveBar(state, message)` og `hideSaveBar(delay)` — fast bunnlinje som viser lagrestatus (gul=lagrer, grønn=lagret, rød=feil)
- `admin-module-tannleger.js` og `admin-module-bilder.js`: Erstatt inline statusEl med `showSaveBar()`
- `admin-module-settings.js`: Behold per-felt-indikatorer men øk til `text-xs` (fra `text-[10px]`)
- `global.css`: Klasser `.admin-save-status`, `.admin-save-status-saving/saved/error`

Filer: `admin-editor-helpers.js`, `admin-module-tannleger.js`, `admin-module-bilder.js`, `admin-module-settings.js`, `global.css`

---

### ✅ Steg 5: Større berøringsmål på mobil (CSS-only)
**Impakt: MIDDELS** — Ikonknapper er ~36px, WCAG anbefaler 44×44px.

Endringer:
- `global.css`: Legg til `min-w-[44px] min-h-[44px]` + `flex items-center justify-center` på:
  - `.admin-icon-btn`
  - `.admin-icon-btn-danger`
  - `.admin-icon-btn-reorder`
  - `.slider-step-btn` (øk fra `w-8 h-8` til `w-10 h-10` på mobil)

Ingen template-endringer — klassene finnes allerede på alle knapper.

Filer: `global.css`

---

### ✅ Steg 6: Dashboard-kort med statusinfo
**Impakt: MIDDELS** — Brukeren må klikke inn i modulen for å se om noe har endret seg.

Endringer:
- `index.astro`: Legg til `<span id="card-xxx-count" class="admin-card-count hidden">` i hvert kort
- `admin-dashboard.js`: Ny funksjon `loadDashboardCounts(config)` — henter data parallelt med `Promise.allSettled()`, oppdaterer kort med f.eks. "5 behandlinger, 3 aktive" / "2 aktive meldinger"
- `admin-init.js`: Kall `loadDashboardCounts()` i `handleAuth()` (fire-and-forget, ikke-blokkerende)
- `global.css`: Ny klasse `.admin-card-count`

Filer: `index.astro`, `admin-dashboard.js`, `admin-init.js`, `global.css`

---

### Steg 7: Mykere overganger mellom visninger
**Impakt: MIDDELS-LAV** — Brå bytte mellom dashboard↔modul og liste↔editor.

Endringer:
- `admin-init.js`: `openModule()`/`closeModule()` bruker fade+slide i stedet for umiddelbar `hidden`-toggle (150ms ut, 200ms inn)
- `admin-dashboard.js`: Listeinnhold etter lasting får `admin-view-enter`-klasse
- `global.css`: Ny animasjon `@keyframes admin-fade-in` (opacity 0→1, translateY 8px→0)

Filer: `admin-init.js`, `admin-dashboard.js`, `global.css`

---

## Rekkefølge

```
1 (Brødsmuler)    → uavhengig, høyest impakt
2 (Skeletoner)    → uavhengig, høy impakt
3 (Feilmeldinger) → uavhengig, høy impakt
5 (Berøringsmål)  → uavhengig, kun CSS
4 (Lagrestatus)   → uavhengig, bygger på mønstre fra steg 3
6 (Dashboard-tall) → uavhengig, komplementerer steg 1
7 (Overganger)    → uavhengig, lavest risiko
```

## Verifisering

Per steg:
1. Kjør enhetstester (`npm test`) — oppdater berørte testfiler, 80% branch coverage
2. Kjør E2E-tester (`npx playwright test`)
3. Bygg (`npm run build`) — ingen byggefeil
4. Manuell sjekk i nettleser (desktop + mobil viewport) for visuell verifisering
