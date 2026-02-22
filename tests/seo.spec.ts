import { test, expect } from '@playwright/test';

test.describe('SEO og Metadata', () => {
  test('forsiden skal ha korrekt SEO-metadata', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Tenner og Trivsel/);

    const description = page.locator('meta[name="description"]');
    await expect(description).toHaveAttribute('content', /.+/);

    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /Tenner og Trivsel/);
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website');
  });

  test('tjeneste-sider skal ha dynamisk SEO-metadata', async ({ page }) => {
    await page.goto('/');
    await page.setViewportSize({ width: 1280, height: 800 });

    const tjenesteKort = page.locator('#tjenester .card-base').first();
    const tittel = await tjenesteKort.locator('.h3').innerText();

    await tjenesteKort.click();

    await expect(page).toHaveTitle(new RegExp(tittel));
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', new RegExp(tittel));
  });

  test('alle bilder bør ha alt-tekst', async ({ page }) => {
    await page.goto('/');

    const images = page.locator('img');
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      await expect(img).toHaveAttribute('alt');
    }
  });

  test('alle sider skal ha canonical-tag', async ({ page }) => {
    const pages = ['/', '/kontakt/', '/tjenester/', '/tannleger/', '/galleri/'];
    for (const path of pages) {
      await page.goto(path);
      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical, `${path} mangler canonical-tag`).toHaveAttribute('href', new RegExp(`https://www\\.tennerogtrivsel\\.no${path === '/' ? '/$' : path}`));
    }
  });

  test('/forside/ skal ikke eksistere (fjernet duplikat)', async ({ page }) => {
    const response = await page.goto('/forside/');
    expect(response?.status()).toBe(404);
  });

  test('standalone-sider skal ha unike titler', async ({ page }) => {
    const titles = new Set<string>();
    const pages = ['/', '/kontakt/', '/tjenester/', '/tannleger/', '/galleri/'];
    for (const path of pages) {
      await page.goto(path);
      const title = await page.title();
      expect(title, `${path} har tom tittel`).toBeTruthy();
      titles.add(title);
    }
    expect(titles.size, 'Alle sider bør ha unike titler').toBe(pages.length);
  });

  test('standalone-sider skal ha meta description', async ({ page }) => {
    const descriptions = new Set<string>();
    const pages = ['/kontakt/', '/tjenester/', '/tannleger/', '/galleri/'];
    for (const path of pages) {
      await page.goto(path);
      const desc = await page.locator('meta[name="description"]').getAttribute('content');
      expect(desc, `${path} mangler description`).toBeTruthy();
      descriptions.add(desc!);
    }
    expect(descriptions.size, 'Standalone-sider bør ha unike beskrivelser').toBe(pages.length);
  });

  test('alle sider skal ha komplett OpenGraph-metadata', async ({ page }) => {
    const pages = ['/', '/kontakt/', '/tjenester/', '/tannleger/', '/galleri/'];
    for (const path of pages) {
      await page.goto(path);
      await expect(page.locator('meta[property="og:locale"]'), `${path} mangler og:locale`).toHaveAttribute('content', 'nb_NO');
      await expect(page.locator('meta[property="og:site_name"]'), `${path} mangler og:site_name`).toHaveAttribute('content', 'Tenner og Trivsel');
      await expect(page.locator('meta[property="og:image:width"]'), `${path} mangler og:image:width`).toHaveAttribute('content', '1200');
      await expect(page.locator('meta[property="og:image:height"]'), `${path} mangler og:image:height`).toHaveAttribute('content', '630');
    }
  });

  test('alle sider skal ha Twitter Card-metadata', async ({ page }) => {
    const pages = ['/', '/kontakt/', '/tjenester/', '/tannleger/', '/galleri/'];
    for (const path of pages) {
      await page.goto(path);
      await expect(page.locator('meta[name="twitter:card"]'), `${path} mangler twitter:card`).toHaveAttribute('content', 'summary_large_image');
      await expect(page.locator('meta[name="twitter:title"]'), `${path} mangler twitter:title`).toHaveAttribute('content', /.+/);
      await expect(page.locator('meta[name="twitter:description"]'), `${path} mangler twitter:description`).toHaveAttribute('content', /.+/);
      await expect(page.locator('meta[name="twitter:image"]'), `${path} mangler twitter:image`).toHaveAttribute('content', /hovedbilde\.png/);
    }
  });

  test('forsiden skal ha Schema.org JSON-LD for Dentist', async ({ page }) => {
    await page.goto('/');
    const jsonLd = page.locator('script[type="application/ld+json"]');
    await expect(jsonLd).toBeAttached();
    const content = await jsonLd.textContent();
    const data = JSON.parse(content!);
    expect(data['@type']).toBe('Dentist');
    expect(data['@context']).toBe('https://schema.org');
    expect(data.name).toBeTruthy();
    expect(data.telephone).toBeTruthy();
    expect(data.address).toBeTruthy();
    expect(data.address['@type']).toBe('PostalAddress');
  });
});
