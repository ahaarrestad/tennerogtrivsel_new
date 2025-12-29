import { getCollection } from 'astro:content';

export async function GET() {
    const allMessages = await getCollection('meldinger');

    const data = allMessages.map((m) => {
        return {
            title: m.data.title,
            startDate: m.data.startDate,
            endDate: m.data.endDate,
            // Siden vi manuelt la teksten i 'body' i config.ts loaderen:
            body: m.data.body
        };
    });

    return new Response(JSON.stringify(data), {
        headers: {
            'Content-Type': 'application/json'
        }
    });
}