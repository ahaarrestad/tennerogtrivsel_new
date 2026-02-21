# Claude Code Instructions

This document outlines the operational guidelines and expectations for the Claude Code agent when interacting with this project. Adhering to these instructions ensures efficient, safe, and context-aware assistance.

## Core Principles

1.  **Adherence to Project Conventions:** Always prioritize and strictly adhere to existing project conventions (formatting, naming, architectural patterns, etc.). Analyze surrounding code, tests, and configuration first.
2.  **Tool and Library Verification:** Never assume the availability or appropriateness of a new library, framework, or tool. Verify its established usage within the project.
3.  **Idiomatic Changes:** Ensure all modifications integrate naturally and idiomatically with the local context.
4.  **Comments:** Add code comments sparingly, focusing on *why* complex logic exists.
5.  **Proactive Fulfillment:** Fulfill requests thoroughly, including adding tests for new features or bug fixes.
6.  **Confirmation for Ambiguity/Expansion:** Do not take significant actions beyond the clear scope of a request without explicit confirmation.
7.  **Security and Safety:** Prioritize security best practices. Never introduce code that exposes sensitive information.
8.  **TODO-liste:** Prosjektet har en `TODO.md` i roten som sporer oppgaver. Før en oppgave startes, lag alltid en plan og still avklarende spørsmål. Hold listen oppdatert underveis — flytt oppgaver mellom seksjonene og noter fremgang.

## Kvalitetssikring (Quality Gates)

For å sikre stabilitet og unngå regresjoner, SKAL følgende sjekkliste følges før en oppgave eller endring kan markeres som ferdig:

1.  **Unit-tester:** Kjør `npm test`. Alle tester SKAL passere 100%.
2.  **Dekningsgrad (Per fil):** Sjekk coverage-rapporten fra `npm test`. **Hver enkelt fil** som inneholder kjerne-logikk (scripts og API) SKAL ha minst **80% branch coverage**. Det er ikke tilstrekkelig at totalen er over 80% hvis enkeltfiler ligger under.
3.  **E2E-tester:** Kjør `npm run test:e2e`. "Happy path" for berørt funksjonalitet SKAL verifiseres i Chromium.
4.  **Rapporteringskrav:** Før en oppgave markeres som ferdig, SKAL du liste opp de faktiske dekningsgradene (% Branch) for alle filer du har endret.
5.  **Build-sjekk:** Kjør `npm run build` lokalt for å bekrefte at prosjektet lar seg kompilere uten feil.
6.  **CI/CD Konsistens:** Hvis du har lagt til en ny miljøvariabel (i `.env`, `src/env.d.ts` eller `sync-data.js`), SKAL du verifisere at denne også er lagt til i relevante workflow-filer i `.github/workflows/` (både for `test` og `build` steg).

**AGENT-REGEL:** Du har ikke lov til å si deg ferdig eller foreslå en commit før du har presentert en fersk testrapport som viser at kravene er møtt for alle berørte filer. Enhver "ferdig"-melding uten tallgrunnlag er et brudd på instruksene. Hvis dekningsgraden faller på grunn av nye funksjoner, SKAL du skrive tester for disse før du går videre. Ved innføring av nye avhengigheter eller miljøvariabler SKAL du eksplisitt sjekke og oppdatere CI-konfigurasjonen.

## Arkitektur: Bildehåndtering (Galleri + Forsidebilde)

### Samlet galleri-ark med Type-kolonne

Forsidebildet og galleribilder deler ett Google Sheets-ark (`galleri`) med kolonner `A:I`:

| A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| Tittel | Bildefil | AltTekst | Aktiv | Rekkefølge | Skala | PosX | PosY | Type |

- **`Type`-kolonnen** skiller mellom `'galleri'` (standard) og `'forsidebilde'` (hero-bilde på forsiden).
- Kun **én rad** kan ha `type='forsidebilde'` om gangen — `setForsideBildeInGalleri()` nedgraderer automatisk den eksisterende.
- Rader uten Type-verdi tolkes som `'galleri'` (bakoverkompatibilitet).

### Dataflyt

```
Google Sheets (galleri-ark)
  ↓ sync-data.js
  ├── syncGalleri()        → src/content/galleri.json  (filtrerer UT forsidebilde-rader)
  └── syncForsideBilde()   → src/assets/hovedbilde.png (leser KUN forsidebilde-rad)
                           → public/hovedbilde.png     (beskjært OG-bilde 1200×630)
```

**Forsidebilde-fallback:** `syncForsideBilde()` prøver galleri-arket først. Hvis det ikke finnes en forsidebilde-rad (eller arket mangler), faller den tilbake til Innstillinger-arket (`forsideBilde`, `forsideBildeScale`, `forsideBildePosX`, `forsideBildePosY`).

### Admin-panelet (bilder-modul)

Nøkkelfunksjoner i `admin-client.js`:

| Funksjon | Formål |
|----------|--------|
| `getGalleriRaw()` | Henter alle rader fra galleri-arket (A:I) |
| `updateGalleriRow()` | Oppdaterer én rad inkl. type |
| `addGalleriRow()` | Legger til ny rad, sikrer at arket finnes (`ensureGalleriSheet`) |
| `setForsideBildeInGalleri()` | Setter én rad som forsidebilde, nedgraderer evt. eksisterende |
| `migrateForsideBildeToGalleri()` | One-time migrering fra Innstillinger-ark til galleri-ark |

Nøkkelfunksjoner i `admin-dashboard.js`:

