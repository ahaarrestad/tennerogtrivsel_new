# Fullførte oppgaver – Tenner og Trivsel

> Arkiv over ferdige oppgaver. Aktive oppgaver finnes i [TODO.md](TODO.md).

- [x] **Leaflet-kart fanger scroll på mobil** ([plan](docs/archive/plan-leaflet-mobilscroll.md))
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

- [x] **Full GDPR-vurdering av prosjektet** ([design](docs/archive/plan-gdpr-vurdering-design.md)) ([plan](docs/archive/plan-gdpr-vurdering.md))
    - CloudFront tile-proxy: `/tiles/*` → OSM via CloudFront (eliminerer IP-lekkasje til tredjepart)
    - Vite dev proxy for lokal utvikling av tiles
    - CSP-opprydding: fjernet `tile.openstreetmap.org`, `fonts.googleapis.com`, `fonts.gstatic.com`
    - Ny `/personvern`-side med komplett personvernerklæring
    - Footer-lenke til personvernerklæring
    - Admin info-banner om localStorage under innlogging
    - Middleware-test: negativ test for fjernede tredjepartsdomener

- [x] **Erstatt Google Maps med Leaflet + OpenStreetMap (cookiefri)** ([design](docs/archive/plan-leaflet-osm-kart-design.md)) ([plan](docs/archive/plan-leaflet-osm-kart.md))
    - Google Maps Embed iframe erstattet med Leaflet.js + CartoDB Voyager tiles
    - Markør med permanent tooltip ("Tenner og Trivsel"), "Få veibeskrivelse"-knapp under kartet
    - CSP oppdatert: `basemaps.cartocdn.com` i img-src og connect-src, fjernet `maps.gstatic.com`
    - Full GDPR-compliance: ingen cookies, ingen IP-overføring til Google, ingen API-nøkkel for kart

- [x] **Bekreft at det ikke brukes cookies på siden**
  - Ingen `document.cookie`, `Set-Cookie`-headere eller Astro cookies API i kodebasen
  - Autentisering bruker localStorage/sessionStorage, ikke cookies
  - Tredjepartsscripts (Google OAuth, EasyMDE, Flatpickr) setter ingen cookies
  - Google Maps embed-iframe kan sette sandboxede tredjepartscookies, men disse påvirker ikke siden

- [x] **Slettede galleri-bilder og tannleger fjernes ikke fra Google Drive** ([plan](docs/archive/plan-drive-sletting-galleri.md))
  - `deleteGalleriBilde()` og `deleteTannlege()` sletter nå Drive-fil etter Sheet-rad (best-effort)
  - Asynkron toveis konsistenssjekk i admin-panelet viser advarsel ved orphan-filer
  - `sync-data.js`: nullstiller image-felt i JSON når fil mangler i Drive, samlet konsistensrapport i loggen
  - Omfattende tester for alle nye kodestier (delete + konsistenssjekk)

- [x] **Galleri krever tilgang til både Google Sheet og Bilder-mappen** ([plan](docs/archive/plan-galleri-tilgangskontroll.md))
  - Ny dedikert `BILDER_FOLDER` miljøvariabel (`PUBLIC_GOOGLE_DRIVE_BILDER_FOLDER_ID`)
  - `enforceAccessControl()` oppdatert med multi-ressurs-sjekk: krever tilgang til både `SHEET_ID` og `BILDER_FOLDER`
  - `admin-module-bilder.js` og `sync-data.js` bruker `BILDER_FOLDER` med fallback til dynamisk utledning
  - Admin-config, workflows og dokumentasjon oppdatert
  - Omfattende tester for alle nye kodestier

- [x] **Flaky tests — sporadiske testfeil** ([plan](docs/archive/plan-flaky-tests.md))
  - Fjernet `npm audit` fra CI — redundant med Dependabot + CodeQL
  - Lagt til `test:e2e:repeat`-script for lokal flaky-verifisering (`--repeat-each=10`)
  - Avdekket og fikset flaky accessibility-tester: `networkidle` i AxeBuilder-tester forhindrer «Execution context destroyed»
  - Verifisert: 280/280 accessibility-tester bestått med 10 repetisjoner, 628/628 totalt

- [x] **Lag design guide for admin-grensesnittet** ([plan](docs/archive/plan-admin-design-guide.md))
  - Opprettet `docs/admin-design-guide.md` — komplett referansedokument for admin-panelets design-system
  - Dekker: 5 admin-fargetokens (slate-basert), 14 seksjonar inkl. typografi, layout, kort, knapper, skjema, status/varsler, nav, animasjoner, modaler, a11y, modulmønster, login
  - Dokumenterer ~40 CSS-klasser, 3 keyframe-animasjoner, toast/confirm/banner JS-API
  - Ren dokumentasjon — ingen kodeendringer

