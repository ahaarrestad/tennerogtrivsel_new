import { test, expect } from '@playwright/test';

test.describe('Tjeneste-sider', () => {
  test('skal kunne navigere til en tjeneste og se innholdet', async ({ page }) => {
    await page.goto('/');
    
    // Vi må være på desktop for å se tjenester-seksjonen i nåværende layout
    await page.setViewportSize({ width: 1280, height: 800 });
    
    const tjenesteKort = page.locator('#tjenester .card-base').first();
    const tittel = await tjenesteKort.locator('.card-title').innerText();
    
    await tjenesteKort.click();
    
    // Sjekk at vi er på en tjeneste-side
    await expect(page).toHaveURL(/\/tjenester\//);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(tittel);
    
    // Sjekk at innholdet faktisk er der (prose-klassen brukes for markdown)
    await expect(page.locator('.markdown-content')).toBeVisible();
    await expect(page.locator('.markdown-content p')).not.toHaveCount(0);
  });

  test('kontakt-info i sidebaren skal være synlig på tjeneste-sider', async ({ page }) => {
    // Gå direkte til en tjeneste (vi antar det finnes en med slug 'undersokelse' basert på vanlig tannlege-innhold)
    // Hvis ikke, vil vi feile her, men la oss prøve å finne en slug fra API-et eller bare navigere
    await page.goto('/');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('#tjenester .card-base').first().click();
    
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.locator('aside')).toContainText('Ta kontakt');
  });
});
