# Plan: Kodekvalitet / småfiks

> **Status: FULLFØRT**

## Kontekst
TODO-backloggen har 5 kodekvalitetsproblemer som bør ryddes opp. Alle er små, isolerte fikser uten innbyrdes avhengigheter.

## Fikser

### 1. Skrivefeil `troke-linecap` → `stroke-linecap`
**Fil:** `src/components/Kontakt.astro:73`
- Endre `troke-linecap="round"` → `stroke-linecap="round"`

### 2. Fjern debug-kommentar
**Fil:** `src/pages/tjenester/[id].astro:21`
- Slett linje 21: `// --- DENNE LINJEN MANGLER SANNSYNLIGVIS: ---`

### 3. Begrens MutationObserver-scope
**Fil:** `src/scripts/layout-helper.js:40-44`
- Observere `bannerRoot` direkte (uten `subtree`) + `main` for innholdsendringer.
- Behold `childList: true` og `attributeFilter: ['class', 'style']`.

### 4. Fjern `[key: string]: any` fra Button.astro
**Fil:** `src/components/Button.astro:6`
- Fjern `[key: string]: any` og `...rest`-spread.
- Legg til eksplisitte HTML-attributter: `target`, `rel`, `aria-label`, `type`, `disabled`.

### 5. Legg til `noindex` på admin-siden
**Fil:** `src/pages/admin/index.astro`
- Legg til `<meta name="robots" content="noindex, nofollow">` i `<head>`.

## Verifisering
1. `npm test` — alle enhetstester passerer
2. `npm run build` — bygget kompilerer uten feil
3. `npm run test:e2e` — E2E-tester passerer
4. Rapporter branch coverage for endrede filer