- [x] **Sjekk hvordan sidene fungerer på iPhone** ([plan](docs/archive/plan-sjekk-iphone.md))
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

- [x] **Kodelesbarhet — ny gjennomgang og forenkling** ([plan](docs/archive/plan-kodelesbarhet-2.md))
  - 6 steg fullført: slider-template, auto-save, bilde-preview, bildevelger, lagreverifisering, admin-client-splitt
  - Steg 1: `renderImageCropSliders()` — felles slider-template for bilder og tannleger
  - Steg 2: `createAutoSaver()` — felles debounce-mønster for alle 4 editor-moduler
  - Steg 3: `resolveImagePreview()` — felles bilde-preview-oppslag med Drive-ID og lokal fallback
  - Steg 4: `handleImageSelected()` — felles bildevelger-callback for bilder og tannleger
  - Steg 5: `verifySave()` — felles lagreverifisering med mismatch-deteksjon
  - Steg 6: `admin-client.js` (997 linjer) → `admin-auth.js` + `admin-drive.js` + `admin-sheets.js` + re-export fasade
  - 907 tester, alle ≥80% branch coverage

- [x] **Grundig sikkerhetssjekk av hele prosjektet** ([plan](docs/archive/plan-sikkerhetssjekk.md))
  - M1: HTML-escaping (`escapeHtml()`) + programmatisk verdi-setting i 5 admin-moduler (15+ injeksjonspunkter)
  - M2: Filopplastings-validering (MIME-type + filstørrelse) i `uploadImage()`
  - M3: Input-validering (`validateSheetInput()`) for Sheets-mutasjoner
  - M7: SRI (Subresource Integrity) på alle 6 CDN-ressurser i admin
  - 15 nye sikkerhetstester (escapeHtml, validateSheetInput, uploadImage-validering)
  - Dokumentert i `docs/architecture/sikkerhet.md`

- [x] **Bekreft tilgangskontroll på adminsiden** ([plan](docs/archive/plan-tilgangskontroll.md))
  - 10 nye enhetstester: 5 tilgangskombinasjoner, 1 checkMultipleAccess blandet, 3 edge cases, 1 returverdi
  - Scenarioer: kun meldinger, kun tjenester, sheet+tannleger, kun sheet, alt unntatt sheet
  - Edge cases: tom config, manglende DOM-elementer, korrekt accessMap-retur
  - Dokumentert tilgangskontrollmodell i `docs/architecture/sikkerhet.md`
  - Branch coverage: admin-dashboard 88.8%, admin-client 94.76%

- [x] **Sjekk at alle filer som kan testes er testet** ([plan](docs/archive/plan-sjekk-testdekning.md))
  - Alle 26 testbare kildefiler har testfiler — ingen hull funnet
  - 37 nye tester (816 → 853), totalt branch coverage 88.87% → 90.87%
  - 6 filer forbedret: content.config (100%), admin-module-tjenester (98%), admin-dialog (96%), admin-editor-helpers (95%), admin-module-tannleger (89%), admin-module-bilder (82%)
  - Resterende udekte grener er defensive null-guards og jsdom-begrensninger

- [x] **Optimaliser testsuiten — fjern redundante tester** ([plan](docs/archive/plan-optimaliser-testsuite.md))
  - `admin.spec.ts`: alle 7 tester → chromium-only (14 instanser spart)
  - `sitemap-pages.spec.ts`: 5 DOM-tester → chromium-only, 2 responsive tester beholdt for alle (10 instanser spart)
  - Totalt: 54 E2E-instanser kjørt (ned fra 108), −50% redundante nettleser-instanser
  - 816 enhetstester bestått, ≥80% branch coverage, bygg OK

- [x] **Dobbelt linjeskift i markdown rendres ikke som mellomrom** ([plan](docs/archive/plan-markdown-linjeskift.md))
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

- [x] **Auto-lagring i admin (Meldinger og Tjenester)** ([plan](docs/archive/plan-auto-lagring-admin.md))
  - Debounced auto-save (1500ms) med save bar for eksisterende meldinger og tjenester
  - Nye oppføringer: «Opprett»-knapp, deretter auto-save etter opprettelse
  - Refaktorert `initMarkdownEditor()` og `initEditors()` — fjernet knapp-binding, returnerer instanser
  - Dato-validering forhindrer auto-save i meldinger (endDate < startDate)
  - 99 tester bestått, ≥85% branch coverage for alle berørte filer

- [x] **Flaky tests i E2E-tester** ([plan](docs/archive/plan-flaky-e2e.md))
  - Mobilmeny-test: bekreftet fikset med `data-open`-attributt (0 feil av 550 kjøringer)
  - Tjeneste-undersider-test: timeout under parallell last — fikset med `test.setTimeout(60_000)` + `waitUntil: 'domcontentloaded'`
  - Verifisert: 0 feil av 1100 kjøringer etter fiks, full testsuite bestått (84 E2E + 787 unit)

