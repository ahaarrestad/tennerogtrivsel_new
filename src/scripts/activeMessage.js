import { getCollection } from 'astro:content';

export async function getActiveMessage() {
    const all = await getCollection('meldinger');
    const now = new Date();

    return all.find(m => {
        const start = new Date(m.data.startDate);
        const end = new Date(m.data.endDate);
        end.setHours(23, 59, 59);
        return now >= start && now <= end;
    });
}