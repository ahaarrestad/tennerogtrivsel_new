# Plan: Button.astro — case-insensitiv `target`-sjekk for auto-`rel`

> §0-oppgave: spec og plan slått sammen (triviell endring).

## Problem / mål

`Button.astro:37` bruker `target === '_blank'` for å sette automatisk
`rel="noopener noreferrer"`. HTML-`target`-attributten er case-insensitiv i nettleseren,
så `_BLANK`, `_Blank` o.l. åpner ny fane uten at `rel` settes — hull i
reverse-tabnabbing-fiksen. Sannsynligheten er lav (vi bruker konsekvent `_blank`), men
fiksen er trivielt enkel å lukke.

## Krav og akseptansekriterier

- `target="_BLANK"` / `target="_Blank"` / `target="_blank"` gir alle `rel="noopener noreferrer"` automatisk når `rel` ikke er eksplisitt angitt.
- Eksplisitt `rel` overstyres ikke (eksisterende oppførsel beholdes).
- Ingen endring i visuell rendering, props-API eller andre attributter.

## Avgrensninger / non-goals

- Ingen nye props eller endringer i variant/class-logikk.
- Ingen endringer i andre komponenter enn `Button.astro` og tilhørende testfil.

## Implementasjonssteg

1. **`src/components/Button.astro` linje 37** — endre sjekken:
   ```diff
   - rel={isAnchor ? (rel ?? (target === '_blank' ? 'noopener noreferrer' : undefined)) : undefined}
   + rel={isAnchor ? (rel ?? (target?.toLowerCase() === '_blank' ? 'noopener noreferrer' : undefined)) : undefined}
   ```

2. **`src/components/__tests__/Button.test.ts`** — legg til én ny testcase:
   - `target="_BLANK"` (uten eksplisitt `rel`) → forventer `rel="noopener noreferrer"`

## Testbehov / definition of done

- Eksisterende 6 testcaser passerer uten endring.
- Ny testcase med `_BLANK` passerer.
- `npm test -- Button` grønn.

## Kjente risiki

Ingen av betydning — én linje endres, ingen logikkgren er ny.
