import { test, expect } from '@playwright/test';

test.describe('Link Crawler', () => {
  test('alle interne lenker på forsiden skal fungere', async ({ page }) => {
    await page.goto('/');
    
    // Finn alle interne lenker (starter med / eller # eller er fulle interne URLer)
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a'))
        .map(a => a.href)
        .filter(href => href.startsWith(window.location.origin) || href.startsWith('/') || href.startsWith('#'));
    });

    // Fjern duplikater
    const uniqueLinks = [...new Set(links)];
    console.log(`Fant ${uniqueLinks.length} unike interne lenker på forsiden.`);

    for (const link of uniqueLinks) {
      // Ignorer anker-lenker (#) da de ikke trigger en ny sidetilgang som kan gi 404
      if (link.includes('#') && !link.split('#')[0].endsWith('.no')) continue;
      
      const response = await page.request.get(link);
      expect(response.status(), `Lenken ${link} ga status ${response.status()}`).toBe(200);
    }
  });

  test('alle tjeneste-sider skal ha fungerende lenker', async ({ page }) => {
    await page.goto('/');
    await page.setViewportSize({ width: 1280, height: 800 });
    
    // Finn alle tjeneste-lenker
    const tjenesteLinks = await page.locator('#tjenester a').evaluateAll(links => 
      links.map(a => (a as HTMLAnchorElement).href)
    );

    for (const link of tjenesteLinks) {
      await page.goto(link);
      const response = await page.waitForResponse(r => r.url() === link || r.status() === 200);
      expect(response.status()).toBe(200);
      
      // Sjekk at nav-lenkene på denne siden også fungerer (f.eks. "Våre tjenester" nederst)
      const subLinks = await page.locator('.container a').evaluateAll(links => 
        links.map(a => (a as HTMLAnchorElement).href).filter(h => h.startsWith(window.location.origin))
      );
      
      for (const subLink of subLinks.slice(0, 5)) { // Sjekk et utvalg for å ikke bruke for lang tid
        const subResponse = await page.request.get(subLink);
        expect(subResponse.status(), `Lenken ${subLink} på siden ${link} feilet`).toBe(200);
      }
    }
  });
});
