import { getCollection } from 'astro:content';

export const GET = async () => {
    try {
        const alleMeldinger = await getCollection('meldinger');

        const data = alleMeldinger.map((m) => {
            // Vasker innholdet for StackEdit-data/kommentarer
            const cleanBody = m.body.replace(/<!--stackedit_data-->.*?<!--\/stackedit_data-->/gs, '').trim();

            return {
                title: m.data.title,
                startDate: m.data.startDate,
                endDate: m.data.endDate,
                content: cleanBody
            };
        });

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: 'Klarte ikke hente meldinger' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};