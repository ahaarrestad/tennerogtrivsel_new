# Spec: Oppgradering Astro 6 → 7

**Dato:** 2026-07-15
**Type:** Vedlikehold / avhengighetsoppgradering

## Problem / mål

Prosjektet står på Astro `6.3.8` (`^6.4.8` i package.json). Astro 7 er ute (latest `7.0.9`)
og bringer Vite 8, ny Rust-basert kompilator og et par default-endringer. Vi vil holde
rammeverket oppdatert for sikkerhetsfikser, ytelse og fortsatt tilgang til
community-integrasjoner, uten å endre nettstedets synlige oppførsel.

## Bakgrunn: hva er nytt i v7 (fra offisiell oppgraderingsguide)

Verifisert mot <https://docs.astro.build/en/guides/upgrade-to/v7/> (ordrette sitat hentet 2026-07-15).

| Breaking change | Beskrivelse |
|---|---|
| **Vite 8** | Ny dev-server og prod-bundler. Custom Vite-config må gjennomgås mot Vite 8-migrasjonsguiden. |
| **Rust-kompilator (default)** | Strengere HTML: krever lukketags på alle ikke-void-elementer, auto-korrigerer ikke lenger ugyldig nesting. |
| **`compressHTML` default `true` → `'jsx'`** | Whitespace mellom inline-elementer strippes etter JSX-regler i stedet for HTML-regler. Kan endre synlig tekst-spacing. |
| **Sätteri som markdown-pipeline** | Erstatter remark/rehype som default for `.md`/`.mdx`. remark/rehype fortsatt mulig via `@astrojs/markdown-remark` / `unified()`-opt-in. |
| **`src/fetch.ts` reservert** | Nytt spesialfilnavn for «advanced routing». |
| **`@astrojs/db` fjernet** | Migrer til alternativer. |
| **`astro:transitions`-interne API fjernet** | `createAnimationScope()`, `TRANSITION_BEFORE_PREPARATION` m.fl. |
| **`getContainerRenderer()` flyttet** | Nå eget `container-renderer`-entrypoint. |

## Hvordan hver endring treffer *dette* prosjektet

| Endring | Treffer oss? | Vurdering |
|---|---|---|
| Vite 8 | **Ja** | `astro.config.mjs` har custom Vite: `@tailwindcss/vite`-plugin, `server.proxy` (`/tiles`, `/api/kontakt`), `optimizeDeps`. `@tailwindcss/vite` støtter allerede `vite ^8`. Proxy/optimizeDeps-API må sjekkes mot Vite 8. **Medium.** |
| Rust-kompilator strengere HTML | **Ja** | 29 `.astro`-filer. Build vil feile på ev. ulukkede tags. Fanges av build. **Medium.** |
| `compressHTML` → `'jsx'` | **Ja** | Kan endre synlig whitespace mellom inline-elementer. Krever visuell verifisering. Se «Åpen beslutning». **Medium.** |
| Sätteri markdown | **Lav** | `.md`-filer finnes i `tjenester/` og `meldinger/`, men komponentene bruker kun frontmatter (`Tjenester.astro` → `.data.ingress`). Markdown-*brødtekst* rendres ikke via `render()`/`.Content`. Ingen custom remark/rehype-plugins. Verifiser at meldinger/tjenester-output er uendret. |
| `src/fetch.ts` reservert | **Nei** | Fila finnes ikke. |
| `@astrojs/db` | **Nei** | Ikke i bruk. |
| `astro:transitions`-interne | **Nei** | Ikke i bruk (ingen ViewTransitions/transitions i `src/`). |
| `getContainerRenderer` | **Nei** | Ikke i bruk. |
| `@astrojs/sitemap` | **Lav** | `3.7.3` er nyeste (ingen v4/v5). Deklarerer **ingen** peerDependency på Astro, så install blokkeres ikke — men kompat er heller ikke peer-garantert. Må verifiseres på build/runtime (at sitemap faktisk genereres). Ingen versjonsbump tilgjengelig. |

**Node-krav:** Astro 7 krever `node >=22.12.0` (verifisert mot npm). Vi kjører Node 24 lokalt og i
CI (`deploy.yml`) — godt innenfor. Ingen Node-oppgradering nødvendig.

**Prosjektspesifikk risiko — CSP-hasher:** `generate-csp-hashes.mjs` genererer hasher fra
byggeoutput. Både `compressHTML`-endringen og Vite 8 kan endre inline-script/style-output og
dermed hashene. CSP-hasher SKAL regenereres og verifiseres etter oppgraderingen (jf.
sikkerhetsarkitekturen og CloudFront-header-synk).

## Funn under implementasjon

