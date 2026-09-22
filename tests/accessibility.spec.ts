import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

// Deterministisk «siden er klar for axe»: DOM parset (domcontentloaded), innhold på plass
// (main), stilark lastet (link.sheet — trengs for color-contrast) og fonter klare.
//
// Bevisst verken 'networkidle' eller 'load': /admin laster Google-skript (gapi + GSI)
// som «async defer», og begge hendelsene venter på dem — 'load' på selve nedlastingen,
// 'networkidle' på hele den serielle kjeden apis → accounts → content.googleapis.
// Det gjorde testen avhengig av tre eksterne verters latens og stoppet en deploy i CI
// 2026-09-15. Ingen av sjekkene her rører nettverket utover localhost. Vite-dep-reload i
// dev-modus dekkes av warm-upen i tests/global-setup.ts.
// Se docs/designs/archive/2026-09-22-stabiliser-ustabile-tester.md.
async function ventTilKlarForAxe(page: Page): Promise<void> {
  await page.waitForSelector('main');
  // Eget, kort timeout: et stilark som feiler (404/CSP) får .sheet === null for alltid,
  // og da skal testen feile her — ikke først på 30 s-grensen med generisk melding.
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"]')).every(
        (l) => l.sheet !== null,
      ),
    undefined,
    { timeout: 10_000 },
  );
  await page.evaluate(() => document.fonts.ready);
}

async function forventIngenBrudd(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
}

test.describe('Universell utforming (UU)', () => {
  test('forsiden skal ikke ha kritiske UU-feil', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await ventTilKlarForAxe(page);
    await forventIngenBrudd(page);
  });

  const standaloneSider = [
    { path: '/kontakt/', name: 'Kontakt' },
    { path: '/tannleger/', name: 'Tannleger' },
    { path: '/tjenester/', name: 'Tjenester' },
    { path: '/galleri/', name: 'Galleri' },
    { path: '/admin', name: 'Admin' },
  ];

  for (const { path, name } of standaloneSider) {
    test(`${name} (${path}) skal ikke ha kritiske UU-feil`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await ventTilKlarForAxe(page);
      await forventIngenBrudd(page);
    });
  }

  test('tjeneste-sider skal ikke ha kritiske UU-feil', async ({ page }) => {
    await page.goto('/tjenester/', { waitUntil: 'domcontentloaded' });

    // Naviger til første tjeneste — #tjenester er skjult på mobil-framsiden (hidden lg:block)
    await page.locator('#tjenester .card-base').first().click();
    await page.waitForLoadState('domcontentloaded');
    await ventTilKlarForAxe(page);
    await forventIngenBrudd(page);
  });
});
