# Fullførte oppgaver – Tenner og Trivsel

> Arkiv over ferdige oppgaver. Aktive oppgaver finnes i [TODO.md](TODO.md).


- [x] **Tannleger-siden: visuelt løft** ([plan](docs/plans/archive/2026-06-21-tannleger-visuelt-loft.md)) ([spec](docs/designs/archive/2026-06-21-tannleger-visuelt-loft.md))
  - Variant A «galleri-overlay»: portrett fyller kortet (3/4), gradient-scrim med navn/tittel alltid synlig, spesialitet glir inn på hover (pekerenheter) / alltid synlig på touch. Accordion (`<details>`) fjernet. Rutenett 2/3/4 kolonner, kapslet `max-w-[1000px]` og sentrert.
  - **Admin-paritet:** forhåndsvisningen i `admin-module-tannleger.js` gjenbruker nøyaktig samme kort-klasser (`.tannlege-kort/.tannlege-scrim/.tannlege-spec`) → identisk tekst-overlegg + hover-/fokus-/mobiloppførsel. `updatePreview()` forenklet til ny DOM (`#preview-name/title/spec`), gamle accordion-/no-desc-grener fjernet.
  - **CSS:** scrim via `color-mix(--color-brand-dark)`, hover-reveal av spesialitet kun under `@media (hover:hover) and (pointer:fine)` (a11y: innhold aldri låst bak hover; alltid i DOM). Design-guide §5.3 oppdatert (3/4 scrim, ikke sirkel).
  - **Designprosess:** Variant A valgt via interaktive UI-mockups (companion). Iterert på bildestørrelse/luft (kapslet grid, to rene rader) og bio-visning før spec.
  - **Verifisert:** vitest 1560 ✓ (`admin-module-tannleger.js` 84.9 % branch); Playwright a11y 28/28 ✓ mot `npm run preview` (dev:secure-feil var kjent dev-flake «Execution context destroyed», ikke ekte WCAG-brudd); `build:ci` ✓. Review-loop: CLEAN.

