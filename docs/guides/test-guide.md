# Test-guide

> Retningslinjer for testskriving i dette prosjektet, basert på [Test Desiderata](https://testdesiderata.com/) (Kent Beck).

## Prinsipper

Vi evaluerer tester langs disse egenskapene, prioritert:

| Prioritet | Egenskap | Beskrivelse |
|-----------|----------|-------------|
| **Høy** | Behavioral | Test atferd, ikke implementasjonsdetaljer |
| **Høy** | Structure-insensitive | Brekker ikke når kodestrukturen endres |
| **Medium** | Readable | Motivasjonen for testen er tydelig |
| **Medium** | Writable | Billige å skrive relativt til koden de tester |
| **Medium** | Specific | Når en test feiler, er årsaken åpenbar |
| **Lav** | Fast / Automated | Allerede godt ivaretatt i prosjektet |

## Prosjektkonvensjoner

### Auto-mocks (`__mocks__/`)

Tredjeparts-moduler som mockes likt på tvers av filer har auto-mocks i `__mocks__/` ved prosjektroten:

- `__mocks__/dompurify.js` — identity-sanitize
- `__mocks__/marked.js` — enkel `<p>text</p>`-wrapping

Bruk: `vi.mock('dompurify')` (uten factory-argument). Vitest bruker da filen i `__mocks__/`.

**Unntak:** `messageClient.test.js` bruker alternativt marked-mock (`<html>${markdown}</html>`) og beholder inline mock.

### Delte hjelpere (`test-helpers.js`)

Importeres fra `src/scripts/__tests__/test-helpers.js`:

```js
import { createMockAutoSaver, mockAdminDialog, setupModuleDOM } from './test-helpers.js';
```

| Hjelper | Bruk |
|---------|------|
| `mockAdminDialog(overrides)` | Standardmock for `admin-dialog.js` med alle 4 eksporter |
| `createMockAutoSaver()` | Factory for autoSaver-mock med trigger/cancel/_saveFn |
| `setupModuleDOM({ configAttrs, extraHTML })` | Standard admin-modul DOM-setup |

### `it.each`

Bruk `it.each` når 3+ tester har identisk struktur men ulike input/output:

```js
// Bra — kompakt, lesbart, lett å utvide
it.each([
    ['non-retryable', new Error('fail'), 'Kunne ikke slette.'],
    ['auth', { status: 401 }, 'Økten din er utløpt.'],
    ['retryable', new Error('net'), 'Nettverksfeil — prøv igjen.'],
])('should show %s error toast', async (errorType, rejection, expectedMsg) => {
    classifyError.mockReturnValueOnce(errorType);
    deleteFile.mockRejectedValue(rejection);
    await doDelete();
    expect(showToast).toHaveBeenCalledWith(expectedMsg, 'error');
});
```

Bruk **ikke** `it.each` når testene har ulik setup, ulike assertions, eller det ville skade lesbarheten.

### Fake timers

Alle dato-avhengige tester **skal** bruke fake timers:

```js
beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-02-15T12:00:00') });
});
afterEach(() => {
    vi.useRealTimers();
});
```

Trenger én test en annen tid? Bruk `vi.setSystemTime(new Date('...'))` inne i testen.

### Console-suppression

Gjøres per-fil i `beforeEach` for den relevante describe-blokken, aldri globalt:

```js
beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
});
```

## Hva vi tester og ikke tester

### Test atferd, ikke implementasjon

| Gjør | Unngå |
|------|-------|
| Sjekk at bruker ser riktig melding | Sjekk eksakt HTML-struktur |
| Sjekk at riktig API-kall gjøres | Sjekk mock-kallrekkefølge |
| Sjekk at data endres korrekt | Sjekk interne variabelverdier |

### Guard clauses

- **Test** guard clauses som beskytter mot reelle feil (API-kall, datamutasjon, sikkerhet)
- **Ikke test** at `querySelector` returnerer null for elementer som alltid finnes
- **Vurder** om guard clause-testen gir tillit — hvis ikke, fjern den

### Coverage-policy

- Mål: 80% branch coverage per fil
- Coverage-verktøy: v8 via vitest
- Ikke skriv tester bare for å nå 80% — skriv tester som gir tillit
- Dokumenter unntak her hvis en fil legitimt faller under 80%

**Kjente unntak:**
- `admin-module-bilder.js`: 78.9% branch (kompleks kode med mange edge cases i UI-logikk)

## E2E-tester (Playwright)

E2E-tester i `tests/` kjøres separat med `npx playwright test`. Disse tester:
- Tilgjengelighet (axe)
- Admin-panel funksjonalitet
- CSP-headere
- Lenker (ingen 404)
- SEO-meta

E2E-testene trenger dev-server og er allerede behavioral av natur.

## Referanser

- [Test Desiderata (Kent Beck)](https://testdesiderata.com/)
- [Test Desiderata 2.0 (Emily Bache)](https://coding-is-like-cooking.info/2025/12/test-desiderata-2-0/)
