# Plan: Drive-uavhengige tester (syntetiske fixtures)

**Dato:** 2026-06-11

## Bakgrunn

Opprinnelig oppgave var «fikse flaky tester». Gjennomgang avdekket et større, underliggende problem: **hele E2E-suiten bygges fra live Google Drive-data**. CI-pipelinen kjører `npm run sync` (henter live Drive/Sheets) → `build:ci` → Playwright. Endrer noen innholdet i Drive (sletter en tjeneste, tømmer galleriet, fjerner en tannlege), feiler testene — uten at koden er rørt.

Denne oppgaven slår derfor sammen backlog-oppgave 8 («Gjennomgå tester for avhengighet til synkronisert data») og kjernen av oppgave 9. De rene timing-/mock-flaky-fiksene (networkidle, `clearMocks`) skilles ut til en **egen oppfølgingsoppgave** (iterasjon 2).

## Mål

Alle tester skal være deterministiske og uavhengige av innholdet i Google Drive. Data i Drive skal kunne byttes ut fritt uten at en eneste test feiler. Tester bruker syntetiske fixtures med kjent innhold.

## Avgrensninger (ikke i scope)

- **Rene flaky-fikser** (networkidle→`page.route` der det ikke handler om data, global `clearMocks`-evaluering) — egen oppfølgingsoppgave.
- **Nye tester for udekket produksjonskode** — ingen coverage-utvidelse her.
- **Endring av selve sync-data.js eller produksjons-bygget** — fixtures brukes kun for test-bygget.

## Funn: avhengige tester

| Test | Avhengighet til Drive-innhold |
|------|-------------------------------|
| `tests/galleri-lightbox.spec.ts` | Krever galleri-fliser (`[data-lightbox-index]`) fra `galleri.json` |
| `tests/prisliste-print.spec.ts` | Krever tannleger fra `tannleger.json` (print-footer med navn) |
| `tests/accessibility.spec.ts` | Klikker `#tjenester .card-base.first()` — krever ≥1 tjeneste |
| `tests/seo.spec.ts` | Leser tjeneste-korttittel; forventer `hovedbilde.png` |
| `tests/sitemap-pages.spec.ts` | Itererer genererte `/tjenester/`-sider |
| `tests/links.spec.ts` | Itererer `#tjenester`-lenker |
| `src/__tests__/data-validation.test.ts` | Leser ekte `src/content/tannleger.json` + `tjenester/*.md` fra disk |

**Allerede rene:** `admin.spec.ts` (mocker hele Google-API via `addInitScript`), øvrige Vitest-tester (mocker `astro:content`/`getCollection`), `telefon-tab-rekkefolge.spec.ts` (telefon fra settings-fallback).

## Tilnærming: seed-script erstatter sync (besluttet)

Et committet syntetisk fixture-datasett. Et eget script kopierer fixtures inn i `src/content/` + `src/assets/` før test-bygg: E2E kjører `seed:fixtures` i stedet for `npm run sync`. Renest separasjon mellom testdata og normal dev-/prod-flyt.

### Hvordan content lastes (verifisert)

`src/content.config.ts` laster fra hardkodede stier under `src/content/`:
- `innstillinger.json`, `tannleger.json`, `galleri.json`, `prisliste.json`, `kontaktskjema.json` (egne loaders)
- `tjenester/*.md`, `meldinger/*.md` (glob-loaders)

Bilder ligger i `src/assets/tannleger/`, `src/assets/galleri/`, `src/assets/hovedbilde.png`.

## Konkrete steg

### Steg 1 — Bygg syntetisk fixture-datasett

Opprett `tests/fixtures/`:

```
tests/fixtures/
  content/
    innstillinger.json      # phone, adresse, lat/long, businessHours, seksjonstitler
    tannleger.json          # 2 tannleger m/ image + imageConfig
    galleri.json            # 1 forsidebilde + 3 galleri-fliser m/ imageConfig
    prisliste.json          # 2 kategorier m/ et par behandlinger
    kontaktskjema.json      # aktiv:false, tittel, tema
    tjenester/
      tjeneste-en.md        # frontmatter: id,title,ingress,active,priority + body
      tjeneste-to.md
      tjeneste-tre.md
    meldinger/
      testmelding.md        # startDate 2020-01-01, endDate 2099-12-31 (alltid aktiv)
  assets/
    tannleger/*.png         # syntetiske placeholder-bilder (navn matcher tannleger.json)
    galleri/*.jpg           # syntetiske placeholder-bilder (navn matcher galleri.json)
    hovedbilde.png          # syntetisk forsidebilde
```

- Datanavn/-verdier er åpenbart syntetiske («Tannlege Test Testesen», «Tjeneste En»), så ingen forveksling med ekte innhold.
- Meldingen får alltid-aktiv datointervall slik at InfoBanner er deterministisk uavhengig av kjøretidspunkt.
- Placeholder-bilder: små genererte PNG/JPG (f.eks. 1×1 eller enkel ensfarget rute via et lite genereringssteg i seed-scriptet, eller committede minifiler). Astro `<Image>` krever gyldige bildefiler.

### Steg 2 — Seed-script