| Funksjon | Formål |
|----------|--------|
| `loadGalleriListeModule()` | Viser bildeoversikt med thumbnails, badges og reorder-knapper |
| `reorderGalleriItem()` | Bytter rekkefølge mellom to naboer (opp/ned-knapper) |

**Thumbnails** lastes asynkront via `findFileByName()` + `getDriveImageBlob()` (best-effort, blokkerer ikke UI). Blob-URLer krever `blob:` i CSP `connect-src`.

### Gitignore for synkroniserte filer

Bilder og JSON-filer som lastes ned fra Google Drive er **gitignored** og synkroniseres ved bygg:

```gitignore
/src/assets/tannleger/       # Tannlege-bilder fra Drive
!src/assets/tannleger/.gitkeep
/src/assets/galleri/          # Galleribilder fra Drive
!src/assets/galleri/.gitkeep
/public/hovedbilde.png        # Generert OG-bilde
src/content/tannleger.json    # Synkronisert fra Sheets
src/content/galleri.json      # Synkronisert fra Sheets
```

`.gitkeep`-filer bevarer mappestrukturen i git.

## Arkitektur: Seksjonsbakgrunner (variant-prop)

Seksjonskomponentene (`Kontakt`, `Galleri`, `Tjenester`, `Tannleger`) tar en `variant`-prop for å kontrollere bakgrunnsfarge:

```astro
interface Props { variant?: 'white' | 'brand' }
```

- `'brand'` → `bg-brand-light` på section, `bg-brand-light/95 md:bg-transparent` på sticky header
- `'white'` → `bg-white` på section, `bg-white/95` på sticky header

### Forsiden (index.astro): Annenhver-mønster

`index.astro` beregner variant dynamisk basert på om galleriet er synlig:

```
Forside:   hvit (hero, ingen variant)
Kontakt:   brand (alltid #1)
Galleri:   white (alltid #2, betinget synlig)
Tjenester: brand hvis galleri synlig, white hvis ikke
Tannleger: motsatt av Tjenester
```

### Standalone-sider: Alltid hvit

Egne sider (`/kontakt`, `/tjenester`, `/tannleger`) bruker **alltid `variant="white"`** for konsistent hvit bakgrunn. Annenhver-mønsteret gjelder kun forsiden.

## Sikkerhet

### DOMPurify og innerHTML
All HTML som settes via `innerHTML` og som inneholder bruker- eller CMS-generert innhold, SKAL saniteres med DOMPurify. **DOMPurify fjerner alle inline event-handlere** (f.eks. `onclick="..."`). Event-lyttere MÅ derfor alltid knyttes programmatisk etter at `innerHTML` er satt — aldri som attributter i template-strenger.

```js
// Feil – onclick strippes av DOMPurify og har ingen effekt:
inner.innerHTML = DOMPurify.sanitize(`<div onclick="doSomething()">...</div>`);

// Riktig – knytt lyttere programmatisk etterpå:
inner.innerHTML = DOMPurify.sanitize(html);
inner.querySelectorAll('.my-btn').forEach(btn => {
    btn.addEventListener('click', () => doSomething());
});
```

I node-miljø (Vitest) finnes ingen DOM, så DOMPurify må mockes i testfiler:
```js
vi.mock('dompurify', () => ({ default: { sanitize: vi.fn(html => html) } }));
```

### Middleware og produksjonsmiljø
`src/middleware.ts` setter HTTP-sikkerhetsheadere (CSP, X-Frame-Options, m.fl.) og kjører i Astro dev-server og for SSR-endepunkter. **Prosjektet deployes som statiske filer til AWS S3 og har ingen kjørende server i produksjon.** Middleware påvirker derfor ikke produksjon. Dersom disse headerne skal gjelde i prod, må de konfigureres i CloudFront (Response Headers Policy) eller S3.

CSP inkluderer `blob:` i `connect-src` for å støtte thumbnail-forhåndsvisning (blob-URLer fra `getDriveImageBlob()`) i admin-panelet.

### CSP-verifisering
`tests/csp-check.spec.ts` er et manuelt verktøy for å avdekke CSP-brudd på tvers av nøkkelsider. Kjør det når `src/middleware.ts` endres, mens dev-server kjører:
```
npx playwright test csp-check --project=chromium
```

### Web Storage og modul-tilstand i tester
- Når kode under test bruker Web Storage, SKAL **begge** `localStorage.clear()` og
  `sessionStorage.clear()` kalles i `beforeEach` – ikke bare én av dem.
- `admin-client.js` har modul-nivå-variabler (`tokenClient`, `_rememberMe`, `gapiInited`,
  `gisInited`) som **ikke** nullstilles av `vi.clearAllMocks()`. Tester som er sensitive
  for denne tilstanden MÅ eksplisitt kalle de eksporterte setter-funksjonene
  (f.eks. `setRememberMe(false)`) i `beforeEach`.

## Testing

### E2E: Sitemap-sider
`tests/sitemap-pages.spec.ts` verifiserer at alle sider i sitemapen laster korrekt (200 OK), har riktig tittel, og at standalone-sider har hvit bakgrunn. Nye sider SKAL legges til i denne testfilen.

### Galleri-tester (sync-data)
`syncForsideBilde()`-tester MÅ mocke **to** `sheets.values.get`-kall: først galleri-arket, deretter Innstillinger-fallback. Eldre tester som kun mocker Innstillinger-kallet vil feile fordi koden nå prøver galleri-arket først.
