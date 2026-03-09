# Test-review og forenkling — Implementasjonsplan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Forbedre testenes vedlikeholdbarhet og kvalitet evaluert mot Test Desiderata, og skriv en test-guide for fremtidig bruk.

**Architecture:** Problem-drevet tilnærming — først bygge delt infrastruktur (auto-mocks + hjelpere), deretter migrere testfiler i batch, og til slutt skrive test-guide. Kvalitetsforbedringer (it.each, behavioral rewrite, cleanup) gjøres som del av migreringen.

**Tech Stack:** Vitest, jsdom, vi.mock auto-mocking via `__mocks__/`-mapper

**Design:** [design-doc](2026-03-09-test-review-design.md)

---

## Viktige konvensjoner

- **Auto-mocks:** Filer i `__mocks__/` plukkes opp av Vitest når `vi.mock('module')` kalles UTEN factory-argument
- **Marked mock variasjon:** `messageClient.test.js` bruker `<html>${markdown}</html>` istedenfor `<p>${text}</p>`. Denne filen beholder inline mock.
- **admin-dialog variasjon:** 3 ulike mønstre (standard, dashboard, pwa-prompt). Flyttes til factory i test-helpers, ikke auto-mock.
- **Coverage:** Målet er fortsatt 80% branch. Kjør `npx vitest run --coverage` etter hver batch for å verifisere.
- **Alle tester skal fortsatt passere** etter hver task. Ingen funksjonelle endringer.

---

### Task 1: Opprett auto-mock for dompurify

**Files:**
- Create: `src/scripts/__tests__/__mocks__/dompurify.js`

**Step 1: Opprett mock-filen**

```javascript
// Auto-mock for dompurify — brukes av vi.mock('dompurify') uten factory
export default { sanitize: vi.fn(html => html) };
```

**Step 2: Verifiser at auto-mock fungerer**

Velg én testfil (f.eks. `admin-module-settings.test.js`), endre:
```javascript
// FØR:
vi.mock('dompurify', () => ({ default: { sanitize: vi.fn(html => html) } }));
// ETTER:
vi.mock('dompurify');
```

Run: `npx vitest run src/scripts/__tests__/admin-module-settings.test.js`
Expected: Alle tester passerer

**Step 3: Reverter testfilen** (resten migreres i batch-tasks)

**Step 4: Commit**

```
feat(test): legg til auto-mock for dompurify
```

---

### Task 2: Opprett auto-mock for marked

**Files:**
- Create: `src/scripts/__tests__/__mocks__/marked.js`

**Step 1: Opprett mock-filen**

```javascript
// Auto-mock for marked — brukes av vi.mock('marked') uten factory
export const marked = { parse: vi.fn(text => `<p>${text}</p>`) };
```

**Step 2: Verifiser med én testfil**

Velg `admin-module-tannleger.test.js`, endre factory-mock til `vi.mock('marked')`.

Run: `npx vitest run src/scripts/__tests__/admin-module-tannleger.test.js`
Expected: PASS

**Step 3: Reverter testfilen**

**Step 4: Commit**

```
feat(test): legg til auto-mock for marked
```

---

### Task 3: Opprett test-helpers.js

**Files:**
- Create: `src/scripts/__tests__/test-helpers.js`

**Step 1: Skriv hjelperfilen**

