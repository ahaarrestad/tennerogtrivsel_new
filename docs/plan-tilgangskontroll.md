# Plan: Bekreft tilgangskontroll på adminsiden

> **Status: FULLFØRT**

## Bakgrunn

Admin-panelet bruker Google Drive-deling som tilgangsmodell. Funksjonen `enforceAccessControl()` i `admin-dashboard.js` sjekker hvilke Google Drive-ressurser (mapper/sheets) brukeren har tilgang til, og viser/skjuler modulkort basert på dette. Hvis brukeren ikke har tilgang til noen ressurser, logges de ut og sendes til forsiden.

### Dagens implementasjon

**Modul-ressurs-mapping:**

| Modul | Krever tilgang til | Logikk |
|-------|-------------------|--------|
| Innstillinger | SHEET_ID | Enkel sjekk |
| Tjenester | TJENESTER_FOLDER | Enkel sjekk |
| Meldinger | MELDINGER_FOLDER | Enkel sjekk |
| Tannleger | TANNLEGER_FOLDER + SHEET_ID | Begge må være tilgjengelige |
| Bilder | SHEET_ID | Enkel sjekk |

**Nøkkelfiler:**
- `admin-dashboard.js:107-154` — `enforceAccessControl()`
- `admin-client.js:563-597` — `checkAccess()` / `checkMultipleAccess()`
- `admin-init.js:76-91` — `handleAuth()` som kaller enforceAccessControl

### Eksisterende testdekning

**Enhetstester som finnes (admin-dashboard.test.js):**
- Mixed tilgang (3 av 4 moduler synlige) ✅
- Tannleger skjules ved manglende Sheet-tilgang ✅
- Logout ved null tilgang ✅
- Bilder synlig/skjult basert på Sheet-tilgang ✅

**Enhetstester som finnes (admin-client.test.js):**
- `checkAccess` returnerer true/false ✅
- `checkMultipleAccess` med tom liste og alle suksess ✅

**E2E-tester:** Kun full-tilgang-scenarioer — ingen tester for begrenset tilgang.

### Mangler / hull

1. Ingen test for "kun meldinger"-kombinasjon
2. Ingen test for "kun tjenester"-kombinasjon
3. Ingen test for "innstillinger + tannleger + galleri" (sheet + tannleger-folder)
4. Ingen test for `checkMultipleAccess` med blandede resultater (noen true, noen false)
5. Ingen test for tom/udefinert config (alle folder-IDer mangler)
6. Ingen test for at modulkort som mangler i DOM ikke krasjer
7. Ikke verifisert at `accessMap`-returverdien er korrekt

## Plan

### Steg 1: Utvid enhetstester for tilgangskombinasjoner

**Fil:** `src/scripts/__tests__/admin-dashboard.test.js`

Legg til nye tester i `enforceAccessControl`-seksjonen for følgende scenarioer:

| Scenario | Sheet | Tjenester | Meldinger | Tannleger | Forventet synlige |
|----------|-------|-----------|-----------|-----------|-------------------|
| Kun meldinger | ❌ | ❌ | ✅ | ❌ | Meldinger |
| Kun tjenester | ❌ | ✅ | ❌ | ❌ | Tjenester |
| Sheet + tannleger-folder | ✅ | ❌ | ❌ | ✅ | Innstillinger, Tannleger, Bilder |
| Kun sheet (ingen folders) | ✅ | ❌ | ❌ | ❌ | Innstillinger, Bilder |
| Alt unntatt sheet | ❌ | ✅ | ✅ | ✅ | Tjenester, Meldinger |

Hver test verifiserer:
- Riktige kort vises (`display: 'flex'`)
- Riktige kort skjules (`display: 'none'`)
- `logout()` **ikke** kalles (bruker har minst én tilgang)
- Returverdien `accessMap` inneholder riktige true/false-verdier

### Steg 2: Utvid enhetstester for `checkMultipleAccess`

**Fil:** `src/scripts/__tests__/admin-client.test.js`

Ny test:
- **Blandede resultater**: 3 IDer inn, 1 feiler → returverdi har 2× true, 1× false

### Steg 3: Edge case-tester for `enforceAccessControl`

**Fil:** `src/scripts/__tests__/admin-dashboard.test.js`

- **Tom config**: Alle folder-IDer er `undefined`/`''` → ingen moduler synlige, men `logout()` kalles IKKE (fordi `ids.length === 0`)
- **Manglende DOM-elementer**: Kort-elementer finnes ikke i DOM → ingen krasj (optional chaining)
- **Returverdi**: Verifiser at `enforceAccessControl` returnerer korrekt `accessMap`-objekt

### Steg 4: Verifiser og dokumenter

- Kjør alle tester og bekreft ≥80% branch coverage for berørte filer
- Oppdater `docs/architecture/sikkerhet.md` med en kort seksjon om tilgangskontroll-modellen
- Marker oppgaven som fullført i TODO.md

## Avgrensninger

- **Ikke E2E-tester for tilgang**: Å mocke Google OAuth i Playwright er komplisert og gir lite merverdi utover enhetstestene. Admin E2E-tester bruker allerede mock-tokens og tester full-tilgang-flyten.
- **Ingen kodeendringer**: Gjennomgangen av koden viser at implementasjonen allerede er solid. Oppgaven handler om å *verifisere* med tester, ikke fikse feil.
- **Google Drive-deling**: Selve tilgangsmodellen (hvem som er delt med i Google Drive) er utenfor kodebasens kontroll.

## Estimat

3 steg med tester + 1 steg verifisering/dokumentasjon.
