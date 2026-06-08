import { test, expect } from '@playwright/test';

/**
 * Regresjonsvern for tab-rekkefølge-bug: telefonnummeret skal være en ekte
 * tel:-lenke på mobil (tap-to-call), men ren, ikke-fokuserbar tekst på stor
 * skjerm der det kun er informativt. Tester begge breakpoints eksplisitt slik
 * at resultatet er deterministisk uavhengig av Playwright-prosjektets viewport.
 */
test.describe('Telefon — tab-rekkefølge', () => {
  test('stor skjerm: ingen synlig/fokuserbar tel:-lenke', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('main');

    // tel:-lenkene finnes i DOM (mobil-variant), men skal alle være skjult (lg:hidden)
    const telLinks = page.locator('a[href^="tel:"]');
    await expect(telLinks).not.toHaveCount(0);
    await expect(page.locator('a[href^="tel:"]:visible')).toHaveCount(0);
  });

  test('mobil: tel:-lenke er synlig og fokuserbar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('main');

    const visibleTel = page.locator('a[href^="tel:"]:visible').first();
    await expect(visibleTel).toBeVisible();

    // Skal kunne motta tastaturfokus (er i tab-rekkefølgen)
    await visibleTel.focus();
    await expect(visibleTel).toBeFocused();
  });
});
