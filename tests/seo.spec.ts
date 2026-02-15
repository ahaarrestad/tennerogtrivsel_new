import { test, expect } from '@playwright/test';

test.describe('SEO og Metadata', () => {
  test('forsiden skal ha korrekt SEO-metadata', async ({ page }) => {
    await page.goto('/');
    
    // Sjekk tittel
    await expect(page).toHaveTitle(/Tenner og Trivsel | Din Tannlege i Stavanger/);
    
    // Sjekk meta-description (hvis den finnes)
    const description = page.locator('meta[name="description"]');
    // Vi forventer at den finnes, men ikke nødvendigvis hva den inneholder akkurat nå
    // Hvis den mangler, vil denne testen feile og vi bør legge den til.
    await expect(description).toHaveAttribute('content', /.+/);
    
    // Sjekk OpenGraph tags
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /Tenner og Trivsel/);
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website');
  });

  test('tjeneste-sider skal ha dynamisk SEO-metadata', async ({ page }) => {
    await page.goto('/');
    await page.setViewportSize({ width: 1280, height: 800 });
    
    const tjenesteKort = page.locator('#tjenester .card-base').first();
    const tittel = await tjenesteKort.locator('.h3').innerText();
    
    await tjenesteKort.click();
    
    // Sjekk at tittelen inneholder tjenestens navn
    await expect(page).toHaveTitle(new RegExp(tittel));
    
    // Sjekk OpenGraph tittel på undersiden
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', new RegExp(tittel));
  });

  test('alle bilder bør ha alt-tekst', async ({ page }) => {
    await page.goto('/');
    
    const images = page.locator('img');
    const count = await images.count();
    
    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      // Alle bilder skal ha en alt-attributt (kan være tom for dekorative bilder, men bør finnes)
      await expect(img).toHaveAttribute('alt');
    }
  });
});
