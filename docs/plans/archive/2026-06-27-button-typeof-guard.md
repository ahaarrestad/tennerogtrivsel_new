# Plan: typeof-guard på `target` i Button.astro

> §0-snarvei: spec og plan er slått sammen (triviell én-linjeendring).

## Problem / mål

`Button.astro:38` bruker `target?.toLowerCase()` for å avgjøre om `rel="noopener noreferrer"` skal settes automatisk. Optional chaining vokter kun mot `null`/`undefined` — en ikke-streng verdi (f.eks. `boolean` eller `number`) ville kastet `TypeError` ved render. `target` er riktignok typet `string` i Props, men defensiv herding er billig og gjør intensjonen eksplisitt.

## Krav og akseptansekriterier

- `rel`-uttrykket fungerer korrekt for `target="_blank"` (store og små bokstaver)
- Ingen `TypeError` hvis `target` mot formodning ikke er en streng
- Ingen endring i synlig oppførsel eller eksisterende tester

## Avgrensninger

- Kun én linje endres — ingen refaktorering, ingen nye Props
- Ingen ny kommentar tilføyes (endringen er selvforklarende)

## Konkret endring

**Fil:** `src/components/Button.astro`, linje 38

**Fra:**
```
rel={isAnchor ? (rel ?? (target?.toLowerCase() === '_blank' ? 'noopener noreferrer' : undefined)) : undefined}
```

**Til:**
```
rel={isAnchor ? (rel ?? (typeof target === 'string' && target.toLowerCase() === '_blank' ? 'noopener noreferrer' : undefined)) : undefined}
```

## Testbehov

Eksisterende tester for `Button.astro` (sjekk med `grep -r "Button" src --include="*.test.*"` / `__tests__`) dekker case-insensitiv `_blank`-sjekk. Kjør disse for å bekrefte ingen regresjon.

Definition of done: alle eksisterende tester passerer, ingen nye tester nødvendig (endringen er ren defensiv herding av allerede typet input).

## Kjente risiki

Ingen — typen er `string` i Props, og TS vil normalt avvise feil type på kompileringstidspunkt. Endringen er ren og ikke-funksjonell i praksis.
