# Plan: Prisliste mobil-layout — bedre lesbarhet

## Problem

På mobil har prislisten varierende og for liten avstand mellom behandlingsnavn og pris. Lange behandlingsnavn (f.eks. «Rotspissamputasjon/spesialist (honorar – NAV ref timehonorar spesialist i endodonti)») presser seg helt inntil prisen, noe som gjør listen vanskelig å lese.

**Rotårsak** (linje 110–116 i `prisliste.astro`):

```html
<div class="flex justify-between items-baseline py-3">
    <span class="text-sm">{item.behandling}</span>
    <span class="text-sm whitespace-nowrap">{formatPris(item.pris)}</span>
</div>
```

- Ingen `gap` mellom flex-elementene
- Behandlingsnavnet kan vokse ubegrenset og skyve seg inntil prisen
- Ingen visuell "leder" mellom tekst og pris

## Løsning

Bruk en **dot-leader-teknikk** med CSS for å:
1. Gi fast minimum-avstand mellom tekst og pris
2. Fylle mellomrommet med en prikket linje som leder øyet fra behandling til pris

### Endringer

**Fil: `src/pages/prisliste.astro`** (kun web-layout, ikke print)

Linje 110–116 — oppdater rad-markup:

```html
<div class="prisliste-rad">
    <span class="prisliste-behandling text-sm">{item.behandling}</span>
    <span class="prisliste-leader" aria-hidden="true"></span>
    <span class="prisliste-pris text-sm whitespace-nowrap">{formatPris(item.pris)}</span>
</div>
```

Legg til CSS i `<style>`-blokken (utenfor `@media print`):

```css
.prisliste-rad {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    py: 0.75rem; /* py-3 */
}

.prisliste-behandling {
    flex-shrink: 1;     /* kan krympe/wrappe */
}

.prisliste-leader {
    flex: 1;
    border-bottom: 1px dotted var(--color-brand-border);
    min-width: 1.5rem;  /* garantert minste avstand */
    align-self: baseline;
    position: relative;
    top: -0.25em;       /* juster vertikalt mot baseline */
}

.prisliste-pris {
    flex-shrink: 0;     /* prisen brytes aldri */
}
```

### Hva dette løser

| Problem | Løsning |
|---------|---------|
| Ingen gap mellom tekst og pris | `gap: 0.5rem` + `min-width: 1.5rem` på leader |
| Tekst helt oppi prisen | Leader-elementet tvinger minimum 1.5rem avstand |
| Vanskelig å følge linjen fra tekst til pris | Prikket linje leder øyet |
| Varierende spacing | Konsistent layout uavhengig av tekstlengde |

### Avgrensning

- **Print-layout påvirkes ikke** — den har egen CSS i `@media print` og eget markup
- **Ingen endring i data eller formatering** — kun CSS/markup i web-layouten
- **Ingen JavaScript-endringer**

## Risiko

Lav. Endringen er rent visuell, kun i web-layouten, og påvirker ikke print eller data.

## Testplan

- Visuell sjekk: sammenlign før/etter på mobil (320px–480px) og desktop
- Verifiser at dot-leader er synlig og jevn
- Verifiser at print-layout (`?print=1`) er uendret
- Sjekk lange behandlingsnavn (f.eks. «Rotspissamputasjon/spesialist...») har god lesbarhet
- Sjekk korte navn (f.eks. «Rebasering») ser bra ut med lengre leader
- Build: `npm run build` skal passere uten feil
