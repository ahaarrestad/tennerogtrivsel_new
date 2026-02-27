# Plan: Optimaliser testsuiten — fjern redundante tester

> **Status: FULLFØRT**

## Nåsituasjon

| Kategori | Filer | Tester | Tid |
|----------|-------|--------|-----|
| Enhetstester (Vitest) | 28 | 816 | ~13s |
| E2E (Playwright) | 5 aktive | 36 tester × 3 nettlesere = 108 instanser | ~2-3 min |

Alle enhetstester bruker allerede `node`-miljø (ingen jsdom-overhead).

## Analyse — identifiserte redundanser

### R1. E2E: `admin.spec.ts` kjøres på 3 nettlesere uten grunn

Admin-panelet er kun desktop. Testene sjekker DOM-innhold (login-side, modul-lasting, sletteknapper) — ingen nettleserspesifikk funksjonalitet. `links.spec.ts` og `seo.spec.ts` har allerede `test.skip` for ikke-chromium.

**Tiltak:** Legg til `test.skip(project !== 'chromium')` i `beforeEach` i `admin.spec.ts`.
**Besparelse:** 14 E2E-instanser fjernet (7 tester × 2 nettlesere).

### R2. E2E: Browser-agnostiske tester i `sitemap-pages.spec.ts`

Flere tester sjekker kun DOM-innhold (200 OK, `bg-white`-klasse, sidebar-synlighet) som er nettleseruavhengig. Kun 2 av 7 tester er responsive (mobilmeny, galleri-nav med mobil/desktop-grener).

DOM-baserte tester (5 stk, chromium-only):
- Sitemapped pages loop (5 sider, 200 OK + navbar)
- Tjeneste-undersider (200 OK + tittel)
- Hvit bakgrunn (`bg-white`-klasse)
- Tjeneste-innhold (heading + prose)
- Sidebar-synlighet (aside + «Ta kontakt»)

Responsive tester (2 stk, alle nettlesere):
- Mobilmeny (data-open toggle)
- Galleri-nav (mobil/desktop-grener)

**Tiltak:** Legg til `test.skip` på de 5 DOM-baserte testene for ikke-chromium.
**Besparelse:** 10 E2E-instanser fjernet (5 tester × 2 nettlesere).

### ~~R3. Flytt `bg-white`-sjekk fra sitemap til accessibility~~ — DROPPET

Besparelsen er marginal (selve sjekken tar millisekunder — det er sidelastingen som koster). Å blande visuell layoutsjekk inn i a11y-tester er semantisk uryddig. `bg-white`-sjekken dekkes allerede av R2 (kjøres kun i chromium).

### ~~R4. Fjern boilerplate init-tester~~ — DROPPET

Init-testene (`initMeldingerModule`, `initTjenesterModule`) verifiserer at window-globaler registreres korrekt, og `reloadMeldinger`/`reloadTjenester` tester at clearBreadcrumb kalles. Andre tester bruker `initXxxModule()` i `beforeEach` som setup, men tester ikke selve registreringen. Risiko > gevinst ved å fjerne (~0.5% av testsuiten).

### R5. Enhetstest: Vurder sammenslåing av små testfiler — INGEN ENDRING

Flere testfiler har under 10 tester. Disse er nyttige og velstrukturerte. Ingen endring — flagges kun for bevissthet.

## Steg

### Steg 1: `admin.spec.ts` → chromium-only
- Legg til `test.skip(project !== 'chromium')` i `beforeEach` (samme mønster som `links.spec.ts` og `seo.spec.ts`)
- Verifiser at tester fremdeles passerer

### Steg 2: `sitemap-pages.spec.ts` → chromium-only for DOM-tester
- Legg til `test.skip` på de 5 browser-agnostiske testene for ikke-chromium
- Behold 3-nettleser for mobilmeny og galleri-nav-tester (responsive)

### Steg 3: Kjør quality gate
- Verifiser at alle 816 enhetstester fortsatt passerer
- Verifiser at E2E-tester passerer (forventet ~84 instanser)
- Verifiser at 80% branch coverage per fil opprettholdes

## Forventet resultat

| Metrikk | Før | Etter |
|---------|-----|-------|
| E2E nettleser-instanser | 108 | ~84 (−22%) |
| Enhetstester | 816 | 816 (uendret) |
| Branch coverage | ≥80% per fil | Uendret |
| Total E2E-tid (CI) | ~2-3 min | ~1:30-2 min |
| Total enhetstest-tid | ~13s | ~13s |

Primærgevinsten er raskere E2E-kjøring i CI, med ~22% færre nettleser-instanser. Kun trygge endringer — ingen tester fjernes, bare begrenset til chromium der nettleserforskjeller er irrelevante.
