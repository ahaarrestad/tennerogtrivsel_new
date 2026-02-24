import { getCollection } from 'astro:content';

export const GET = async () => {
    try {
        const alleMeldinger = await getCollection('meldinger');

        // Datofiltrering skjer på klienten (messageClient.js) — ikke ved byggetid.
        // Statisk bygg fryser JSON-filen, så filtrering her gir utdaterte resultater.
        const data = alleMeldinger
            .sort((a, b) => {
                const dateA = new Date(a.data.startDate).getTime();
                const dateB = new Date(b.data.startDate).getTime();
                return dateB - dateA;
            })
            .map((m) => {
                // Vasker innholdet for StackEdit-data/kommentarer (støtter begge formater)
                const cleanBody = m.body 
                    ? m.body
                        .replace(/<!--stackedit_data-->.*?<!--\/stackedit_data-->/gs, '')
                        .replace(/<!--stackedit_data:[\s\S]*?-->/g, '')
                        .trim() 
                    : '';

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
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Feil ved henting av meldinger:', error);
        return new Response(JSON.stringify({ error: 'Klarte ikke hente meldinger' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};