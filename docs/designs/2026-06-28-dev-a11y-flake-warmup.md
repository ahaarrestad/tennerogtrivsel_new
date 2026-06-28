# Spec: Dev-modus a11y-flake — rot-årsak-fiks via Vite warm-up

**Dato:** 2026-06-28
**Status:** Godkjent design

## Problem / mål

`tests/accessibility.spec.ts` flaker under lokal e2e i dev-modus (`dev:secure:fixtures`,
`astro dev`). Flaken slo til på 2 tester i en kvalitetsport-kjøring (2026-06-21), altså mer
enn de «~1 %» som tidligere ble dokumentert. Feilmeldingen er «Execution context was
destroyed».

**Rot-årsak:** Den kalde dev-serveren kjører Vites dep-optimering på første navigasjon til en
rute. Optimeringen oppdager nye avhengigheter, pre-bundler dem og trigger en full
dokument-reload. Reloaden kan starte *etter* at `page.waitForLoadState('networkidle')` har
løst — altså midt i axe-skannet — og river dermed bort JS-konteksten skannet kjører i.

Flaken reproduserer **ikke** mot `npm run preview` (prod-bygget CI bruker): der finnes ingen
Vite-dev-server og dermed ingen dep-optimering. CI er alltid 77/0. Dette er et rent
dev-artefakt som aldri når CI.

Målet er **stabil lokal e2e i dev-modus** (med hot-reload bevart), ikke bare mot CI-stien.

## Krav og akseptansekriterier

1. Lokal e2e i dev-modus (`dev:secure:fixtures`) skal kjøre stabilt på **kald** Vite-cache
   (`node_modules/.vite` tømt) — ingen «Execution context was destroyed».
2. Hot-reload i utvikling skal bevares — ingen bytte til `preview` lokalt.
3. CI-stien (`npm run preview`) skal være uendret og fortsatt grønn.
4. Fiksen skal treffe rot-årsaken (flytte Vite-reloaden ut av de assertende testene), ikke
   maskere symptomet.

## Designvalg med begrunnelse

Valgt løsning: **warm-up i Playwright `globalSetup`**.

Vites dep-optimering kjører kun én gang per kald dev-server og cacher resultatet i
`node_modules/.vite`. Reloaden skjer derfor bare på *første* navigasjon. Ved å besøke rutene
én gang i `globalSetup` — før selve testkjøringen — flyttes reloaden ut av de assertende
testene. Når de ekte testene kjører, er deps ferdig bundlet → ingen reload → ingen «context
destroyed».

Warm-upen er server-bred: reloaden kan i prinsippet treffe enhver tidlig test, ikke bare
axe. Global setup herder derfor hele suiten, ikke bare `accessibility.spec.ts`.

### Forkastede alternativer

- **Bytt lokal e2e til `preview`:** fjerner Vite-reloaden helt, men mister hot-reload-nytte
  under utvikling. Avvist — bruker kjører e2e aktivt under utvikling.
- **Retry-wrapper rundt axe-skannet:** robust, men behandler symptom, ikke årsak, og kan
  maskere ekte navigasjonsfeil. Avvist som primær fiks (oppgaven krever rot-årsak-fiks).
- **Timing-basert ventelogikk (dobbel `networkidle` e.l.):** fortsatt racy; vanskelig å vite
  når Vite er «ferdig». Avvist.

## Komponenter

1. **`tests/global-setup.ts`** (ny fil)
   - Default-eksportert `async (config: FullConfig)`-funksjon.
   - Tidlig retur hvis `process.env.CI` er satt (CI kjører `preview` — ingen Vite-optimering,
     warm-up unødvendig).
   - Leser `baseURL` fra config, starter en chromium-instans, navigerer til hver rute med
     `waitUntil: 'load'`, lukker browseren.
   - Ruter: `/`, `/kontakt/`, `/tannleger/`, `/tjenester/`, `/galleri/`, `/admin`.
   - **Hvorfor `'load'` og ikke `'networkidle'`:** warm-upen trenger bare å laste modulgrafen
     så Vite oppdager og cacher deps — `'load'` er nok. `/admin` laster Google Identity
     Services som holder gjentakende nettverksaktivitet og derfor aldri når «networkidle»;
     `networkidle` ville bare race mot 30s-timeouten og kunne henge hele warm-upen.
2. **`playwright.config.ts`** — legg til `globalSetup: './tests/global-setup.ts'`.

## Dataflyt

`webServer` (dev:secure:fixtures) starter → `globalSetup` kjører mot oppe server →
Vite-dep-optimering trigges og fullføres, cache skrives til `node_modules/.vite` →
testkjøring starter mot varm server.

## Feilhåndtering

Warm-up-besøkene asserterer ingenting; en reload *under* warm-up er forventet og uskadelig
(sidene forkastes). Warm-upen er **best-effort**: hver `goto` er pakket i try/catch som
logger en `console.warn` og fortsetter ved feil. En enkelt rute som feiler (f.eks. et
timing-hikke) skal ikke felle hele suiten — de ekte testene har sine egne assertions og
rapporterer reelle feil tydelig. Mangler `baseURL` i config (en konfigurasjonsfeil, ikke et
runtime-hikke), kastes det tidlig før browseren startes.

## Avgrensninger (non-goals)

- Ingen bytte til `preview` lokalt — hot-reload beholdes.
- Ingen retry-wrapper eller timing-baserte ventelys.
- `accessibility.spec.ts` sin eksisterende `networkidle`-vente beholdes uendret (skader ikke).

## Definition of done

Flaken er et dev-only-artefakt og kan ikke fanges av en deterministisk enhetstest.
Verifiseres manuelt:

- Tøm cache (`rm -rf node_modules/.vite`), kjør lokal e2e i dev-modus
  (`dev:secure:fixtures`) → forventet 77/0.
- Gjenta på kald cache flere ganger → stabilt, ingen «Execution context was destroyed».
- CI (`preview`) er uendret og fortsatt grønn (warm-up hoppes over via CI-guard).

## Kjente risiki / usikkerheter

- Litt ekstra oppstartstid på kald server (én reload, én gang). Gratis på varm server
  (`reuseExistingServer` lokalt).
- Rutelisten må dekke de modulene testene bruker. De listede rutene speiler rutene i
  `accessibility.spec.ts`; tjeneste-detaljsider deler komponenter med `/tjenester/` og dekkes
  indirekte. Hvis en fremtidig test introduserer en helt ny modul-sti, kan rutelisten trenge
  utvidelse — men dep-optimeringen er server-bred, så ett besøk per hovedrute trigger som
  regel hele oppdagelsen.
