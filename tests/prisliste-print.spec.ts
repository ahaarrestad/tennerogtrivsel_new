import { test, expect } from '@playwright/test';

test.describe('Prisliste print-footer', () => {
    test.beforeEach(({}, testInfo) => {
        test.skip(testInfo.project.name !== 'chromium', 'Print-atferd er nettleser-avhengig — kun Chromium er primær print-target');
    });

    test('footer er skjult i normal visning', async ({ page }) => {
        await page.goto('/prisliste');
        const footer = page.locator('.prisliste-footer-print');
        // toBeHidden() er true også når element mangler i DOM. Det er OK her — det
        // syntetiske fixture-settet har alltid tannleger, så footeren rendres.
        await expect(footer).toBeHidden();
    });

    test('footer vises i print-modus med tannlegenavn', async ({ page }) => {
        await page.goto('/prisliste');
        await page.emulateMedia({ media: 'print' });
        const footer = page.locator('.prisliste-footer-print');
        await expect(footer).toBeVisible();
        // Verifiser mot kjent fixture-tannlege (tests/fixtures/content/tannleger.json),
        // ikke bare «ikke tom» — beviser at navn faktisk rendres uavhengig av Drive.
        await expect(footer).toContainText('Tannlege Test Testesen');
    });
});
