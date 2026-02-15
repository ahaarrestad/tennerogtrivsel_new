import { test, expect } from '@playwright/test';

test.describe('Admin-panel Fase 1', () => {
  test('skal laste admin-siden og vise innloggingsknapp', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveTitle(/Admin | Tenner og Trivsel/);
    await expect(page.locator('#login-btn')).toBeVisible();
  });

  test('skal kunne åpne meldinger og se sortert liste', async ({ page }) => {
    // Mock login state
    await page.addInitScript(() => {
      localStorage.setItem('admin_google_token', JSON.stringify({
        access_token: 'mock_token',
        expiry: Date.now() + 3600000,
        user: { name: 'Test', email: 'test@test.com' }
      }));
      
      (window as any).gapi = {
        load: (name, cb) => cb(),
        client: {
          init: () => Promise.resolve(),
          load: () => Promise.resolve(),
          setToken: () => {},
          getToken: () => ({ access_token: 'mock' }),
          drive: { files: { 
            list: () => Promise.resolve({ result: { files: [
                { id: '1', name: 'a.md' },
                { id: '2', name: 'b.md' }
            ]}}),
            get: (params) => {
                if (params.fileId === '1') return Promise.resolve({ body: '---\ntitle: Gammel\nstartDate: 2024-01-01\nendDate: 2024-01-02\n---\nBody' });
                if (params.fileId === '2') return Promise.resolve({ body: '---\ntitle: Ny\nstartDate: 2026-01-01\nendDate: 2026-01-02\n---\nBody' });
                return Promise.resolve({ result: { name: 'Folder', capabilities: { canEdit: true } } });
            }
          }},
          sheets: { spreadsheets: { values: { get: () => Promise.resolve({ result: { values: [] } }) } } }
        }
      };
      (window as any).google = { accounts: { oauth2: { initTokenClient: () => ({ requestAccessToken: () => {} }) } } };
    });

    await page.goto('/admin');
    await expect(page.locator('#dashboard')).toBeVisible();
    await page.locator('#btn-open-meldinger').click();
    
    // Sjekk sortering
    const titles = page.locator('#module-inner h3');
    await expect(titles.first()).toHaveText('Ny');
    await expect(titles.nth(1)).toHaveText('Gammel');
    
    // Sjekk datoformat i listen
    const dateText = await page.locator('#module-inner p.text-xs').first().textContent();
    expect(dateText).toMatch(/1\.?\s+jan\.?\s+2026/i);
  });
});
