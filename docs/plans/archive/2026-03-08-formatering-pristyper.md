# Pen formatering av pristyper — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Forbedre `formatPris()` slik at alle prisformater (heltall, område, timepris, +tekn., m/tannteknikk) får konsistent "kr"-prefiks og tusen-mellomrom.

**Architecture:** Flytt `formatPris()` fra inline i prisliste.astro til en egen utility-fil `src/utils/format-pris.js` for testbarhet. Funksjonen bruker regex for å gjenkjenne tallmønstre og formatere dem, mens suffiks bevares. TDD med Vitest.

**Tech Stack:** JavaScript, Vitest, Astro

---

### Task 1: Opprett utility med tester for heltall og string-fallback

**Files:**
- Create: `src/utils/format-pris.js`
- Create: `src/utils/__tests__/format-pris.test.js`

**Step 1: Skriv failing tester**

```js
// src/utils/__tests__/format-pris.test.js
import { describe, it, expect } from 'vitest';
import { formatPris } from '../format-pris.js';

describe('formatPris', () => {
    it('formaterer heltall med kr-prefiks og tusen-mellomrom', () => {
        expect(formatPris(830)).toBe('kr 830');
        expect(formatPris(8370)).toBe('kr 8 370');
        expect(formatPris(17170)).toBe('kr 17 170');
        expect(formatPris(70)).toBe('kr 70');
    });

    it('returnerer tom streng for null/undefined', () => {
        expect(formatPris(null)).toBe('');
        expect(formatPris(undefined)).toBe('');
    });
});
```

**Step 2: Kjør test for å verifisere at den feiler**

Run: `npx vitest run src/utils/__tests__/format-pris.test.js`
Expected: FAIL — modul finnes ikke

**Step 3: Skriv minimal implementasjon**

```js
// src/utils/format-pris.js

/**
 * Formaterer et tall med nb-NO locale (tusen-mellomrom).
 */
function formatNumber(n) {
    return n.toLocaleString('nb-NO');
}

/**
 * Formaterer en pris til visning.
 * Støtter: heltall, prisområder, suffiks (+tekn., pr time, m/tannteknikk).
 */
export function formatPris(pris) {
    if (pris == null) return '';
    if (typeof pris === 'number') return `kr ${formatNumber(pris)}`;
    return String(pris);
}
```

**Step 4: Kjør test for å verifisere at den passerer**

Run: `npx vitest run src/utils/__tests__/format-pris.test.js`
Expected: PASS

**Step 5: Commit**

```
feat(prisliste): legg til formatPris utility med heltall-støtte
```

---

### Task 2: Legg til støtte for prisområder (X - Y)

**Files:**
- Modify: `src/utils/format-pris.js`
- Modify: `src/utils/__tests__/format-pris.test.js`

**Step 1: Skriv failing tester**

Legg til i describe-blokken:

```js
    it('formaterer prisområde med kr-prefiks, tusen-mellomrom og tankestrek', () => {
        expect(formatPris('1050 - 1350')).toBe('kr 1 050 – 1 350');
        expect(formatPris('500 - 1200')).toBe('kr 500 – 1 200');
        expect(formatPris('7500 - 9500')).toBe('kr 7 500 – 9 500');
        expect(formatPris('330 - 410')).toBe('kr 330 – 410');
    });
```

**Step 2: Kjør test — forvent FAIL**

Run: `npx vitest run src/utils/__tests__/format-pris.test.js`
Expected: FAIL — returnerer rå streng uten "kr"

**Step 3: Implementer område-parsing**

Oppdater `formatPris` i `src/utils/format-pris.js`:

```js
export function formatPris(pris) {
    if (pris == null) return '';
    if (typeof pris === 'number') return `kr ${formatNumber(pris)}`;

    const str = String(pris).trim();

    // Prisområde: "1050 - 1350"
    const rangeMatch = str.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
        return `kr ${formatNumber(Number(rangeMatch[1]))} – ${formatNumber(Number(rangeMatch[2]))}`;
    }

    return str;
}
```

**Step 4: Kjør test — forvent PASS**

Run: `npx vitest run src/utils/__tests__/format-pris.test.js`
Expected: PASS

**Step 5: Commit**

```
feat(prisliste): formatPris støtter prisområder med tankestrek
```

