import { getCollection } from 'astro:content';

export const GET = async () => {
    try {
        const now = new Date();
        const alleMeldinger = await getCollection('meldinger');

        const data = alleMeldinger
            .filter((m) => {
                const start = new Date(m.data.startDate);
                const end = new Date(m.data.endDate);
                // Sett sluttidspunkt til slutten av dagen for å være på den sikre siden
                end.setHours(23, 59, 59, 999);
                return now >= start && now <= end;
            })
            .sort((a, b) => b.data.startDate.getTime() - a.data.startDate.getTime())
            .map((m) => {
                // Vasker innholdet for StackEdit-data/kommentarer
                const cleanBody = m.body ? m.body.replace(/<!--stackedit_data-->.*?<!--\/stackedit_data-->/gs, '').trim() : '';

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
        console.error('Feil ved henting av meldinger:', error);
        return new Response(JSON.stringify({ error: 'Klarte ikke hente meldinger' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};