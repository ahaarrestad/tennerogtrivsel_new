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

**`padding-bottom` på body:** `@page { margin: 0 }` er allerede satt, og `position: fixed; bottom: 0` plasserer footeren relativt til papirkanten — ikke til body-padding. Uten `padding-bottom` på body vil footeren overlappe siste prisrader. Oppdater eksisterende body-print-regel (linje 202–208):

```css
body {
    padding: 0.5cm 1.2cm 0.9cm !important;  /* bunn: plass til footer */
    /* (resten uendret) */
}
```

`0.9cm` = footerens estimerte høyde (`0.15cm` top + én linje `7pt × line-height 1.25 ≈ 0.31cm` + `0.3cm` bunn = `~0.76cm`) med `~0.14cm` margin.

## Testbehov

Ingen logikk å enhetsteste — dette er utelukkende HTML/CSS.

Manuell verifisering:
1. Åpne `/prisliste` i nettleseren
2. Trykk Ctrl+P — bekreft at footeren vises med alle tannlegenavn
3. Bekreft at siste prisrader **ikke** er skjult bak footeren
4. Bekreft at footeren **ikke** vises i normal web-visning

## Definition of done

- [ ] Footer vises i print med alle tannlegenavn separert med `·`
- [ ] Footer er usynlig i web-visningen
- [ ] Siste prisrader ikke skjult bak footer (padding-bottom virker)
- [ ] `npm run build` passerer uten feil

## Kjente risiki

- **`position: fixed` i Firefox:** Firefox har hatt historiske quirks med `position: fixed` i print — elementet kan opptre som `position: absolute` (vises én gang nederst på siste side, ikke på hver side). For en side som normalt er én side er dette uproblematisk. Siden `?print`-flyten primært brukes i admin (Chromium), er Chromium-atferd det som teller.
- **Bygg-tid vs. runtime:** Tannlegerlisten er bygget statisk inn ved `astro build`, ikke hentet dynamisk. Endringer i `tannleger.json` krever nybygg for å reflekteres i prislisten — dette er konsistent med resten av siden.
