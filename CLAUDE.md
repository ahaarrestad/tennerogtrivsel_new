# Claude Code Instructions

## TODO-liste

Prosjektets oppgaver spores i `TODO.md`. Følg arbeidsflyten som er beskrevet der.

## Kvalitetssikring (Quality Gates)

Fullstendig prosedyre finnes i `/quality-gate`-skill. Kjernekrav:

- **80% branch coverage per fil** for kjerne-logikk (scripts og API).
- Ved nye miljøvariabler: sjekk og oppdater `.github/workflows/`-filer.

**AGENT-REGEL:** Du har ikke lov til å si deg ferdig eller foreslå en commit før du har presentert en fersk testrapport som viser at kravene er møtt for alle berørte filer. Hvis dekningsgraden faller pga. nye funksjoner, SKAL du skrive tester før du går videre.

## Design-system

Token-drevet design-guide i [`docs/designs/design-guide.md`](docs/designs/design-guide.md). Alle visuelle endringer skal følge denne.

- **Farger:** Kun CSS-variabler fra `src/styles/global.css` (`@theme`-blokken). Token-klasser (`text-brand`, `bg-accent`) — aldri hardkodede hex eller Tailwind-fargeklasser.
- **Fonter:** Montserrat (headings) og Inter (body), begge self-hosted woff2. `--font-heading` / `--font-body`.
- **Knapper:** `btn-primary` (fylt), `btn-secondary` (outline), `btn-accent` (mørk CTA). Maks én accent-knapp per viewport-seksjon.

## Sheets API: valueRenderOption

Alle `sheets.values.get`-kall med numeriske felter **SKAL** bruke `valueRenderOption: 'UNFORMATTED_VALUE'`. Norsk locale gjør `1.5` → `"1,5"` → `parseFloat` gir `1`.

## Build-scripts

| Script | Kommando | Bruk |
|--------|----------|------|
| `build` | `sync-data.js && astro build` | Lokalt |
| `build:ci` | `astro build` | CI/CD (sync kjøres som eget steg før) |

## Dato-avhengige tester

Alle tester som sammenligner datoer mot "nå" **SKAL** bruke `vi.useFakeTimers()`. Aldri bruk hardkodede fremtidsdatoer som antar at testen kjøres før en viss dato.

```js
beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-02-15T12:00:00') });
});
afterEach(() => {
    vi.useRealTimers();
});
```

Hvis én test trenger en annen tid enn resten av describe-blokken: bruk `vi.setSystemTime(new Date('...'))` inne i den testen (ikke `vi.useFakeTimers` på nytt).

## Arkitekturdokumentasjon

Detaljert arkitekturdokumentasjon for spesifikke subsystemer finnes i `docs/architecture/`:

- [Bildehåndtering](docs/architecture/bildehåndtering.md) — galleri, forsidebilde, admin-funksjoner, Sheets-ark
- [Meldinger](docs/architecture/meldinger.md) — InfoBanner, datofiltrering klient-side
- [Seksjonsbakgrunner](docs/architecture/seksjonsbakgrunner.md) — variant-prop, annenhver-mønster
- [Sikkerhet](docs/architecture/sikkerhet.md) — DOMPurify, CSP, middleware, test-gotchas

Les relevant arkitekturdokument **før** du gjør endringer i et subsystem.
