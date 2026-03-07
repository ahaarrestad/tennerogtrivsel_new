# Plan: Audit tester for dato-avhengige feil

## Bakgrunn

Tester som bruker hardkodede datoer feiler når tiden passerer dem. Ref: `sortMessages`-testen som feilet pga. `endDate: '2026-03-01'` (fe7ee0d). Vi standardiserer pa `vi.useFakeTimers()` for alle dato-avhengige tester.

## Berørte filer

### 1. `src/scripts/__tests__/admin-dashboard.test.js` — HOY RISIKO

- Linje 17-19: Hardkodede 2026-datoer i mock (`2026-02-10`, `2026-03-01`, `2026-01-01`)
- Linje 335, 360: Bruker `new Date('2026-02-15')` som "today" — ok lokalt, men andre tester i filen sammenligner mot faktisk `new Date()`
- Linje 1883-1885: Blanding av `2020`/`2099`-datoer — trygt, men bor bruke fakeTimers for konsistens
- Linje 1900, 1915: Meldinger med `startDate: '2020-01-01'` — avhenger av at "na" er etter 2020

**Fix:** Legg til `vi.useFakeTimers({ now: new Date('2026-02-15T12:00:00') })` i relevante `describe`-blokker. Juster alle hardkodede datoer til a vaere relative til den frosne tiden.

### 2. `src/pages/api/__tests__/active-messages.test.ts` — MIDDELS RISIKO

- Linje 27-28, 36-37, 84-85, 95-96, 104-105: `new Date('2026-12-31')` som endDate — feiler etter 2026
- Linje 176-177: `new Date('2026-03-01')` og `new Date('2026-03-31')` — feiler etter mars 2026
- Linje 122-125: Bruker relative datoer (yesterday/tomorrow) — ok, men bor ogsa bruke fakeTimers

**Fix:** Legg til `vi.useFakeTimers({ now: new Date('2026-02-15T12:00:00') })` i toppniva `beforeEach`. Erstatt alle hardkodede datoer med datoer relative til den frosne tiden.

### 3. `src/scripts/__tests__/textFormatter.test.js` — LAV RISIKO (fikset for)

- Linje 149-151: Bruker 2099/2098-datoer for aktiv/planlagt/utlopt — trygt langt frem
- Linje 162-163: Bruker 2090-datoer (fikset i fe7ee0d)
- Linje 104, 115: `'2026-02-15'` i formatDate-tester — dato-formateringstester, ikke "na"-avhengige

**Fix:** Legg til `vi.useFakeTimers()` i `sortMessages`-describe-blokken. Bruk datoer relative til frossen tid istedenfor 2090/2099.

### 4. `src/scripts/__tests__/messageClient.test.js` — LAV RISIKO

- Linje 131: Allerede bruker `vi.useFakeTimers()` i en test
- Linje 25-28, 92-95: Bruker relative datoer (yesterday/tomorrow) — ok
- Linje 58-59, 77-78: `'2020-01-31'` (fortid) og `'2099-12-31'` (fremtid) — trygt

**Fix:** Utvid `vi.useFakeTimers()` til hele describe-blokken for konsistens.

### 5. `src/scripts/__tests__/admin-client.test.js` — MINIMAL RISIKO

- Linje 276, 312, 324, 335, 1079, 1087: Bruker `Date.now() + 3600000` for token-expiry — relative, trygt
- Ingen hardkodede fremtidsdatoer

**Fix:** Ingen endring nodvendig (allerede relativt).

### 6. `src/scripts/__tests__/admin-module-meldinger.test.js` — INGEN RISIKO

- Bruker 2024-datoer som formverdier, ikke sammenlignet mot "na"

**Fix:** Ingen endring nodvendig.

## Steg

1. Fiks `admin-dashboard.test.js` — legg til fakeTimers, oppdater datoer
2. Fiks `active-messages.test.ts` — legg til fakeTimers, oppdater datoer
3. Fiks `textFormatter.test.js` — legg til fakeTimers i sortMessages-blokken
4. Fiks `messageClient.test.js` — utvid fakeTimers til hele describe
5. Verifiser at alle tester passerer
6. Legg til konvensjon i CLAUDE.md

## Konvensjon (legges til CLAUDE.md)

```
## Dato-avhengige tester

Alle tester som er avhengige av "na"-tidspunkt SKAL bruke `vi.useFakeTimers()`.
Aldri bruk hardkodede fremtidsdatoer som antar at testen kjores for en viss dato.

Monster:
- `vi.useFakeTimers({ now: new Date('YYYY-MM-DDT12:00:00') })` i `beforeEach`
- `vi.useRealTimers()` i `afterEach`
- Velg testdatoer relativt til den frosne tiden
```