- [x] **Fiks galleri-relaterte E2E-feil og vis tom-melding på gallerisiden** ([plan](docs/archive/plan-galleri-e2e.md))
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

- [x] **Forbedre visuell synlighet på aktiv melding i info-banner** ([plan](docs/archive/plan-info-banner-synlighet.md))
  - Fjernet pulserende prikk, erstattet med SVG info-ikon (`w-4 h-4`, sirkel med "i")
  - Økt tekststørrelse fra `text-xs md:text-sm` til `text-sm md:text-base`
  - Økt font-weight fra `font-medium` til `font-semibold`

- [x] **Skjul galleri-lenke i meny når galleriet er tomt**
  - Layout.astro beregner `showGalleri` fra galleri-collectionen (ekskluderer forsidebilde-type)
  - Navbar.astro filtrerer bort galleri-lenken i desktop- og mobilmeny når `showGalleri` er `false`
  - galleri.astro redirecter til forsiden ved direkte tilgang til tom galleri-side

- [x] **Galleri-navigasjon: scroll vs. standalone-side — er det konsistent?** ([plan](docs/archive/plan-galleri-navigasjon.md))
  - Forsiden begrenset til 4 bilder + «Se alle bilder»-lenke på alle skjermstørrelser
  - Navbar-lenke følger samme mønster som Tjenester/Tannleger (scroll på desktop, standalone på mobil) — konsistent

- [x] **UX- og brukervennlighetsgjennomgang av admin-panelet** ([plan](docs/archive/plan-ux-brukervennlighet-admin.md))
  - 7 steg fullført: brødsmuler, skeleton-loadere, kontekstuelle feilmeldinger, lagrestatus, berøringsmål, dashboard-tall, overganger
  - Steg 1: brødsmule-nav `Dashboard / Modulnavn (N elementer)` med elementtelling per modul
  - Steg 2: skeleton-kort (thumbnail + tekstlinjer + knapper) erstatter «Henter...»-tekst
  - Steg 3: kontekstuelle feilmeldinger med auth-expired-banner og «Prøv igjen»-knapper
  - Steg 4: `showSaveBar()`/`hideSaveBar()` — fast bunnlinje med gul/grønn/rød lagrestatus
  - Steg 5: `min-w/h-[44px]` på alle ikonknapper, `w-10 h-10` på slider-step-btn (CSS-only)
  - Steg 6: aktiv-telling på dashboard-kort — tjenester (frontmatter), meldinger (datofiltrering), tannleger og galleri (Sheets)
  - Steg 7: `admin-view-enter` fade+slide-animasjon ved åpning/lukking av moduler og etter innlasting av lister

- [x] **Sett opp CloudFront på test-siden** ([plan](docs/archive/plan-cloudfront-test.md))
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

- [x] **Gjennomgang av flaky tester** ([plan](docs/archive/plan-flaky-tester.md))
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

- [x] **Kodelesbarhet — gå gjennom og forenkle koden** ([plan](docs/archive/plan-kodelesbarhet.md))
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

- [x] **Gjøre det enklere å forstå hvor innstillinger brukes på nettsiden** ([plan](docs/archive/plan-innstillinger-hint.md))
  - Lagt til «Vises på:»-hint under hver innstilling i admin-panelet
  - SETTING_HINTS-objekt med 28 nøkler som mapper til plassering på nettsiden
  - Hint vises som dempet tekst (10px) under label, før input-feltet

- [x] **Design- og UX-gjennomgang av admin-panelet** ([plan](docs/archive/plan-admin-ux.md))
  - 10 steg fullført: CLS-fiks, 5 admin-fargetokens, ~65 slate→token-erstatninger, toggle CSS refaktor, semantiske status-klasser, ikon-knapper, fokus/spacing, EasyMDE/PWA-opprydding, a11y (role=switch, aria-checked, role=status)
  - Token-drevet admin-design: alle farger via CSS-variabler (admin-surface, admin-hover, admin-border, admin-muted, admin-muted-light)
  - Ny CSS-klasser: admin-icon-btn, admin-icon-btn-danger, admin-icon-btn-reorder, admin-btn-cancel, admin-status-active/planned/expired

- [x] **UX/design-gjennomgang av den offentlige nettsiden** ([design-guide](docs/design-guide.md)) ([plan](docs/archive/plan-ux-redesign.md))
  - 13 steg fullført: typografi, fargepalett (stone), spacing, knapper, kort, navbar, footer, galleri, accent bar, 404-side, tjenester-detaljside, tilgjengelighet, CLAUDE.md
  - Token-drevet design: alle farger via CSS-variabler, self-hosted Montserrat/Inter fonter
  - Skip-link, globale fokus-stiler, fjernet nestet main, fjernet !important-overstyrringer