```javascript
/**
 * Delte test-hjelpere for admin-moduler.
 *
 * Bruk:
 *   import { createMockAutoSaver, mockAdminDialog, setupModuleDOM } from './test-helpers.js';
 */

/**
 * Lag en mock createAutoSaver-factory.
 * Returnerer et objekt med trigger/cancel og tilgang til saveFn.
 */
export function createMockAutoSaver() {
    return vi.fn((saveFn) => ({
        trigger: vi.fn(),
        cancel: vi.fn(),
        _saveFn: saveFn,
    }));
}

/**
 * Standard admin-dialog mock-factory.
 * @param {Object} overrides — overstyr individuelle funksjoner
 */
export function mockAdminDialog(overrides = {}) {
    return {
        showToast: vi.fn(),
        showConfirm: vi.fn().mockResolvedValue(false),
        showAuthExpired: vi.fn(),
        showBanner: vi.fn(),
        ...overrides,
    };
}

/**
 * Sett opp standard modul-DOM med admin-config og containere.
 * @param {Object} opts
 * @param {string} opts.configAttrs — ekstra attributter på #admin-config (f.eks. 'data-sheet-id="sid"')
 * @param {string} opts.extraHTML — ekstra HTML etter standard-elementer
 */
export function setupModuleDOM({ configAttrs = '', extraHTML = '' } = {}) {
    document.body.innerHTML = `
        <div id="admin-config" ${configAttrs}></div>
        <div id="module-inner"></div>
        <div id="module-actions"></div>
        ${extraHTML}
    `;
}
```

**Step 2: Verifiser import fungerer**

Lag en minimal testfil som importerer hjelperne:
```javascript
import { createMockAutoSaver, mockAdminDialog, setupModuleDOM } from './test-helpers.js';
// Verifiser at funksjonene finnes
console.log(typeof createMockAutoSaver, typeof mockAdminDialog, typeof setupModuleDOM);
```

Run: `npx vitest run <temp-testfil>` (slett etterpå)

**Step 3: Commit**

```
feat(test): opprett test-helpers.js med delte mock-factories og DOM-setup
```

---

### Task 4: Migrer admin-module-tjenester.test.js (pilot)

Første fil som migreres fullstendig — brukes som mønster for resten.

**Files:**
- Modify: `src/scripts/__tests__/admin-module-tjenester.test.js`

**Step 1: Les testfilen grundig og forstå strukturen**

**Step 2: Erstatt mock-definisjoner**

Erstatt inline mocks med:
```javascript
import { createMockAutoSaver, mockAdminDialog, setupModuleDOM } from './test-helpers.js';

vi.mock('dompurify');  // auto-mock
vi.mock('marked');     // auto-mock
vi.mock('../admin-dialog.js', () => mockAdminDialog());
vi.mock('../admin-editor-helpers.js', () => ({
    createAutoSaver: createMockAutoSaver(),
    // ... andre exports som trengs
}));
```

**Step 3: Erstatt DOM-setup med setupModuleDOM()**

**Step 4: Konverter repetitive tester til it.each der mulig**

Se etter tester med identisk struktur men ulike input-verdier.

**Step 5: Evaluer "should not throw"/"should do nothing"-tester**

- Slett de som bare tester at `querySelector` returnerer null
- Behold/omskriv de som beskytter mot reelle feil (API-kall osv.)

**Step 6: Fiks eventuelle `mock.calls[0]` callback-ekstraksjon**

Vurder om det finnes en bedre måte (f.eks. navngitt spy, eller `mockImplementation` som fanger callback).

**Step 7: Kjør tester**

Run: `npx vitest run src/scripts/__tests__/admin-module-tjenester.test.js`
Expected: PASS (alle tester)

Run: `npx vitest run src/scripts/__tests__/admin-module-tjenester.test.js --coverage`
Expected: ≥80% branch coverage

**Step 8: Commit**

```
refactor(test): migrer admin-module-tjenester til delt infrastruktur
```

---

### Task 5: Migrer admin-module-tannleger.test.js

**Files:**
- Modify: `src/scripts/__tests__/admin-module-tannleger.test.js`

Følg samme mønster som Task 4:
1. Les filen
2. Erstatt dompurify/marked med auto-mock
3. Erstatt admin-dialog med `mockAdminDialog()`
4. Erstatt createAutoSaver med `createMockAutoSaver()`
5. Erstatt DOM-setup med `setupModuleDOM({ configAttrs: 'data-sheet-id="sid" data-tannleger-folder="taf"', extraHTML: '<dialog id="image-picker-modal"></dialog>' })`
6. Konverter til it.each der mulig
7. Evaluer/fiks "should not throw"-tester og callback-ekstraksjon
8. Kjør tester + coverage: `npx vitest run src/scripts/__tests__/admin-module-tannleger.test.js --coverage`
9. Commit: `refactor(test): migrer admin-module-tannleger til delt infrastruktur`

