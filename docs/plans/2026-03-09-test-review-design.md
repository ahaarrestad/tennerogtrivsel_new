# Design: Test-review og forenkling

> Opprettet: 2026-03-09

## Mål

Forbedre testenes **vedlikeholdbarhet og kvalitet** evaluert mot Kent Becks Test Desiderata, pluss en test-guide for fremtidig testskriving.

## Evalueringsrammeverk: Test Desiderata

Testene evalueres som skyveknapper langs disse egenskapene:

| Egenskap | Beskrivelse |
|----------|-------------|
| **Isolated** | Resultatet er uavhengig av kjørerekkefølge |
| **Composable** | Kan teste ulike dimensjoner separat og kombinere |
| **Deterministic** | Samme resultat hvis ingenting endres |
| **Fast** | Kjører raskt |
| **Writable** | Billige å skrive relativt til koden de tester |
| **Readable** | Forståelige — motivasjonen for testen er tydelig |
| **Behavioral** | Sensitive til endringer i *atferd*, ikke implementasjon |
| **Structure-insensitive** | Brekker *ikke* når kodestrukturen endres |
| **Automated** | Kjører uten manuell intervensjon |
| **Specific** | Når en test feiler, er årsaken åpenbar |
| **Predictive** | Grønne tester = koden er klar for produksjon |
| **Inspiring** | Grønne tester gir faktisk tillit |

## Nåværende problemer

### Omfang
- 34 testfiler, ~17 000 linjer
- De 5 største filene utgjør nesten halvparten (~8 000 linjer)

### Hovedproblemer

| Problem | Omfang | Berørt desiderata |
|---------|--------|-------------------|
| Dupliserte mock-definisjoner | dompurify (9), admin-dialog (9), admin-client (10), marked (5), createAutoSaver (5) | Writable, Readable |
| Ingen delte test-hjelpere | Hver fil gjenskaper DOM-setup, mock-factories fra scratch | Writable, Readable |
| Null `it.each`-bruk | 30+ tester kunne konsolideres | Writable, Readable |
| Coverage-jaging | 50+ "should not throw"/"should do nothing"-tester uten atferdsverifisering | Inspiring, Predictive, Specific |
| Skjør callback-ekstraksjon | `mock.calls[0][1]` i 9+ steder | Structure-insensitive |
| Implementasjonsdetalj-testing | Verifiserer eksakt HTML, regex, mock-kallrekkefølge | Behavioral, Structure-insensitive |
| Inkonsistent setup | setupDOM() i noen filer men ikke andre, fake timers brukes ulikt | Composable, Deterministic |

## Løsning

### Delt infrastruktur

**Automatiske mocks** i `src/scripts/__tests__/__mocks__/`:
- `dompurify.js` — identisk i 9 filer i dag
- `marked.js` — identisk i 5 filer
- `admin-dialog.js` — identisk i 9 filer

**Hjelpere** i `src/scripts/__tests__/test-helpers.js`:
- `createAutoSaver()` factory (duplisert i 5 filer)
- DOM setup-hjelpere (`setupAdminDOM()`, `setupModuleDOM()`)
- Console-suppression forblir per-fil (ikke global — bevarer debugging-mulighet)

### Testrensing per desiderata

| Desiderata | Tiltak |
|------------|--------|
| **Behavioral** | Omskriv tester som verifiserer HTML-struktur/mock-kallrekkefølge til å teste atferd |
| **Structure-insensitive** | Fjern `mock.calls[0][1]` callback-ekstraksjon, erstatt med navngitte callbacks eller spies |
| **Readable** | Migrer til delt infrastruktur, bruk `it.each` (30+ steder), fjern boilerplate |
| **Writable** | Delt mocks + hjelpere gjør nye tester billigere å skrive |
| **Specific** | Erstatt "should not throw" med faktiske assertions der verdifullt |
| **Inspiring** | Slett coverage-jagende tester som gir falsk tillit. Behold guard-tester for kritisk kode (API, datamutasjon) |

### Coverage-strategi
- Målet er fortsatt 80% branch per fil
- Vi aksepterer at noen filer kan falle litt under etter sletting av verdiløse tester
- Eventuelle unntak dokumenteres i test-guiden

### Test-guide (`docs/guides/test-guide.md`)

1. **Prinsipper** — Test Desiderata som rammeverk med prioritering
2. **Prosjektkonvensjoner** — Mock-struktur (`__mocks__/`, `test-helpers.js`), fake timers, `it.each`, DOM-setup
3. **Hva vi tester og ikke tester** — Behavioral over structural, guard clause-policy
4. **Eksempler** — Før/etter fra faktiske refaktoreringer i denne oppgaven

## Tilnærming: Problem-drevet

Angrip etter problemtype på tvers av alle filer:

1. **Lag delt infrastruktur** — mocks + hjelpere
2. **Migrer alle testfiler** til ny infrastruktur (fjern duplisert boilerplate)
3. **Evaluer og fiks tester** per desiderata-egenskap
4. **Skriv test-guiden** basert på lærdom fra gjennomgangen

## Referanser

- [Test Desiderata (Kent Beck)](https://testdesiderata.com/)
- [Test Desiderata 2.0 (Emily Bache)](https://coding-is-like-cooking.info/2025/12/test-desiderata-2-0/)
