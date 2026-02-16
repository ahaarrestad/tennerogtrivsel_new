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

  test('skal kunne åpne tjenester, se sortert liste og bruke editor', async ({ page }) => {
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
                { id: 'z', name: 'z.md' },
                { id: 'a', name: 'a.md' }
            ]}}),
            get: (params) => {
                if (params.fileId === 'a') return Promise.resolve({ body: '---\ntitle: Ape\ningress: Ingress A\n---\nBody A' });
                if (params.fileId === 'z') return Promise.resolve({ body: '---\ntitle: Zebra\ningress: Ingress Z\n---\nBody Z' });
                return Promise.resolve({ result: { name: 'Folder', capabilities: { canEdit: true } } });
            }
          }},
          sheets: { spreadsheets: { values: { get: () => Promise.resolve({ result: { values: [] } }) } } }
        }
      };
      (window as any).google = { accounts: { oauth2: { initTokenClient: () => ({ requestAccessToken: () => {} }) } } };
    });

    await page.goto('/admin');
    await page.locator('#btn-open-tjenester').click();
    
    // Sjekk sortering (Ape før Zebra)
    const titles = page.locator('#module-inner h3');
    await expect(titles.first()).toHaveText('Ape');
    await expect(titles.nth(1)).toHaveText('Zebra');

    // Åpne redigering
    await page.locator('button:has-text("Rediger")').first().click();
    
    // Sjekk inputs
    await expect(page.locator('#edit-title')).toHaveValue('Ape');
    await expect(page.locator('#edit-ingress')).toHaveValue('Ingress A');

    // Sjekk EasyMDE
    await expect(page.locator('.CodeMirror')).toBeVisible();
  });

  test('skal deaktivere moduler uten tilgang og logge ut hvis ingen tilgang i det hele tatt', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('admin_google_token', JSON.stringify({
        access_token: 'mock_token',
        expiry: Date.now() + 3600000,
        user: { name: 'No Access User', email: 'none@test.com' }
      }));
      
      (window as any).gapi = {
        load: (name, cb) => cb(),
        client: {
          init: () => Promise.resolve(),
          load: () => Promise.resolve(),
          setToken: () => {},
          getToken: () => ({ access_token: 'mock' }),
          drive: { files: { 
            get: () => Promise.reject({ status: 403 }) // Ingen tilgang
          }},
          sheets: { spreadsheets: { values: { 
            get: () => Promise.reject({ status: 403 }) // Ingen tilgang
          } } }
        }
      };
      (window as any).google = { 
        accounts: { 
            oauth2: { 
                initTokenClient: () => ({ requestAccessToken: () => {} }),
                revoke: () => {} 
            } 
        } 
      };

      // Sett opp mock IDs i DOMen før scriptet kjører
      const mockConfig = () => {
          const el = document.getElementById('admin-config');
          if (el) {
              el.dataset.tjenesterFolder = 'f1';
              el.dataset.meldingerFolder = 'f2';
              el.dataset.tannlegerFolder = 'f3';
              el.dataset.sheetId = 's1';
          } else {
              setTimeout(mockConfig, 10);
          }
      };
      mockConfig();
    });

    // Vi forventer redirect til forsiden
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/(\?access_denied=true)?$/);
  });
});
