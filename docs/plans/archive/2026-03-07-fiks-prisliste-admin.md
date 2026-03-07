# Plan: Fiks prisliste-admin (flere problemer)

Dato: 2026-03-07

## Oversikt

Fire deloppgaver som fikser UX-problemer i prisliste-admin. Hver deloppgave committes separat.

## Deloppgave 1 — Custom kategori-dropdown

**Problem:** Native `<datalist>` gir dårlig UX — begrenset styling, ingen "opprett ny"-funksjon.

**Løsning:** Custom vanilla JS dropdown-komponent som erstatter datalist.

- Input-felt med søk/filtrering av eksisterende kategorier
- Dropdown-liste vises ved fokus/input, filtreres mens man skriver
- "Opprett ny kategori"-alternativ nederst når søketeksten ikke matcher
- Klikk utenfor lukker dropdown
- Tastaturnavigering (pil opp/ned, Enter, Escape)

**Filer:**
- `src/scripts/admin-module-prisliste.js` — erstatt datalist med custom dropdown i `editPrisRad()`
- `src/styles/global.css` — CSS for `.admin-category-select`, `.admin-category-dropdown`
- `src/scripts/__tests__/admin-module-prisliste.test.js` — tester for dropdown-oppførsel

## Deloppgave 2 — Autosave-flyt for nye rader

**Problem:** Autosave trigger for tidlig for nye rader — brukeren kastes tilbake til oversikten før alle felt er fylt ut.

**Løsning:** Ny rad bruker eksplisitt "Opprett"-knapp i stedet for autosave. Etter opprettelse byttes det til redigeringsmodus med autosave.

**Flyt:**
1. Nye rader: vis "Opprett"-knapp + "Avbryt"-knapp, ingen autosave
2. Klikk "Opprett" → `addPrislisteRow()` → hent ny `rowIndex` fra sheetet
3. Bytt til redigeringsmodus (sett `rowIndex`) → autosave aktiveres
4. Brukeren navigerer tilbake via breadcrumb når ferdig

**Filer:**
- `src/scripts/admin-module-prisliste.js` — betinget autosave-oppsett i `editPrisRad()`
- `src/scripts/__tests__/admin-module-prisliste.test.js` — tester for ny-rad-flyt

## Deloppgave 3 — Tilbake-knapp (konsistent med andre moduler)

**Problem:** Ingen synlig "Avbryt"/"Tilbake"-knapp i redigeringsvisningen.

**Løsning:** Følg mønsteret fra meldinger/tjenester-modulene:
- Nye rader: "Opprett"-knapp (`btn-primary`) + "Avbryt"-knapp (`admin-btn-cancel`)
- Eksisterende rader: breadcrumb fungerer allerede (ingen endring)

**Merk:** Deloppgave 2 og 3 implementeres sammen da de overlapper (samme knapper).

**Filer:**
- `src/scripts/admin-module-prisliste.js` — legg til knapper i `editPrisRad()`
- `src/scripts/__tests__/admin-module-prisliste.test.js` — tester for knapp-oppførsel

## Deloppgave 4 — Sist oppdatert

**Problem:** Ingen visning av når priser sist ble endret.

**Løsning:** Ny kolonne D "SistOppdatert" i sheetet, visning i admin og offentlig side.

### Sheet-endringer
- `ensurePrislisteSheet()`: inkluder kolonne D "SistOppdatert" i header
- `getPrislisteRaw()`: utvid range til `A:D`, inkluder `sistOppdatert` i returnert objekt
- `addPrislisteRow()`: sett kolonne D til ISO-dato ved opprettelse
- `updatePrislisteRow()`: sett kolonne D til ISO-dato ved oppdatering

### Admin-visning
- Listeoversikten: vis "Oppdatert: 6. mars 2026" (dag + måned + år, norsk) per rad

### Offentlig prisliste
- `sync-data.js`: hent kolonne D, finn nyeste dato blant alle rader
- Lagre i `prisliste.json` som `sistOppdatert`-felt
- `prisliste.astro`: vis "Sist oppdatert: mars 2026" (måned + år) på siden

**Filer:**
- `src/scripts/admin-sheets.js` — sheet-operasjoner
- `src/scripts/admin-module-prisliste.js` — admin-visning per rad
- `scripts/sync-data.js` — hent og lagre nyeste dato
- `src/pages/prisliste.astro` — vis global dato
- Tester for alle berørte filer

## Rekkefølge

1. **Deloppgave 4** (Sist oppdatert) — sheet-endringer først, da de påvirker datamodellen
2. **Deloppgave 1** (Kategori-dropdown) — uavhengig UI-endring
3. **Deloppgave 2+3** (Autosave + Tilbake-knapp) — implementeres sammen
