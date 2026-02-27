# Plan: Sjekk at alle filer som kan testes er testet

## 1. Kartlegging av alle testbare kildefiler

### 1.1 src/scripts/ (24 kildefiler)

| Kildefil | Testfil finnes? | Branch % |
|----------|-----------------|----------|
| `admin-api-retry.js` | Ja | 92.1% |
| `admin-client.js` | Ja | 94.76% |
| `admin-dashboard.js` | Ja | 88.41% |
| `admin-dialog.js` | Ja | 86.27% |
| `admin-editor-helpers.js` | Ja | 86.36% |
| `admin-gallery.js` | Ja | 100% |
| `admin-init.js` | Ja | 84.74% |
| `admin-module-bilder.js` | Ja | 81.16% |
| `admin-module-meldinger.js` | Ja | 90.27% |
| `admin-module-settings.js` | Ja | 88.63% |
| `admin-module-tannleger.js` | Ja | 83.78% |
| `admin-module-tjenester.js` | Ja | 85.48% |
| `generate-robots.js` | Ja | 100% |
| `getSettings.ts` | Ja | 100% |
| `image-config.js` | Ja | 100% |
| `layout-helper.js` | Ja | 100% |
| `menu-highlight.js` | Ja | 100% |
| `messageClient.js` | Ja | 100% |
| `mobile-menu.js` | Ja | 100% |
| `pwa-prompt.js` | Ja | 90% |
| `sectionVariant.ts` | Ja | 100% |
| `slugify.ts` | Ja | 100% |
| `sync-data.js` | Ja | 95.37% |
| `textFormatter.js` | Ja | 92% |

**Alle 24 kildefiler har testfiler og er over 80% branch coverage.**

### 1.2 src/pages/api/ (1 kildefil)

| Kildefil | Testfil finnes? | Branch % |
|----------|-----------------|----------|
| `active-messages.json.ts` | Ja | 100% |

### 1.3 Andre testbare filer

| Kildefil | Testfil finnes? | Branch % |
|----------|-----------------|----------|
| `src/content.config.ts` | Ja | 81.81% |
| `src/middleware.ts` | Ja | 100% |
| `src/pages/robots.txt.ts` | Nei (indirekte via `generate-robots.test.js`) | Ikke målt |

### 1.4 E2E-tester (Playwright)

| Testfil | Dekker |
|---------|--------|
| `tests/accessibility.spec.ts` | WCAG/a11y for alle standalone-sider |
| `tests/admin.spec.ts` | Admin-panelet |
| `tests/csp-check.spec.ts` | CSP-headere (manuell, ekskludert fra CI) |
| `tests/links.spec.ts` | Lenker på tvers av sider |
| `tests/seo.spec.ts` | SEO-metadata, canonical, schema.org |
| `tests/sitemap-pages.spec.ts` | Sidenavigasjon, mobilmeny, tjeneste-undersider |

## 2. Filer som IKKE trenger enhetstester

| Filtype | Antall | Begrunnelse |
|---------|--------|-------------|
| `.astro`-komponenter | 13 | Deklarative templates — testbar logikk er ekstrahert til scripts. Dekkes av E2E. |
| `src/env.d.ts` | 1 | Ren type-deklarasjon, ingen kjøretidslogikk. |
| `src/__mocks__/astroContent.ts` | 1 | Test-infrastruktur — skal ikke testes selv. |
| `src/pages/robots.txt.ts` | 1 | Tynn wrapper (6 linjer logikk). Delegerer til `generateRobotsTxt()` som er 100% testet. |

## 3. Konklusjon: Ingen hull i testdekningen

**Alle 26 testbare kildefiler har dedikerte testfiler.** Ingen filer mangler tester. Alle oppfyller 80% branch coverage-kravet.

## 4. Prioritert handlingsplan — heve marginen

Selv om ingen filer mangler tester, har noen filer liten margin til 80%-kravet. Disse bør styrkes for å tåle fremtidige endringer.

### Prioritet A: Nærmest 80%-grensen (risiko for å falle under)

| # | Fil | Nå | Mål | Estimat |
|---|-----|----|-----|---------|
| A1 | `content.config.ts` | 81.81% | 90%+ | 30 min — galleri-loaderens normal-bane |
| A2 | `admin-module-bilder.js` | 81.16% | 85%+ | 45 min — feilhåndtering-paths |
| A3 | `admin-module-tannleger.js` | 83.78% | 88%+ | 45 min — toggle-edge-cases |

### Prioritet B: Styrke robustheten (85–90%)

| # | Fil | Nå | Mål | Estimat |
|---|-----|----|-----|---------|
| B1 | `admin-init.js` | 84.74% | 90%+ | 30 min — login-feilhåndtering |
| B2 | `admin-module-tjenester.js` | 85.48% | 90%+ | 30 min — auto-save og toggle |
| B3 | `admin-dialog.js` | 86.27% | 90%+ | 30 min — timer-logikk |
| B4 | `admin-editor-helpers.js` | 86.36% | 90%+ | 30 min — feilhåndtering i editor |

### Prioritet C: Ytterligere forbedring (valgfritt, allerede over 88%)

| # | Fil | Nå | Mål | Estimat |
|---|-----|----|-----|---------|
| C1 | `admin-dashboard.js` | 88.41% | 92%+ | 45 min |
| C2 | `admin-module-settings.js` | 88.63% | 92%+ | 30 min |
| C3 | `admin-module-meldinger.js` | 90.27% | 93%+ | 20 min |
| C4 | `pwa-prompt.js` | 90% | 95%+ | 20 min |
| C5 | `textFormatter.js` | 92% | 95%+ | 20 min |
| C6 | `admin-api-retry.js` | 92.1% | 95%+ | 20 min |

## 5. Estimert omfang

| Prioritet | Antall filer | Estimert tid | Beskrivelse |
|-----------|-------------|--------------|-------------|
| A (kritisk) | 3 filer | ~2 timer | Heve filer nærmest 80%-grensen |
| B (anbefalt) | 4 filer | ~2 timer | Styrke robustheten til 90%+ |
| C (valgfritt) | 6 filer | ~2.5 timer | Perfeksjonering til 92–95%+ |
| **Totalt** | **13 filer** | **~6.5 timer** | **Full gjennomgang** |

**Anbefaling:** Prioritet A og B bør gjøres (~4 timer). Prioritet C er valgfritt og kan gjøres iterativt ved fremtidige endringer.
