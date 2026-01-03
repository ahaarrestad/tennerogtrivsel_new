import {defineCollection, z} from 'astro:content';

const GOOGLE_API_KEY = import.meta.env.PUBLIC_GOOGLE_API_KEY;
const SHEET_ID = '1XTRkjyJpAk7hMNe4tfhhA3nI0BwmOfrR0dzj5iC_Hoo'; // Finn denne i nettleser-URLen til arket
const RANGE = 'Innstillinger!A:B'; // Navnet på fanen og kolonnene

const innstillinger = defineCollection({
    loader: async () => {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${GOOGLE_API_KEY}`;

        try {
            console.log(`[Google Sheets] Prøver å hente data fra: ${RANGE}...`);

            const response = await fetch(url, {
                headers: {
                    // Erstatt med domenet du har hvitlistet i Google Cloud Console
                    "Referer": "https://tennerogtrivsel.no"
                }
            });
            const data = await response.json();

            // Sjekk om Google returnerte en feilmelding (f.eks. 403 Forbidden eller 404)
            if (data.error) {
                console.error("❌ Google API feil:");
                console.error(`- Status: ${data.error.code}`);
                console.error(`- Melding: ${data.error.message}`);
                console.error(`- Årsak: ${data.error.status}`);
                return [];
            }

            if (!data.values || data.values.length === 0) {
                console.warn("⚠️ Ingen rader funnet i arket (arket kan være tomt).");
                return [];
            }

            // Hvor mye data fant den?
            console.log(`✅ Fant ${data.values.length} rader (inkludert header).`);
            // Mapper radene (hopper over header-raden hvis du har en)
            const mappedData = data.values.slice(1).map((row: string[], index: number) => {
                // Sjekk at raden faktisk har to kolonner for å unngå krasj på tomme rader
                if (!row[0] || !row[1]) {
                    console.warn(`[Rad ${index + 2}] Mangler data i A eller B kolonne.`);
                }

                return {
                    id: row[0]?.trim() || `empty-key-${index}`,
                    value: row[1]?.trim() || ''
                };
            });

            // Hvilke data fant den? (Viser de 3 første som eksempel i loggen)
            console.log("[Google Sheets] Mapping ferdig.");
            console.table(mappedData);

            return mappedData;

        } catch (e) {
            console.error("❌ Kritisk feil under fetch fra Google Sheets:", e);
            return [];
        }
    },
    schema: z.object({
        id: z.string(),
        value: z.string(),
    })
});

const meldinger = defineCollection({
    type: 'content', // Dette sier til Astro: "Se i src/content/meldinger/ etter .md filer"
    schema: z.object({
        title: z.string(),
        startDate: z.coerce.string(),
        endDate: z.coerce.string(),
    }),
});

const tjenester = defineCollection({
    type: 'content', // Viktig: Dette sier at det er .md-filer
    schema: z.object({
        id: z.string(),
        title: z.string(),
        ingress: z.string(),
    }),
});

// --- 4. EKSPORT ---
export const collections = {tjenester, meldinger, innstillinger};