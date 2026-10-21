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

/**
 * Telefonkortet i Kontakt: på mobil er hele kortet én tel:-lenke (stor treffflate),
 * på stor skjerm et ikke-interaktivt kort. Kortet rendres i to varianter, så nøyaktig
 * én av dem skal være synlig per bredde.
 */
for (const path of ['/', '/kontakt/']) {
  test.describe(`Telefonkort i Kontakt (${path})`, () => {
    test('mobil: hele kortet er én tel:-lenke', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 800 });
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const kontakt = page.locator('#kontakt');

      await expect(kontakt.getByRole('heading', { name: 'Telefon', exact: true })).toHaveCount(1);

      // Nøyaktig én synlig tel:-lenke, og den omslutter både tittel og nummer.
      // (En nestet <a> splittes av HTML-parseren, så den viser seg som flere lenker her.)
      const telLenker = kontakt.locator('a[href^="tel:"]:visible');
      await expect(telLenker).toHaveCount(1);
      const kortLenke = telLenker.first();
      await expect(kortLenke.getByRole('heading', { name: 'Telefon', exact: true })).toBeVisible();
      await expect(kortLenke).toHaveText(/\d{2} \d{2} \d{2} \d{2}/);
      await expect(kontakt.getByRole('link', { name: /Telefon.*Ring oss/s })).toBeVisible();

      // Treffflaten er hele kortet, ikke bare nummerlinja
      await kortLenke.scrollIntoViewIfNeeded();
      const boks = await kortLenke.boundingBox();
      expect(boks?.height ?? 0).toBeGreaterThanOrEqual(250);
      const treffNedeIKortet = await page.evaluate(({ x, y }) => {
        return !!document.elementFromPoint(x, y)?.closest('a[href^="tel:"]');
      }, { x: boks!.x + boks!.width / 2, y: boks!.y + boks!.height - 12 });
      expect(treffNedeIKortet).toBe(true);
    });

    test('stor skjerm: ett ikke-interaktivt telefonkort', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const kontakt = page.locator('#kontakt');

      await expect(kontakt.getByRole('heading', { name: 'Telefon', exact: true })).toHaveCount(1);
      await expect(kontakt.locator('a[href^="tel:"]:visible')).toHaveCount(0);
    });
  });
}
