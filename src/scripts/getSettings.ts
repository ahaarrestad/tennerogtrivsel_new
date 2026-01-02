// src/lib/getSettings.ts
import { getCollection } from 'astro:content';

export async function getSiteSettings() {
    const entries = await getCollection('innstillinger');
    // Gjør om [ {id: "tel", verdi: "123"}, ... ] til { tel: "123", ... }
    const resultat =  Object.fromEntries(
        entries.map(entry => [entry.id, entry.data.value])
    );
    return resultat;
}