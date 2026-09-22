# Spec: Stabiliser ustabile tester — rot-årsaker, ikke nye ventetriks

**Dato:** 2026-09-22
**Status:** Fullført 2026-09-22 (arkivert)
**Bakgrunn:** TODO.md-oppgaven «Stabiliser ustabile tester». Dette er sjuende runde med
«flaky tester» i prosjektet (se `docs/designs/archive/` og `docs/plans/archive/` fra
2026-02-22, -02-24, -02-26 ×2, -02-28, -03-08, -05-31, -06-14, -06-28). Denne spec-en
starter derfor med å etterprøve tidligere påstander før den foreslår noe.

## Problem / mål

Tre tester feiler last-avhengig. Én av dem har stoppet en deploy i CI.

| # | Test | Symptom | Hvor observert |
|---|------|---------|----------------|
| A | `tests/accessibility.spec.ts` → «Admin (/admin) skal ikke ha kritiske UU-feil» | `waitForLoadState('networkidle')` (linje 33) timer ut på 30 s | **CI** (kjøring `35022298679`, 2026-09-15, chromium, feilet også ved retry → blokkerte `build`/`deploy`/`update-lambda`) + lokalt under last |
| B | `tests/links.spec.ts` → «alle tjeneste-sider skal ha fungerende lenker» | `locator('.container a').evaluateAll` → «Execution context was destroyed, most likely because of a navigation» | Lokalt (dev-modus) under last, 2026-09-15. Består isolert |
| C | `src/__tests__/data-validation.test.ts` → «tannleger collection should include imageConfig in schema» | `await import('../content.config')` overskrider 5 s-timeouten | Lokalt i full `vitest`-kjøring under last (2026-09-21). Består isolert |

Målet er at hver av de tre får en fiks som **fjerner mekanismen** som gjør dem
last-avhengige — ikke lengre timeouts, ikke retries, ikke nye `wait*`-kall.

### Hva som *faktisk* er dokumentert i CI

Av de siste 60 `deploy.yml`-kjøringene har fem feilet. Fire av dem er `npm audit`
(ECONNRESET / svgo-sårbarhet) og én `build`. **Bare én kjøring har feilet på en test:
A, 2026-09-15.** B og C har aldri feilet i CI. Det betyr:

- A er den eneste som koster deployer. Den er høyest prioritert.
- B og C er lokale irritasjonsmomenter som koster tid i kvalitetsporten (`/commit` Step 2.5
  og 5a kjører full suite; én flake = ny runde på 5–10 min).

## Rot-årsaker (etterprøvd)

### A — `/admin` kan aldri nå `networkidle`

`/admin` laster `apis.google.com/js/api.js` og `accounts.google.com/gsi/client`
(`src/pages/admin/index.astro:25-26`). `src/scripts/admin-auth.js` gjør deretter ved
sidelast: `gapi.load('client')` → `gapi.client.init` → `gapi.client.load('drive','v3')` +
`load('sheets','v4')` (discovery-dokumenter fra `googleapis.com`) → eventuelt
`requestAccessToken({prompt:'none'})` (skjult iframe mot `accounts.google.com`).
`networkidle` krever 500 ms uten *noen* åpen forbindelse.

**Målt 2026-09-22** (3 kjøringer mot `dev:secure:fixtures`, `page.on('request')`-logg):
`load` inntreffer etter 0,7–1,9 s; `networkidle` først etter **2,7–3,6 s**. Hele
differansen er en *seriell* kjede av tredjepartskall — `apis.google.com` (4–5 kall) →
`accounts.google.com` (1–2) → `content.googleapis.com` (3 discovery-dokumenter) — der
hvert ledd venter på det forrige. Ventetiden er altså summen av tre eksterne verters
latens, ganger antall ledd. På en GitHub-runner med variabel nett (og Google som
kan strupe runner-IP-er) er 30 s ikke en trygg margin; 2026-09-15 rakk den ikke, to
ganger på rad.

**Hvorfor dette ikke ble fanget tidligere:** kommentaren i testen påstår at `networkidle`
«løser umiddelbart mot preview-bygg (CI)». Det var en antakelse fra 2026-06-14
(`185a044`), aldri verifisert for `/admin`. Warm-up-spec-en 2026-06-28 gjentok
antakelsen («CI er alltid 77/0») — og advarte samtidig, i sin egen begrunnelse for
`global-setup.ts`, mot nøyaktig denne mekanismen («`/admin` laster Google Identity
Services som holder gjentakende nettverksaktivitet, så `networkidle` kan være
tregt/upålitelig»). Advarselen ble brukt for warm-upen, men ikke for den asserterende
testen.

**Historikken viser ping-pong:** `networkidle` → `domcontentloaded` (`8bae670`, 2026-03-01,
«flaky») → `networkidle` igjen som dev-reload-workaround (`185a044`, 2026-06-14) →
warm-up i `globalSetup` gjorde workarounden overflødig (`24fc6b4`, 2026-06-28), men
`networkidle`-kallet ble stående. Det har ikke lenger noen funksjon i dev (warm-upen
dekker reloaden) og er skadelig i CI.

