import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import TelefonKort from '../TelefonKort.astro';

async function render(phone: string): Promise<string> {
    const container = await AstroContainer.create();
    return container.renderToString(TelefonKort, {
        props: { phone, sentralbordTekst: 'Sentralbordet er åpent 08–15', minHeight: '250px' },
    });
}

/** Åpningstaggene til alle kort (`.card-base`) i rendret HTML, i rekkefølge. */
const kort = (html: string) => html.match(/<(a|div)\b[^>]*class="[^"]*\bcard-base\b[^"]*"[^>]*>/g) ?? [];

describe('TelefonKort.astro', () => {
    it.each([
        ['tomt nummer', ''],
        ['bare mellomrom', '   '],
    ])('%s: ett kort uten lenke, aldri href="tel:"', async (_navn, phone) => {
        const html = await render(phone);

        expect(kort(html)).toHaveLength(1);
        expect(html).not.toMatch(/<a\b/);
        expect(html).not.toMatch(/href="tel:/);
        expect(html).not.toContain('Ring oss');
        expect(html).toContain('Sentralbordet er åpent 08–15');
    });

    it('med nummer: lenkekort på mobil og ikke-interaktivt kort fra lg', async () => {
        const html = await render('12 34 56 78');
        const [mobil, desktop] = kort(html);

        expect(kort(html)).toHaveLength(2);
        expect(mobil).toMatch(/^<a\b/);
        expect(mobil).toMatch(/href="tel:12345678"/);
        expect(mobil).toMatch(/\blg:hidden\b/);
        expect(desktop).toMatch(/^<div\b/);
        expect(desktop).toMatch(/\bmax-lg:hidden\b/);
        expect(desktop).not.toMatch(/href=/);
    });

    it('med nummer: nummeret er ren tekst, og bare mobilkortet har «Ring oss»', async () => {
        const html = await render('12 34 56 78');

        // Én <a> totalt — nummeret ligger ikke i en egen lenke inne i kort-lenka
        expect(html.match(/<a\b/g)).toHaveLength(1);
        expect(html.match(/<p class="whitespace-nowrap">12 34 56 78<\/p>/g)).toHaveLength(2);
        expect(html.match(/Ring oss/g)).toHaveLength(1);
        expect(html).toMatch(/Ring oss <span aria-hidden="true"[^>]*>→<\/span>/);
    });
});