**`vite: ^7`-override måtte bumpes.** package.json hadde `overrides.vite: "^7"` (lagt inn i
commit 9e85d68 *«lås vite til ^7 for å unngå konflikt med astro 6»*). Denne overstyrte astro 7s
krav om `vite ^8.0.13` og holdt vite på 7.3.6 uten ERESOLVE — en stille inkonsistens. Løst ved å
bumpe overriden til `^8`. `overrides.esbuild: "^0.28.1"` (sikkerhets-pin, commit fdeb229) er
kompatibel med astro 7 (`^0.28.0`) og beholdes uendret.

**Astro 7: `astro dev` auto-daemoniserer under AI-agent.** Astro 7 gjør `astro dev` til en
bakgrunns-daemon (`astro dev stop/status/logs`). Doksen: flagget `--background` *«is provided
automatically when an AI agent is detected»*. Konsekvens:
- **Vanlig utvikler i eget terminal:** foreground — Playwright/`dev:secure` fungerer normalt.
- **CI (`deploy.yml`):** E2E bruker `npm run preview` (ikke `dev`), ingen agent — upåvirket.
- **Kun inne i en AI-agent** (f.eks. Claude Code): `astro dev` backgrounder → Playwright sin
  `webServer.command` «exited early». Verifisering fra agent gjøres ved å pre-starte serveren og
  la Playwright gjenbruke den (`reuseExistingServer: true` lokalt). Ingen kode-/config-endring
  kreves — dette rammer verken bruker eller CI.

## Deploy-verifisering (Astro 7)

Deploy skjer via `.github/workflows/deploy.yml`: `npm ci --ignore-scripts` → test/lint/E2E →
`npm run sync` (ekte Drive-data) → `build:ci` → last opp `dist/` → `aws s3 sync dist/_astro/`,
`dist/fonts/`, `dist/` → CloudFront-invalidering. Verifisert under v7:
- `build:ci` bygger `dist/` med forventet struktur (`_astro/`, `fonts/`, sider, `sitemap-index.xml`
  + `sitemap-0.xml`, `robots.txt`, `llms.txt`, favicons) — S3-sync-stiene stemmer.
- `astro preview` (CI-E2E-serveren) kjører foreground under v7 og svarer HTTP 200.
- `package-lock.json` regenerert → `npm ci` er i sync.
- CSP-hasher regenereres fra `dist/` som før (deploy-steget «Generate CSP hashes from build output»).

## Krav og akseptansekriterier

1. `astro` oppgradert til `^7.x` (latest stabil), `@astrojs/sitemap` på v7-kompatibel versjon.
2. `npm run build` fullfører uten feil eller nye advarsler.
3. Alle enhetstester (`npm test`) og E2E (`npm run test:e2e`) er grønne.
4. CSP-hasher regenerert; `dev:secure` kjører uten CSP-brudd i konsollen.
5. Nettstedet er visuelt uendret (forside, tjenester, tannleger, galleri, kontakt, admin) —
   spesielt mtp. `compressHTML`-whitespace-endringen.
6. `astro.config.mjs` fungerer under Vite 8 (proxy, tailwind, optimizeDeps).
7. Ingen nye miljøvariabler introdusert (ellers: oppdater `.github/workflows/` per CLAUDE.md).
8. CI (`deploy.yml`) bygger grønt på Node 24.

## Avgrensninger / non-goals

- **Ingen** adopsjon av nye v7-funksjoner (advanced routing/`src/fetch.ts`, Sätteri-plugins,
  server islands e.l.). Dette er en ren vedlikeholdsoppgradering.
- Ingen refaktorering av markdown-innhold eller CMS-flyt.
- Ingen andre avhengighetsoppgraderinger enn de v7 krever (Vite følger med Astro).
- Ingen visuelle/designendringer.

## Beslutning: `compressHTML` (avklart 2026-07-15)

**`compressHTML`-default endres fra `true` til `'jsx'`.** **Valgt: (A) adopter ny default `'jsx'`**
og verifiser visuelt at spacing er uendret — holder oss på rammeverkets standard.

Fallback hvis vi finner en synlig spacing-regresjon som er vanskelig å fikse i markup: pinn
`compressHTML: true` eksplisitt i `astro.config.mjs` (alternativ B). Kun hvis (A) gir regresjon.

## Designvalg

- Én samlet oppgradering (Astro + Vite + sitemap i samme PR), siden Vite-bumpen er en tvungen
  del av Astro-bumpen og ikke gir mening å splitte.
- Verifisering skjer via eksisterende kvalitetsporter (build, unit, E2E, CSP) framfor ny
  test-infrastruktur — oppgraderingen endrer ikke funksjonalitet, bare motor.