**Viktig avgrensning:** Dette er *ikke* samme flake som 2026-06-28-spec-en fikset. Den
handlet om Vite-reload i dev; denne handler om at `networkidle` er feil ventebetingelse
for en side med tredjepartsskript. Samme test, samme linje, ulik mekanisme.

### B — `evaluateAll` mot et dokument som byttes ut

Testen går gjennom hver tjeneste-side med `page.goto(link)` (venter kun på `load`) og
kjører så `locator('.container a').evaluateAll(...)`. Feilen betyr at dokumentet ble
navigert bort mellom `load` og evalueringen. Testen kjører lokalt mot `astro dev`, og
`tests/global-setup.ts` varmer `/tjenester/` men **ikke** en enkelt tjeneste-side
(`/tjenester/<id>/`). Et dev-server-utløst reload på første besøk til en ikke-oppvarmet
rute er dermed den kandidaten som passer alle observasjonene (lokalt, dev-modus, aldri i
CI, består 3/3 i ny kjøring rett etter — da er cachen varm).

Dette er en hypotese, ikke bekreftet: `[id].astro` importerer ingen komponent som er
unik for tjeneste-sidene, så en «new dependencies»-reoptimering er ikke gitt, og
2026-09-22 besto testen 4/4 under load 20 — men med *varm* Vite-cache. Planen inneholder
derfor et eksplisitt reproduksjonssteg (kald `node_modules/.vite`, under last) før fiksen
velges. Uansett utfall gjelder: testens egen struktur — mange
`goto` + `evaluateAll` i løkke uten å låse dokumentet — er skjør, og skal gjøres robust.

### C — testen importerer halve Astro for å sjekke et zod-skjema

`src/content.config.ts` importerer `glob` fra `astro/loaders`. Den importen drar inn
Astros content-layer-graf: **~230 ms i ren Node, ~780 ms inne i vitest** (målt
2026-09-22, varm cache). Isolert er det uproblematisk. I full kjøring med 8 workers på
8 kjerner, pluss ekstern last (Gradle-bygg på 6–20 i load average 2026-09-21), skaleres
780 ms lett forbi 5 s-timeouten. Ingen annen test i suiten har en så tung dynamisk import
inne i en `it`-blokk.

**Påstanden fra 2026-09-21 om at manglende `.astro/` var rotårsaken, er feil.** Kontrollert
retest 2026-09-22: `.astro/` fjernet fra primærtreet, load 2.0 → 1609/1609 grønt, inkl.
denne testen. Korrelasjonen dagen før (rødt i worktree uten `.astro/`, grønt i primærtre)
var last, ikke katalogen. Også kald sidecache er utelukket: `node_modules` kastet ut av
sidecachen (`posix_fadvise DONTNEED`, 19 882 filer) → isolert kjøring 1,31 s vs 1,24 s
varm. TODO.md-punktet rettes som del av oppgaven.

## Krav og akseptansekriterier

1. **A:** `tests/accessibility.spec.ts` inneholder verken `networkidle`- eller
   `load`-venting. Alle a11y-tester venter på deterministiske, lokale betingelser
   (`domcontentloaded` + `main` + alle `link[rel=stylesheet]` har `.sheet` +
   `document.fonts.ready`). Verifisert på to måter: (a) 7/7 på chromium *og* Mobile
   Safari, `--repeat-each=5`, mot **både** `dev:secure:fixtures` og `preview` (CI-stien) —
   chromium under kunstig CPU-last (6 × `yes`), Mobile Safari uten (se note under);
   (b) **mekanismetest**: et engangs-skript (ikke committet) som med `page.route`
   forsinker alle `*.google*`-svar med 35 s, skal få *gammel* test til å time ut og *ny*
   test til å bestå. CPU-last alene reproduserer ikke A (36/36 under load 21 den
   2026-09-22) — A er nett-bundet, så (b) er den egentlige verifikasjonen.

   *Note om Mobile Safari under last:* WebKit + axe er CPU-bundet — `goto` 3–4 s og
   `analyze()` 4–5 s per side allerede ved load 7 (chromium: 1–2 s + 1,5–2 s). Med fire
   WebKit-workere under load ~22 sprenger det 30 s-timeouten for **både** gammel og ny
   variant (13/14 mot 12/14 røde, samme betingelser). Det er uavhengig av ventelogikken og
   av mekanisme A, og ligger utenfor oppgaven (se non-goals og backlog-punkt).
2. **B:** `tests/links.spec.ts` består `--repeat-each=5` under samme last, med kald
   `node_modules/.vite`. Hvis reproduksjonssteget bekrefter dev-reload som årsak, skal
   `tests/global-setup.ts` varme minst én tjeneste-side. Uavhengig av det skal testen
   hente alle hrefs i ett `page.evaluate`-kall rett etter `goto` (ikke `locator.evaluateAll`
   som re-spør DOM-en) — og feilmeldingen ved brudd skal si *hvilken* side det gjaldt.
