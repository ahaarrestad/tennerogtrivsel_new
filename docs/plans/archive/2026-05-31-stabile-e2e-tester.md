# Plan: Stabile E2E-tester

**Dato:** 2026-05-31

## Mål

Fjerne sporadisk Mobile Safari-feil i `tjeneste-sider`-aksessibilitetstesten.

## Funn

- Webkit/Mobile Safari viser `-` for `admin`, `links`, `seo`, `prisliste` — **tilsiktet**, disse bruker `test.skip(project !== 'chromium')`.
- Eneste reelle problem: `accessibility.spec.ts:39` setter `setViewportSize({ width: 1280, height: 800 })` etter at siden er lastet med iPhone 14-viewport. Hybridtilstanden (mobil UA + desktop viewport) trigger av og til color-contrast-avvik i WebKit.

## Tiltak

Fjern `await page.setViewportSize({ width: 1280, height: 800 })` fra `tjeneste-sider`-testen. Navigasjonen via `#tjenester .card-base.first().click()` fungerer på alle viewports.

## Filer

- `tests/accessibility.spec.ts` — linje 39 fjernes

## Definition of done

- Alle prosjekter (inkl. Mobile Safari) passerer aksessibilitetstester
- Ingen regressions i unit-tester
