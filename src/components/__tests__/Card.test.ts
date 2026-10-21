import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Card from '../Card.astro';

/** Henter åpningstaggen (navn + attributter) for rot-elementet i rendret HTML. */
function openingTag(html: string): { tag: string; attrs: string } {
    const match = html.trim().match(/^<([a-z]+)([^>]*)>/i);
    if (!match) throw new Error(`Fant ingen åpningstag i: ${html.slice(0, 80)}`);
    return { tag: match[1], attrs: match[2] };
}

async function render(props: Record<string, unknown>): Promise<string> {
    const container = await AstroContainer.create();
    return container.renderToString(Card, { props: { title: 'Tittel', ...props } });
}

describe('Card.astro', () => {
    it.each([
        ['<a> med href', { href: '/x' }, 'a'],
        ['<div> uten href', {}, 'div'],
    ])('legger class-propen på rot-elementet: %s', async (_navn, props, forventetTag) => {
        const { tag, attrs } = openingTag(await render({ ...props, class: 'lg:hidden' }));

        expect(tag).toBe(forventetTag);
        expect(attrs).toMatch(/class="[^"]*\blg:hidden\b/);
        expect(attrs).toMatch(/class="[^"]*\bcard-base\b/);
    });

    it('rendrer <div> uten href og cursor-pointer når href mangler', async () => {
        const { tag, attrs } = openingTag(await render({}));

        expect(tag).toBe('div');
        expect(attrs).not.toMatch(/\bhref=/);
        expect(attrs).not.toMatch(/cursor-pointer/);
    });

    it('skjuler pila i standard «Les mer»-lenke for skjermlesere', async () => {
        const html = await render({ href: '/x' });

        expect(html).toMatch(/Les mer <span aria-hidden="true"[^>]*>→<\/span>/);
    });
});