3. **C:** `data-validation.test.ts` mocker `astro/loaders` (`vi.mock('astro/loaders', …)`),
   så `import('../content.config')` er en ren zod-skjema-import. Verifisert: testens
   egen varighet < 100 ms isolert, og full `npm test` 3/3 grønn under kunstig last.
   Samme mock vurderes for `content.config.test.ts` (top-level await, ingen timeout, men
   samme unødvendige vekt). **C-variant funnet under verifisering:**
   `getSettings.test.ts` importerte `sync-data.js` (googleapis + sharp, ~0,6 s) inne i
   testkroppen og sprakk 5 s-timeouten under load 27 — samme mekanisme, samme fiks
   (mock av de fire tunge avhengighetene, som `sync-data.test.js` allerede gjør).
4. **Dokumentasjon:** kommentaren i `accessibility.spec.ts` som påstår at `networkidle`
   «løser umiddelbart i preview» fjernes; `global-setup.ts`-kommentaren oppdateres hvis
   ruter legges til; TODO.md-punktets feilaktige `.astro/`-påstand rettes ved arkivering.
5. **Ingen** timeout økes, ingen `retries` legges til, ingen `test.fixme`/`skip`.
6. Full kvalitetsport (`/commit` Step 2.5) grønn: 80 % branch coverage per fil er
   uberørt (kun testfiler endres), E2E 4 prosjekter grønne.

## Avgrensninger / non-goals

- **Ikke** bytte lokal E2E fra `astro dev` til `preview` (avvist i 2026-06-28, samme grunn:
  hot-reload er i bruk under utvikling).
- **Ikke** blokkere Google-skriptene i admin-testen med `page.route`. Det ville gjøre testen
  hermetisk, men den skanner da en side som ikke er den brukeren ser. Velges kun hvis
  krav 1 ikke kan innfris uten (se risiko i planen).
- **Ikke** røre `tests/csp-check.spec.ts`, som også bruker `networkidle`. Den har aldri
  flaket, besøker ikke `/admin`, og ligger utenfor oppgaven. Noteres som backlog-punkt.
- **Ikke** endre `playwright.config.ts` (`retries`, `workers`, timeouts).
- **Ikke** løse at WebKit + axe er CPU-bundet (4–5 s per skann) og timer ut under tung
  ytre last uansett ventelogikk. Egen sak: noteres som backlog-punkt.
- **Ikke** legge `astro sync` i `scripts/setup-worktree.sh` — hypotesen bak var feil.
- **Ikke** generell «test-herding» av andre spec-filer.

## Designvalg med begrunnelse

**A — deterministisk venting i stedet for `networkidle`.** Playwright-dokumentasjonen
fraråder `networkidle` for tester («rely on web assertions»). Det axe trenger er DOM og
stilark: `waitUntil: 'domcontentloaded'` gir parset DOM; `waitForSelector('main')` at
innholdet er der; en `waitForFunction` på at alle `link[rel=stylesheet]` har `.sheet`
at stilarkene er anvendt (color-contrast); `document.fonts.ready` at fontlasting ikke
påvirker målinger midt i skannet (fontene er selvhostet i `public/fonts/`). Ingen av disse
rører nett utover localhost.

Første utkast brukte `waitUntil: 'load'` i stedet for stilark-sjekken. Mekanismetesten
avviste det: `load` venter på *alle* subressurser, inkludert `<script async defer>` fra
`apis.google.com`/`accounts.google.com` — så også `load` timet ut med 35 s forsinkelse
på Google-svarene. Bare `domcontentloaded` er uavhengig av de eksterne skriptene.

Dev-reload-risikoen som `networkidle` opprinnelig skulle dekke, er allerede dekket av
`global-setup.ts`. Fjernes for *alle* a11y-tester, ikke bare admin — samme mekanisme kan
treffe `/kontakt/` (kartfliser via `/tiles/`-proxy) og `/galleri/` (bilder).

**B — robust evaluering + eventuelt utvidet warm-up.** Ett `page.evaluate` som returnerer
hele href-listen er atomisk mot dokumentet; `locator.evaluateAll` gjør et nytt
DOM-oppslag i en egen runde-tur. Warm-up av en tjeneste-side er billig (én ekstra `goto`
i `globalSetup`, dev-modus only) og fjerner reloaden hvis den er årsaken.

**C — mock av `astro/loaders`.** Testen sjekker at `collections.tannleger.schema` godtar
`imageConfig`. `glob`-loaderen er irrelevant for det. `vi.mock('astro/loaders', () => ({
glob: vi.fn(() => ({ name: 'glob-mock', load: async () => {} })) }))` gjør importen til en
ren TS-modul med zod-mocken som allerede er der. Alternativet — heve timeout — gjør
testen langsom-men-grønn, og lar lastfølsomheten stå.

### Forkastede alternativer

- **Heve `testTimeout`/`timeout`:** symptombehandling; last kan alltid overstige tallet.
- **`retries: 1` lokalt:** skjuler flaker i stedet for å fikse dem; koster tid hver gang.
- **`page.route`-blokkering av Google i A:** se non-goals.
- **`astro sync` i worktree-oppsett for C:** hypotesen er tilbakevist.
