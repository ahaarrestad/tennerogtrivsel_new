import { test, expect } from '@playwright/test';

// Regresjon: lightboxens lukkeknapp ble dekket av det dato-styrte InfoBanneret
// (banner z-[60] > tidligere lightbox z-50). Banneret vises/skjules basert på
// dato, så testen mocker en aktiv melding for å verifisere stacking
// deterministisk — uavhengig av om en melding faktisk er aktiv akkurat nå.
test.describe('Galleri-lightbox stacking', () => {
  test('lukkeknappen ligger over et synlig InfoBanner', async ({ page }) => {
    // Returner en deterministisk aktiv melding (datoer spenner over enhver
    // systemklokke), så InfoBanner-scriptet selv viser banneret via ekte
    // kodesti. Dette eliminerer racet der et sent /api/active-messages.json-svar
    // ellers kunne re-skjule et manuelt synliggjort banner (false positive) —
    // erstatter den tidligere waitForLoadState('networkidle').
    await page.route('**/api/active-messages.json', (route) =>
      route.fulfill({
        json: [
          { title: 'Testmelding', content: 'Test', startDate: '2000-01-01', endDate: '2100-01-01' },
        ],
      }),
    );

    await page.goto('/galleri/', { waitUntil: 'domcontentloaded' });

    const firstTile = page.locator('[data-lightbox-index]').first();
    await firstTile.waitFor();

    // Banneret (sticky top-0, z-[60]) vises nå av appen selv basert på den
    // mockede aktive meldingen — initBanner() kjører remove('hidden').
    const banner = page.locator('#banner-root');
    await expect(banner).toBeVisible();

    // Mål lukkeknappens senter (krever åpen lightbox), lukk så igjen.
    await firstTile.click();
    const closeBtn = page.locator('[data-lightbox-close]');
    await expect(closeBtn).toBeVisible();
    const box = await closeBtn.boundingBox();
    expect(box).not.toBeNull();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    await page.keyboard.press('Escape');
    await expect(closeBtn).toBeHidden();

    // Forankring: med lightbox lukket dekker banneret nettopp dette punktet.
    // Beviser at overlappen er reell — uten dette ville testen vært meningsløs
    // dersom knapp og banner aldri overlappet.
    const bannerCovers = await page.evaluate(
      ({ x, y }) => !!document.elementFromPoint(x, y)?.closest('#banner-root'),
      { x: cx, y: cy },
    );
    expect(bannerCovers).toBe(true);

    // Med lightbox åpen skal lukkeknappen ligge over banneret (z-[110] > z-[60]).
    await firstTile.click();
    await expect(closeBtn).toBeVisible();
    const closeOnTop = await page.evaluate(
      ({ x, y }) => !!document.elementFromPoint(x, y)?.closest('[data-lightbox-close]'),
      { x: cx, y: cy },
    );
    expect(closeOnTop).toBe(true);
  });
});
