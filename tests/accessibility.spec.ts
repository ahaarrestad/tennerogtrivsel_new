import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Universell utforming (UU)', () => {
  test('forsiden skal ikke ha kritiske UU-feil', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('main');
    // Venter til siden er stabil før axe starter; løser umiddelbart mot
    // preview-bygg (CI). Den primære beskyttelsen mot Vite-dep-reload midt i
    // skannet (dev-modus) er warm-upen i tests/global-setup.ts — se
    // docs/designs/archive/2026-06-28-dev-a11y-flake-warmup.md.
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
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
      await page.waitForSelector('main');
      await page.waitForLoadState('networkidle');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(results.violations).toEqual([]);
    });
  }

  test('tjeneste-sider skal ikke ha kritiske UU-feil', async ({ page }) => {
    await page.goto('/tjenester/', { waitUntil: 'domcontentloaded' });

    // Naviger til første tjeneste — #tjenester er skjult på mobil-framsiden (hidden lg:block)
    await page.locator('#tjenester .card-base').first().click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
