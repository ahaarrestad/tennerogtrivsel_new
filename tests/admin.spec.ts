import { test, expect } from '@playwright/test';

test.describe('Admin-panel Fase 1', () => {
  test('skal laste admin-siden og vise innloggingsknapp', async ({ page }) => {
    await page.goto('/admin');
    
    await expect(page).toHaveTitle(/Admin | Tenner og Trivsel/);
    const loginBtn = page.locator('#login-btn');
    await expect(loginBtn).toBeVisible();
    await expect(loginBtn).toContainText('Logg inn med Google');
  });

  test('skal ha nødvendige scripts for Google APIer', async ({ page }) => {
    await page.goto('/admin');
    
    // Sjekk at scriptene er lagt inn (vi sjekker for > 0 siden Google kan injisere ekstra scripts)
    const gapiScript = page.locator('script[src*="apis.google.com"]');
    const gsiScript = page.locator('script[src*="accounts.google.com"]');
    
    await expect(gapiScript.first()).toBeAttached();
    await expect(gsiScript.first()).toBeAttached();
  });
});
