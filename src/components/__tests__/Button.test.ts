import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Button from '../Button.astro';

/**
 * Henter åpningstaggen (navn + attributter) for rot-elementet i rendret HTML.
 * Gjør det enkelt å asserte hvilke attributter som faktisk havnet på elementet.
 */
function openingTag(html: string): { tag: string; attrs: string } {
    const match = html.trim().match(/^<([a-z]+)([^>]*)>/i);
    if (!match) throw new Error(`Fant ingen åpningstag i: ${html.slice(0, 80)}`);
    return { tag: match[1], attrs: match[2] };
}

async function render(props: Record<string, unknown>): Promise<string> {
    const container = await AstroContainer.create();
    return container.renderToString(Button, { props });
}

describe('Button.astro – attributt-gating per tag', () => {
    it('rendrer <span> uten interaktive attributter når interactive=false', async () => {
        const html = await render({
            interactive: false,
            type: 'submit',
            disabled: true,
            target: '_blank',
            rel: 'noopener',
        });
        const { tag, attrs } = openingTag(html);

        expect(tag).toBe('span');
        expect(attrs).not.toMatch(/\btype=/);
        expect(attrs).not.toMatch(/\bdisabled\b/);
        expect(attrs).not.toMatch(/\btarget=/);
        expect(attrs).not.toMatch(/\brel=/);
    });

    it('rendrer <a> med target/rel men uten type/disabled når href er satt', async () => {
        const html = await render({
            href: '/kontakt',
            type: 'submit',
            disabled: true,
            target: '_blank',
            rel: 'noopener',
        });
        const { tag, attrs } = openingTag(html);

        expect(tag).toBe('a');
        expect(attrs).toMatch(/href="\/kontakt"/);
        expect(attrs).toMatch(/target="_blank"/);
        expect(attrs).toMatch(/rel="noopener"/);
        expect(attrs).not.toMatch(/\btype=/);
        expect(attrs).not.toMatch(/\bdisabled\b/);
    });

    it('rendrer <button> med type/disabled men uten target/rel som standard', async () => {
        const html = await render({
            type: 'submit',
            disabled: true,
            target: '_blank',
            rel: 'noopener',
        });
        const { tag, attrs } = openingTag(html);

        expect(tag).toBe('button');
        expect(attrs).toMatch(/type="submit"/);
        expect(attrs).toMatch(/\bdisabled\b/);
        expect(attrs).not.toMatch(/\btarget=/);
        expect(attrs).not.toMatch(/\brel=/);
    });

    it('bevarer variant-, class- og aria-label-oppførsel (regresjonsvern)', async () => {
        const html = await render({
            variant: 'accent',
            class: 'extra-klasse',
            'aria-label': 'Ring oss',
        });
        const { tag, attrs } = openingTag(html);

        expect(tag).toBe('button');
        expect(attrs).toMatch(/class="[^"]*btn-accent[^"]*"/);
        expect(attrs).toMatch(/class="[^"]*extra-klasse[^"]*"/);
        expect(attrs).toMatch(/aria-label="Ring oss"/);
    });
});
