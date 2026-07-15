# Plan: Oppgradering Astro 6 → 7

**Dato:** 2026-07-15
**Spec:** [docs/designs/2026-07-15-astro-v7-oppgradering.md](../designs/2026-07-15-astro-v7-oppgradering.md)

## Mål og avgrensninger

Oppgrader `astro` fra `6.3.8` til latest v7 (`^7.0.9`) med tilhørende Vite 8, uten å endre
synlig oppførsel. Ren vedlikeholdsoppgradering — ingen nye v7-funksjoner tas i bruk (se
non-goals i spec).

## Steg

### 1. Les Vite 8-migrasjonsguiden
- Gjennomgå <https://vite.dev/guide/migration> for endringer som treffer `server.proxy`,
  `optimizeDeps` og plugin-API. Noter ev. justeringer før bump.

### 0. Forutsetning: worktree-oppsett
- Kjør `bash scripts/setup-worktree.sh` i worktreet **før** build/test — henter gitignorerte
  filer (innhold, bilder, `.env`) som build og CSP-hash-generering trenger.

### 2. Bump avhengigheter
- `astro` → `^7.0.9` (eller nyeste stabile på oppgraderingstidspunktet). Astro 7 trekker inn
  `vite ^8` og `@astrojs/markdown-remark 7.2.1` transitivt.
- `@astrojs/sitemap`: **ingen versjonsbump** — `3.7.3` er nyeste (ingen v4/v5) og har ingen
  peerDependency på Astro. Blir stående; kompat verifiseres på build/runtime (steg 6/7).
- Rydd package.json-inkonsistens: installert `6.3.8` vs. `^6.4.8` — la `npm install` løse lockfilen rent.
- Kjør `npm install`, sjekk at `vite` deduper til v8 og at `@tailwindcss/vite` er kompatibel.
- **Filer:** `package.json`, `package-lock.json`.

### 3. `compressHTML` — valg (A) adopter `'jsx'`
- Beslutning tatt: behold ny default `'jsx'` (ingen config-endring nødvendig).
- Fallback kun ved påvist spacing-regresjon i steg 7: sett `compressHTML: true` i `astro.config.mjs` (B).
- **Filer:** ingen (kun `astro.config.mjs` ved fallback B).

### 4. Bygg og fiks kompilator-/config-feil
- `npm run build:ci` for ren build-verifisering (unngår `sync-data.js`/Google-creds; forutsetter
  at steg 0 har hentet innhold). Bruk `npm run build` (med sync) ved endelig full verifisering.
- Rust-kompilatoren er strengere på HTML — fiks ev. ulukkede/ugyldig nestede tags i `.astro`-filer
  som build flagger. Merk: prosjektet har ingen `astro check`, så `.astro`-typefeil dukker først
  opp her i build — ikke forvent en egen typegate.
- Fiks ev. Vite 8-relaterte config-feil (proxy/optimizeDeps).
- **Filer:** `astro.config.mjs`, berørte `src/**/*.astro`.

### 5. Regenerer og verifiser CSP-hasher
- `npm run generate-csp-hashes` — bygg-output kan ha endret inline-hasher (compressHTML/Vite 8).
- Kjør `npm run dev:secure` og verifiser ingen CSP-brudd i nettleserkonsollen.
- Hvis `security-headers.ts` endres: husk manuell CloudFront Console-synk (jf. memory/CLAUDE.md)
  — men her forventer vi kun hash-endringer i den genererte hash-fila, ikke policy-endring.
- **Filer:** generert CSP-hash-fil (og ev. `security-headers.ts` hvis hasher ligger der).

### 6. Kjør testsuite
- `npm test` (unit + coverage) — grønt, coverage-krav opprettholdt (ingen ny logikk, så
  eksisterende dekning skal holde).
- `npm run test:e2e` (Playwright) — grønt.
- `npm run lint`.

### 7. Visuell verifisering (golden path + edge)
- Kjør appen og gå gjennom: forside, tjenester, tannleger, galleri, kontakt/kontaktmodal, admin.
- Spesielt: se etter whitespace-/spacing-regresjoner fra `compressHTML`-endringen (tekst som
  klistrer seg sammen mellom inline-elementer).
- Verifiser InfoBanner (marked/dompurify klient-side) og kart (`/tiles`-proxy).

## Testbehov og definition of done

- `npm run build` grønn uten nye advarsler.
- `npm test`, `npm run test:e2e`, `npm run lint` grønne.
- CSP-hasher regenerert; `dev:secure` uten CSP-brudd.
- Manuell visuell gjennomgang bekrefter uendret utseende (særlig spacing).
- Alle akseptansekriterier i spec (1–8) oppfylt.
- Fersk testrapport presentert før commit foreslås (AGENT-REGEL i CLAUDE.md).

## Kjente risiki / usikkerheter

- **Vite 8** kan ha subtile endringer i proxy/optimizeDeps-oppførsel som først viser seg i dev
  (kart-tiles, kontakt-proxy, HMR/pre-bundling for axe-core E2E-stabilitet).
- **`compressHTML: 'jsx'`** er den mest sannsynlige kilden til synlig regresjon; håndteres av steg 3/7.
- **CSP-hash-drift** kan gi «alt ser bygget ut, men prod-CSP blokkerer» hvis hasher ikke regenereres — steg 5 er kritisk.
- **`@astrojs/sitemap` 3.7.3:** ingen peer-garanti mot Astro 7 og ingen nyere versjon. Hvis den
  bryter på build/runtime finnes ingen bump å ty til — da må vi vurdere workaround eller å bygge
  sitemap manuelt. Verifiser tidlig (steg 6 build + at `sitemap-index.xml` genereres).
- **Node:** Astro 7 krever `node >=22.12.0` (verifisert). Node 24 lokalt + CI oppfyller dette — ingen risiko.

## Rekkefølge / iterasjon

Én PR (Astro + Vite + sitemap hører sammen). Innenfor PR-en: commit bump + config/kompilatorfikser
først, deretter CSP-hash-regenerering som egen commit hvis hashene endres — så diffen er lesbar.
