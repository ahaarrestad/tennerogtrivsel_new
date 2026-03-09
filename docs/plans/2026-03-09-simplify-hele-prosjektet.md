# Plan: Kjør simplify på hele prosjektet

## Mål

Systematisk gjennomgang av hele kodebasen med tre fokusområder:

- **CSS-konsistens** — Bruk `global.css`-variabler og token-klasser, fjern hardkodede verdier og duplisert styling
- **Kodekvalitet** — Gode metoder, fjern duplisering, forenkle logikk, rydd opp i hacky patterns
- **Testkvalitet** — Sjekk at tester er vedlikeholdbare, følger test-guiden, og dekker viktig logikk

## Batches

Hver batch kjøres som en egen `/simplify`-runde med commit per batch.

### Batch 1: Admin-moduler

- `admin-module-bilder.js` + test
- `admin-module-meldinger.js` + test
- `admin-module-prisliste.js` + test
- `admin-module-settings.js` + test
- `admin-module-tannleger.js` + test
- `admin-module-tjenester.js` + test

### Batch 2: Admin-infrastruktur

- `admin-auth.js` + test
- `admin-client.js` + test
- `admin-api-retry.js` + test
- `admin-sheets.js` + test
- `admin-drive.js` + test
- `admin-init.js` + test
- `admin-dashboard.js` + test

### Batch 3: Admin UI-hjelpere

- `admin-dialog.js` + test
- `admin-editor-helpers.js` + test
- `admin-gallery.js` + test
- `admin-reorder.js` + test
- `admin-transition.js` + test

### Batch 4: Frontend-scripts

- `mobile-menu.js` + test
- `menu-highlight.js` + test
- `layout-helper.js` + test
- `pwa-prompt.js` + test
- `messageClient.js` + test
- `textFormatter.js` + test
- `image-config.js` + test

### Batch 5: Astro-komponenter + CSS

- Alle `.astro`-filer (components, layouts, pages)
- `global.css`

### Batch 6: Build/config

- `sync-data.js` + test
- `generate-robots.js` + test

## Per batch

1. Kjør `/simplify` med tre parallelle agenter (gjenbruk, kvalitet, effektivitet)
2. Fiks funn direkte
3. Kjør quality gate (tester + coverage)
4. Commit via `/commit`

## Ikke i scope

- Nye features eller funksjonalitet
- Arkitekturendringer
- Endringer i avhengigheter
