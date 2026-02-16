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

  const setupMocks = async (page, options: any = {}) => {
    await page.addInitScript(({ messages = [], services = [], dentists = [] }) => {
      localStorage.setItem('admin_google_token', JSON.stringify({
        access_token: 'mock_token',
        expiry: Date.now() + 3600000,
        user: { name: 'Test User', email: 'test@example.com' }
      }));
      
      const mockDriveGet = (params) => {
        // Handle file content requests (alt=media)
        if (params.alt === 'media') {
            const foundMsg = messages.find(m => m.id === params.fileId);
            if (foundMsg) return Promise.resolve({ body: foundMsg.content });
            const foundSvc = services.find(s => s.id === params.fileId);
            if (foundSvc) return Promise.resolve({ body: foundSvc.content });
            return Promise.resolve({ body: '' });
        }
        // Handle metadata requests
        return Promise.resolve({ 
            result: { 
                id: params.fileId,
                name: 'Mock Resource', 
                capabilities: { canEdit: true } 
            } 
        });
      };

      (window as any).gapi = {
        load: (name, cb) => cb(),
        client: {
          init: () => Promise.resolve(),
          load: () => Promise.resolve(),
          setToken: () => {},
          getToken: () => ({ access_token: 'mock_token' }),
          drive: { 
            files: { 
                list: () => Promise.resolve({ result: { files: [...messages, ...services] } }),
                get: mockDriveGet
            }
          },
          sheets: { 
            spreadsheets: { 
                values: { 
                    get: (params) => {
                        if (params.range.includes('tannleger')) {
                            return Promise.resolve({ result: { values: dentists } });
                        }
                        return Promise.resolve({ result: { values: [["id", "value", "note"], ["dummy", "val", "note"]] } });
                    } 
                } 
            } 
          }
        }
      };
      (window as any).google = { accounts: { oauth2: { initTokenClient: () => ({ requestAccessToken: () => {} }) } } };
    }, options);
  };

  test('skal laste admin-siden og vise innloggingsknapp uten JS-feil', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/admin');
    await expect(page).toHaveTitle(/Admin | Tenner og Trivsel/);
    await expect(page.locator('#login-btn')).toBeVisible();
    
    const criticalErrors = consoleErrors.filter(e => !e.includes('401') && !e.includes('403'));
    expect(criticalErrors, `Fant JS-feil i konsollen: ${criticalErrors.join(', ')}`).toHaveLength(0);
  });

  test('skal kunne åpne meldinger og se sortert liste', async ({ page }) => {
    await setupMocks(page, {
        messages: [
            { id: '1', name: 'a.md', content: '---\ntitle: Gammel\nstartDate: 2020-01-01\nendDate: 2020-01-02\n---\nBody' },
            { id: '2', name: 'b.md', content: '---\ntitle: Ny\nstartDate: 2020-01-01\nendDate: 2099-01-01\n---\nBody' }
        ]
    });

    await page.goto('/admin');
    await expect(page.locator('#dashboard')).toBeVisible();
    await page.locator('#btn-open-meldinger').click();
    
    const titles = page.locator('#module-inner h3');
    await expect(titles.first()).toHaveText('Ny');
    await expect(titles.nth(1)).toHaveText('Gammel');
    await expect(page.locator('text=Aktive oppslag')).toBeVisible();
  });

  test('skal kunne åpne tjenester, se sortert liste og bruke editor', async ({ page }) => {
    await setupMocks(page, {
        services: [
            { id: 'z', name: 'z.md', content: '---\ntitle: Zebra\ningress: Z\n---\nBody Z' },
            { id: 'a', name: 'a.md', content: '---\ntitle: Ape\ningress: A\n---\nBody A' }
        ]
    });

    await page.goto('/admin');
    await expect(page.locator('#dashboard')).toBeVisible();
    await page.locator('#btn-open-tjenester').click();
    
    const titles = page.locator('#module-inner h3');
    await expect(titles.first()).toHaveText('Ape');

    await page.locator('.edit-btn').first().click();
    await expect(page.locator('#edit-title')).toHaveValue('Ape');
    await expect(page.locator('.CodeMirror')).toBeVisible();
  });

  test('skal kunne åpne tannleger, se sortert liste og åpne editor', async ({ page }) => {
    await setupMocks(page, {
        dentists: [
            ["Navn", "Tittel", "Beskrivelse", "Bilde", "Aktiv", "Skala", "X", "Y"],
            ["Ape", "Tittel A", "Beskrivelse A", "ape.jpg", "ja", "1.2", "40", "60"]
        ]
    });

    await page.goto('/admin');
    await expect(page.locator('#dashboard')).toBeVisible();
    await page.click('#btn-open-tannleger');
    
    await expect(page.locator('#module-inner h3').filter({ hasText: 'Ape' })).toBeVisible();
    await page.click('.edit-tannlege-btn');
    await expect(page.locator('h3:has-text("Rediger profil")')).toBeVisible();
    await expect(page.locator('#preview-name')).toHaveText('Ape');
  });
});
