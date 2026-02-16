import { test, expect } from '@playwright/test';

test.describe('Admin-panel Fase 1', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error(`BROWSER ERROR: ${msg.text()}`);
      }
    });
    page.on('pageerror', err => {
      console.error(`PAGE ERROR: ${err.message}`);
    });
  });

  test('skal laste admin-siden og vise innloggingsknapp uten JS-feil', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/admin');
    await expect(page).toHaveTitle(/Admin | Tenner og Trivsel/);
    await expect(page.locator('#login-btn')).toBeVisible();
    
    // Verifiser at det ikke er noen JS-feil (som manglende importer)
    const criticalErrors = consoleErrors.filter(e => !e.includes('401') && !e.includes('403'));
    expect(criticalErrors, `Fant JS-feil i konsollen: ${criticalErrors.join(', ')}`).toHaveLength(0);
  });

  test('skal kunne åpne meldinger og se sortert liste', async ({ page }) => {
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
                if (params.fileId === '1') return Promise.resolve({ body: '---\ntitle: Gammel\nstartDate: 2020-01-01\nendDate: 2020-01-02\n---\nBody' });
                if (params.fileId === '2') return Promise.resolve({ body: '---\ntitle: Ny\nstartDate: 2020-01-01\nendDate: 2099-01-01\n---\nBody' });
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
    
    // Sjekk at vi ser den nye kreative gruppetittelen
    await expect(page.locator('text=Aktive oppslag')).toBeVisible();
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
    
    const titles = page.locator('#module-inner h3');
    await expect(titles.first()).toHaveText('Ape');

    // Åpne redigering via det nye ikonet (.edit-btn)
    await page.locator('.edit-btn').first().click();
    
    await expect(page.locator('#edit-title')).toHaveValue('Ape');
    await expect(page.locator('.CodeMirror')).toBeVisible();
  });

  test('skal kunne åpne tannleger, se sortert liste og åpne editor', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('admin_google_token', JSON.stringify({
        access_token: 'mock_token',
        expiry: Date.now() + 3600000,
        user: { name: 'Test User', email: 'test@example.com' }
      }));
      
      (window as any).gapi = {
        load: (name, cb) => cb(),
        client: {
          init: () => Promise.resolve(),
          load: () => Promise.resolve(),
          setToken: () => {},
          getToken: () => ({ access_token: 'mock' }),
          drive: { files: { 
            get: () => Promise.resolve({ result: { name: 'Test' } })
          }},
          sheets: { spreadsheets: { values: { 
            get: (params) => {
                if (params.range.includes('tannleger')) {
                    return Promise.resolve({
                        result: {
                            values: [
                                ["Navn", "Tittel", "Beskrivelse", "Bilde", "Aktiv", "Skala", "X", "Y"],
                                ["Ape", "Tittel A", "Beskrivelse A", "ape.jpg", "ja", "1.2", "40", "60"]
                            ]
                        }
                    });
                }
                return Promise.resolve({ result: { values: [] } });
            }
          } } }
        }
      };
      (window as any).google = { accounts: { oauth2: { initTokenClient: () => ({ requestAccessToken: () => {} }) } } };
    });

    await page.goto('/admin');
    await page.click('#btn-open-tannleger');
    
    await expect(page.locator('#module-inner h3').filter({ hasText: 'Ape' })).toBeVisible();

    // Åpne editor via det nye ikonet (.edit-tannlege-btn)
    await page.click('.edit-tannlege-btn');
    await expect(page.locator('h3:has-text("Rediger profil")')).toBeVisible();
    await expect(page.locator('#preview-name')).toHaveText('Ape');
  });
});