- [x] **Konsistent aktiv/inaktiv-visning i admin på tvers av moduler** ([plan](docs/archive/plan-konsistent-toggle.md))
  - Tannlege-editor: checkbox → toggle-switch med `data-active`
  - Galleri-editor: select/dropdown → toggle-switch med `data-active`
  - Felles `setToggleState()` og `renderToggleHtml()` hjelpefunksjoner
  - Tjeneste-editor refaktorert til å bruke samme hjelpefunksjoner
  - Alle tre editorer har identisk "Synlighet"-toggle

- [x] **Fiks wrapping av tekst i tjeneste-listen i admin på mobil** ([plan](docs/archive/plan-tjeneste-tekst-wrapping.md))
  - `line-clamp-2 sm:line-clamp-none` på h3-titler i meldinger, tjenester og tannleger
  - `self-end sm:self-auto` på knapp-containere for konsistent plassering på mobil
  - Galleri allerede OK (hadde `truncate` og `self-end`)

- [x] **Legal vurdering av dependencies** ([rapport](docs/archive/plan-legal-dependencies.md))
    - npm audit: 0 sårbarheter, alle deps aktivt vedlikeholdt
    - 97%+ permissive lisenser (MIT/Apache/BSD/ISC), 2 LGPL + 5 MPL — ingen risiko
    - MIT-lisens lagt til prosjektet (`LICENSE`)
    - Dependabot + CI-audit dekker løpende vedlikehold

- [x] **"Legg til snarvei"-lenke i admin på mobil (PWA / Add to Home Screen)** ([plan](docs/archive/plan-pwa-snarvei.md))
  - Web App Manifest (`admin-manifest.json`) med eksisterende favicon-ikoner
  - Install-prompt (`pwa-prompt.js`) med Android- og iOS-støtte
  - Toast etter innlogging, husker avvisning via localStorage
  - Meta-tagger for theme-color og apple-web-app i admin `<head>`
  - 15 enhetstester, 87.5% branch coverage

- [x] **Legg til toggling for tjenester** ([plan](docs/archive/plan-toggling-tjenester.md))
  - Toggle-switch i liste og editor, frontmatter-basert lagring (active: true/false)
  - Inaktive tjenester filtreres ut fra forsiden og standalone-sider
  - 8 nye enhetstester for toggle-funksjonaliteten

- [x] **Legg til toggling for tannleger**
  - Klikkbar toggle-switch i tannlege-listen (samme mønster som galleri)
  - Optimistisk UI-oppdatering med revert ved feil
  - 7 nye enhetstester for toggle-funksjonaliteten

- [x] **Konsolidere og rydde i E2E-tester** ([plan](docs/archive/plan-konsolidere-e2e.md))
  - Slettet `homepage.spec.ts` — mobilmeny-test flyttet til `sitemap-pages.spec.ts`
  - Slettet `services.spec.ts` — tjeneste-navigasjon og sidebar-test flyttet til `sitemap-pages.spec.ts`
  - `seo.spec.ts` og `links.spec.ts` begrenset til kun chromium-prosjektet (24 nettleser-instanser skippet)
  - Redusert fra ~99 til ~84 reelle nettleser-instanser (~15% reduksjon)

- [x] **Komprimere bokser i admin-panelet**
  - Redusert padding, gap og border-radius på admin-kort (`.admin-card`, `.admin-card-interactive`, `.admin-card-header`)
  - Mindre fontstørrelser på overskrifter (`.admin-subtitle`) og tettere spacing (`.admin-description`)
  - Kompaktere dashboard-grid (`gap-8` → `gap-5`) og container-spacing
  - Mindre knapper i lister (p-3 → p-2.5, ikoner 18px → 16px) og redusert module-content min-height

- [x] **Vurdere byggetid og test-tid på nytt** ([plan](docs/archive/plan-byggetid-test-tid.md))
  - Playwright Docker-container (`mcr.microsoft.com/playwright:v1.58.2-noble`) — eliminerer browser-install/cache-steg
  - Build slått sammen inn i e2e-jobben — eliminerer separat runner-oppstart + npm ci
  - Workers 2→4, retries 2→1 i Playwright-config
  - `build`-jobb beholdt som tynn gate (required status check) + full build for repository_dispatch
  - Forventet besparelse: ~25-35% (fra ~4 min til ~2:30-3:00 min)

- [x] **Raskere bygg ved Google Drive-oppdatering (repository_dispatch)** ([plan](docs/archive/plan-raskere-drive-bygg.md))
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

- [x] **Kodekvalitet / småfiks** ([plan](docs/archive/plan-kodekvalitet-smafiks.md))
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