---

### Task 3: Legg til støtte for suffiks-formater (+tekn., pr time, m/tannteknikk)

**Files:**
- Modify: `src/utils/format-pris.js`
- Modify: `src/utils/__tests__/format-pris.test.js`

**Step 1: Skriv failing tester**

```js
    it('formaterer pris med suffiks "pr time"', () => {
        expect(formatPris('2700 pr time')).toBe('kr 2 700 pr time');
        expect(formatPris('3380 pr time')).toBe('kr 3 380 pr time');
    });

    it('formaterer pris med suffiks "+ tekn." (med og uten punktum)', () => {
        expect(formatPris('5950 + tekn.')).toBe('kr 5 950 + tekn.');
        expect(formatPris('1730 + tekn')).toBe('kr 1 730 + tekn');
        expect(formatPris('9720 + tekn.')).toBe('kr 9 720 + tekn.');
    });

    it('formaterer pris med suffiks "m/tannteknikk"', () => {
        expect(formatPris('2980 m/tannteknikk')).toBe('kr 2 980 m/tannteknikk');
        expect(formatPris('4500 m/tannteknikk')).toBe('kr 4 500 m/tannteknikk');
    });
```

**Step 2: Kjør test — forvent FAIL**

Run: `npx vitest run src/utils/__tests__/format-pris.test.js`
Expected: FAIL — suffiks-strenger returneres uten formatering

**Step 3: Implementer suffiks-parsing**

Oppdater `formatPris` — legg til generell "tall + suffiks"-matching etter område-sjekken:

```js
export function formatPris(pris) {
    if (pris == null) return '';
    if (typeof pris === 'number') return `kr ${formatNumber(pris)}`;

    const str = String(pris).trim();

    // Prisområde: "1050 - 1350"
    const rangeMatch = str.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
        return `kr ${formatNumber(Number(rangeMatch[1]))} – ${formatNumber(Number(rangeMatch[2]))}`;
    }

    // Tall med suffiks: "2700 pr time", "5950 + tekn.", "2980 m/tannteknikk"
    const suffixMatch = str.match(/^(\d+)\s+(.+)$/);
    if (suffixMatch) {
        return `kr ${formatNumber(Number(suffixMatch[1]))} ${suffixMatch[2]}`;
    }

    return str;
}
```

**Step 4: Kjør test — forvent PASS**

Run: `npx vitest run src/utils/__tests__/format-pris.test.js`
Expected: PASS

**Step 5: Commit**

```
feat(prisliste): formatPris støtter suffiks-formater (pr time, +tekn, m/tannteknikk)
```

---

### Task 4: Koble utility til prisliste.astro

**Files:**
- Modify: `src/pages/prisliste.astro:52-55`

**Step 1: Erstatt inline formatPris med import**

I frontmatter-blokken i `src/pages/prisliste.astro`, erstatt:

```js
function formatPris(pris) {
    if (typeof pris === 'number') return `kr ${pris.toLocaleString('nb-NO')}`;
    return String(pris);
}
```

med:

```js
import { formatPris } from '../utils/format-pris.js';
```

**Step 2: Verifiser at build fungerer**

Run: `npm run build`
Expected: Build OK uten feil

**Step 3: Kjør alle tester**

Run: `npx vitest run`
Expected: Alle tester passerer

**Step 4: Visuell sjekk**

Run: `npm run dev` og åpne `/prisliste` i nettleseren. Verifiser at:
- Heltall vises som `kr 830`, `kr 8 370` etc.
- Områder vises som `kr 1 050 – 1 350` etc.
- Suffiks-priser vises som `kr 2 700 pr time` etc.

**Step 5: Commit**

```
feat(prisliste): bruk formatPris utility i prisliste-siden
```

---

### Task 5: Kjør quality gate og oppdater TODO

**Step 1: Sjekk branch coverage**

Run: `npx vitest run --coverage src/utils/__tests__/format-pris.test.js`
Expected: ≥80% branch coverage for `src/utils/format-pris.js`

**Step 2: Kjør full quality gate**

Run: `/quality-gate`

**Step 3: Oppdater TODO.md**

Marker oppgaven som fullført og arkiver.

**Step 4: Final commit**

```
docs: arkiver oppgave formatering-av-pristyper
```
