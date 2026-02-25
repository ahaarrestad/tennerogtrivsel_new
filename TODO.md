# TODO – Tenner og Trivsel

> Denne filen holdes oppdatert underveis. Kryss av oppgaver med `[x]` når de er ferdige.

### Arbeidsflyt
- **Før vi starter på en oppgave:** Lag alltid en plan først. Still avklarende spørsmål hvis noe er uklart.
- Planen skrives som notater under oppgaven før implementering begynner.
- Flytt oppgaven til «Pågående» når planen er godkjent og arbeidet starter.
- **Lever i små, iterative forbedringer** — minst én commit per oppgave. Store oppgaver brytes ned i deloppgaver som hver committes for seg.
- **Planer lagres under `/docs`** i prosjektet, både når de er utarbeidet og etter eventuelle revisjoner.
- Flytt oppgaven til «Fullført» når den er ferdig.

## Pågående

- [ ] **UX- og brukervennlighetsgjennomgang av admin-panelet** ([plan](docs/plan-ux-brukervennlighet-admin.md))
  - Helhetlig gjennomgang av admin-siden med fokus på brukeropplevelse
  - Vurder: navigasjon, arbeidsflyt, feilmeldinger, responstid, mobilvennlighet, visuelt hierarki
  - 7 steg: brødsmuler, skeleton-loadere, kontekstuelle feilmeldinger, lagrestatus, berøringsmål, dashboard-tall, overganger
  - ✅ Steg 1: modul-header med brødsmuler og elementtelling
  - Steg 2 neste: skeleton-loadere

## Backlog
- [ ] **Sett opp CloudFront på produksjon (www.tennerogtrivsel.no)** ([plan](docs/plan-cloudfront-prod.md))
  - Samme oppsett som test-siden, tilpasset produksjonsdomenet
  - SSL-sertifikat (ACM us-east-1), CloudFront-distribusjon med OAC, cache-policy, DNS-pekere
  - Gjenbruk Response Headers Policy og CloudFront Function fra test
  - Oppdater deploy-workflow for prod-bucket
  - 7 steg: ACM-sertifikat, CF-distribusjon, headere, S3-policy, DNS, deploy-workflow, verifisering


- [ ] **Sjekk at alle filer som kan testes er testet**
  - Gå gjennom alle kildefiler i `src/scripts/` og `src/pages/api/` og verifiser at de har tilhørende testfiler
  - Identifiser eventuelle hull i testdekningen

- [ ] **Grundig sikkerhetssjekk av hele prosjektet** ([plan](docs/plan-sikkerhetssjekk.md))
  - Det er gjort en sikkerhetsgjennomgang tidligere, men mye kode er endret siden da
  - CloudFront-headere allerede håndtert (CloudFront test ferdig, prod følger oppgave 1)
  - Nye funn: HTML-attributt-escaping mangler i admin-template literals
  - 6 steg: HTML-escaping (M1), filopplasting (M2), input-validering (M3), API-nøkkel (L1), tester, dokumentasjon
  - Steg 1–4 uavhengige, steg 5 avhenger av 1+2+3, steg 6 sist

- [ ] **Optimaliser testsuiten — fjern redundante tester** ([plan](docs/plan-optimaliser-testsuite.md))
  - Gå gjennom alle enhetstester og E2E-tester og identifiser overlapp/duplisering
  - Fjern tester som dekker samme logikk flere ganger uten å tilføre verdi
  - Mål: behold 80% branch coverage per fil, men reduser total byggetid

- [ ] **Kodelesbarhet — ny gjennomgang og forenkling**
  - Analyser dagens tilstand av kodebasen etter tidligere refaktoreringer
  - Vurder om koden er lesbar nok eller om ytterligere forenkling trengs
  - Fokusområder: kompleksitet, navngiving, modulstruktur, duplisering


## Fullført

- [x] **Sett opp CloudFront på test-siden** ([plan](docs/plan-cloudfront-test.md))
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

- [x] **Gjennomgang av flaky tester** ([plan](docs/plan-flaky-tester.md))
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


- [x] **Kodelesbarhet — gå gjennom og forenkle koden** ([plan](docs/plan-kodelesbarhet.md))
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

- [x] **Gjøre det enklere å forstå hvor innstillinger brukes på nettsiden** ([plan](docs/plan-innstillinger-hint.md))
  - Lagt til «Vises på:»-hint under hver innstilling i admin-panelet
  - SETTING_HINTS-objekt med 28 nøkler som mapper til plassering på nettsiden
  - Hint vises som dempet tekst (10px) under label, før input-feltet

- [x] **Design- og UX-gjennomgang av admin-panelet** ([plan](docs/plan-admin-ux.md))
  - 10 steg fullført: CLS-fiks, 5 admin-fargetokens, ~65 slate→token-erstatninger, toggle CSS refaktor, semantiske status-klasser, ikon-knapper, fokus/spacing, EasyMDE/PWA-opprydding, a11y (role=switch, aria-checked, role=status)
  - Token-drevet admin-design: alle farger via CSS-variabler (admin-surface, admin-hover, admin-border, admin-muted, admin-muted-light)
  - Ny CSS-klasser: admin-icon-btn, admin-icon-btn-danger, admin-icon-btn-reorder, admin-btn-cancel, admin-status-active/planned/expired

