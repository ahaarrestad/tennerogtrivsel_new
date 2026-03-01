import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Universell utforming (UU)', () => {
  test('forsiden skal ikke ha kritiske UU-feil', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('main');

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

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(results.violations).toEqual([]);
    });
  }

  test('tjeneste-sider skal ikke ha kritiske UU-feil', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.setViewportSize({ width: 1280, height: 800 });

    // Naviger til første tjeneste
    await page.locator('#tjenester .card-base').first().click();
    await page.waitForLoadState('domcontentloaded');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
