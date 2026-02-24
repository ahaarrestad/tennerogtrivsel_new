# Plan: Gjennomgang av flaky tester

## Kontekst

Prosjektet har `retries: 1` i Playwright-config for CI, noe som maskerer flaky-feil. En konkret test har feilet i CI nylig, og ved lokal kjøring oppstår sporadiske feil som ofte feilaktig avskrives som «flaky» uten at rotårsaken undersøkes. Målet er å identifisere og fikse rotårsakene slik at testene er deterministiske.

## Bekreftet feil fra CI

**Run #22322319345** — E2E-jobben feilet:

```
✘ [Mobile Chrome] › tests/sitemap-pages.spec.ts:70 › mobilmeny skal fungere
  Error: expect(locator).toBeHidden() failed
  Locator: locator('#mobile-menu')
  Expected: hidden
  Received: visible
```

Feilet på **både** første forsøk og retry #1.

### Rotårsak

`#mobile-menu` i Navbar.astro har `opacity-0 invisible pointer-events-none` i HTML-kildekoden. Men i Playwright-loggen mangler `invisible` fra den rendrete klasselisten — elementet har bare `opacity-0 pointer-events-none`.

Playwright vurderer et element som «visible» så lenge det har en bounding box og ikke har `visibility: hidden` eller `display: none`. `opacity: 0` alene gjør det **ikke** hidden i Playwrights øyne.

Mulige årsaker til at `invisible` mangler:
1. Tailwind v4 genererer ikke `invisible`-klassen korrekt i dev-modus
2. CSS-spesifisitet: `transition-all` kan sette `visibility: visible` som overskriver
3. Rekkefølge-issue i Tailwind v4s utility-lag

**Uansett årsak** er den underliggende svakheten at testen bruker `toBeHidden()`/`toBeVisible()` på et element som styres via CSS-klasser (`opacity` + `visibility`), som er skjørt.

## Steg

### Steg 1: Diagnostikk — reproduser og forstå

- Kjør mobilmeny-testen isolert lokalt med Mobile Chrome: `npx playwright test sitemap-pages --project="Mobile Chrome" --grep="mobilmeny"`
- Inspiser om `invisible`-klassen faktisk er til stede i den rendrete DOM-en (via `page.evaluate`)
- Sjekk om `visibility: hidden` er computed style
- Kjør 5× for å bekrefte om det er konsistent eller sporadisk

**Filer:** `tests/sitemap-pages.spec.ts`

### Steg 2: Fiks mobilmeny-synlighet

Basert på diagnostikken, mest sannsynlige fiks:

**Alternativ A (foretrukket): Bruk `data-open`-attributt og Playwright-vennlig sjekk.**
Endre `mobile-menu.js` til å sette `data-open="true"/"false"` på `#mobile-menu`. Endre testen til å sjekke dette attributtet:
```js
await expect(mobileMenu).toHaveAttribute('data-open', 'false');
```
CSS-stylingen beholder `opacity`/`invisible`-klasser for visuell effekt.

**Alternativ B: Bytt til `hidden`-attributt.**
Bruk HTML `hidden`-attributtet i stedet for CSS-klasser for toggle. Playwright håndterer dette korrekt. Men dette fjerner CSS-transisjon.

**Alternativ C: Fiks testen til å sjekke CSS.**
Bruk `toHaveCSS('opacity', '0')` i stedet for `toBeHidden()`. Ulempe: tester implementasjonsdetalj snarere enn brukersynlig atferd.

**Filer:**
- `src/scripts/mobile-menu.js` — legg til data-attributt
- `src/components/Navbar.astro` — legg til `data-open="false"` på `#mobile-menu`
- `tests/sitemap-pages.spec.ts` — endre assertion
- `src/scripts/__tests__/mobile-menu.test.js` — oppdater tester

### Steg 3: Kjør full E2E-suite

- Kjør alle E2E-tester med `retries: 0` lokalt, 3× for å verifisere stabilitet
- Sjekk at ingen andre tester feiler sporadisk

### Steg 4: Vurder å fjerne retry i CI

Når alle tester er stabile, vurder å sette `retries: 0` i CI for å avdekke fremtidige flaky-problemer umiddelbart i stedet for å maskere dem.

**Fil:** `playwright.config.ts`

## Verifisering

1. `npx playwright test sitemap-pages --project="Mobile Chrome"` — mobilmenyen passerer konsistent
2. `npx playwright test` — full suite passerer uten retries
3. `npm test` — alle enhetstester passerer