- [x] **setup-worktree.sh: robust utledning av `MAIN`** ([plan](docs/plans/archive/2026-06-21-setup-worktree-robust-main.md))
  - PR-review-funn (#399, Gemini): kjørt fra hovedrepoet ga `git rev-parse --git-common-dir` relativ `.git`; `${MAIN%/.git}` matcher ikke den bare strengen → `MAIN` ble `.git`, så `"$MAIN/src/..."` ble `.git/src/...` (feil relativ kilde) og kopieringen no-op-et stille. Reell impact lav (skriptet kjøres normalt kun fra worktree der git-common-dir er absolutt).
  - **Fiks** (`scripts/setup-worktree.sh`): `MAIN=$(cd "$(git rev-parse --git-common-dir)/.." && pwd)` — resolver alltid absolutt sti til hovedrepoet uansett kjørested. La til `mkdir -p src/content src/assets/galleri` så galleri-kopieringen (som svelger feil med `|| true`) ikke stille hopper over manglende målmappe.
  - **Verifisert:** `bash -n` ✓; kjørt fra worktree → `MAIN` peker korrekt på hovedrepo + «Worktree-oppsett fullført.»; demonstrert gammel vs. ny logikk fra hovedrepo (`.git/src` → absolutt sti). Review-loop: CLEAN (én minor doc-unøyaktighet om feilmekanismen rettet — gammel `MAIN` var `.git`, ikke tom streng).

- [x] **Norsk rettskriving i dokumentasjon** ([plan](docs/plans/archive/2026-06-14-norsk-rettskriving.md))
  - Småfiks fra PR-review (#367/#368), rent kosmetisk/konsistens — fem bokmål-rettelser i to filer
  - `docs/architecture/sikkerhet.md`: «scanner» → «skanner» (2×), «på root» → «i rotmappen», «begge `package-lock.json`» → «…-filene», «Nivå-forskjell» → «Nivåforskjell» (sammensatt ord), «Scheduled-workflow er» → «Scheduled-workflowen er» (bestemt form)
  - `TODO-archive.md`: «eget job» → «egen jobb» (anglisisme + kjønnsfeil: «jobb» er hankjønn → «egen»), «scanner» → «skanner»
  - Review-funn: planutkastet foreslo feilaktig «eget jobb»; rettet til «egen jobb» før implementasjon. Review-loop CLEAN, alle rettelser grammatisk verifisert.

- [x] **Fikse flaky tester (timing/mock-lekkasje)** ([plan](docs/plans/archive/2026-06-14-flaky-tester.md)) — iterasjon 2 etter Drive-uavhengighet
  - **galleri-lightbox.spec.ts:** erstattet `waitForLoadState('networkidle')` + manuell DOM-poke med `page.route` som leverer en deterministisk *aktiv* melding (datoer 2000→2100). Appen viser banneret via ekte `initBanner()`-kodesti; ingen kodesti re-skjuler det → ingen falsk positiv. Bevist: `--repeat-each=10` = 40/40 på alle 4 prosjekter.
  - **vitest.config.ts:** `clearMocks: true` mot call-historikk-lekkasje (nullstiller kun historikk, ikke `vi.mock`-implementasjoner). Full suite 1559/1559 — ingen fallout. `csp-check` (CI-ignored) og `mockReset`/`restoreMocks` (9-filers churn uten påvist gevinst) bevisst droppet etter avklaring.
  - **Accessibility-flake oppdaget under full-suite-verifisering:** axe-skann på `/tannleger/`+`/tjenester/` feilet («Execution context destroyed») under parallell last. Trace-analyse: dev-server-navigasjon midt i skann. **Bevist dev-only** — 70/70 grønn mot `npm run preview` (CI-stien). Tiltak: `astro.config.mjs` pre-bundler `marked`+`dompurify` i `optimizeDeps.include` (fjernet dep-optimaliserings-reload, dev-only, null prod-effekt); sjelden residual dev-race dokumentert i testkommentar — `networkidle` bevisst *ikke* gjeninnført.
  - ~~setViewportSize/Mobile Safari color-contrast~~ allerede løst i main; orphaned worktree forkastet.
  - **Verifisert:** vitest 1559 ✓ (branch 88.9 %); galleri-lightbox 40/40 ✓; full Playwright mot preview (CI-sti) 77 passed / 0 failed ✓. Review-loop: CLEAN.

- [x] **Drive-uavhengige tester (syntetiske fixtures)** ([plan](docs/plans/archive/2026-06-11-drive-uavhengige-tester.md))
  - Bakgrunn: hele E2E-suiten ble bygget fra live Google Drive (`npm run sync` → build → Playwright), så endring av Drive-innhold kunne knekke tester. Verre: deploy-artefakten ble bygget i e2e-jobben fra ekte Drive — sammenblanding av test- og deploy-bygg. Slo sammen tidligere backlog-oppgave 8.
  - **Fixture-datasett** (`tests/fixtures/`): syntetiske innstillinger/tannleger/galleri/prisliste/kontaktskjema-JSON, 3 tjenester, 1 alltid-aktiv melding, 8 minimale committede bildefiler. Åpenbart syntetiske navn.
  - **Seed-script** (`scripts/seed-test-fixtures.mjs`): kopierer fixtures → `src/content/` + `src/assets/` (tømmer mål, bevarer `.gitkeep`, idempotent). Nye scripts `seed:fixtures` + `dev:secure:fixtures`.
  - **Deploy-separasjon** (`deploy.yml`): e2e-jobben seeder fixtures + bygger KUN for testing (laster ikke opp artefakt); `build`-jobben bygger ALLTID fra ekte Drive (`npm run sync`) og leverer deploy-artefakten — for både push og repository_dispatch; hoppes over på PR. Fjernet sync-only service-account-secrets fra e2e (beholdt `PUBLIC_*` admin-build trenger). **Resultat: syntetiske data kan aldri deployes til prod.**
  - **Tester:** `data-validation.test.ts` validerer nå fixtures (deterministisk, ingen skips); `prisliste-print.spec.ts` asserterer kjent fixture-tannlegenavn. accessibility/seo/sitemap/links/galleri-lightbox verifisert strukturelt dekket av fixtures — ingen endring nødvendig.
  - **Verifisert:** Vitest 1559 ✓ (branch 88.9%), lint ✓, chromium-E2E 41/41 ✓; DoD-bevis: tømte `src/content` → re-seed → grønt. csp-hashes.json revertert (skal reflektere ekte-data-bygg). Review-loop: CLEAN.
  - Iterasjon 2 (egen backlog-post): rene flaky-fikser (galleri-lightbox networkidle→`page.route`, `clearMocks`-vurdering, orphaned Mobile Safari setViewportSize-fix).

- [x] **Konsolidering av arbeidsflyt (skills, hooks, memory)** ([plan](docs/plans/archive/2026-06-08-arbeidsflyt-konsolidering.md))
  - Gjorde TODO-oppgaveflyten selvgående og deterministisk — flyttet «hvordan/rekkefølge» fra ~10 feedback-minner inn i skills + hook, så håndhevingen ikke lenger hviler på at agenten husker
  - **todo-skill:** Fase 2 synker lokal main før worktree (med fallback-rebase når lokal main ligger foran origin); Fase 5 gjør TODO-arkivering til eksplisitt gate FØR `/commit`; Fase 6 delegerer all git-mekanikk til `/commit`
  - **commit-skill Step 5 «ship it»:** rebase på lokal main → `merge --ff-only` fra primær-tre (`git -C`) → `git review` → opprydding (`ExitWorktree` med `git worktree remove`-fallback). Rekkefølge merge-før-fjerning verifisert mot `ExitWorktree`-kontraktet (nekter ved commits ikke på opphavsbranch). Bygger på at `auto-pr.yml` auto-merger med `--rebase` (ikke squash)
  - **git-guard hook** (`.claude/hooks/git-guard.sh`, PreToolUse Bash): blokkerer rå `git push`, advarer ved `git commit` på main. Testet 6 tilfeller. Wiring i gitignorert `settings.local.json` (dokumentert i `.claude/hooks/README.md`)
  - **Deduplisering:** delt `_shared/reviewer-prompt.md` (commit Step 4.5 + review-loop) og `_shared/start-secure-server.sh` (dev:secure-boot, commit Step 2.5 + Step 5)
  - **Memory:** 10 → 6 feedback-minner (slått sammen git- og worktree-minner, slettet e2e-minne), MEMORY.md-indeks oppdatert, ingen døde lenker
  - Review-loop fant 2 Critical (ship-it-rekkefølge mot `ExitWorktree`) + flere Minor — alle fikset. Meta-tooling: 80%-coverage-porten gjelder ikke (ingen kjernekode endret)
  - Gjenstår som egen etterprosess: `/fewer-permission-prompts` (rører kun gitignorert settings)

- [x] **Bug: tab-rekkefølge — telefonnummer fokuserbart på stor skjerm** ([plan](docs/plans/archive/2026-06-07-tab-rekkefolge-telefon.md))
  - Telefonnummeret var en `tel:`-lenke med `lg:pointer-events-none` på stor skjerm — klikk var deaktivert, men elementet lå fortsatt i tab-rekkefølgen
  - Løsning: render to elementer per breakpoint — mobil = ekte `tel:`-lenke (`lg:hidden`), desktop = ikke-fokuserbart `<span>` (`hidden lg:inline`). Tre forekomster fikset: `TelefonKnapp.astro`, `Footer.astro`, `textFormatter.js` (telefon-autolenking i Kontakt)
  - `Button.astro`: ny additiv `interactive`-prop (`false` → `<span>` i stedet for `<a>`/`<button>`, ingen `href`)
  - Oppfølging: SVG-ikon trukket ut til egen `PhoneIcon.astro` (fjernet duplisering); href-gard på ikke-interaktiv Button
  - Ny E2E `tests/telefon-tab-rekkefolge.spec.ts` (desktop + mobil, 8/8 på fire prosjekter) + oppdaterte/nye `textFormatter`-tester; 1559 unit, alle filer ≥80% branch, build og audit grønn
  - Pushet via `git review` (rebaset på lokal main)

- [x] **Byggytelse: parallelliser galleri-bildeprosessering** ([plan](docs/plans/archive/2026-06-07-galleri-bildeprosessering-parallell.md))
  - `Galleri.astro`: lightbox-bildeløkka endret fra sekvensiell `for...of` til `Promise.all` over `sortert.map()` + rekkefølgebevarende rebuild av `indexById`/`lightboxImages`
  - Rekkefølge og indeksering bevart 1:1 (Promise.all garanterer rekkefølge); atferd verifisert mot fire fokuspunkter i review-loop (indeksrekkefølge, hopp over manglende bilder, width-clamping, JSON-escaping)
  - Gevinst er moderat — Astro køer Sharp-encodingen internt; parallelliteten gjelder per-fil `loader()`-metadatalesing. Skalerer med galleristørrelse (PR #369-review)
  - 1558 unit-tester, alle filer ≥80% branch, 69 E2E, build og audit grønn
  - Sidefunn: pre-eksisterende drift i `csp-hashes.json` (egen backlog-oppgave) — urelatert til denne endringen
  - Pushet via `git review` (rebaset på lokal main)

- [x] **Galleri-lightbox: robusthet, tilgjengelighet og sikkerhet** ([plan](docs/plans/archive/2026-06-07-galleri-lightbox-robusthet.md))
  - Oppfølging av PR-review (#369/#370) på `src/scripts/gallery-lightbox.js`
  - **Tastatur/fokus:** `keydown` flyttet fra `root` til `document` med modul-scoped handler-swap — Esc/piltaster virker uansett hvor fokus havner, uten lytter-lekkasje ved Astro view transitions
  - **Sikkerhet:** defense-in-depth `javascript:`-guard i `render()`; CodeQL-alert #4 (`js/xss-through-dom`) dismisset som falsk positiv (byggetids-data fra eier-kontrollert Sheets/Drive, `<img src>` eksekverer ikke skript)
  - **Robusthet:** null-guard for manglende DOM-barn + guard mot tom `e.touches` i `touchstart`/`touchmove`
  - **Review-oppfølging (PR #375, Gemini):** flyttet keydown-opprydning til toppen av `init()` (før tidlige return-er) — ellers lekket lytteren ved navigasjon til side uten lightbox; ny regresjonstest
  - CodeQL-alert #4 (`js/xss-through-dom`) dismisset som falsk positiv
  - 6 nye enhetstester (32 totalt), 93.15% branch coverage; lint, build og full E2E grønn
  - Merget til `origin/main` (PR #375 + oppfølgingsfiks)

- [x] **Galleri: «klikk for å vise større bilde»** ([plan](docs/superpowers/plans/archive/2026-06-05-galleri-lightbox.md)) ([spec](docs/superpowers/specs/archive/2026-06-05-galleri-lightbox-design.md))
  - Singleton `Lightbox.astro`-overlay med navigasjon (piler, piltaster, Esc, klikk-utenfor, swipe) — mobil + desktop
  - `gallery-lightbox.js` — vanilla JS-modul med idempotent `initGalleryLightbox()`, focus-trap, scroll-lås, fokus-retur
  - `getImage()` i `Galleri.astro` genererer webp-varianter for alle galleribilder; tiles omgjort til `<button data-lightbox-index>`
  - Dark-launch-mønster: commit 1–4 inert, kun aktiveringscommit (Task 5) endrer prod-oppførsel
  - 25 enhetstester — 88.23% branch coverage; lint og build grønn
  - Merget til `origin/main`

- [x] **Varsling ved supply chain-angrep** ([plan](docs/plans/archive/2026-06-02-supply-chain-varsling.md))
  - Dependabot alerts og automated security fixes verifisert aktivert via `gh api`
  - `scheduled-audit.yml` opprettet — kjører ukentlig `npm audit --audit-level=high` på root og lambda
  - Google OSV Scanner lagt til som egen jobb i samme workflow — skanner begge `package-lock.json` rekursivt, laster opp SARIF til GitHub Security-fanen
  - `docs/architecture/sikkerhet.md` oppdatert med avsnitt «Kontinuerlig varsling — scheduled audit»
  - Merget til `origin/main`

- [x] **Galleri-grid: alltid 2×2 eller 4×1** ([plan](docs/plans/archive/2026-06-02-galleri-grid.md))
  - Fjernet `md:grid-cols-3` fra `Galleri.astro` — grid hopper nå direkte fra 2 til 4 kolonner
  - Oppdatert `sizes`-attributt tilsvarende
  - Merget til `origin/main`

- [x] **Sjekk bildeoppløsning — bilder er hakkete** ([plan](docs/plans/archive/2026-06-01-bildeopplosning.md))
  - `widths`/`sizes`-props lagt til på `<Image>` i `Forside.astro`, `Galleri.astro` og `Tannleger.astro`
  - Astro genererer nå riktig `srcset` med flere størrelser — nettleseren velger optimal variant på HiDPI/stor skjerm
  - Merget til `origin/main` og deployet til prod

- [x] **Mobil: framsiden og meny ikke i sync** ([plan](docs/plans/archive/2026-05-31-mobil-framsiden-meny-sync.md))
  - `hidden lg:block`-wrapper lagt tilbake rundt `<Tjenester>` og `<Tannleger>` i `src/pages/index.astro`
  - Galleri `mobileHref` endret fra `/galleri/` til `/#galleri` i `src/components/Navbar.astro`
  - E2e-test (`accessibility.spec.ts`) oppdatert til å navigere via `/tjenester/` siden `#tjenester` er skjult på mobil-framsiden

- [x] **Ustabile E2E-tester: Mobile Safari color-contrast** ([plan](docs/plans/archive/2026-05-31-stabile-e2e-tester.md))
  - `accessibility.spec.ts:39` satte `setViewportSize({ width: 1280, height: 800 })` etter iPhone 14-viewport — ga hybridtilstand i WebKit som trigget sporadiske color-contrast-avvik
  - Fix: fjernet `setViewportSize`-kallet fra `tjeneste-sider`-testen

- [x] **Target-lengde på innstillinger med live teller** ([plan](docs/plans/archive/2026-05-31-settings-target-length.md))
  - Kolonne E i Innstillinger-arket leses som `targetLength` (streng, f.eks. `"130-160"` eller `"160"`)
  - `parseTargetLength()` parser formatet til `{ min, max }` — `undefined`/`null`/`0`/ugyldig → `null`
  - Live tegneller rendres under feltet (både `<input>` og `<textarea>`) med fargeklasse: grå (nøytral), gul (under min), grønn (innenfor), rød (over max)
  - Ingen teller i reorder-modus eller for innstillinger uten target
  - Nye CSS-tokens: `--color-admin-ok/warn/error` i `global.css`
  - TDD: 22 nye tester (admin-sheets + admin-module-settings), 1525/1525 grønne, ≥ 80% branch coverage

- [x] **Footer på prisliste-utskrift med tannlegenavn** ([plan](docs/plans/archive/2026-05-30-prisliste-print-footer.md))
  - `getCollection('tannleger')` i frontmatter, navn jointet med ` · ` (U+00B7)
  - `<div class="prisliste-footer-print">` med `tannleger.length > 0`-guard, skjult i screen, `position: fixed; bottom: 0` i print
  - `padding-bottom: 0.9cm` på `body` i print — unngår overlapp med siste prisrader
  - `background-color: white` på footer — hindrer innholdsbleed-through
  - Playwright-test (Chromium only, `emulateMedia({ media: 'print' })`) i `tests/prisliste-print.spec.ts`
  - Verifisert lokalt: 8 tannlegenavn vises korrekt i print-modus

- [x] **Redirects for legacy-URLer fra gammel nettside** ([plan](docs/plans/archive/2026-05-30-legacy-url-redirects.md))
  - Lagt til `?page=`-redirect-blokk i `cloudfront-trailing-slash.js` og `.mjs` — mapper kontakt/behandlingstilbud/trygdeordninger/omoss til nye URL-er og /index.html + /www/index.html til /
  - TDD: 11 nye tester, 47/47 grønne, 97% branch coverage
  - Verifisert i prod med curl — alle redirects svarer `301` med korrekt `location`-header

- [x] **Fiks GSI silent-refresh popup-feil i admin** ([plan](docs/superpowers/plans/archive/2026-05-24-gsi-popup-fix.md)) ([spec](docs/superpowers/specs/archive/2026-05-24-gsi-popup-fix-design.md))
  - Fjernet `silentLogin()` fra `hadRememberMe`-stien i `admin-init.js` — kallet skjedde uten brukergest og fikk GSI til å prøve `window.open()` som nettleseren blokkerte
  - Innloggingsskjermen vises nå umiddelbart med «Husk meg» forhåndskrysset; `silentLogin()` beholdes i `admin-api-retry.js` for midt-sesjon token-fornyelse
  - Fikk til en grundig code review med ingen gjenstående funn

- [x] **GDPR: Rydd opp i CSP frame-src for Google** ([plan](docs/plans/archive/2026-05-23-gdpr-csp-frame-src.md))
  - `www.google.com` fjernet fra `frame-src` — ingen identifisert bruk med GSI-biblioteket
  - `*.googleapis.com` wildcard beholdt — browser-test bekreftet at `content-sheets.googleapis.com` blokkeres med snevrere alternativ
  - GAPI runtime-injisert hash (`sha256-Ck+...`) lagt til `script-src` — fanges ikke av build-time hash-generator
  - CI (`update-cloudfront-csp.mjs`) oppdatert til å erstatte hele CSP-strengen automatisk ved deploy (alle direktiver, ikke bare `script-src`)

- [x] **GDPR: Gjør rettigheter og klagerett ubetinget synlig i personvern** ([plan](docs/plans/archive/2026-05-18-gdpr-rettigheter-ubetinget.md)) ([design](docs/superpowers/specs/archive/2026-05-18-gdpr-rettigheter-ubetinget-design.md))
  - Rettighetsavsnittet (innsyn, retting, sletting, klage til Datatilsynet) ble flyttet ut av den betingede `visKontaktPersonvern`-blokken i `personvern.astro`
  - Teksten justert fra «av opplysningene» til «av opplysninger vi behandler om deg»
  - Vises nå alltid, uavhengig av om kontaktskjemaet er aktivt

- [x] **GDPR: Avklar og dokumenter CloudFront access logging** ([plan](docs/plans/archive/2026-05-18-gdpr-cloudfront-access-logging.md))
  - Verifisert via AWS CLI: begge CloudFront-distribusjoner (prod + test) har logging deaktivert
  - Lagt til defensiv setning i `src/pages/personvern.astro` som eksplisitt bekrefter at server-side logging ikke er aktivert

- [x] **IndexNow-støtte (Bing)** ([plan](docs/plans/archive/2026-05-18-indexnow.md))
  - Nøkkelfil (`{key}.txt`) genereres i deploy-jobben og landes i S3 via ordinært sync-steg
  - IndexNow POST sendes til `api.indexnow.org` etter CloudFront-invalidering med alle URL-er fra `sitemap-0.xml`
  - `INDEXNOW_KEY` GitHub Secret satt — begge steg skippes gracefully hvis secret mangler
  - Guard for 10 000 URL-grense og manglende sitemap-fil

- [x] **Hardening av setup-response-headers-policy.mjs** ([plan](docs/plans/archive/2026-05-14-setup-response-headers-hardening.md))
  - `unsafe-inline`-fallback fjernet — kaster nå `FatalError` ved tom `scriptHashes`
  - Forklarende feilmelding ved manglende `csp-hashes.json` (ENOENT → instruksjon om `npm run build`)
  - `ensurePolicy()` genuint idempotent — sammenligner eksisterende CSP og oppdaterer ved avvik

- [x] **Rett opp Lambda IP-deteksjon i sikkerhetsplan** ([plan](docs/superpowers/plans/archive/2026-05-14-fiks-lambda-ip-deteksjon.md))
  - `x-forwarded-for` får nå prioritet over `sourceIp` i rate-limiting — CloudFront-noden deler ikke lenger bucket med alle brukere
  - Sikkerhetsplanen steg 3.4 oppdatert med FUNN (HIGH) og forklaring
  - Ny test verifiserer at `x-forwarded-for` brukes når begge headere er satt

- [x] **CloudFront redirect-fiks — query-string og doble redirects** ([plan](docs/plans/archive/2026-05-14-cloudfront-redirect-fixes.md))
  - `buildQuerySuffix()` bevarer UTM-parametere og andre query-strings ved www-redirect
  - www-redirect beregner nå endelig mål-URI (host + trailing-slash) i én redirect i stedet for to
  - 9 nye tester dekker query-string-bevaring, multi-verdi-params og kombinerte tilfeller

- [x] **Utvid grep-scope for `repository_dispatch` i sikkerhetsplan**
  - Grep-kommandoen i `docs/plans/2026-05-14-helhetlig-sikkerhetsgjennomgang.md` (linje 114) utvidet til å søke alle filtyper, ikke bare JS/TS
  - Ny kommando: `grep -rn "repository_dispatch" . --exclude-dir={node_modules,.worktrees,.claude}`

- [x] **AWS infrastruktur som kode** ([plan](docs/plans/archive/2026-05-06-aws-infrastruktur-som-kode.md))
  - 6 idempotente setup-scripts: `setup-s3.mjs`, `setup-dynamodb.mjs`, `setup-cloudfront-functions.mjs`, `setup-response-headers-policy.mjs`
  - CF Function `strip-tiles-prefix` reddet fra AWS til kode (`cloudfront-strip-tiles-prefix.js`)
  - Deprecated scripts fjernet: `deploy-cloudfront-function.mjs`, `setup-admin-cloudfront-function.mjs`
  - Komplett arkitekturdokumentasjon med oppsettssteg: `docs/architecture/aws-infrastruktur.md`
  - Gjenstår manuelt: test-distribusjonen bruker fortsatt deprecated `add-index-html` CF Function (se arkitekturdok)

- [x] **Fjern deprecation-advarsel: apple-mobile-web-app-capable**
  - Lagt til `<meta name="mobile-web-app-capable" content="yes">` i `src/pages/admin/index.astro`
  - Apple-taggen beholdt for iOS-bakoverkompatibilitet

- [x] **Gå i produksjon** ([plan](docs/plans/archive/2026-02-28-cloudfront-prod-komplett.md))
  - Lambda-origin + `/api/kontakt`-behavior lagt til prod-distribusjon via AWS CLI
  - CloudFront Function `add-index-html` utvidet med `?page=`-redirects fra gammel side
  - Response Headers Policy (CSP, HSTS, X-Frame-Options) tilknyttet alle behaviors
  - Custom error responses (403→404, 404→404) lagt til prod-distribusjon
  - Prod-deploy og CloudFront-invalidering aktivert i `deploy.yml`
  - SES-domene `tennerogtrivsel.no` verifisert med DKIM i eu-north-1
  - Alle 6 domener live: HTTPS, sikkerhetsheadere, cache-control og redirects verifisert

- [x] **llms.txt — AI-lesbar nettstedsbeskrivelse** ([plan](docs/plans/archive/2026-04-25-llms-txt.md))
  - `generate-llms.js` med `generateLlmsTxt` og `generateLlmsFullTxt` — rene funksjoner, testbare
  - `/llms.txt` (kortversjon med tjenester, tannleger, lenker) og `/llms-full.txt` (komplett med tjeneste-body og prisliste) som Astro API-ruter
  - 22 enhetstester, 80% branch coverage

- [x] **CDN til npm — avhengighetsreduksjon** ([plan](docs/superpowers/plans/archive/2026-04-22-cdn-til-npm.md))
  - EasyMDE, Flatpickr og Font Awesome fjernet fra CDN — nå installert som npm-pakker og versjonsstyrt via `package-lock.json`
  - npm-imports i `admin/index.astro` med `window.EasyMDE`/`window.flatpickr` for bakoverkompatibilitet
  - EasyMDE toolbar erstattet med inline SVG-ikoner — Font Awesome ikke lenger nødvendig
  - EasyMDE CSS-override flyttet fra `<style is:global>` i Astro-filen til `global.css`

- [x] **Bug i Takstlista** — Opp/ned-sortering rotet til rekkefølgen ved gjentatte bytter uten reload
  - `reorderPrislisteItem` sorterte ikke items etter `.order` før `findIndex`, slik at feil nabo ble valgt etter første bytte
  - Samme bug fikset i `reorderGalleriItem` samtidig
  - Mønster: `[...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))` — identisk med `reorderPrislisteKategori`

- [x] **Bildeutsnitt for bilder på siden** ([plan](docs/superpowers/plans/archive/2026-04-24-bildeutsnitt-layout.md))
  - Crop-sliders (zoom, fokuspunkt X/Y) flyttet fra venstre skjemakolonne til høyre kolonne under forhåndsvisningen i galleri-editoren
  - Samme mønster som tannleger-editoren — sliders er nå synlige ved siden av preview under justering

- [x] **Tannleger-bilde på framsiden valgfritt** ([plan](docs/superpowers/plans/archive/2026-04-22-tannleger-bilde-optional.md))
  - Tannleger-seksjonen på framsiden skjules helt når fellesbilde ikke er satt i admin
  - Navbar-lenken peker til `/#tannleger` (anchor) når bilde finnes, `/tannleger` (full side) ellers
  - `showTannleger` beregnes i `Layout.astro` og sendes som prop til `Navbar`

- [x] **Vite version warning**
  - Lagt til `"vite": "^7"` i `overrides` i package.json for å låse alle avhengigheter til Vite 7
  - Fjernet konflikt mellom astro 6 (krever vite ^7) og @tailwindcss/vite / vitest (trakk inn vite 8)

- [x] **Stram inn IAM-tillatelser for githubTestDeploy** ([spec](docs/superpowers/specs/archive/2026-04-03-iam-githubTestDeploy-design.md)) ([plan](docs/superpowers/plans/archive/2026-04-03-iam-githubTestDeploy.md))
  - Fjernet `AWSLambda_FullAccess`, `AmazonS3FullAccess`, `CloudFrontFullAccess` og gammel `lambda-deploy-kontakt-form` inline policy
  - Erstattet med én smal inline policy `CICDDeploy`: STS, S3 (test + prod), CloudFront, Lambda
  - Lagt til `sts:GetCallerIdentity` som var årsaken til at tidligere forsøk feilet

- [x] **Rydd opp «epost»-rester i kodebasen** ([spec](docs/superpowers/specs/2026-04-02-fjern-epost-design.md)) ([plan](docs/superpowers/plans/2026-04-02-fjern-epost.md))
  - Fjernet `email`/`showEmail`-innstillingen og `EpostKnapp`-komponenten
  - `ContactButton` (nå `MessageButton`) internaliserer `aktiv`-sjekken
  - Fjernet fra `getSettings.ts`, `buildSchema.ts`, `sync-data.js`, `personvern.astro`
  - Oppdaterte tester: `buildSchema.test.ts`, `content.config.test.ts`, `admin-module-settings.test.js`, `admin-dashboard.test.js`

- [x] **Kontaktskjema** ([spec](docs/superpowers/specs/archive/2026-03-28-kontaktskjema-design.md)) ([plan](docs/superpowers/plans/archive/2026-03-28-kontaktskjema.md))
  - ContactModal med feltene tema, navn, telefon, e-post og melding
  - Sentrert modal (desktop) / bunnark (mobil)
  - Tema-liste, tittel og tekst administreres via Google Sheet + admin-blokk (KontaktSkjema-fane)
  - AWS Lambda + SES for utsending — mottaker-e-post som Lambda-miljøvariabel, aldri eksponert i frontend
  - Honeypot + rate limiting via DynamoDB mot spam
  - SES identity policy dokumentert og satt opp
  - Fjernet gammel epost-visning (EpostKnapp → MessageButton)
  - Personvernerklæringen oppdatert

- [x] **ContactModal forbedringer**
    - Reset skjema, suksessmelding og feilmelding ved lukking (via `close`-event)
    - Sentrert dialog på alle skjermstørrelser — fjernet bunn-ark-mønster
    - Meldingsfelt økt til 5 rader med auto-vekst (`field-sizing: content`)

- [x] **AWS-oppsett for kontaktskjema (manuelt)**
    - Lambda opprettet, kode lastet opp, Function URL aktivert
    - IAM inline policy for DynamoDB og SES lagt til
    - DynamoDB-tabell `kontakt-rate-limit` opprettet med TTL
    - SES-domene verifisert, sending bekreftet fungerende
    - CloudFront origin og behavior for `/api/kontakt` konfigurert
    - GitHub Secrets `LAMBDA_KONTAKT_ARN` og `ORIGIN_VERIFY_SECRET` lagt til
    - Google Sheet `KontaktSkjema`-fane opprettet

- [x] **Støtte for ett telefonnummer til klinikken** ([plan](docs/superpowers/plans/archive/2026-03-24-ett-telefonnummer.md)) ([spec](docs/superpowers/specs/archive/2026-03-24-ett-telefonnummer-design.md))
    - Fjernet `phone2`-feltet fra hele kodebasen (innstillinger.json, getSettings.ts, sync-data.js, admin-module-settings.js, Kontakt.astro, Footer.astro)
    - Kontakt-kort viser nå kun ett telefonnummer, footer likeså

- [x] **Anker-scroll stopper for langt oppe ved navigasjon fra underside** ([plan](docs/plans/archive/2026-03-22-anker-scroll-fix.md))
    - CSS-fallback `scroll-margin-top: var(--nav-total-height, 1.5rem)` → `4rem` i `.section-container`
    - Re-scroll til hash-anker i `initLayoutHelper()` etter første `updateLayout()` — retter timing-race mot nettleserens native hash-scroll
    - `try/catch` rundt `querySelector` for å håndtere ugyldig CSS-selektor i URL-fragment
    - 5 nye tester, 100% branch coverage på `layout-helper.js`

- [x] **Admin-tilgangskontroll — vis «ingen tilgang» uten gyldig Google-token** ([plan](docs/plans/archive/2026-03-21-admin-tilgangskontroll.md)) ([spec](docs/designs/archive/2026-03-21-admin-tilgangskontroll-design.md))
    - `showState()` styrer fire eksklusive UI-tilstander (login/loading/dashboard/no-access)
    - `handleAuth` viser spinner → verifiserer med `enforceAccessControl` → dashboard eller ingen-tilgang
    - `enforceAccessControl` returnerer `false` i stedet for redirect ved ingen tilgang
    - `updateUIWithUser` innsnevret til kun nav-pill — container-synlighet flyttes til `showState`
    - `#loading-container` og `#no-access-container` lagt til i `admin/index.astro`
    - 18 nye tester, 89.56%/83.07% branch coverage

- [x] **Schema.org strukturerte data (JSON-LD)** ([plan](docs/superpowers/plans/2026-03-18-schema-org.md)) ([design](docs/superpowers/specs/2026-03-18-schema-org-design.md))
    - Ny `buildSchema`-utility med full TDD (24 tester, 83% branch coverage)
    - Datadriven: navn, adresse, åpningstider, geo, tjenester hentes fra settings og content-collection
    - `SchemaOrg.astro` forenklet til ren rendering, `Layout.astro` kaller `buildSchema`

- [x] **Prisliste mobil-layout — bedre lesbarhet** ([plan](docs/plans/archive/2026-03-10-prisliste-mobil-spacing.md))
    - Lagt til dot-leader (prikket linje) mellom behandlingsnavn og pris i web-layouten
    - Garantert minimum-avstand (1.5rem) mellom tekst og pris via flex gap + min-width
    - Prisen brytes aldri (`flex-shrink: 0`, `whitespace-nowrap`)
    - Print-layout uendret

- [x] **Bildejustering for tannleger — bedre layout på desktop**
    - Flyttet bildeutsnitt-slidere fra venstre kolonne til høyre, rett under forhåndsvisningen

- [x] **Oppgrader til Astro 6** ([plan](docs/plans/archive/2026-03-10-astro-6-oppgradering.md))

- [x] **Sorter "Våre tjenester"-lenker på tjenestesider**
    - Endret sortering i `/tjenester/[id]` fra alfabetisk til priority-basert (samme som hovedsiden og forsiden)
    - Én linje endret i `src/pages/tjenester/[id].astro`

- [x] **Kjør simplify på hele prosjektet** ([plan](docs/plans/archive/2026-03-09-simplify-hele-prosjektet.md))
    - 6 batches gjennomført: admin-moduler, admin-infra, admin UI-hjelpere, frontend-scripts, Astro+CSS, build/config
    - CSS-konsistens: ~30 nye CSS-token-klasser, fjernet hardkodede Tailwind-farger
    - Kodekvalitet: ensureSheet, swapOrder, getBusinessHours, buildImageStyle, cleanupUnusedFiles, getImageFolderId, getOptionalSheetValues
    - HTML: fjernet nestede `<main>`-tags, SectionHeader med as-prop
    - Ytelse: decorated array sort, rAF-debouncing, hoistet DOM-queries, parallellisert API-kall
    - parseInt radix 10 på alle steder, .find() erstatter .filter()[0]
    - 1203 tester bestått, 100% coverage på nye utilities

- [x] **Kollapserbare kategorier i prisliste-admin** ([plan](docs/plans/archive/2026-03-09-kollapserbare-kategorier.md)) ([design](docs/plans/archive/2026-03-09-kollapserbare-kategorier-design.md))
    - Chevron-ikon i kategori-headers med klikk for kollaps/ekspander
    - Global "Kollaps/Ekspander alle"-knapp i topplinjen
    - 7 tester dekker funksjonaliteten

- [x] **Optimalisere responstid i admin-moduler** ([plan](docs/plans/archive/2026-03-09-optimistisk-reorder.md)) ([design](docs/plans/archive/2026-03-09-optimistisk-reorder-design.md))
    - Optimistisk DOM-swap med animasjon, API i bakgrunn, revert ved feil
    - Ny felles `admin-reorder.js`-modul med `animateSwap()`, `disableReorderButtons()`, `enableReorderButtons()`, `updateReorderButtonVisibility()`
    - Berørte moduler: Prisliste (rader + kategorier), Galleri, Tjenester, Settings

- [x] **Redirect fra gamle sider til nye** ([plan](docs/plans/2026-02-28-cloudfront-prod-komplett.md#fase-5-redirects-fra-gammel-side))
    - Oppgaven er dekket som fase 5 i CloudFront-planen
    - URL-kartlegging, CloudFront Function-kode og verifiseringssteg dokumentert der
    - Redirects: `?page=kontakt` → `/kontakt`, `?page=behandlingstilbud` → `/tjenester`, `?page=trygdeordninger` → `/tjenester`, `?page=omoss` → `/tannleger`, `/index.html` → `/`

- [x] **Fiks layout-hopp på admin-sider** ([plan](docs/plans/archive/2026-03-09-fiks-layout-hopp-admin.md))
    - Dashboard-korttellere: reservert plass med `min-height: 1lh` og opacity-fade i stedet for hidden-toggle
    - Modul-innlasting: ny `smoothReplaceContent()`-funksjon animerer høyde ved skeleton → innhold-bytte
    - Brødsmuleteller: samme opacity-fix som korttellere

- [x] **Flytt secrets fra workflow-nivå til jobb-nivå i deploy.yml**
    - Fjernet workflow-level `env`-blokk med Google-secrets
    - Lagt til secrets som jobb-level `env` på `e2e-tests` og `build` (de eneste som trenger dem)
    - `unit-tests` og `deploy` har nå ingen unødvendige secrets

- [x] **Oppdater defaults-innstillinger fra Google Sheet**
    - HARD_DEFAULTS i getSettings.ts oppdatert med verdier fra Google Sheets
    - Koordinater, åpningstider (splittet til 5 dager), og forenklede titler synkronisert
    - businessHours3–5 lagt til i HARD_DEFAULT_KEYS i sync-data.js


- [x] **Legg til hjelpetekst på alle innstillinger i admin** ([plan](docs/plans/archive/2026-03-09-admin-hjelpetekst.md))
    - Hjelpetekst lagt til i alle 6 admin-moduler: settings, tjenester, meldinger, tannleger, bilder, prisliste
    - businessHours3–5 lagt til i SETTING_HINTS (manglet fra Google Sheets-data)
    - Alle hints følger eksisterende mønster: `<p class="text-xs text-admin-muted-light">Vises på: ...</p>`



- [x] **Begrens workflow-kjøring for fork-PRer**
    - Lagt til `github.event.pull_request.head.repo.fork != true` på `unit-tests` og `e2e-tests` jobbene
    - Fork-PRer kjører ingen CI — sparer CI-minutter og unngår feilende kjøringer uten secrets



- [x] **Admin-lenke på framsiden for innlogget bruker**
    - Tannhjul-ikon i navbaren (desktop + mobil) som vises når bruker er innlogget
    - Client-side sjekk via `getStoredUser()` fra admin-auth.js
    - Kun `Navbar.astro` endret

- [x] **Test-review og forenkling** ([design](docs/plans/archive/2026-03-09-test-review-design.md), [plan](docs/plans/archive/2026-03-09-test-review.md))
    - Auto-mocks (`__mocks__/dompurify.js`, `__mocks__/marked.js`) erstatter 14+ inline mocks
    - Delt test-helpers (`test-helpers.js`) med `mockAdminDialog()`, `createMockAutoSaver()`, `setupModuleDOM()`
    - `it.each`-konsolidering i 8+ testfiler (toggle-tester, feilhåndtering, slugify, format-pris)
    - Test-guide (`docs/guides/test-guide.md`) basert på Kent Beck's Test Desiderata
    - CLAUDE.md oppdatert med test-guide referanse
    - Netto: ~400 linjer fjernet, 1163 tester bestått, alle filer ≥80% branch coverage

- [x] **Oppdater hjelpetekst for åpningstider i admin**
    - Lagt til formatveiledning «Dag(er): HH:MM - HH:MM» i SETTING_HINTS for businessHours1 og businessHours2
    - Admin ser nå «Vises på: Kontakt, footer — format: «Dag(er): HH:MM - HH:MM»» under feltet

- [x] **Bedre linjebrekk-kontroll for sentralbord-tekst under telefon (kontakt)**
    - Sentralbord-teksten satt til `text-xs` for å unngå uheldige linjebrekk
    - `text-wrap: pretty` lagt til på `.card-text` for bedre brekk-valg generelt
    - Fjernet `md:grid-cols-2` fra kontakt-grid — kort går nå rett fra 1 til 3 kolonner (ingen 2+1 layout)

- [x] **Seksjons-titler på framsiden bommer ved aktiv melding** ([plan](docs/plans/archive/2026-03-09-seksjons-titler-scroll-offset.md))
    - Erstattet statiske `scroll-mt` verdier med dynamisk `scroll-margin-top: var(--nav-total-height)` i `.section-container`
    - Fjernet `scroll-mt-16 lg:scroll-mt-20` overrides fra Forside.astro
    - Ankerlenker scroller nå korrekt uavhengig av om InfoBanner er aktiv

- [x] **Pen formatering av åpningstider i kontakt og footer**
    - Parset "Dag: Tid"-format til strukturert to-kolonne grid (`<dl>` med CSS grid)
    - `tabular-nums` for jevn sifferbredde på klokkeslett
    - Kontakt-kort: sentrert grid med `justify-center` og `gap-x-6`
    - Footer: kompakt grid med `w-fit` og `gap-x-2`

- [x] **Gjennomgang av admin-seksjonsnavn** ([plan](docs/plans/archive/2026-03-08-admin-seksjonsnavn.md))
    - Oppdatert alle 6 seksjonskort med nye kortnavn og beskrivelser (tannklinikk-metafor)
    - Oppdatert modultittel-mapping i admin-init.js
    - Oppdatert tilhørende tester

- [x] **loadAllServices mangler withRetry**
    - Wrappet `listFiles` og `getFileContent`-kall i `loadAllServices()` med `withRetry` og `refreshAuth`
    - Importert `withRetry` fra `admin-api-retry.js` og `getRefreshAuth` fra `admin-editor-helpers.js`
    - Lagt til tester som verifiserer withRetry-integrasjonen
    - Kilde: Gemini Code Assist, PR #135

- [x] **Tomme catch-blokker i prisliste/admin**
    - Lagt til `console.error` i 2 stille catch-blokker: `admin-dashboard.js` (thumbnail-lasting) og `admin-module-tjenester.js` (prioritet-beregning)
    - De 3 catch-blokkene i `admin-module-prisliste.js` hadde allerede `console.error`
    - Kilde: Gemini Code Assist, PR #144/#149

- [x] **Ustabil sortering i prisliste** ([plan](docs/plans/archive/2026-03-08-ustabil-sortering-prisliste.md))
    - Lagt til tiebreaker i `prisliste.astro` (sorterer på `tjeneste`-navn ved lik `order`)
    - Lagt til tiebreaker i `admin-dashboard.js` `reorderPrislisteKategori` (sorterer på `kategori`-navn ved lik `order`)
    - Admin-modulen (`admin-module-prisliste.js`) hadde allerede tiebreaker med `indexOf()`
    - Ny test for tiebreaker-oppførsel i admin-dashboard
    - Kilde: Gemini Code Assist, PR #148

- [x] **Print-knapp: legg til admin-sjekk**
    - `?print=1` URL-parameter trigget `window.print()` for alle besøkende
    - Løst: Sjekker `admin_google_token` i localStorage/sessionStorage før `window.print()` trigges
    - Kilde: Gemini Code Assist, PR #144/#145

- [x] **formatPris: håndter trim() og string-input**
    - Lagt til `.trim()` på string-input for å håndtere whitespace
    - Lagt til sjekk for numeriske strenger (f.eks. `'1234'`) fra Google Sheets — konverteres til tall med `kr`-prefiks
    - 2 nye tester, 100% branch coverage
    - Kilde: Gemini Code Assist, PR #150

- [x] **Fiks package-lock.json pakkenavn**
    - Pakkenavnet var endret fra `tennerogtrivsel2` til `prisliste-kategori-sortering` i PR #149
    - Rettet i både `package.json` (var tomt) og `package-lock.json`
    - Kjørt `npm install --package-lock-only` for å verifisere konsistens

- [x] **XSS-fix i admin-module-tannleger.js**
    - `previewSrc` fra Google Sheets ble injisert i `img src` via innerHTML uten sanitering
    - Fikset med `escapeHtml(previewSrc)` i src-attributtet (linje 108)
    - Lagt til XSS-test som verifiserer at escapeHtml kalles med previewSrc
    - Kilde: Gemini Code Assist, PR #126

- [x] **Grundig sikkerhetssjekk av prosjektet** ([plan](docs/plans/archive/2026-03-07-sikkerhetssjekk.md))
    - OWASP Top 10-gjennomgang av hele kodebasen
    - Fikset: Drive API query-escaping (A03), path traversal i sync-data.js (A08), silentLogin race condition (A07), manglende BILDER_FOLDER i tilgangskontroll (A01)
    - Dokumentert nye aksepterte risikoer (L7, L8) i sikkerhet.md

- [x] **Forbedre sortering i prisliste-admin** ([plan](docs/plans/archive/2026-03-08-prisliste-sortering-ui.md))
    - Flyttet item-reorder-knapper fra venstre til høyre side (ved edit/delete), konsistent med tjenester og galleri
    - Kategori-sortering forblir i headeren til venstre
    - Eksporterte ICON_EDIT/ICON_DELETE fra admin-dashboard.js, inlinet knapper i stedet for renderActionButtons

- [x] **Landscape print av prisliste med to kolonner** ([plan](docs/plans/archive/2026-03-08-landscape-print-prisliste.md))
    - Landscape-orientering med eksplisitt to-kolonners CSS grid (CSS columns var upålitelig i print)
    - Ny `findColumnSplitIndex()` utility for optimal fordeling av kategorier (100% coverage)
    - Kompakt header på én linje, tilpassede fontstørrelser for å få alt på én side
    - Admin popup-bredde økt til 1100px for landscape
    - Lik fontstørrelse på behandling og pris (web + admin)

- [x] **Pen formatering av ulike pristyper i prislisten** ([plan](docs/plans/archive/2026-03-08-formatering-pristyper.md))
    - Flyttet `formatPris()` fra inline i prisliste.astro til `src/utils/format-pris.js`
    - Støtter 5 prisformater: heltall, prisområde (X–Y), pr time, +tekn., m/tannteknikk
    - Alle får "kr"-prefiks og tusen-mellomrom, områder får typografisk tankestrek (–)
    - 7 tester, 100% branch coverage

- [x] **Sortering av prisliste-kategorier (admin)** ([plan](docs/plans/archive/2026-03-08-prisliste-kategori-sortering.md))
    - Opp/ned-knapper per kategori-header i admin-prisliste for å endre kategori-rekkefølge
    - Nytt Sheets-ark `KategoriRekkefølge` (kategori + order)
    - `reorderPrislisteKategori()` i admin-dashboard.js — swapper order mellom naboer
    - Nye kategorier auto-legges til i KategoriRekkefølge ved lasting
    - `sync-data.js` synker kategoriOrder til prisliste.json
    - `prisliste.astro` sorterer kategorier etter rekkefølge (fallback: alfabetisk)
    - 7 nye tester, 88.95% branch coverage på admin-dashboard.js

- [x] **Sortering av elementer i prisliste-kategorier (admin)** ([plan](docs/plans/archive/2026-03-08-prisliste-sortering.md))
    - Ny kolonne E (`Rekkefølge`) i Prisliste-arket — numerisk `order`-felt
    - `getPrislisteRaw` leser A:E og returnerer `order` (parseInt, fallback 0)
    - `updatePrislisteRow` og `addPrislisteRow` skriver order til kolonne E
    - `reorderPrislisteItem()` i admin-dashboard.js — swapper order mellom to naboer (som reorderGalleriItem)
    - Opp/ned-knapper per rad i admin-prisliste-UI, synlig for alle unntatt første/siste
    - Nye rader legges til sist i kategorien (order = max + 1)
    - Kategoribytte setter elementet sist i ny kategori
    - `sync-data.js` leser og eksporterer order-felt
    - `prisliste.astro` sorterer elementer per kategori etter order
    - 80%+ branch coverage på alle berørte filer

- [x] **Skjul «Juster prisene»-knapp uten Sheet-tilgang** ([plan](docs/plans/archive/2026-03-08-skjul-prisliste-knapp.md))
    - Prisliste-kortet skjules i admin-dashboardet når brukeren mangler Google Sheet-tilgang
    - Utvidet `enforceAccessControl()` med `{ id: 'prisliste', resource: config.SHEET_ID, card: 'card-prisliste' }`
    - 3 nye tester + 6 oppdaterte eksisterende tester

- [x] **Admin-panel: Kompakt logg-ut-knapp med tooltip**
    - Endret bruker-pillen til å vise kun fornavn i stedet for fullt navn
    - Tooltip (title) settes dynamisk til «Logg ut [hele navnet]»
    - Email brukes som fallback hvis navn mangler

- [x] **Prisliste-admin: «+»-knapp per kategori for raskere opprettelse av ny rad**
    - Kompakt «+»-knapp i kategori-headeren i prislisteoversikten
    - Klikk åpner ny-rad-editor med forhåndsutfylt kategori og fokus på behandlings-feltet

- [x] **Fiks prisliste-admin (flere problemer)** ([plan](docs/plans/archive/2026-03-07-fiks-prisliste-admin.md))
    - Custom kategori-dropdown med søk/opprett ny (erstatter native datalist)
    - Autosave deaktivert for nye rader — eksplisitt Opprett/Avbryt-knapper
    - "Tilbake til listen"-knapp i redigeringsvisningen for eksisterende rader
    - "Sist oppdatert" (måned og år) vises på prisliste-siden

- [x] **Prisliste-admin: Samkjør rediger/slett-ikoner med resten av admin**
    - Byttet inline SVG (14x14) til `renderActionButtons()` med `ICON_EDIT`/`ICON_DELETE`-konstanter (16x16)
    - Slett-knapp bruker nå `admin-icon-btn-danger` (rød) i stedet for grå
    - Prisliste-layout endret til kategori-kort med linje-rader (ligner offentlig prisliste-side)
    - Behandling til venstre, pris og action-knapper alignert til høyre

- [x] **Forenkle UI på admin-siden — kompaktere action-knapper** ([plan](docs/plans/archive/2026-03-07-kompakte-action-knapper.md))
    - Erstatt teksttunge «Legg til»-knapper med kompakte «+»-ikonknapper (btn-primary stil)
    - Gjelder action-knappene oppe til høyre i modulvisningene (5 moduler)

- [x] **Flytt "Skriv ut"-knapp fra prisliste-siden til admin-panelet** ([plan](docs/plans/archive/2026-03-07-flytt-skriv-ut-knapp.md))
    - Printer-ikon i prisliste-modulens action-bar i admin (ved siden av "Legg til prisrad")
    - Popup-vindu med auto-print og afterprint-lukking (ikke ny fane)
    - Prisliste-logo satt til loading="eager" for pålitelig print
    - Inline-script (`is:inline`) for auto-print ved `?print=1`
    - Fjernet gammel print-knapp fra offentlig prisliste-side
    - 55 tester, 88.5% branch coverage

- [x] **Kodestil og CSS-opprydding** ([plan](docs/plans/archive/2026-03-07-kodestil-css-opprydding.md))
    - Erstattet udefinerte CSS-klasser (`bg-brand-surface`, `text-heading`, `text-body`) med gyldige tokens
    - Konsolidert `.section-heading` inn i `.h2`, fjernet duplikat fra global.css
    - Erstattet inline `style="font-family: ..."` med Tailwind utility-klasser (`font-heading`/`font-body`)
    - Erstattet inline farge-styles i Forside med token-klasser (`bg-brand-message-box`, `text-brand`)
    - Erstattet Tailwind arbitrary values (`font-[800]` → `font-extrabold`, `rounded-3xl` → `rounded-2xl`)
    - Fjernet ubrukt `.brand-text` CSS-klasse
    - Oppdatert design-guide.md til å reflektere endringene

- [x] **Juster tannlege-bilder størrelse + admin-forhåndsvisning**
    - Mindre tannlege-bilder i oversikten
    - Admin-forhåndsvisning nøyaktig lik visningen på tannlege-siden

- [x] **Sortering av tjenester på admin-siden** ([plan](docs/plans/archive/2026-03-07-tjenester-sortering.md))
    - Opp/ned-piler i tjenestelisten (samme mønster som galleri)
    - Prioritetsbasert sortering (priority → alfabetisk)
    - Fjernet priority-input fra redigeringsskjema (styres kun via piler)
    - Re-indekserer alle tjenester sekvensielt (1, 2, 3, ...) ved hver flytt
    - Nye tjenester legges sist (priority = max + 1)

- [x] **Flytt "Prisliste" til siste plass i navbar**
    - Flyttet Prisliste-lenken fra posisjon 5 til sist i `allNavLinks` i `Navbar.astro`

- [x] **Audit tester for dato-avhengige feil** ([plan](docs/plans/archive/2026-03-07-audit-dato-tester.md))
    - Lagt til `vi.useFakeTimers()` i 4 testfiler: textFormatter, messageClient, active-messages, admin-dashboard
    - Fjernet per-test setSystemTime/useRealTimers der global fake timer dekker
    - Lagt til konvensjon i CLAUDE.md

- [x] **Footer-justeringer** ([design](docs/plans/archive/2026-03-07-brukertesting-forbedringer-design.md))
    - `sentralbordTekst` allerede fjernet fra footer (brukes kun i Kontakt.astro)
    - Prisliste-lenke allerede lagt til i copyright-linjen — beholdt der

- [x] **"Skriv ut"-knapp på prisliste skal kun vises for innlogget admin**
    - Knappen skjules med `hidden`-attributt, inline script sjekker `admin_google_token` i storage
- [x] **Prisliste — ny side og admin-modul** ([plan](docs/plans/archive/2026-03-07-prisliste.md))
    - Nytt Google Sheets-ark: `Prisliste` (Kategori, Behandling, Pris) med `UNFORMATTED_VALUE`
    - Ny side `/prisliste` — kort-liste layout gruppert etter kategori, `md:grid-cols-2`
    - Print-versjon via `@media print` med `break-inside: avoid`
    - Auto-save admin-modul med CRUD, escapeHtml og DOMPurify
    - Navbar-lenke (etter Tjenester) og footer-lenke
    - Dashboard-teljer og arkitekturdok `docs/architecture/prisliste.md`
    - 1013 tester bestått, alle berørte filer >80% branch coverage, bygg OK

- [x] **Redesign tjenester-seksjonen** ([plan](docs/plans/archive/2026-03-07-redesign-tjenester.md), [design](docs/plans/archive/2026-03-07-redesign-tjenester-design.md))
    - Nytt `priority`-felt i schema (default 99), sorterer tjenester etter prioritet
    - Forsiden viser maks 6 tjenester med "Se alle våre tjenester"-knapp (`btn-secondary`)
    - Tjenester-seksjonen synlig på mobil (fjernet `hidden md:block`)
    - Admin-editor med prioritet-felt og auto-save
    - 964 tester bestått, 95.16% branch coverage, bygg OK

- [x] **Redesign tannleger-seksjonen** ([plan](docs/plans/archive/2026-03-07-redesign-tannleger.md), [design](docs/plans/2026-03-07-brukertesting-forbedringer-design.md))
    - Forsiden: én klikkbar boks med fellesbilde → lenke til `/tannleger`, synlig på mobil
    - `/tannleger`: `rounded-xl` portrait grid (2 mobil, 3 desktop) med `imageConfig`-crop
    - Native `<details>`/`<summary>` accordion for beskrivelser
    - Admin: fellesbilde-støtte i galleri (checkbox, gjenbruk av `setGalleriSpecialType()`)
    - Admin preview matcher tannleger-sidens layout (aspect-[3/4], tekststyling)
    - 960 tester bestått, bygg OK

- [x] **Fjern sticky card-stabling på mobil** ([design](docs/plans/2026-03-07-brukertesting-forbedringer-design.md))
    - Fjernet `position: sticky`, `margin-bottom: 6vh`, mobil z-index og desktop-override media queries fra `.stack-card` i `global.css`
    - Beholdt `isStack`-prop og `--card-index` i Card.astro for eventuelle desktop-effekter
    - Kort vises nå som vanlig scrollbar liste på mobil

- [x] **Feilsøk hvorfor alle pull requests feiler på GitHub**
    - Årsak: Hardkodet testdato `2026-03-01` i `textFormatter.test.js` passerte sluttdato, gjort meldingen "utløpt" i stedet for "aktiv"
    - Fiks: Endret testdatoer til 2027 for å unngå tidsavhengig feil

- [x] **Personvernerklæring — avgrensning til nettsiden** ([design](docs/plans/archive/2026-03-01-personvern-avgrensning-design.md))
    - Innledende avsnitt som avgrenser erklæringen til nettsiden (tennerogtrivsel.no/.com/.net)
    - Henvisning til helse- og personvernlovgivningen for pasientdata
    - Meta-description oppdatert til domene-nøytral formulering

- [x] **Lokal pre-push code review** ([plan](docs/plans/archive/2026-03-01-lokal-pre-push-review.md), [design](docs/designs/archive/2026-03-01-lokal-pre-push-review-design.md))
    - Nytt Step 4.5 i `/commit`-skillen: `superpowers:code-reviewer`-subagent reviewer diff før push
    - Differensiert strenghet: Critical blokkerer, Important lar bruker velge, Minor er rådgivende
    - Agent lagt til i allowed-tools, prosjektregler innebygd i subagent-prompt

- [x] **AI-drevet PR-review med Gemini Code Assist** ([plan](docs/plans/archive/2026-02-28-gemini-pr-reviewer.md))
  - Gemini Code Assist installert fra GitHub Marketplace (automatisk review på alle PR-er)
  - Fjernet auto-approve-steget fra `auto-pr.yml`, beholdt auto-merge
  - Branch protection konfigurert: 1 required approval + required status checks (unit-tests, e2e-tests, build)

- [x] **Leaflet-kart fanger scroll på mobil** ([plan](docs/plans/archive/2026-03-01-leaflet-mobilscroll.md))
  - Deaktivert én-finger drag på touch-enheter, krever to fingre for panorering
  - Overlay-melding «Bruk to fingre for å flytte kartet» ved én-finger touch, fader ut etter 1.5s
  - Ekstrahert kartlogikk til `src/scripts/mapInit.ts` med 100% testdekning

- [x] **E2E-test: intermittent timeout-feil på GitHub Actions**
  - Rotårsak: `waitUntil: 'networkidle'` i accessibility-tester timeout under CI-last (Leaflet-tiles, Vite HMR)
  - Fiks: byttet til `domcontentloaded` — `waitForSelector('main')` sikrer DOM-beredskap for axe-analyse
  - Verifisert: 0 feil av 70 kjøringer (10 repetisjoner), full E2E-suite bestått

- [x] **Besøksadresse-kortet: tydeliggjør at det er en lenke**
    - Erstattet tomt link-slot med "Vis veibeskrivelse →" i `Kontakt.astro`
    - Gjenbruker eksisterende `card-link`-klasse og hover-animasjon

- [x] **Full GDPR-vurdering av prosjektet** ([design](docs/designs/archive/2026-03-01-gdpr-vurdering-design.md)) ([plan](docs/plans/archive/2026-03-01-gdpr-vurdering.md))
    - CloudFront tile-proxy: `/tiles/*` → OSM via CloudFront (eliminerer IP-lekkasje til tredjepart)
    - Vite dev proxy for lokal utvikling av tiles
    - CSP-opprydding: fjernet `tile.openstreetmap.org`, `fonts.googleapis.com`, `fonts.gstatic.com`
    - Ny `/personvern`-side med komplett personvernerklæring
    - Footer-lenke til personvernerklæring
    - Admin info-banner om localStorage under innlogging
    - Middleware-test: negativ test for fjernede tredjepartsdomener

- [x] **Erstatt Google Maps med Leaflet + OpenStreetMap (cookiefri)** ([design](docs/designs/archive/2026-03-01-leaflet-osm-kart-design.md)) ([plan](docs/plans/archive/2026-03-01-leaflet-osm-kart.md))
    - Google Maps Embed iframe erstattet med Leaflet.js + CartoDB Voyager tiles
    - Markør med permanent tooltip ("Tenner og Trivsel"), "Få veibeskrivelse"-knapp under kartet
    - CSP oppdatert: `basemaps.cartocdn.com` i img-src og connect-src, fjernet `maps.gstatic.com`
    - Full GDPR-compliance: ingen cookies, ingen IP-overføring til Google, ingen API-nøkkel for kart

- [x] **Bekreft at det ikke brukes cookies på siden**
  - Ingen `document.cookie`, `Set-Cookie`-headere eller Astro cookies API i kodebasen
  - Autentisering bruker localStorage/sessionStorage, ikke cookies
  - Tredjepartsscripts (Google OAuth, EasyMDE, Flatpickr) setter ingen cookies
  - Google Maps embed-iframe kan sette sandboxede tredjepartscookies, men disse påvirker ikke siden

- [x] **Slettede galleri-bilder og tannleger fjernes ikke fra Google Drive** ([plan](docs/plans/archive/2026-02-28-drive-sletting-galleri.md))
  - `deleteGalleriBilde()` og `deleteTannlege()` sletter nå Drive-fil etter Sheet-rad (best-effort)
  - Asynkron toveis konsistenssjekk i admin-panelet viser advarsel ved orphan-filer
  - `sync-data.js`: nullstiller image-felt i JSON når fil mangler i Drive, samlet konsistensrapport i loggen
  - Omfattende tester for alle nye kodestier (delete + konsistenssjekk)

- [x] **Galleri krever tilgang til både Google Sheet og Bilder-mappen** ([plan](docs/plans/archive/2026-02-28-galleri-tilgangskontroll.md))
  - Ny dedikert `BILDER_FOLDER` miljøvariabel (`PUBLIC_GOOGLE_DRIVE_BILDER_FOLDER_ID`)
  - `enforceAccessControl()` oppdatert med multi-ressurs-sjekk: krever tilgang til både `SHEET_ID` og `BILDER_FOLDER`
  - `admin-module-bilder.js` og `sync-data.js` bruker `BILDER_FOLDER` med fallback til dynamisk utledning
  - Admin-config, workflows og dokumentasjon oppdatert
  - Omfattende tester for alle nye kodestier

- [x] **Flaky tests — sporadiske testfeil** ([plan](docs/plans/archive/2026-02-28-flaky-tests.md))
  - Fjernet `npm audit` fra CI — redundant med Dependabot + CodeQL
  - Lagt til `test:e2e:repeat`-script for lokal flaky-verifisering (`--repeat-each=10`)
  - Avdekket og fikset flaky accessibility-tester: `networkidle` i AxeBuilder-tester forhindrer «Execution context destroyed»
  - Verifisert: 280/280 accessibility-tester bestått med 10 repetisjoner, 628/628 totalt

- [x] **Lag design guide for admin-grensesnittet** ([plan](docs/designs/archive/2026-02-28-admin-design-guide.md))
  - Opprettet `docs/admin-design-guide.md` — komplett referansedokument for admin-panelets design-system
  - Dekker: 5 admin-fargetokens (slate-basert), 14 seksjonar inkl. typografi, layout, kort, knapper, skjema, status/varsler, nav, animasjoner, modaler, a11y, modulmønster, login
  - Dokumenterer ~40 CSS-klasser, 3 keyframe-animasjoner, toast/confirm/banner JS-API
  - Ren dokumentasjon — ingen kodeendringer

- [x] **Sjekk hvordan sidene fungerer på iPhone** ([plan](docs/plans/archive/2026-02-28-sjekk-iphone.md))
  - Mobile Safari (iPhone 14) lagt til som 4. Playwright-prosjekt
  - Alle 9 relevante E2E-tester bestod uten feil — ingen Safari-spesifikke bugs
  - Viewport meta oppdatert med `initial-scale=1` i Layout.astro og admin/index.astro
  - `<dialog>` og sticky-posisjonering fungerer i WebKit (Safari 16+)
  - 63 E2E bestått (4 prosjekter), 907 enhetstester bestått

- [x] **Estimer kostnader for nettsiden (månedlig / årlig)**
  - AWS S3: ~1 kr/mnd (7 MB lagring, ~2 000 requests — neglisjerbart)
  - AWS CloudFront: 0 kr (permanent gratis-kvote: 1 TB/mnd, 10M requests)
  - AWS ACM, Google Maps Embed, Sheets/Drive API, OAuth, GitHub Actions: alt 0 kr
  - Google Workspace: 0–90 kr/mnd (avhenger av om Drive-kontoen er personlig eller Workspace)
  - Domener: ~100–500 kr/år (.no + evt. .com/.net)
  - **Totalt uten Workspace: ~1 kr/mnd + 100–500 kr/år domener**
  - **Totalt med Workspace: ~91 kr/mnd (~1 100–1 600 kr/år)**

- [x] **Kodelesbarhet — ny gjennomgang og forenkling** ([plan](docs/plans/archive/2026-02-27-kodelesbarhet-2.md))
  - 6 steg fullført: slider-template, auto-save, bilde-preview, bildevelger, lagreverifisering, admin-client-splitt
  - Steg 1: `renderImageCropSliders()` — felles slider-template for bilder og tannleger
  - Steg 2: `createAutoSaver()` — felles debounce-mønster for alle 4 editor-moduler
  - Steg 3: `resolveImagePreview()` — felles bilde-preview-oppslag med Drive-ID og lokal fallback
  - Steg 4: `handleImageSelected()` — felles bildevelger-callback for bilder og tannleger
  - Steg 5: `verifySave()` — felles lagreverifisering med mismatch-deteksjon
  - Steg 6: `admin-client.js` (997 linjer) → `admin-auth.js` + `admin-drive.js` + `admin-sheets.js` + re-export fasade
  - 907 tester, alle ≥80% branch coverage

- [x] **Grundig sikkerhetssjekk av hele prosjektet** ([plan](docs/plans/archive/2026-02-23-sikkerhetssjekk.md))
  - M1: HTML-escaping (`escapeHtml()`) + programmatisk verdi-setting i 5 admin-moduler (15+ injeksjonspunkter)
  - M2: Filopplastings-validering (MIME-type + filstørrelse) i `uploadImage()`
  - M3: Input-validering (`validateSheetInput()`) for Sheets-mutasjoner
  - M7: SRI (Subresource Integrity) på alle 6 CDN-ressurser i admin
  - 15 nye sikkerhetstester (escapeHtml, validateSheetInput, uploadImage-validering)
  - Dokumentert i `docs/architecture/sikkerhet.md`

- [x] **Bekreft tilgangskontroll på adminsiden** ([plan](docs/plans/archive/2026-02-27-tilgangskontroll.md))
  - 10 nye enhetstester: 5 tilgangskombinasjoner, 1 checkMultipleAccess blandet, 3 edge cases, 1 returverdi
  - Scenarioer: kun meldinger, kun tjenester, sheet+tannleger, kun sheet, alt unntatt sheet
  - Edge cases: tom config, manglende DOM-elementer, korrekt accessMap-retur
  - Dokumentert tilgangskontrollmodell i `docs/architecture/sikkerhet.md`
  - Branch coverage: admin-dashboard 88.8%, admin-client 94.76%

- [x] **Sjekk at alle filer som kan testes er testet** ([plan](docs/plans/archive/2026-02-27-sjekk-testdekning.md))
  - Alle 26 testbare kildefiler har testfiler — ingen hull funnet
  - 37 nye tester (816 → 853), totalt branch coverage 88.87% → 90.87%
  - 6 filer forbedret: content.config (100%), admin-module-tjenester (98%), admin-dialog (96%), admin-editor-helpers (95%), admin-module-tannleger (89%), admin-module-bilder (82%)
  - Resterende udekte grener er defensive null-guards og jsdom-begrensninger

- [x] **Optimaliser testsuiten — fjern redundante tester** ([plan](docs/plans/archive/2026-02-25-optimaliser-testsuite.md))
  - `admin.spec.ts`: alle 7 tester → chromium-only (14 instanser spart)
  - `sitemap-pages.spec.ts`: 5 DOM-tester → chromium-only, 2 responsive tester beholdt for alle (10 instanser spart)
  - Totalt: 54 E2E-instanser kjørt (ned fra 108), −50% redundante nettleser-instanser
  - 816 enhetstester bestått, ≥80% branch coverage, bygg OK

- [x] **Dobbelt linjeskift i markdown rendres ikke som mellomrom** ([plan](docs/plans/archive/2026-02-27-markdown-linjeskift.md))
  - Erstattet `snarkdown` med `marked` — avsnitt wrapes nå korrekt i `<p>`-tagger
  - Oppdatert `messageClient.js` og `admin-editor-helpers.js` (2 previewRender-funksjoner)
  - Oppdatert 7 testfiler med ny mock (`vi.mock('marked', ...)`)
  - Alle 816+ tester bestått, ≥80% branch coverage, bygg OK

- [x] **Tilbake-navigasjon fra editor til liste i admin**
  - Utvidet brødsmulen til tre nivåer: `← Dashboard / Meldinger / Redigerer melding`
  - Modulnavnet blir klikkbart i editorvisning og fører tilbake til listen
  - `setBreadcrumbEditor()` / `clearBreadcrumbEditor()` i admin-init.js
  - Fjernet inkonsistente «Tilbake til listen»-knapper fra meldinger, tjenester, tannleger og bilder
  - Beholdt «Avbryt»-knapp for nye elementer og «Lagre og gå tilbake» i bilder
  - 816 enhetstester bestått, ≥80% branch coverage, 84 E2E bestått

- [x] **Auto-lagring i admin (Meldinger og Tjenester)** ([plan](docs/plans/archive/2026-02-26-auto-lagring-admin.md))
  - Debounced auto-save (1500ms) med save bar for eksisterende meldinger og tjenester
  - Nye oppføringer: «Opprett»-knapp, deretter auto-save etter opprettelse
  - Refaktorert `initMarkdownEditor()` og `initEditors()` — fjernet knapp-binding, returnerer instanser
  - Dato-validering forhindrer auto-save i meldinger (endDate < startDate)
  - 99 tester bestått, ≥85% branch coverage for alle berørte filer

- [x] **Flaky tests i E2E-tester** ([plan](docs/plans/archive/2026-02-26-flaky-e2e.md))
  - Mobilmeny-test: bekreftet fikset med `data-open`-attributt (0 feil av 550 kjøringer)
  - Tjeneste-undersider-test: timeout under parallell last — fikset med `test.setTimeout(60_000)` + `waitUntil: 'domcontentloaded'`
  - Verifisert: 0 feil av 1100 kjøringer etter fiks, full testsuite bestått (84 E2E + 787 unit)

- [x] **Fiks galleri-relaterte E2E-feil og vis tom-melding på gallerisiden** ([plan](docs/plans/archive/2026-02-26-galleri-e2e.md))
  - `galleri.astro`: erstatt `Astro.redirect('/')` med tom-tilstand-melding (overskrift + "Galleriet er tomt for øyeblikket")
  - Galleri-siden beholder nå egen `<title>`, canonical URL og SEO-metadata ved tomt galleri
  - E2E-test for galleri-nav håndterer tomt galleri gracefully (early return hvis lenke mangler)
  - 5 E2E-feil fikset: canonical-tag, unik tittel, galleri-nav-lenke (3 nettlesere)

- [x] **URL-slug for tjenestesider skal baseres på overskrift, ikke filnavn**
  - Ny `slugify()` funksjon i `src/scripts/slugify.ts` (æ→ae, ø→o, å→a, spesialtegn→bindestrek)
  - URL genereres fra `title`-feltet i frontmatter i stedet for `id`
  - F.eks. «Krone / Bro / Fasetter» → `/tjenester/krone-bro-fasetter` (var `/tjenester/gjenoppretting`)
  - Oppdatert `[id].astro` (params + sidebar) og `Tjenester.astro` (kortlenker)
  - 7 enhetstester, 100% coverage

- [x] **Forbedre visuell synlighet på aktiv melding i info-banner** ([plan](docs/plans/archive/2026-02-26-info-banner-synlighet.md))
  - Fjernet pulserende prikk, erstattet med SVG info-ikon (`w-4 h-4`, sirkel med "i")
  - Økt tekststørrelse fra `text-xs md:text-sm` til `text-sm md:text-base`
  - Økt font-weight fra `font-medium` til `font-semibold`

- [x] **Skjul galleri-lenke i meny når galleriet er tomt**
  - Layout.astro beregner `showGalleri` fra galleri-collectionen (ekskluderer forsidebilde-type)
  - Navbar.astro filtrerer bort galleri-lenken i desktop- og mobilmeny når `showGalleri` er `false`
  - galleri.astro redirecter til forsiden ved direkte tilgang til tom galleri-side

- [x] **Galleri-navigasjon: scroll vs. standalone-side — er det konsistent?** ([plan](docs/plans/archive/2026-02-25-galleri-navigasjon.md))
  - Forsiden begrenset til 4 bilder + «Se alle bilder»-lenke på alle skjermstørrelser
  - Navbar-lenke følger samme mønster som Tjenester/Tannleger (scroll på desktop, standalone på mobil) — konsistent

- [x] **UX- og brukervennlighetsgjennomgang av admin-panelet** ([plan](docs/plans/archive/2026-02-25-ux-brukervennlighet-admin.md))
  - 7 steg fullført: brødsmuler, skeleton-loadere, kontekstuelle feilmeldinger, lagrestatus, berøringsmål, dashboard-tall, overganger
  - Steg 1: brødsmule-nav `Dashboard / Modulnavn (N elementer)` med elementtelling per modul
  - Steg 2: skeleton-kort (thumbnail + tekstlinjer + knapper) erstatter «Henter...»-tekst
  - Steg 3: kontekstuelle feilmeldinger med auth-expired-banner og «Prøv igjen»-knapper
  - Steg 4: `showSaveBar()`/`hideSaveBar()` — fast bunnlinje med gul/grønn/rød lagrestatus
  - Steg 5: `min-w/h-[44px]` på alle ikonknapper, `w-10 h-10` på slider-step-btn (CSS-only)
  - Steg 6: aktiv-telling på dashboard-kort — tjenester (frontmatter), meldinger (datofiltrering), tannleger og galleri (Sheets)
  - Steg 7: `admin-view-enter` fade+slide-animasjon ved åpning/lukking av moduler og etter innlasting av lister

- [x] **Sett opp CloudFront på test-siden** ([plan](docs/plans/archive/2026-02-24-cloudfront-test.md))
  - ACM-sertifikat (us-east-1) med DNS-validering
  - CloudFront-distribusjon med OAC, CachingOptimized + CachingDisabled for `/api/*`
  - Response Headers Policy: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy
  - S3 bucket policy for OAC, blokkert direkte offentlig tilgang
  - DNS peker til CloudFront, feilsider (403→404) konfigurert
  - Deploy-workflow oppdatert: fjernet `--acl public-read` og API-cache-steg
  - Verifisert: HTTPS, sikkerhetsheadere, API no-cache, 404-side, undersider, blokkert S3-tilgang

- [x] **CI/CD-forbedringer 2**
  - CloudFront cache-invalidering allerede implementert i `deploy.yml` (commit `109c339`) — invaliderer hele distribusjonen etter S3-sync
  - Gjennomgått alle 5 workflows: ingen ubrukte eller redundante (deploy, auto-pr, codeql, dependabot-auto-merge, dependabot-rebase)

- [x] **Gjennomgang av flaky tester** ([plan](docs/plans/archive/2026-02-24-flaky-tester.md))
  - Rotårsak: `toBeHidden()`/`toBeVisible()` avhenger av Tailwinds `invisible`-klasse som Playwright ikke konsistent gjenkjenner
  - Fiks: `data-open`-attributt på `#mobile-menu`, tester sjekker attributt i stedet for CSS-synlighet
  - Fjernet `retries: 1` i CI — alle tester kjøres nå uten retries
  - Trace endret til `retain-on-failure` (nyttig uten retries)
  - 84 E2E-tester + 725 enhetstester passerer uten feil

- [x] **Tester for ekstraherte admin-moduler**
  - 223 tester på tvers av 7 testfiler, alle bestått
  - Branch coverage per fil: editor-helpers 86%, init 83%, bilder 80%, meldinger 92%, settings 88%, tannleger 80%, tjenester 80%
  - Alle filer over 80%-kravet

- [x] **Endre tekst på admin-siden**
  - Byttet «i Google Sheets» til «på Google Disk» i dashboard-headeren

- [x] **Kodelesbarhet — gå gjennom og forenkle koden** ([plan](docs/plans/archive/2026-02-23-kodelesbarhet.md))
  - 6 steg fullført: bildeparsing, CRUD-konsolidering, event-binding, HTML-templates, sync-data-rydding, inline-script-ekstraksjon
  - Steg 1: `parseImageConfig()` erstatter 5× duplisert parsing
  - Steg 2: `deleteSheetRow()` + `updateSheetRow()` konsoliderer CRUD
  - Steg 3: `bindCardClickDelegation()` + `loadThumbnails()` fjerner duplisering
  - Steg 4: SVG-ikonkonstanter + `renderToggleSwitch()` + `renderActionButtons()`
  - Steg 5: Innrykk-fiks + `downloadImageIfNeeded()` fjerner 3× duplisert download
  - Steg 6: 1570-linjers inline-script → 7 modulfiler, `index.astro` 1797→231 linjer

- [x] **Legg til åpningstid for telefon i footeren**
  - `sentralbordTekst` fra Google Sheets vises under telefonnumrene i footer
  - Subtil styling (text-white/50, text-xs) for å skille fra kontaktinfo
  - Håndterer tom phone2 — teksten vises etter siste telefonnummer

- [x] **Dynamisk årstall for copyright i footer**
  - Allerede implementert: `new Date().getFullYear()` i Footer.astro gir riktig årstall ved hvert bygg

- [x] **Gjøre det enklere å forstå hvor innstillinger brukes på nettsiden** ([plan](docs/plans/archive/2026-02-24-innstillinger-hint.md))
  - Lagt til «Vises på:»-hint under hver innstilling i admin-panelet
  - SETTING_HINTS-objekt med 28 nøkler som mapper til plassering på nettsiden
  - Hint vises som dempet tekst (10px) under label, før input-feltet

- [x] **Design- og UX-gjennomgang av admin-panelet** ([plan](docs/plans/archive/2026-02-23-admin-ux.md))
  - 10 steg fullført: CLS-fiks, 5 admin-fargetokens, ~65 slate→token-erstatninger, toggle CSS refaktor, semantiske status-klasser, ikon-knapper, fokus/spacing, EasyMDE/PWA-opprydding, a11y (role=switch, aria-checked, role=status)
  - Token-drevet admin-design: alle farger via CSS-variabler (admin-surface, admin-hover, admin-border, admin-muted, admin-muted-light)
  - Ny CSS-klasser: admin-icon-btn, admin-icon-btn-danger, admin-icon-btn-reorder, admin-btn-cancel, admin-status-active/planned/expired

- [x] **UX/design-gjennomgang av den offentlige nettsiden** ([design-guide](docs/designs/design-guide.md)) ([plan](docs/designs/archive/2026-02-22-ux-redesign.md))
  - 13 steg fullført: typografi, fargepalett (stone), spacing, knapper, kort, navbar, footer, galleri, accent bar, 404-side, tjenester-detaljside, tilgjengelighet, CLAUDE.md
  - Token-drevet design: alle farger via CSS-variabler, self-hosted Montserrat/Inter fonter
  - Skip-link, globale fokus-stiler, fjernet nestet main, fjernet !important-overstyrringer

- [x] **Konsistent aktiv/inaktiv-visning i admin på tvers av moduler** ([plan](docs/plans/archive/2026-02-23-konsistent-toggle.md))
  - Tannlege-editor: checkbox → toggle-switch med `data-active`
  - Galleri-editor: select/dropdown → toggle-switch med `data-active`
  - Felles `setToggleState()` og `renderToggleHtml()` hjelpefunksjoner
  - Tjeneste-editor refaktorert til å bruke samme hjelpefunksjoner
  - Alle tre editorer har identisk "Synlighet"-toggle

- [x] **Fiks wrapping av tekst i tjeneste-listen i admin på mobil** ([plan](docs/plans/archive/2026-02-23-tjeneste-tekst-wrapping.md))
  - `line-clamp-2 sm:line-clamp-none` på h3-titler i meldinger, tjenester og tannleger
  - `self-end sm:self-auto` på knapp-containere for konsistent plassering på mobil
  - Galleri allerede OK (hadde `truncate` og `self-end`)

- [x] **Legal vurdering av dependencies** ([rapport](docs/plans/archive/2026-02-23-legal-dependencies.md))
    - npm audit: 0 sårbarheter, alle deps aktivt vedlikeholdt
    - 97%+ permissive lisenser (MIT/Apache/BSD/ISC), 2 LGPL + 5 MPL — ingen risiko
    - MIT-lisens lagt til prosjektet (`LICENSE`)
    - Dependabot + CI-audit dekker løpende vedlikehold

- [x] **"Legg til snarvei"-lenke i admin på mobil (PWA / Add to Home Screen)** ([plan](docs/plans/archive/2026-02-23-pwa-snarvei.md))
  - Web App Manifest (`admin-manifest.json`) med eksisterende favicon-ikoner
  - Install-prompt (`pwa-prompt.js`) med Android- og iOS-støtte
  - Toast etter innlogging, husker avvisning via localStorage
  - Meta-tagger for theme-color og apple-web-app i admin `<head>`
  - 15 enhetstester, 87.5% branch coverage

- [x] **Legg til toggling for tjenester** ([plan](docs/plans/archive/2026-02-23-toggling-tjenester.md))
  - Toggle-switch i liste og editor, frontmatter-basert lagring (active: true/false)
  - Inaktive tjenester filtreres ut fra forsiden og standalone-sider
  - 8 nye enhetstester for toggle-funksjonaliteten

- [x] **Legg til toggling for tannleger**
  - Klikkbar toggle-switch i tannlege-listen (samme mønster som galleri)
  - Optimistisk UI-oppdatering med revert ved feil
  - 7 nye enhetstester for toggle-funksjonaliteten

- [x] **Konsolidere og rydde i E2E-tester** ([plan](docs/plans/archive/2026-02-22-konsolidere-e2e.md))
  - Slettet `homepage.spec.ts` — mobilmeny-test flyttet til `sitemap-pages.spec.ts`
  - Slettet `services.spec.ts` — tjeneste-navigasjon og sidebar-test flyttet til `sitemap-pages.spec.ts`
  - `seo.spec.ts` og `links.spec.ts` begrenset til kun chromium-prosjektet (24 nettleser-instanser skippet)
  - Redusert fra ~99 til ~84 reelle nettleser-instanser (~15% reduksjon)

- [x] **Komprimere bokser i admin-panelet**
  - Redusert padding, gap og border-radius på admin-kort (`.admin-card`, `.admin-card-interactive`, `.admin-card-header`)
  - Mindre fontstørrelser på overskrifter (`.admin-subtitle`) og tettere spacing (`.admin-description`)
  - Kompaktere dashboard-grid (`gap-8` → `gap-5`) og container-spacing
  - Mindre knapper i lister (p-3 → p-2.5, ikoner 18px → 16px) og redusert module-content min-height

- [x] **Vurdere byggetid og test-tid på nytt** ([plan](docs/plans/archive/2026-02-22-byggetid-test-tid.md))
  - Playwright Docker-container (`mcr.microsoft.com/playwright:v1.58.2-noble`) — eliminerer browser-install/cache-steg
  - Build slått sammen inn i e2e-jobben — eliminerer separat runner-oppstart + npm ci
  - Workers 2→4, retries 2→1 i Playwright-config
  - `build`-jobb beholdt som tynn gate (required status check) + full build for repository_dispatch
  - Forventet besparelse: ~25-35% (fra ~4 min til ~2:30-3:00 min)

- [x] **Raskere bygg ved Google Drive-oppdatering (repository_dispatch)** ([plan](docs/plans/archive/2026-02-22-raskere-drive-bygg.md))
  - Testjobber (`unit-tests`, `e2e-tests`) hoppes over ved `repository_dispatch`-trigger
  - `build`-jobb bruker `always()` med eksplisitt sjekk for `success` eller `skipped`
  - Forventet byggetid for innholdsoppdateringer: ~1 min (ned fra ~4 min)

- [x] **Robust feilhåndtering ved tapt Google-tilkobling i admin**
  - Ny `admin-api-retry.js` med `classifyError`, `withRetry` (eksponentiell backoff) og `createAuthRefresher`
  - Automatisk token-refresh ved 401/403 via `silentLogin()` og custom events
  - «Prøv igjen»-knapper i alle feilmeldinger (meldinger, tjenester, tannleger, galleri, innstillinger)
  - 34 nye tester for retry-modul + 10 nye tester for dashboard/client

- [x] **Reduser antall/størrelse på dependencies 2**
  - Byttet `googleapis` (196 MB) til `@googleapis/sheets` + `@googleapis/drive` + `google-auth-library`
  - node_modules redusert fra 461 MB til 269 MB (−42%)

- [x] **Reduser antall/størrelse på dependencies 1**
  - Fjernet `dotenv` — erstattet med innebygd `process.loadEnvFile()` (Node 20.12+)
  - Flyttet `@types/dompurify` fra `dependencies` til `devDependencies`
  - Lagt til `sharp` som eksplisitt `devDependency` (var kun transitiv via Astro)

- [x] **SEO-forbedringer**
  - Fjernet `/forside/` duplikat-side, lagt til `<link rel="canonical">` på alle sider
  - Standalone-sider har unike `<title>` og `<meta description>` via settings
  - Schema.org/JSON-LD (`Dentist`) med adresse, telefon, åpningstider
  - Komplett OpenGraph (`og:locale`, `og:site_name`, `og:image:width/height`) og Twitter Card
  - 10 nye E2E-tester for SEO-metadata

- [x] **Kodekvalitet / småfiks** ([plan](docs/plans/archive/2026-02-22-kodekvalitet-smafiks.md))
  - Skrivefeil `troke-linecap` → `stroke-linecap` i Kontakt.astro
  - Fjernet debug-kommentar i `tjenester/[id].astro`
  - Begrenset `MutationObserver` i `layout-helper.js` til `banner-root` og `main` (var `document.body` med `subtree: true`)
  - Fjernet `[key: string]: any` fra `Button.astro`, la til eksplisitte HTML-attributter
  - La til `<meta name="robots" content="noindex, nofollow">` på admin-siden

- [x] **Tilgjengelighet (a11y) — småfiks**
  - Hamburger-knapp: `aria-expanded` og `aria-controls` i `mobile-menu.js`
  - SVG-ikoner: `aria-hidden="true"` på dekorative ikoner i Kontakt, TelefonKnapp, EpostKnapp
  - InfoBanner og dynamisk innhold: `aria-live="polite"`
  - Breadcrumb-nav i `/tjenester/[id].astro`: `aria-label` for distinkte nav-elementer
  - Admin range-slidere: `for`/`id`-kobling mellom labels og inputs

- [x] **Erstatt `alert()`/`confirm()` med tilgjengelige dialoger i admin**
  - Ny modul `admin-dialog.js` med `showToast()`, `showConfirm()` og `showBanner()`
  - 10 `alert()` → `showToast(..., 'error')`, 5 `confirm()` → `await showConfirm()`
  - `Forside.astro`: `alert()` → dynamisk `import()` + `showBanner()`
  - Tilgjengelig: `aria-live`, `role="alert"`, Escape-lukking, fokus på avbryt-knapp
  - 29 nye enhetstester, 87% branch coverage, alle E2E-tester oppdatert og bestått

- [x] **Egen side for Galleri / Klinikken**
  - Standalone-side `/galleri` med `variant="white"` (samme mønster som /kontakt, /tjenester, /tannleger)
  - `standalone`-prop på Galleri-komponenten viser alle bilder på mobil (ikke bare 2)
  - Navbar `mobileHref` peker til `/galleri` i stedet for `/#galleri`
  - Lagt til i sitemap-tester og hvit-bakgrunn-test

- [x] **Refaktorere inline-klasser til global.css**
  - Ny `getSectionClasses()` hjelpefunksjon erstatter duplisert variant-logikk i 4 komponenter
  - Ny `SectionHeader.astro` komponent erstatter identisk header-blokk i 4 seksjoner
  - `.card-grid` CSS-klasse for responsivt kort-rutenett (Tjenester, Tannleger)
  - `.image-frame` CSS-klasse for bildramme med kant og skygge (Forside, Card)
  - 5 commits, 10 filer endret, 100% testdekning på ny kode

- [x] **Vurdere "Start behandling"-knappene på admin-kortene**
  - Fjernet redundante knapper, erstattet med chevron-pil (›) for navigasjonsindikator
  - Forbedret a11y: role="link", tabindex, aria-label, keyboard-støtte (Enter/Space)
  - Forenklet JS fra dobbel event-håndtering til én klikk-handler per kort
  - focus-visible-styling for tastaturnavigasjon

- [x] **Rask aktiv/inaktiv-toggle på galleri-oversikten**
  - Klikkbar status-pill i galleri-listen — toggle uten å åpne editoren
  - Optimistisk UI-oppdatering med rollback ved feil
  - Responsivt design (fungerer på mobil og desktop)

- [x] **Gjennomgå testdekning mot faktisk kode**
  - Analysert coverage-rapport og identifisert udekte grener med Python-parsing av v8 coverage JSON
  - sync-data.js: 85% → 97% branch coverage (11 nye tester for edge cases og feilhåndtering)
  - admin-client.js: 88% → 96% branch coverage (12 nye tester for fallback-verdier, undefined-håndtering, feilscenarier)
  - Alle filer over 80% branch coverage-kravet

- [x] **Utrede backend-alternativer for mer «live» oppdatering**
  - Konklusjon: Beholdt Google Sheets — admin er allerede live nok, nettsiden kan henge litt etter
  - Implementert stille verifisering etter lagring (re-fetch fra Sheets + sammenligning)
  - Tidspunkt i lagremeldinger ("✅ 22. feb kl. 14:32") og "Sist hentet"-tid i modul-header
  - Mismatch → automatisk reload av modulen
  - Implementert for alle tre moduler: innstillinger, galleri og tannleger

- [x] **Sikre at Dependabot-PRer ikke merges ved feilet bygg**
  - Auto-merge begrenset til minor/patch (major krever manuell gjennomgang)
  - Ruleset oppdatert: required status check endret fra «build-and-deploy» til «build»
  - `build`-jobben har `needs: [unit-tests, e2e-tests]` — feilet test → build skipped → merge blokkert

- [x] **Optimalisere bygg, tester og deploy for raskere feedback-loop**
  - Slått sammen ci.yml og deploy.yml til én workflow med parallelle jobber (unit-tests + e2e-tests parallelt → build → deploy)
  - Ekskludert csp-check.spec.ts fra CI via testIgnore (manuell test)
  - Økt Playwright-workers fra 1 til 2 i CI
  - Nytt `dev:nosync`-script; E2E i CI bruker dette + eksplisitt sync-steg
  - npm audit flyttet inn i unit-tests-jobben

- [x] **Tydeliggjøre i admin at endringer ikke vises umiddelbart**
  - Info-tekst på dashboard-header om at endringer publiseres automatisk
  - Lagremeldinger (tannleger + galleri) viser undertekst om publiseringstid
  - Innstillinger-checkmark har tooltip om publiseringstid

- [x] **Forbedre UX for zoom/posisjon-kontroller i admin**
  - +/- knapper for finjustering (zoom ±0.1, posisjon ±1%)
  - `touch-action: pan-y` på slidere + `wheel`-event blokkering for å hindre utilsiktet scrolling

- [x] **Gjennomgang av innstillinger og opplesing**
  - Zoom/utsnitt: unifisert scale-range 1.0–3.0, verifisert hel dataflyt fra Sheets → admin → sync → frontend
  - Alle 24 innstillingsnøkler gjennomgått: konsistente mellom HARD_DEFAULTS, Google Sheets, admin og komponenter
  - Fikset locale-bug: `valueRenderOption: 'UNFORMATTED_VALUE'` på alle Sheets API-kall som leser desimaltall
  - Ingen inkonsekvenser funnet i property-navn, standardverdier eller fallback-logikk

- [x] **Thumbnails på tannleger-listen i admin**
  - Thumbnail-bilder ved siden av hver tannlege i admin-panelet
  - Responsiv layout med flex-container (identisk mønster som galleri)
  - Asynkron lasting via `findFileByName` + `getDriveImageBlob`

- [x] **CI/CD-forbedringer 1**
  - Alle 3 Playwright-prosjekter (chromium, webkit, Mobile Chrome) kjøres i CI
  - A11y-tester utvidet til 5 standalone-sider (kontakt, tannleger, tjenester, galleri, admin)
  - Fikset manglende `aria-label` på hjem-lenke i admin (WCAG link-name)

- [x] **Sjekk utsnitt/visning av hovedbilde og bildegalleri**
  - Admin-thumbnails bruker nå riktig utsnitt (scale, posX, posY) fra data
  - Forsidebilde-thumbnail har aspect-[16/10], galleri aspect-[4/3], tannleger kvadratisk
  - Forside.astro leser utsnitt fra galleri-arket (ikke Innstillinger) — én autoritativ kilde
  - syncGalleri() inkluderer forsidebilde i galleri.json med type-felt
