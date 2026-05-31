# Plan: Footer på prisliste-utskrift med tannlegenavn

**Dato:** 2026-05-30

## Mål

Legg til en footer i print-visningen av prislisten som viser navnene på alle tannlegene. Footeren skal kun være synlig ved utskrift — ikke i web-visningen.

## Avgrensninger (ikke med)

- Ingen titler, stillingstitler eller bilder — bare navn
- Ingen endringer i CMS-flyten, Sheets eller admin
- Ingen endringer i web-visningen av prislisten

## Berørte filer

| Fil | Endring |
|-----|---------|
| `src/pages/prisliste.astro` | Hent tannlegerdata, legg til footer-element og print-CSS |

## Steg

### 1. Hent tannlegerdata i frontmatter

Legg til `getCollection('tannleger')` i frontmatter — samme mønster som `src/pages/tannleger.astro:10`.

```ts
const tannleger = await getCollection('tannleger');
const tannlegenavn = tannleger.map(t => t.data.name).join(' · ');
```

`getCollection` er allerede importert (linje 3). Separatoren er U+00B7 MIDDLE DOT (`·`) — bruk copy-paste fra denne filen, ikke tastatur.

### 2. Legg til footer-element i HTML

Plasser `<div class="prisliste-footer-print">` etter `.prisliste-print`-griden (linje 149), men innenfor `.section-content` (lukkes linje 150). Bruk `tannleger.length > 0` som guard — en streng-guard vil ikke fange opp tannleger med tomme navn:

```html
{tannleger.length > 0 && (
    <div class="prisliste-footer-print">
        {tannlegenavn}
    </div>
)}
```

### 3. Legg til CSS

**CSS-plassering er viktig:** Det finnes allerede én `<style is:global>`-blokk med én `@media print { … }`-blokk (linje 186–287). Legg til i eksisterende blokker — ikke opprett duplikate `@media print`-blokker.

- `display: none`-regelen: inn i den ikke-scoped seksjonen øverst i `<style is:global>`
- Print-reglene: inn i den **eksisterende** `@media print { }`-blokken

**Ny `display: none`-regel (legg til ved de andre `display: none`-reglene, f.eks. etter linje 156):**

```css
.prisliste-footer-print {
    display: none;
}
```

**Print-regler (legg til i eksisterende `@media print { }`):**

```css
.prisliste-footer-print {
    display: block;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 0.15cm 1.2cm 0.3cm;
    font-size: 7pt;
    color: var(--color-brand-hover);
    text-align: center;
    border-top: 0.5px solid var(--color-brand-border);
}
```

**`padding-bottom` på body:** `@page { margin: 0 }` er allerede satt, og `position: fixed; bottom: 0` plasserer footeren relativt til papirkanten — ikke til body-padding. Uten `padding-bottom` på body vil footeren overlappe siste prisrader.

Det finnes to `body`-regler i `@media print`:
- Linje ~197–200: `html, body { margin: 0 !important; padding: 0 !important; }` — nuller alt
- Linje ~202–207: `body { padding: 0.5cm 1.2cm !important; ... }` — overstyrer tilbake

Oppdater **den andre** regelen (linje 202–207, `body`-only):

```css
body {
    padding: 0.5cm 1.2cm 0.9cm !important;  /* bunn: plass til footer */
    /* (resten uendret) */
}
```

Ikke rør den første `html, body`-regelen. `0.9cm` = footerens estimerte høyde (`0.15cm` top + én linje `7pt × line-height 1.25 ≈ 0.31cm` + `0.3cm` bunn = `~0.76cm`) med `~0.14cm` margin.

## Steg 4: Playwright-test

Opprett `tests/prisliste-print.spec.ts`. Playwright støtter `page.emulateMedia({ media: 'print' })` som bytter CSS-media til print uten manuell Ctrl+P.

```ts
import { test, expect } from '@playwright/test';

test.describe('Prisliste print-footer', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Print-CSS er nettleser-uavhengig');
  });

  test('footer er skjult i normal visning', async ({ page }) => {
    await page.goto('/prisliste');
    const footer = page.locator('.prisliste-footer-print');
    await expect(footer).toBeHidden();
  });

  test('footer vises i print-modus med tannlegenavn', async ({ page }) => {
    await page.goto('/prisliste');
    await page.emulateMedia({ media: 'print' });
    const footer = page.locator('.prisliste-footer-print');
    await expect(footer).toBeVisible();
    await expect(footer).not.toBeEmpty();
    await expect(footer).toContainText('·');
  });
});
```

**Merk — `toBeHidden()`:** Playwright's `toBeHidden()` returnerer `true` også når elementet ikke finnes i DOM. Guarden `tannleger.length > 0` i HTML-koden betyr at elementet aldri rendres ved tom samling — begge tester ville da passere (skjult-test korrekt, synlig-test ville feile ved `toBeVisible()`). I praksis vil samlingen alltid ha tannleger, men vær obs på dette i testmiljø med tom/mocka data.

**Merk — `toContainText('·')`:** Separatoren `·` vises kun når det er minst to tannleger. `not.toBeEmpty()` er den reelle minste-grensen. `toContainText('·')` er et tilleggssjekk som bekrefter flernavnsformatering — ikke en erstatning for `not.toBeEmpty()`.

## Testbehov

Ingen enhetslogikk å teste. Playwright-testen (steg 4) dekker:
- Footer skjult i screen-modus
- Footer synlig med navn i print-modus

## Definition of done

- [ ] Footer vises i print med alle tannlegenavn separert med `·`
- [ ] Footer er usynlig i web-visningen
- [ ] Siste prisrader ikke skjult bak footer (padding-bottom virker)
- [ ] Playwright-testen i `tests/prisliste-print.spec.ts` passerer
- [ ] `npm run build` passerer uten feil

## Kjente risiki

- **`position: fixed` gjentar footeren på hver side (Chromium):** I Chromium sin print-renderer vil `position: fixed; bottom: 0` vises på *hver* side, ikke bare den siste. Dette er korrekt atferd for en enkeltsidig prisliste. Forutsetning: prislisten må forbli på én utskriftsside. Dersom den vokser til to sider vil footeren overlappe innhold på side 1. Akseptert risiko gitt nåværende innholdsmengde.
- **`position: fixed` i Firefox:** Firefox behandler `position: fixed` i print som `position: absolute` — footeren vises kun én gang, nederst på siste side. Uproblematisk siden print-flyten primært brukes i admin (Chromium).
- **Bygg-tid vs. runtime:** Tannlegerlisten er bygget statisk inn ved `astro build`, ikke hentet dynamisk. Endringer i `tannleger.json` krever nybygg for å reflekteres i prislisten — dette er konsistent med resten av siden.
