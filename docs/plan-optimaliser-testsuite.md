# Plan: Optimaliser testsuiten — fjern redundante tester

## Nåsituasjon

| Kategori | Filer | Tester | Tid |
|----------|-------|--------|-----|
| Enhetstester (Vitest) | 27 | 725 | ~26s |
| E2E (Playwright) | 5 aktive | ~36 tester × 3 nettlesere | ~2-3 min |

Alle enhetstester bruker allerede `node`-miljø (ingen jsdom-overhead).

## Analyse — identifiserte redundanser

### R1. E2E: `admin.spec.ts` kjøres på 3 nettlesere uten grunn

Admin-panelet er kun desktop. Testene sjekker DOM-innhold (login-side, modul-lasting, sletteknapper) — ingen nettleserspesifikk funksjonalitet. `links.spec.ts` og `seo.spec.ts` har allerede `test.skip` for ikke-chromium.

**Tiltak:** Legg til `test.skip(project !== 'chromium')` i `admin.spec.ts`.
**Besparelse:** ~10 E2E-kjøringer fjernet (5 tester × 2 nettlesere).

### R2. E2E: Browser-agnostiske tester i `sitemap-pages.spec.ts`

Flere tester sjekker kun DOM-innhold (200 OK, `bg-white`-klasse, sidebar-synlighet) som er nettleseruavhengig. Kun 2 av 7 tester er responsive (mobilmeny, galleri-nav med mobil/desktop-grener).

**Tiltak:** Legg til `test.skip` på de 4 rent DOM-baserte testene (sitemapped pages, tjeneste-undersider, hvit bakgrunn, tjeneste-innhold + sidebar). Behold 3-nettleser for responsive tester.
**Besparelse:** ~8 E2E-kjøringer fjernet (4 tester × 2 nettlesere).

### R3. E2E: Dupliserte sidebesøk mellom `sitemap-pages` og `accessibility`

Begge testfilene besøker de samme 4-5 standalone-sidene. `sitemap-pages` sjekker `bg-white`, `accessibility` kjører axe-core. Dette betyr doble sidelastinger.

**Tiltak:** Flytt `bg-white`-sjekken inn i `accessibility.spec.ts`-løkken (som allerede besøker sidene), og fjern den fra `sitemap-pages.spec.ts`.
**Besparelse:** ~12 sidelastinger fjernet (4 sider × 3 nettlesere).

### R4. Enhetstest: Boilerplate init-tester i modulfilene

`admin-module-meldinger.test.js` og `admin-module-tjenester.test.js` har hver 2 tester som kun verifiserer at `initXxxModule()` registrerer window-globaler og at `reloadXxx()` kaller `loadXxxModule()`. Disse er implementasjonsdetaljer som allerede dekkes av `admin-dashboard.test.js`.

**Tiltak:** Fjern de 4 boilerplate-testene (2 per modul).
**Besparelse:** 4 tester — neglisjerbar tidsbesparelse, men reduserer vedlikeholdsbyrde.

### R5. Enhetstest: Vurder sammenslåing av små testfiler

Flere testfiler har under 10 tester: `sectionVariant.test.ts` (4), `data-validation.test.ts` (5), `generate-robots.test.js` (4), `layout-helper.test.js` (7). Disse er nyttige og velstrukturerte, men kan vurderes for samlokalisering om det gir organisatorisk gevinst.

**Tiltak:** Ingen endring — filene er logisk adskilte og tar lite tid. Flagges kun for bevissthet.

## Steg

### Steg 1: `admin.spec.ts` → chromium-only
- Legg til `test.skip(project !== 'chromium')` i `beforeEach`
- Verifiser at tester fremdeles passerer

### Steg 2: `sitemap-pages.spec.ts` → del opp responsive vs DOM-tester
- Legg til `test.skip` på browser-agnostiske tester
- Behold 3-nettleser for mobilmeny og galleri-nav-tester

### Steg 3: Flytt `bg-white`-sjekk fra sitemap til accessibility
- Utvid `accessibility.spec.ts`-løkken med `bg-white`-assertion
- Fjern den dedikerte testen fra `sitemap-pages.spec.ts`

### Steg 4: Fjern boilerplate init-tester
- Slett `initMeldingerModule`/`reloadMeldinger`-tester fra `admin-module-meldinger.test.js`
- Slett `initTjenesterModule`/`reloadTjenester`-tester fra `admin-module-tjenester.test.js`

### Steg 5: Kjør quality gate
- Verifiser at alle 725+ enhetstester fortsatt passerer
- Verifiser at E2E-tester passerer
- Verifiser at 80% branch coverage per fil opprettholdes

## Forventet resultat

| Metrikk | Før | Etter |
|---------|-----|-------|
| E2E nettleser-instanser | ~84 | ~62 (−26%) |
| Enhetstester | 725 | 721 |
| Branch coverage | ≥80% per fil | Uendret |
| Total E2E-tid (CI) | ~2-3 min | ~1:30-2 min |
| Total enhetstest-tid | ~26s | ~26s |

Primærgevinsten er raskere E2E-kjøring i CI, med ~26% færre nettleser-instanser. Enhetstestendringene gir marginalt raskere kjøring men bedre vedlikeholdbarhet.
