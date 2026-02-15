import { test, expect } from '@playwright/test';

test.describe('Forsiden', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('skal ha riktig tittel', async ({ page }) => {
    await expect(page).toHaveTitle(/Tenner og Trivsel/);
  });

  test('hovedoverskrift skal være synlig', async ({ page }) => {
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
  });

  test('alle hovedseksjoner skal eksistere', async ({ page }) => {
    await expect(page.locator('#kontakt')).toBeVisible();
    
    // Seksjonene under er skjult på mobil i nåværende index.astro (hidden md:block)
    // Vi sjekker kun hvis vi ikke er på mobil
    const isMobile = page.viewportSize()?.width! < 768;
    if (!isMobile) {
      await expect(page.locator('#tjenester')).toBeVisible();
      await expect(page.locator('#tannleger')).toBeVisible();
    }
  });

  test('mobilmeny skal fungere', async ({ page }) => {
    const isMobile = page.viewportSize()?.width! < 768;
    if (isMobile) {
      const menuBtn = page.locator('#menu-btn');
      const mobileMenu = page.locator('#mobile-menu');
      
      await expect(mobileMenu).toBeHidden();
      await menuBtn.click();
      await expect(mobileMenu).toBeVisible();
      await menuBtn.click();
      await expect(mobileMenu).toBeHidden();
    }
  });
});
