import { test, expect, type Page } from '@playwright/test';

test.describe('Link Crawler', () => {
  // Lenkesjekk er serverside og identisk uavhengig av nettleser
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Lenkesjekk er nettleser-uavhengig');
  });

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

  // Henter interne hrefs under en selektor i ett page.evaluate-kall rett etter goto.
  // Testen feilet 2026-09-15 med «Execution context was destroyed» under full kjøring;
  // utløseren lot seg ikke reprodusere 2026-09-22 (kald Vite-cache + last, 8/8 grønne).
  // Endringen er hygiene: ett kall, ikke-tom-sjekk, og feilmeldinger som sier hvilken side.
  const interneHrefs = (page: Page, selector: string) =>
    page.evaluate((sel) =>
      Array.from(document.querySelectorAll<HTMLAnchorElement>(`${sel} a`))
        .map(a => a.href)
        .filter(h => h.startsWith(window.location.origin)),
    selector);

  test('alle tjeneste-sider skal ha fungerende lenker', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const tjenesteLinks = await interneHrefs(page, '#tjenester');
    expect(tjenesteLinks.length, 'Fant ingen tjeneste-lenker på forsiden').toBeGreaterThan(0);

    for (const link of tjenesteLinks) {
      const response = await page.goto(link, { waitUntil: 'load' });
      expect(response?.status(), `Tjeneste-siden ${link} ga status ${response?.status()}`).toBe(200);

      // Sjekk at nav-lenkene på denne siden også fungerer (f.eks. "Våre tjenester" nederst)
      const subLinks = await interneHrefs(page, '.container');

      for (const subLink of subLinks.slice(0, 5)) { // Sjekk et utvalg for å ikke bruke for lang tid
        const subResponse = await page.request.get(subLink);
        expect(subResponse.status(), `Lenken ${subLink} på siden ${link} feilet`).toBe(200);
      }
    }
  });
});
