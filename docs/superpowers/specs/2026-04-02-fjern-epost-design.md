# Spec: Fjern offentlig e-postadresse-funksjon

**Dato:** 2026-04-02

## Bakgrunn

Kontaktskjema (ContactModal) har erstattet den gamle løsningen der klinikkens e-postadresse ble vist direkte på siden. `email`/`showEmail`-innstillingene og `EpostKnapp`-komponenten er ikke lenger i bruk og skal fjernes.

## Scope

### Fjernes helt
- `src/components/EpostKnapp.astro` — slett filen
- `email` og `showEmail` fra `getSettings.ts` defaults
- `email` og `showEmail` fra `sync-data.js` `HARD_DEFAULT_KEYS`
- `showEmail`-blokken i `buildSchema.ts` (schema.org email)
- `showEmail`/`email`-betingelsen i `personvern.astro` (kontaktlinje)

### Oppdateres

**`ContactButton.astro`**
- Henter `kontaktskjema`-entry internt via `getEntry`
- Rendrer ingenting hvis `!ks.aktiv`
- Kallesteder slipper ekstern `aktiv`-sjekk

**`Forside.astro`**
- Fjern `kontaktskjema.aktiv &&`-wrapper rundt `ContactButton`
- Fjern død `EpostKnapp`-import

**`tjenester/[id].astro`**
- Fjern `EpostKnapp`-import og bruk
- Fjern `KontaktKnapp`-import og bruk (erstattes av ContactButton)
- Legg til `ContactButton variant="accent"` i flex-kolonnen

**`Kontakt.astro`** — ingen endring nødvendig

### Tester oppdateres
- `buildSchema.test.ts` — fjern `describe('buildSchema – email', ...)` blokken
- `content.config.test.ts` — fjern `email`-oppføring fra mock-innstillinger
- `admin-module-settings.test.js` — fjern `email`-oppføring fra mock
- `admin-dashboard.test.js` — fjern `email`-oppføringer fra mock-data

## Hva beholdes

Alt tilknyttet kontaktskjema røres ikke:
- `ContactModal.astro`, `contact-form.js`
- `kontaktEpost` i `sync-data.js` og `admin-sheets.js`
- `admin-module-kontaktskjema.js` og tilhørende tester
- Lambda-kode og deploy-workflow

## Selvrengjørende

`admin-module-settings.js` trenger ikke endres — `email`/`showEmail` forsvinner automatisk fra admin-panelet når de fjernes fra Google Sheet og defaults.
