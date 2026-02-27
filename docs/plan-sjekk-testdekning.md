# Plan: Sjekk at alle filer som kan testes er testet

> **Status: FULLFØRT**

## 1. Kartlegging av alle testbare kildefiler

### 1.1 src/scripts/ (24 kildefiler)

| Kildefil | Testfil finnes? | Branch % (før) | Branch % (etter) |
|----------|-----------------|----------------|------------------|
| `admin-api-retry.js` | Ja | 92.1% | 92.1% |
| `admin-client.js` | Ja | 94.76% | 94.76% |
| `admin-dashboard.js` | Ja | 88.41% | 88.41% |
| `admin-dialog.js` | Ja | 86.27% | **96.07%** |
| `admin-editor-helpers.js` | Ja | 86.36% | **95.45%** |
| `admin-gallery.js` | Ja | 100% | 100% |
| `admin-init.js` | Ja | 84.74% | 84.74% |
| `admin-module-bilder.js` | Ja | 81.16% | **82.06%** |
| `admin-module-meldinger.js` | Ja | 90.27% | 90.27% |
| `admin-module-settings.js` | Ja | 88.63% | 88.63% |
| `admin-module-tannleger.js` | Ja | 83.78% | **89.18%** |
| `admin-module-tjenester.js` | Ja | 85.48% | **98.38%** |
| `generate-robots.js` | Ja | 100% | 100% |
| `getSettings.ts` | Ja | 100% | 100% |
| `image-config.js` | Ja | 100% | 100% |
| `layout-helper.js` | Ja | 100% | 100% |
| `menu-highlight.js` | Ja | 100% | 100% |
| `messageClient.js` | Ja | 100% | 100% |
| `mobile-menu.js` | Ja | 100% | 100% |
| `pwa-prompt.js` | Ja | 90% | 90% |
| `sectionVariant.ts` | Ja | 100% | 100% |
| `slugify.ts` | Ja | 100% | 100% |
| `sync-data.js` | Ja | 95.37% | 95.37% |
| `textFormatter.js` | Ja | 92% | 92% |

**Alle 24 kildefiler har testfiler og er over 80% branch coverage.**

### 1.2 src/pages/api/ (1 kildefil)

| Kildefil | Testfil finnes? | Branch % |
|----------|-----------------|----------|
| `active-messages.json.ts` | Ja | 100% |

### 1.3 Andre testbare filer

| Kildefil | Testfil finnes? | Branch % (før) | Branch % (etter) |
|----------|-----------------|----------------|------------------|
| `src/content.config.ts` | Ja | 81.81% | **100%** |
| `src/middleware.ts` | Ja | 100% | 100% |
| `src/pages/robots.txt.ts` | Nei (indirekte via `generate-robots.test.js`) | Ikke målt | — |

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

## 4. Gjennomført arbeid

### Prioritet A: Nærmest 80%-grensen

| # | Fil | Før | Etter | Status |
|---|-----|-----|-------|--------|
| A1 | `content.config.ts` | 81.81% | **100%** | ✅ Galleri-loader testet (3 nye tester) |
| A2 | `admin-module-bilder.js` | 81.16% | **82.06%** | ⚠️ Resterende er defensive null-guards |
| A3 | `admin-module-tannleger.js` | 83.78% | **89.18%** | ✅ Toggle-grener dekket (7 nye tester) |

### Prioritet B: Styrke robustheten

| # | Fil | Før | Etter | Status |
|---|-----|-----|-------|--------|
| B1 | `admin-init.js` | 84.74% | 84.74% | ⚠️ Resterende er null-guards + jsdom readyState |
| B2 | `admin-module-tjenester.js` | 85.48% | **98.38%** | ✅ Toggle + create-feil dekket (7 nye tester) |
| B3 | `admin-dialog.js` | 86.27% | **96.07%** | ✅ Timer, type-fallback, authExpired (6 nye tester) |
| B4 | `admin-editor-helpers.js` | 86.36% | **95.45%** | ✅ previewRender, flatpickr, timer (7 nye tester) |

### Udekte grener — forklaring

De resterende udekte grenene i `admin-module-bilder.js` og `admin-init.js` er:

1. **Defensive null-guards** for DOM-elementer som alltid eksisterer i innerHTML-templates (f.eks. `if (titleInput)`, `if (previewContainer)`). Å teste false-grenen ville kreve å mocke `document.getElementById` for spesifikke kall, noe som er svært kunstig og ikke tester reell funksjonalitet.

2. **jsdom-begrensninger**: `document.readyState === 'complete'` er alltid `true` i jsdom, så `else`-grenen kan ikke nås.

3. **V8 sort-komparator**: Sorteringsalgoritmen i V8 kaller komparatoren med argumenter i en rekkefølge som ikke dekker alle greiner selv med ulike testdata.

**Totalt branch coverage: 88.87% → 90.87%** (over prosjektets 80%-krav med god margin)

## 5. Resultater

| Metrikk | Før | Etter |
|---------|-----|-------|
| Enhetstester | 816 | **853** (+37) |
| Totalt branch coverage | 88.87% | **90.87%** |
| Filer under 85% | 4 | **2** |
| Filer over 90% | 15 | **19** |