- [x] **UX/design-gjennomgang av den offentlige nettsiden** ([design-guide](docs/design-guide.md)) ([plan](docs/plan-ux-redesign.md))
  - 13 steg fullført: typografi, fargepalett (stone), spacing, knapper, kort, navbar, footer, galleri, accent bar, 404-side, tjenester-detaljside, tilgjengelighet, CLAUDE.md
  - Token-drevet design: alle farger via CSS-variabler, self-hosted Montserrat/Inter fonter
  - Skip-link, globale fokus-stiler, fjernet nestet main, fjernet !important-overstyrringer


- [x] **Konsistent aktiv/inaktiv-visning i admin på tvers av moduler** ([plan](docs/plan-konsistent-toggle.md))
  - Tannlege-editor: checkbox → toggle-switch med `data-active`
  - Galleri-editor: select/dropdown → toggle-switch med `data-active`
  - Felles `setToggleState()` og `renderToggleHtml()` hjelpefunksjoner
  - Tjeneste-editor refaktorert til å bruke samme hjelpefunksjoner
  - Alle tre editorer har identisk "Synlighet"-toggle

- [x] **Fiks wrapping av tekst i tjeneste-listen i admin på mobil** ([plan](docs/plan-tjeneste-tekst-wrapping.md))
  - `line-clamp-2 sm:line-clamp-none` på h3-titler i meldinger, tjenester og tannleger
  - `self-end sm:self-auto` på knapp-containere for konsistent plassering på mobil
  - Galleri allerede OK (hadde `truncate` og `self-end`)

- [x] **Legal vurdering av dependencies** ([rapport](docs/plan-legal-dependencies.md))
    - npm audit: 0 sårbarheter, alle deps aktivt vedlikeholdt
    - 97%+ permissive lisenser (MIT/Apache/BSD/ISC), 2 LGPL + 5 MPL — ingen risiko
    - MIT-lisens lagt til prosjektet (`LICENSE`)
    - Dependabot + CI-audit dekker løpende vedlikehold

- [x] **"Legg til snarvei"-lenke i admin på mobil (PWA / Add to Home Screen)** ([plan](docs/plan-pwa-snarvei.md))
  - Web App Manifest (`admin-manifest.json`) med eksisterende favicon-ikoner
  - Install-prompt (`pwa-prompt.js`) med Android- og iOS-støtte
  - Toast etter innlogging, husker avvisning via localStorage
  - Meta-tagger for theme-color og apple-web-app i admin `<head>`
  - 15 enhetstester, 87.5% branch coverage

- [x] **Legg til toggling for tjenester** ([plan](docs/plan-toggling-tjenester.md))
  - Toggle-switch i liste og editor, frontmatter-basert lagring (active: true/false)
  - Inaktive tjenester filtreres ut fra forsiden og standalone-sider
  - 8 nye enhetstester for toggle-funksjonaliteten

- [x] **Legg til toggling for tannleger**
  - Klikkbar toggle-switch i tannlege-listen (samme mønster som galleri)
  - Optimistisk UI-oppdatering med revert ved feil
  - 7 nye enhetstester for toggle-funksjonaliteten

- [x] **Konsolidere og rydde i E2E-tester** ([plan](docs/plan-konsolidere-e2e.md))
  - Slettet `homepage.spec.ts` — mobilmeny-test flyttet til `sitemap-pages.spec.ts`
  - Slettet `services.spec.ts` — tjeneste-navigasjon og sidebar-test flyttet til `sitemap-pages.spec.ts`
  - `seo.spec.ts` og `links.spec.ts` begrenset til kun chromium-prosjektet (24 nettleser-instanser skippet)
  - Redusert fra ~99 til ~84 reelle nettleser-instanser (~15% reduksjon)

- [x] **Komprimere bokser i admin-panelet**
  - Redusert padding, gap og border-radius på admin-kort (`.admin-card`, `.admin-card-interactive`, `.admin-card-header`)
  - Mindre fontstørrelser på overskrifter (`.admin-subtitle`) og tettere spacing (`.admin-description`)
  - Kompaktere dashboard-grid (`gap-8` → `gap-5`) og container-spacing
  - Mindre knapper i lister (p-3 → p-2.5, ikoner 18px → 16px) og redusert module-content min-height

- [x] **Vurdere byggetid og test-tid på nytt** ([plan](docs/plan-byggetid-test-tid.md))
  - Playwright Docker-container (`mcr.microsoft.com/playwright:v1.58.2-noble`) — eliminerer browser-install/cache-steg
  - Build slått sammen inn i e2e-jobben — eliminerer separat runner-oppstart + npm ci
  - Workers 2→4, retries 2→1 i Playwright-config
  - `build`-jobb beholdt som tynn gate (required status check) + full build for repository_dispatch
  - Forventet besparelse: ~25-35% (fra ~4 min til ~2:30-3:00 min)

- [x] **Raskere bygg ved Google Drive-oppdatering (repository_dispatch)** ([plan](docs/plan-raskere-drive-bygg.md))
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

- [x] **Kodekvalitet / småfiks** ([plan](docs/plan-kodekvalitet-smafiks.md))
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

