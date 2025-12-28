// src/pages/meldinger.json.ts
import { getCollection, render } from 'astro:content';

export async function GET() {
    const allMessages = await getCollection('meldinger');

    const data = await Promise.all(allMessages.map(async (m) => {
        const { Content } = await render(m);
        // Vi må rendre innholdet til en streng her, men Astro sine komponenter
        // er litt vriene å sende som JSON. Vi sender derfor dataene og
        // bruker en enkel løsning i frontend.
        return {
            title: m.data.title,
            startDate: m.data.startDate,
            endDate: m.data.endDate,
            body: m.body // Her sender vi rå-markdown
        };
    }));

    return new Response(JSON.stringify(data));
}