---

### Task 6: Migrer admin-module-bilder.test.js

**Files:**
- Modify: `src/scripts/__tests__/admin-module-bilder.test.js` (2173 linjer — den nest største)

Følg Task 4-mønsteret. Spesielt fokus:
- Filen har **kompleks callback-ekstraksjon** (`loadGalleriListeModule.mock.calls[0][1]`) — vurder refaktorering
- Mange DOM-introspeksjonstester — omskriv til behavioral
- Verifiser coverage: `npx vitest run src/scripts/__tests__/admin-module-bilder.test.js --coverage`
- Commit: `refactor(test): migrer admin-module-bilder til delt infrastruktur`

---

### Task 7: Migrer admin-module-prisliste.test.js

**Files:**
- Modify: `src/scripts/__tests__/admin-module-prisliste.test.js`

Følg Task 4-mønsteret.
- Verifiser coverage: `npx vitest run src/scripts/__tests__/admin-module-prisliste.test.js --coverage`
- Commit: `refactor(test): migrer admin-module-prisliste til delt infrastruktur`

---

### Task 8: Migrer admin-module-meldinger.test.js

**Files:**
- Modify: `src/scripts/__tests__/admin-module-meldinger.test.js`

**OBS:** Denne filen bruker et annet marked-mock-mønster (`<html>${markdown}</html>`). Den skal IKKE bruke auto-mock for marked — behold inline mock.

- Verifiser coverage: `npx vitest run src/scripts/__tests__/admin-module-meldinger.test.js --coverage`
- Commit: `refactor(test): migrer admin-module-meldinger til delt infrastruktur`

---

### Task 9: Migrer admin-module-settings.test.js

**Files:**
- Modify: `src/scripts/__tests__/admin-module-settings.test.js`

Følg Task 4-mønsteret.
- Verifiser coverage: `npx vitest run src/scripts/__tests__/admin-module-settings.test.js --coverage`
- Commit: `refactor(test): migrer admin-module-settings til delt infrastruktur`

---

### Task 10: Migrer admin-dashboard.test.js

**Files:**
- Modify: `src/scripts/__tests__/admin-dashboard.test.js` (2383 linjer — den største)

Denne filen trenger mest arbeid:
- **9 "should not throw/do nothing"-tester** — evaluer hver enkelt
- **Unikt admin-dialog mock** (Pattern 2 med showAuthExpired, showBanner) — bruk `mockAdminDialog()` som allerede inkluderer disse
- **Kompleks DOM-setup** — dashboard-spesifikk, lag eventuelt `setupDashboardDOM()` i test-helpers
- **Mange toggle-tester** (linjer 1207-1239) — kandidat for it.each
- Verifiser coverage: `npx vitest run src/scripts/__tests__/admin-dashboard.test.js --coverage`
- Commit: `refactor(test): migrer admin-dashboard til delt infrastruktur`

---

### Task 11: Migrer admin-editor-helpers.test.js

**Files:**
- Modify: `src/scripts/__tests__/admin-editor-helpers.test.js`

Fokus:
- **32 inline `document.body.innerHTML`-tildelinger** — standardiser med setupModuleDOM eller lokale hjelpere
- **5 "should not throw"-tester** — evaluer
- Verifiser coverage: `npx vitest run src/scripts/__tests__/admin-editor-helpers.test.js --coverage`
- Commit: `refactor(test): migrer admin-editor-helpers til delt infrastruktur`

---

### Task 12: Migrer admin-init.test.js, admin-gallery.test.js, admin-sheets.test.js

**Files:**
- Modify: `src/scripts/__tests__/admin-init.test.js`
- Modify: `src/scripts/__tests__/admin-gallery.test.js`
- Modify: `src/scripts/__tests__/admin-sheets.test.js`

