# Plan: assert antall hasher i generate-csp-hashes sorterings-test

> §0-snarvei: spec og plan er slått sammen (triviell test-herding, to assert-linjer).

## Problem / mål

Testen «skriver hashene i kanonisk sortert rekkefølge» i
`scripts/__tests__/generate-csp-hashes.test.mjs:131` verifiserer determinisme ved å
sammenligne output mot sin egen sorterte kopi:

```js
expect(hashes).toEqual([...hashes].sort());
expect(data.scriptHashes).toEqual([...data.scriptHashes].sort());
```

Svakhet (PR-review #406, gemini-code-assist, lav): en **tom** liste består denne
sjekken falskt (`[] === [...[]].sort()`). Skulle `run()` en dag slutte å plukke opp
skript (regresjon i skanning/ekstraksjon), ville testen fortsatt være grønn og skjule
feilen. Assertion har ingen nedre grense på antall hasher.

## Krav og akseptansekriterier

- Testen feiler hvis `run()` returnerer færre enn de tre forventede hashene
- Sorterings-invarianten beholdes uendret
- Ingen endring i produksjonskode — kun test
- Hele test-suiten passerer fortsatt

## Avgrensninger / non-goals

- Kun den ene testen (linje 131–141) endres — ingen andre tester røres
- Ingen refaktorering av `generate-csp-hashes.mjs`
- Ingen nye test-caser

## Konkret endring

**Fil:** `scripts/__tests__/generate-csp-hashes.test.mjs`, i testen på linje 131.

Testen skriver tre ulike skript (`zzz()`, `aaa()`, `mmm()`) i tre separate filer —
ingen dedup, ingen whitespace-filtrering — så nøyaktig **3** hasher forventes.

Legg til en lengde-assertion før sorterings-sjekken:

```js
const hashes = run(tmpDist, tmpOut);
expect(hashes).toHaveLength(3);                    // ny — vokter mot falsk-positiv tom liste
expect(hashes).toEqual([...hashes].sort());
const data = JSON.parse(readFileSync(tmpOut, 'utf-8'));
expect(data.scriptHashes).toHaveLength(3);         // ny
expect(data.scriptHashes).toEqual([...data.scriptHashes].sort());
```

## Testbehov / definition of done

- `npx vitest run scripts/__tests__/generate-csp-hashes.test.mjs` — alle grønne
- Coverage for `generate-csp-hashes.mjs` uendret (kun test-fil endres; ingen ny kildekode-branch)
- Definition of done: de to nye `toHaveLength(3)`-assertene er på plass og suiten passerer

## Kjente risiki

Ingen. Ren additiv herding av en eksisterende test. Skulle det forventede antallet
noen gang endres bevisst, feiler testen tydelig og oppdateres i samme slengen.
