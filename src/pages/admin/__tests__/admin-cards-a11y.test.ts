import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Tre kilder til seksjonsnavn som må holdes i synk:
 *   1. index.astro <h2>-titler (synlig tekst)
 *   2. index.astro aria-label (skjermleser-tekst)
 *   3. admin-init.js cardModules-mapping (brukes til breadcrumb/modul-tittel)
 */
describe('Admin-kort: titler og aria-labels skal være konsistente', () => {
    const astroFile = fs.readFileSync(
        path.join(process.cwd(), 'src/pages/admin/index.astro'),
        'utf-8',
    );
    const initFile = fs.readFileSync(
        path.join(process.cwd(), 'src/scripts/admin-init.js'),
        'utf-8',
    );

    // Hent titler fra admin-init.js cardModules-array
    const jsCardPattern = /\['(card-\w+)',\s*'[^']+',\s*'([^']+)'\]/g;
    const jsTitles = new Map<string, string>();
    let jsMatch;
    while ((jsMatch = jsCardPattern.exec(initFile)) !== null) {
        jsTitles.set(jsMatch[1], jsMatch[2]);
    }

    // Hent h2-titler og aria-labels fra index.astro
    const astroCardPattern =
        /id="(card-\w+)"[^>]*aria-label="([^"]*)"[\s\S]*?<h2[^>]*>([^<]+)<\/h2>/g;
    const astroCards = new Map<string, { ariaLabel: string; h2Title: string }>();
    let astroMatch;
    while ((astroMatch = astroCardPattern.exec(astroFile)) !== null) {
        astroCards.set(astroMatch[1], {
            ariaLabel: astroMatch[2],
            h2Title: astroMatch[3].trim(),
        });
    }

    const allCardIds = [...new Set([...jsTitles.keys(), ...astroCards.keys()])];

    it('finner kort i begge filer', () => {
        expect(allCardIds.length).toBeGreaterThan(0);
        for (const id of allCardIds) {
            expect(jsTitles.has(id), `${id} mangler i admin-init.js`).toBe(true);
            expect(astroCards.has(id), `${id} mangler i index.astro`).toBe(true);
        }
    });

    it.each(allCardIds)(
        '%s: h2-tittel i Astro === tittel i admin-init.js',
        (cardId) => {
            const jsTitle = jsTitles.get(cardId);
            const astroH2 = astroCards.get(cardId)?.h2Title;
            expect(astroH2).toBe(jsTitle);
        },
    );

    it.each(allCardIds)(
        '%s: aria-label inneholder h2-tittelen',
        (cardId) => {
            const { ariaLabel, h2Title } = astroCards.get(cardId)!;
            expect(ariaLabel).toContain(h2Title);
        },
    );

    it.each(allCardIds)(
        '%s: aria-label starter med "Gå til"',
        (cardId) => {
            const { ariaLabel } = astroCards.get(cardId)!;
            expect(ariaLabel).toMatch(/^Gå til /);
        },
    );
});