Tre mindre filer med overlappende mocks. Migrer alle tre, commit samlet.
- Verifiser: `npx vitest run src/scripts/__tests__/admin-init.test.js src/scripts/__tests__/admin-gallery.test.js src/scripts/__tests__/admin-sheets.test.js --coverage`
- Commit: `refactor(test): migrer admin-init, admin-gallery, admin-sheets til delt infrastruktur`

---

### Task 13: Migrer admin-client.test.js

**Files:**
- Modify: `src/scripts/__tests__/admin-client.test.js` (1788 linjer)

Fokus:
- **74 linjer global stub-setup** (File, Blob, FormData, URL, fetch, gapi, google) — vurder om noe kan flyttes til test-helpers
- **20+ console-spies** som aldri asserteres — fjern de som bare demper støy (erstatt med `vi.spyOn(console, 'error').mockImplementation(() => {})` i beforeEach for den describe-blokken)
- **5 nesten-identiske listImages-tester** — konverter til it.each
- Verifiser coverage: `npx vitest run src/scripts/__tests__/admin-client.test.js --coverage`
- Commit: `refactor(test): migrer admin-client til delt infrastruktur`

---

### Task 14: Migrer resterende testfiler

**Files:**
- Modify: `src/scripts/__tests__/messageClient.test.js` (**OBS:** bruker alternativt marked-mock — behold inline)
- Modify: `src/scripts/__tests__/pwa-prompt.test.js` (**OBS:** bruker alternativt admin-dialog mock med DOM-oppretting — behold inline eller lag spesifikk factory)
- Modify: `src/scripts/__tests__/admin-dialog.test.js`
- Modify: `src/scripts/__tests__/admin-api-retry.test.js`

Evaluer hvert fil for:
- Mock-duplisering som kan fjernes
- it.each-muligheter
- "should not throw"-tester
- Verifiser: `npx vitest run src/scripts/__tests__/messageClient.test.js src/scripts/__tests__/pwa-prompt.test.js src/scripts/__tests__/admin-dialog.test.js src/scripts/__tests__/admin-api-retry.test.js --coverage`
- Commit: `refactor(test): migrer messageClient, pwa-prompt, admin-dialog, admin-api-retry`

---

### Task 15: Migrer rene funksjonstester og utils

**Files:**
- Modify: `src/scripts/__tests__/slugify.test.ts`
- Modify: `src/scripts/__tests__/sectionVariant.test.ts`
- Modify: `src/scripts/__tests__/image-config.test.js`
- Modify: `src/scripts/__tests__/generate-robots.test.js`
- Modify: `src/scripts/__tests__/getSettings.test.ts`
- Modify: `src/utils/__tests__/format-pris.test.js`
- Modify: `src/utils/__tests__/column-split.test.js`

Disse er allerede rene — fokuser kun på:
- Konverter til it.each der det gir bedre lesbarhet (f.eks. slugify, format-pris)
- Ingen mock-migrering nødvendig
- Verifiser: `npx vitest run src/scripts/__tests__/slugify.test.ts src/utils/__tests__/format-pris.test.js` (osv.)
- Commit: `refactor(test): forenkle rene funksjonstester med it.each`

---

### Task 16: Migrer DOM/browser-tester

**Files:**
- Modify: `src/scripts/__tests__/mobile-menu.test.js`
- Modify: `src/scripts/__tests__/menu-highlight.test.js`
- Modify: `src/scripts/__tests__/layout-helper.test.js`
- Modify: `src/scripts/__tests__/mapInit.test.ts`
- Modify: `src/scripts/__tests__/textFormatter.test.js`

Evaluer for:
- DOM-setup standardisering
- it.each-muligheter
- Behavioral vs structural assertions
- Verifiser: `npx vitest run` (kjør alle for å verifisere ingen regressioner)
- Commit: `refactor(test): forenkle DOM/browser-tester`

---

### Task 17: Migrer API- og integrasjonstester

**Files:**
- Modify: `src/pages/api/__tests__/active-messages.test.ts`
- Modify: `src/__tests__/middleware.test.ts`
- Modify: `src/__tests__/data-validation.test.ts`
- Modify: `src/__tests__/content.config.test.ts`

