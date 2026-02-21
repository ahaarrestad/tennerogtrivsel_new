import { test, expect } from '@playwright/test';

/**
 * Verifiserer at alle sider i sitemapen returnerer 200 OK
 * og har forventet grunnleggende innhold.
 */

const sitemapPages = [
  { path: '/', name: 'Forsiden' },
  { path: '/forside/', name: 'Forside (egen side)' },
  { path: '/kontakt/', name: 'Kontakt' },
  { path: '/tannleger/', name: 'Om oss / Tannleger' },
  { path: '/tjenester/', name: 'Tjenester' },
];

test.describe('Sitemap-sider', () => {
  for (const { path, name } of sitemapPages) {
    test(`${name} (${path}) skal laste uten feil`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status(), `${name} ga uventet status`).toBe(200);
      await expect(page).toHaveTitle(/Tenner og Trivsel/);
      // Navbar skal alltid finnes
      await expect(page.locator('nav')).toBeVisible();
    });
  }

  test('alle tjeneste-undersider skal laste uten feil', async ({ page }) => {
    // Naviger til tjenester-siden og finn alle tjeneste-lenker
    await page.goto('/tjenester/');
    await page.setViewportSize({ width: 1280, height: 800 });

    const tjenesteLinks = await page.locator('a[href^="/tjenester/"]').evaluateAll(links =>
      [...new Set(links.map(a => (a as HTMLAnchorElement).getAttribute('href')).filter(Boolean))]
    );

    expect(tjenesteLinks.length).toBeGreaterThan(0);

    for (const link of tjenesteLinks) {
      const response = await page.goto(link!);
      expect(response?.status(), `Tjeneste ${link} ga uventet status`).toBe(200);
      await expect(page).toHaveTitle(/Tenner og Trivsel/);
    }
  });

  test('standalone-sider skal ha hvit bakgrunn (ikke brand-light)', async ({ page }) => {
    // Kontakt, Tjenester og Tannleger på egne sider skal ha hvit bakgrunn
    for (const path of ['/kontakt/', '/tannleger/', '/tjenester/']) {
      await page.goto(path);
      const section = page.locator('section').first();
      const hasWhiteBg = await section.evaluate(el => el.classList.contains('bg-white'));
      expect(hasWhiteBg, `${path} section bør ha bg-white`).toBe(true);
    }
  });

  test('navigasjonsmenyen skal inneholde galleri-lenke med dynamisk tittel', async ({ page }) => {
    await page.goto('/');
    const isMobile = (page.viewportSize()?.width ?? 1280) < 1024;
    if (isMobile) {
      await page.locator('#menu-btn').click();
      const galleriLink = page.locator('#mobile-menu a[href="/#galleri"]');
      await expect(galleriLink).toBeVisible();
      await expect(galleriLink).toContainText('Klinikken');
    } else {
      const galleriLink = page.locator('nav a[href="/#galleri"]').first();
      await expect(galleriLink).toBeVisible();
      await expect(galleriLink).toContainText('Klinikken');
    }
  });
});
