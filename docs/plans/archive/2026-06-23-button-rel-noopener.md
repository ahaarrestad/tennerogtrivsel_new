# Button.astro: auto `rel="noopener noreferrer"` for `target="_blank"`

> Kombinert spec + plan (§0-snarvei — liten, veldefinert oppgave fra PR-review #403).

## Problem / mål

PR-review (#403, gemini-code-assist, **security-medium**): når en lenke åpnes i ny fane
(`<a target="_blank">`) uten `rel`, er det en reverse-tabnabbing-svakhet i eldre nettlesere.
Den nye fanen får tilgang til `window.opener` og kan manipulere opprinnelig side.

Moderne nettlesere setter `noopener` implisitt for `target="_blank"`, men eldre gjør det
ikke — derfor er eksplisitt `rel="noopener noreferrer"` fortsatt beste praksis.

## Krav / akseptansekriterier

1. Når `Tag === 'a'`, `target === '_blank'` og `rel` **ikke** er eksplisitt angitt:
   `rel="noopener noreferrer"` settes automatisk.
2. Når `rel` **er** eksplisitt angitt: forbrukerens verdi bevares uendret (ingen overstyring).
3. Når `target !== '_blank'` (eller ikke satt): ingen `rel` settes automatisk (uendret oppførsel).
4. `<button>` og `<span>` får aldri `rel` (uendret — allerede gated på `isAnchor`).

## Avgrensninger / non-goals

- Ingen endring i `type`/`disabled`/`href`-gating — kun `rel`-fallback berøres.
- Ingen endring i kallsteder; dette er en ren defaults-forbedring i komponenten.
- Vurderer ikke å tvinge `noopener` på *alle* `target`-verdier — kun `_blank`.

## Designvalg

Bruk review-forslaget direkte (`src/components/Button.astro:35`):

```astro
rel={isAnchor ? (rel ?? (target === '_blank' ? 'noopener noreferrer' : undefined)) : undefined}
```

`rel ?? …` bevarer eksplisitt `rel` (krav 2); den indre ternæren begrenser fallbacken til
`_blank` (krav 3). Holder seg innenfor det etablerte `isAnchor`-gating-mønsteret på linja.

## Steg

1. **TDD:** legg til tester i `src/components/__tests__/Button.test.ts`:
   - `<a target="_blank">` uten `rel` → `rel="noopener noreferrer"`
   - `<a target="_blank" rel="...">` → eksplisitt `rel` bevares
   - `<a>` uten `target` → ingen `rel`
2. Endre `rel`-attributtet på `src/components/Button.astro:35` per designvalget.
3. Kjør testene grønne.

## Testbehov / definition of done

- Nye tester dekker krav 1–3 og er grønne.
- Eksisterende Button-tester fortsatt grønne (regresjonsvern, inkl. `rel="noopener"`-casen
  på linje 51 som verifiserer at eksplisitt `rel` bevares).
- Kvalitetsport oppfylt for `Button.astro` (review-loop ren).

## Risiki / usikkerheter

- Lav. Endringen er additiv og gated. Eneste teoretiske regresjon ville vært om et kallsted
  bevisst åpner `_blank` *uten* `noopener` (svært usannsynlig og uønsket) — ikke et reelt behov.