Evaluer for kvalitetsforbedringer. Disse har sannsynligvis færre mock-duplikat-problemer.
- Verifiser: `npx vitest run src/pages/api/__tests__/ src/__tests__/ --coverage`
- Commit: `refactor(test): forenkle API- og integrasjonstester`

---

### Task 18: Evaluer E2E-tester (Playwright)

**Files:**
- Review: `tests/accessibility.spec.ts`
- Review: `tests/admin.spec.ts`
- Review: `tests/csp-check.spec.ts`
- Review: `tests/links.spec.ts`
- Review: `tests/seo.spec.ts`
- Review: `tests/sitemap-pages.spec.ts`

Les og evaluer mot Test Desiderata. Disse kjøres ikke av vitest, men av Playwright.
- Er de behavioral? Readable? Specific?
- Lag eventuelle forbedringsforslag som del av test-guide
- Commit kun hvis endringer gjøres: `refactor(test): forenkle E2E-tester`

---

### Task 19: Full testsuite-verifisering

**Step 1: Kjør alle unit-tester**

Run: `npx vitest run --coverage`
Expected: PASS, ≥80% branch per fil (med dokumenterte unntak)

**Step 2: Kjør E2E-tester**

Run: `npx playwright test`
Expected: PASS

**Step 3: Kjør build**

Run: `npm run build`
Expected: PASS

**Step 4: Dokumenter eventuelle coverage-unntak**

Hvis noen filer falt under 80% pga. fjernede tester, noter disse.

**Step 5: Commit eventuelle siste fikser**

---

### Task 20: Skriv test-guide

**Files:**
- Create: `docs/guides/test-guide.md`

**Innhold:**

1. **Prinsipper** — Test Desiderata som rammeverk, med kort forklaring per egenskap og vår prioritering:
   - Behavioral og Structure-insensitive prioriteres høyest
   - Readable og Writable er neste
   - Fast og Automated er allerede godt ivaretatt

2. **Prosjektkonvensjoner:**
   - Auto-mocks i `__mocks__/` — når og hvordan
   - `test-helpers.js` — tilgjengelige factories og DOM-hjelpere
   - `it.each` — når det gir bedre lesbarhet (≥3 lignende tester)
   - Fake timers — alltid `vi.useFakeTimers({ now: ... })` i beforeEach + `vi.useRealTimers()` i afterEach
   - Console-suppression — per-fil, kun i beforeEach for describe-blokken

3. **Hva vi tester og ikke tester:**
   - Test atferd, ikke implementasjon
   - Guard clauses: test kun de som beskytter mot reelle feil (API, datamutasjon)
   - Ikke test at `querySelector` returnerer null
   - Ikke verifiser eksakt HTML-struktur — test synlig effekt
   - Ikke verifiser mock-kallrekkefølge med mindre rekkefølge faktisk betyr noe

4. **Eksempler:**
   - Før/etter fra faktiske refaktoreringer gjort i denne oppgaven
   - Godt vs. dårlig testnavn
   - it.each-konvertering eksempel

**Step 1: Skriv guiden**

**Step 2: Review innholdet**

**Step 3: Commit**

```
docs: legg til test-guide basert på Test Desiderata
```

---

### Task 21: Oppdater CLAUDE.md og arkiver

**Step 1: Oppdater CLAUDE.md**

Legg til referanse til test-guiden under relevant seksjon:
```markdown
## Test-guide
Retningslinjer for testskriving finnes i [`docs/guides/test-guide.md`](docs/guides/test-guide.md).
```

**Step 2: Marker oppgaven ferdig i TODO.md**

**Step 3: Flytt plan til arkiv**

- `docs/plans/2026-03-09-test-review.md` → `docs/plans/archive/`
- `docs/plans/2026-03-09-test-review-design.md` → `docs/plans/archive/`

**Step 4: Flytt oppgaven til TODO-archive.md**

**Step 5: Commit**

```
docs: arkiver test-review oppgave, oppdater CLAUDE.md
```
