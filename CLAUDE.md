# Claude Code Instructions

## TODO-liste

Prosjektets oppgaver spores i `TODO.md`. Følg arbeidsflyten som er beskrevet der.

## Kvalitetssikring (Quality Gates)

Fullstendig prosedyre finnes i `/quality-gate`-skill. Kjernekrav:

- **80% branch coverage per fil** for kjerne-logikk (scripts og API).
- Ved nye miljøvariabler: sjekk og oppdater `.github/workflows/`-filer.

**AGENT-REGEL:** Du har ikke lov til å si deg ferdig eller foreslå en commit før du har presentert en fersk testrapport som viser at kravene er møtt for alle berørte filer. Hvis dekningsgraden faller pga. nye funksjoner, SKAL du skrive tester før du går videre.

## Design-system

Alle visuelle endringer SKAL følge den token-drevne design-guiden i [`docs/designs/design-guide.md`](docs/designs/design-guide.md) (farger, typografi, knapper, spacing). **Les den før du gjør visuelle endringer.**

Ufravikelig kjerneregel: bruk kun semantiske token-klasser (`text-brand`, `bg-accent`) — aldri hardkodede hex eller Tailwind-fargeklasser (`text-slate-600`).

## Sheets API: valueRenderOption

Alle `sheets.values.get`-kall med numeriske felter **SKAL** bruke `valueRenderOption: 'UNFORMATTED_VALUE'`. Norsk locale gjør `1.5` → `"1,5"` → `parseFloat` gir `1`.

## Build-scripts

| Script | Kommando | Bruk |
|--------|----------|------|
| `build` | `sync-data.js && astro build` | Lokalt |
| `build:ci` | `astro build` | CI/CD (sync kjøres som eget steg før) |

## Test-guide

Retningslinjer for testskriving finnes i [`docs/guides/test-guide.md`](docs/guides/test-guide.md). Dekker Test Desiderata-prinsipper, auto-mocks, test-helpers, `it.each`-konvensjoner, fake timers for dato-avhengige tester, og coverage-policy.

## Worktree-oppsett (prosjektspesifikt)

Etter `npm install` i en ny worktree mangler gitignorerte filer (innhold, bilder, `.env`). Kopier dem fra main **før** build eller tester kjøres:

```bash
bash scripts/setup-worktree.sh
```

## Arkitekturdokumentasjon

Detaljert arkitekturdokumentasjon for spesifikke subsystemer finnes i `docs/architecture/`:

- [Bildehåndtering](docs/architecture/bildehåndtering.md) — galleri, forsidebilde, admin-funksjoner, Sheets-ark
- [Meldinger](docs/architecture/meldinger.md) — InfoBanner, datofiltrering klient-side
- [Seksjonsbakgrunner](docs/architecture/seksjonsbakgrunner.md) — variant-prop, annenhver-mønster
- [Sikkerhet](docs/architecture/sikkerhet.md) — DOMPurify, CSP, middleware, test-gotchas

Les relevant arkitekturdokument **før** du gjør endringer i et subsystem.

## Sikkerhetsregler for innerHTML

`innerHTML`/`outerHTML` med template-interpolasjon krever `DOMPurify.sanitize()`, `escapeHtml()`, eller en `// safe: <begrunnelse>`-kommentar på linjen **før** assignment. ESLint-regelen `local/no-unsafe-inner-html` håndhever dette i `src/scripts/`. Se [`docs/guides/security-guide.md`](docs/guides/security-guide.md) for mønstre og kjente begrensninger.
