# Plan: Sjekk hvordan sidene fungerer på iPhone

## Bakgrunn

Prosjektet tester i dag med Desktop Chrome, Desktop Safari og Mobile Chrome (Pixel 5) i Playwright — men **Mobile Safari mangler**. iOS Safari har kjente forskjeller fra desktop Safari, spesielt rundt sticky-posisjonering, `<dialog>`-elementet, fixed positioning og viewport-beregninger.

## Funn fra analyse

### Potensielle problemer

| Problem | Alvorlighet | Påvirker |
|---------|-------------|----------|
| Ingen Mobile Safari i Playwright | Høy | Testdekning |
| `<dialog>` + `::backdrop` styling (Safari < 17) | Medium | Admin (modaler, bekreftelsesdialog) |
| Sticky navbar + iOS adresselinje | Medium | Offentlig side (alle seksjoner) |
| Sticky card-stacking (`--card-index` calc) | Medium | Kontakt-kort på mobil |
| Fixed toast-posisjon (`bottom: 1.5rem`) | Lav | Admin (lagremeldinger) |
| Viewport meta mangler `initial-scale=1` | Lav | Begge |
| EasyMDE-toolbar overflow på smal skjerm | Lav | Admin (tjeneste-editor) |

### Allerede OK

- Touch targets er 44×44px (Apple HIG)
- `backdrop-filter` har `supports()`-fallback
- `touch-action: pan-y` på range-slidere
- PWA har iOS-deteksjon (`isIOS()`) og `navigator.standalone`
- Ingen `100vh`-bruk (unngår adresselinje-problemet)
- Self-hosted fonter (ingen ekstern CDN-avhengighet)

## Plan

### Steg 1: Legg til Mobile Safari i Playwright

**Fil:** `playwright.config.ts`

Legg til iPhone 14-prosjekt:
```js
{
  name: 'Mobile Safari',
  use: { ...devices['iPhone 14'] },
}
```

Kjør hele testsuiten og noter feil som er spesifikke for Mobile Safari.

### Steg 2: Fiks testfeil fra Mobile Safari

Gå gjennom feilende tester og klassifiser:
- **Ekte Safari-bugs** → fiks koden
- **Test-spesifikke problemer** (viewport-størrelse, touch vs. click) → tilpass testene
- **Browser-uavhengige tester** → legg til `test.skip` for Mobile Safari der det gir mening (f.eks. SEO-metadata)

### Steg 3: Viewport og safe-area forbedringer

**Filer:** `Layout.astro`, `admin/index.astro`

- Legg til `initial-scale=1` i viewport meta-tag
- Vurder `viewport-fit=cover` + `safe-area-inset-*` CSS for notch-enheter (kun hvis det påvirker layout)

### Steg 4: Dialog-fallback for eldre Safari

**Fil:** `admin-dialog.js`, `admin/index.astro`

Sjekk om `<dialog>` fungerer i Playwrights WebKit-engine:
- Hvis ja: ingen endring nødvendig (WebKit i Playwright matcher Safari 16+)
- Hvis nei: legg til enkel polyfill eller fallback-styling

### Steg 5: Verifiser sticky-posisjonering

Kjør E2E-tester som involverer scroll-atferd på Mobile Safari:
- Navbar sticky wrapper
- Sticky section headers
- Card stacking i Kontakt-seksjonen

Fiks eventuelle layout-problemer med fallback-verdier for `--nav-total-height`.

### Steg 6: Kvalitetssjekk

- Alle eksisterende enhetstester består
- E2E-tester består for alle 4 Playwright-prosjekter (inkl. Mobile Safari)
- Bygg OK

## Avhengigheter

- Ingen eksterne avhengigheter — Playwright inkluderer WebKit-engine
- Steg 2–5 avhenger av funn i steg 1

## Estimert omfang

- Steg 1: Konfig-endring + testkjøring
- Steg 2–5: Avhenger av antall feil som dukker opp — sannsynligvis småfikser
- Hovedsakelig test-infrastruktur, minimale kodeendringer på selve nettsiden
