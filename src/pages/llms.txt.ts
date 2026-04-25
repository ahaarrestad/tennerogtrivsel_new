// src/pages/llms.txt.ts
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { generateLlmsTxt } from '../scripts/generate-llms.js';

export const GET: APIRoute = async () => {
    const innstillingerItems = await getCollection('innstillinger');
    const settings = Object.fromEntries(innstillingerItems.map(i => [i.id, i.data.value]));

    const tannlegerItems = await getCollection('tannleger');
    const tannleger = tannlegerItems.map(t => ({
        name: t.data.name,
        title: t.data.title,
        description: t.data.description,
    }));

    const tjenesterItems = await getCollection('tjenester');
    const tjenester = tjenesterItems
        .filter(s => s.data.active !== false)
        .toSorted((a, b) =>
            (a.data.priority ?? 99) - (b.data.priority ?? 99) ||
            a.data.title.localeCompare(b.data.title, 'nb')
        )
        .map(s => ({
            title: s.data.title,
            ingress: s.data.ingress,
            body: '',
        }));

    const txt = generateLlmsTxt({ settings, tannleger, tjenester });

    return new Response(txt, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
};