**Ny fil:** `scripts/seed-test-fixtures.mjs`
- Kopierer `tests/fixtures/content/` → `src/content/` (overskriver json + tjenester/ + meldinger/).
- Kopierer `tests/fixtures/assets/tannleger/`, `galleri/`, `hovedbilde.png` → `src/assets/`.
- Skriver tydelig logg: «⚠️ Seeder syntetiske testdata — kjør `npm run sync` for å gjenopprette ekte Drive-data.»
- Idempotent; trygt å kjøre flere ganger.

**`package.json`:** `"seed:fixtures": "node scripts/seed-test-fixtures.mjs"`. Test-bygget kjører `seed:fixtures && build:ci` før Playwright.

### Steg 3 — CI + lokal Playwright bruker fixtures

- **`.github/workflows/deploy.yml`** (`e2e-tests`-jobben): erstatt steget `npm run sync` med `npm run seed:fixtures`. Drive-secrets (`GOOGLE_*`) kan da fjernes fra `e2e-tests`-jobben — sjekk og rydd iht. CLAUDE.md-regel om miljøvariabler i workflows.
- **`playwright.config.ts`**: lokal `webServer.command` bør seede fixtures før dev-server starter, ev. via et eget npm-script (`pretest:e2e` eller `test:e2e` som kjører `seed:fixtures` først). Dokumentér at lokal E2E-kjøring overskriver `src/content/` (gjenopprett med `npm run sync`).

### Steg 4 — Skriv om de avhengige testene mot kjent fixture-innhold

- `accessibility.spec.ts`, `sitemap-pages.spec.ts`, `links.spec.ts`, `seo.spec.ts`: **verifisert strukturelt dekket av fixtures — ingen kodeendring nødvendig.** Bruker strukturelle selektorer (`#tjenester .card-base`, `/tjenester/`-iterasjon) og fallback-titler fra `HARD_DEFAULTS`; siden fixtures garanterer 3 tjenester + alle seksjoner, passerer de deterministisk mot fixture-bygget uten endring. (Bekreftet med full chromium-E2E, 41/41.)
- `prisliste-print.spec.ts`: **endret** — footer asserterer nå eksplisitt mot fixture-tannlegenavnet (`Tannlege Test Testesen`) i stedet for kun «ikke tom»; misvisende kommentar oppdatert.
- `galleri-lightbox.spec.ts`: galleri-fliser er garantert av fixtures (data-delen løst). networkidle→page.route-forbedringen er **iterasjon 2** (urørt her).

### Steg 5 — Fiks `data-validation.test.ts`

Testen validerer i dag ekte synket innhold. Pek den mot `tests/fixtures/content/` i stedet, slik at den verifiserer at **fixture-settet** er internt konsistent (tannlege-bilder finnes, tjeneste-frontmatter er gyldig). Behold schema-testen (#4) og `.gitkeep`-testen (#3) uendret. Da tester den kjent data, ikke Drive.

## Filer som berøres

- **Nye:** `tests/fixtures/**` (data + bilder), `scripts/seed-test-fixtures.mjs`
- **Endres:** `package.json` (script), `.github/workflows/deploy.yml` (sync→seed, rydd secrets), `playwright.config.ts` (seed før server), `tests/{accessibility,sitemap-pages,links,seo,prisliste-print,galleri-lightbox}.spec.ts`, `src/__tests__/data-validation.test.ts`

## Testbehov og definition of done

- **Bevis på Drive-uavhengighet:** kjør E2E mot fixtures lokalt og bekreft grønn. Deretter tøm/endre `src/content/` (simuler endret Drive) → re-seed → fortsatt grønn. Testene skal aldri lese fra ekte Drive.
- Alle Playwright-prosjekter grønn (inkl. Mobile Safari).
- Vitest: alle grønn, branch coverage ≥80% uendret (ingen produksjonskode endres).
- `data-validation.test.ts` kjører mot fixtures, ikke `src/content`.
- CLAUDE.md-sjekk: ingen gjenværende Drive-secrets i `e2e-tests`-jobben som ikke trengs.

## Kjente risiki / usikkerheter

- **Lokal clobbering:** seed overskriver gitignorert `src/content/` lokalt. Avbøtes med tydelig logg + dokumentert `npm run sync`-gjenoppretting. (Matcher eksisterende worktree-kopieringsmønster.)
- **Bildegenerering:** Astro `<Image>` krever gyldige bildefiler. Placeholder-bilder må være ekte (om enn minimale) PNG/JPG. Avklares i Steg 1 — committe minifiler vs. generere i seed.
- **Eksisterende orphaned worktree:** `fix/e2e-stabile-tester` inneholder en eldre, ikke-merget accessibility-fix (setViewportSize). Den hører til iterasjon 2 (rene flaky) — håndteres separat, ikke i denne oppgaven.
- **Datofiltrering for meldinger:** alltid-aktiv intervall (2020→2099) gjør banner deterministisk uten fake timers i E2E.

## Oppfølgingsoppgave (iterasjon 2 — egen backlog-post)

Rene flaky-fikser: `galleri-lightbox.spec.ts` networkidle→`page.route`, evaluering av global `clearMocks`/`restoreMocks` i `vitest.config.ts`, samt den orphaned accessibility-setViewportSize-fiksen fra `fix/e2e-stabile-tester`.
