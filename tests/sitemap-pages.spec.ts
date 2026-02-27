import { test, expect } from '@playwright/test';

/**
 * Verifiserer at alle sider i sitemapen returnerer 200 OK
 * og har forventet grunnleggende innhold.
 */

const sitemapPages = [
  { path: '/', name: 'Forsiden' },
  { path: '/kontakt/', name: 'Kontakt' },
  { path: '/tannleger/', name: 'Om oss / Tannleger' },
  { path: '/tjenester/', name: 'Tjenester' },
  { path: '/galleri/', name: 'Galleri / Klinikken' },
];

test.describe('Sitemap-sider', () => {
  for (const { path, name } of sitemapPages) {
    test(`${name} (${path}) skal laste uten feil`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'chromium', 'DOM-sjekk er nettleser-uavhengig');
      const response = await page.goto(path);
      expect(response?.status(), `${name} ga uventet status`).toBe(200);
      await expect(page).toHaveTitle(/Tenner og Trivsel/);
      // Navbar skal alltid finnes
      await expect(page.locator('nav')).toBeVisible();
    });
  }

  test('alle tjeneste-undersider skal laste uten feil', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'DOM-sjekk er nettleser-uavhengig');
    // Denne testen besøker mange sider sekvensielt — trenger ekstra tid
    test.setTimeout(60_000);

    // Naviger til tjenester-siden og finn alle tjeneste-lenker
    await page.goto('/tjenester/');
    await page.setViewportSize({ width: 1280, height: 800 });

    const tjenesteLinks = await page.locator('a[href^="/tjenester/"]').evaluateAll(links =>
      [...new Set(links.map(a => (a as HTMLAnchorElement).getAttribute('href')).filter(Boolean))]
    );

    expect(tjenesteLinks.length).toBeGreaterThan(0);

    for (const link of tjenesteLinks) {
      const response = await page.goto(link!, { waitUntil: 'domcontentloaded' });
      expect(response?.status(), `Tjeneste ${link} ga uventet status`).toBe(200);
      await expect(page).toHaveTitle(/Tenner og Trivsel/);
    }
  });

  test('standalone-sider skal ha hvit bakgrunn (ikke brand-light)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'DOM-sjekk er nettleser-uavhengig');
    // Kontakt, Tjenester og Tannleger på egne sider skal ha hvit bakgrunn
    for (const path of ['/kontakt/', '/tannleger/', '/tjenester/', '/galleri/']) {
      await page.goto(path);
      const section = page.locator('section').first();
      const hasWhiteBg = await section.evaluate(el => el.classList.contains('bg-white'));
      expect(hasWhiteBg, `${path} section bør ha bg-white`).toBe(true);
    }
  });

  test('navigasjonsmenyen skal inneholde galleri-lenke med dynamisk tittel når galleri har bilder', async ({ page }) => {
    await page.goto('/');
    const isMobile = (page.viewportSize()?.width ?? 1280) < 1024;
    if (isMobile) {
      await page.locator('#menu-btn').click();
      const galleriLink = page.locator('#mobile-menu a[href="/galleri"]');
      const linkCount = await galleriLink.count();
      if (linkCount === 0) {
        // Galleri-lenken er skjult når galleriet er tomt — forventet oppførsel
        return;
      }
      await expect(galleriLink).toBeVisible();
      await expect(galleriLink).toContainText('Klinikken');
    } else {
      const galleriLink = page.locator('nav a[href="/#galleri"]').first();
      const linkCount = await galleriLink.count();
      if (linkCount === 0) {
        // Galleri-lenken er skjult når galleriet er tomt — forventet oppførsel
        return;
      }
      await expect(galleriLink).toBeVisible();
      await expect(galleriLink).toContainText('Klinikken');
    }
  });

  test('mobilmeny skal fungere', async ({ page }) => {
    await page.goto('/');
    const isMobile = (page.viewportSize()?.width ?? 1280) < 1024;
    if (isMobile) {
      const menuBtn = page.locator('#menu-btn');
      const mobileMenu = page.locator('#mobile-menu');

      await expect(mobileMenu).toHaveAttribute('data-open', 'false');
      await menuBtn.click();
      await expect(mobileMenu).toHaveAttribute('data-open', 'true');
      await menuBtn.click();
      await expect(mobileMenu).toHaveAttribute('data-open', 'false');
    }
  });

  test('skal kunne navigere til en tjeneste og se innholdet', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'DOM-sjekk er nettleser-uavhengig');
    await page.goto('/tjenester/');
    await page.setViewportSize({ width: 1280, height: 800 });

    const tjenesteKort = page.locator('.card-base').first();
    const tittel = await tjenesteKort.locator('.h3').innerText();

    await tjenesteKort.click();

    await expect(page).toHaveURL(/\/tjenester\//);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(tittel);

    // Sjekk at innholdet faktisk er der (prose-klassen brukes for markdown)
    await expect(page.locator('.markdown-content')).toBeVisible();
    await expect(page.locator('.markdown-content p')).not.toHaveCount(0);
  });

  test('kontakt-info i sidebaren skal være synlig på tjeneste-sider', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'DOM-sjekk er nettleser-uavhengig');
    await page.goto('/tjenester/');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('.card-base').first().click();

    await expect(page.locator('aside')).toBeVisible();
    await expect(page.locator('aside')).toContainText('Ta kontakt');
  });
});
