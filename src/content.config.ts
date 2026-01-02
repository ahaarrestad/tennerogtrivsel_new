import { defineCollection, z } from 'astro:content';
import { google } from 'googleapis';
import matter from 'gray-matter';
import dotenv from 'dotenv';

dotenv.config();

// --- 1. DELT AUTENTISERING (Kjører én gang) ---
const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const key = process.env.GOOGLE_PRIVATE_KEY;
const parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

const formattedKey = key?.trim().replace(/^['"]|['"]$/g, '').replace(/\\n/g, '\n');

const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: formattedKey },
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});

const drive = google.drive({ version: 'v3', auth });

// ... (samme auth-logikk øverst)


const GOOGLE_API_KEY = import.meta.env.PUBLIC_GOOGLE_MAP_KEY;
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
            console.log("[Google Sheets] Mapping ferdig. Første elementer:");
            console.table(mappedData.slice(0, 5));

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

async function fetchDriveContent(folderName: string) {
    try {
        const folderRes = await drive.files.list({
            q: `'${parentFolderId}' in parents and name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'files(id, name)',
        });

        const subFolder = folderRes.data.files?.[0];
        if (!subFolder) throw new Error(`Fant ikke mappen ${folderName}`);

        const res = await drive.files.list({
            q: `'${subFolder.id}' in parents and name contains '.md' and trashed = false`,
            fields: 'files(id, name)',
        });

        const files = res.data.files || [];
        const results = [];

        console.log("Found", files.length, "files in folder", folderName);
        for (const file of files) {
            console.log("Folder:", folderName, "Processing file:", file.name);

            // Inne i loopen i content.config.ts
            const response = await drive.files.get({ fileId: file.id!, alt: 'media' });

            // Tving innholdet til å bli en ren tekststreng uten rart format
            let rawContent = "";
            if (typeof response.data === 'string') {
                rawContent = response.data;
            } else {
                // Hvis Google sender det som et objekt/buffer
                rawContent = response.data.toString('utf-8');
            }

            const { data, content } = matter(rawContent);
            const slug = file.name!.replace('.md', '');


            results.push({
                id: slug,
                ...data,
                body: content.trim(), // Trim fjerner usynlige tegn i start/slutt
            });
            console.log("Folder:", folderName, "Processing complete:", file.name);

        }
        return results;
    } catch (e) {
        console.error(`Feil i loader for ${folderName}:`, e);
        return [];
    }
}

const tjenester = defineCollection({
    loader: async () => {
        const data = await fetchDriveContent('tjenester');
        return data; // Astro 5 tar imot arrayet direkte
    },
    schema: z.object({
        id: z.string(),
        title: z.string(),
        ingress: z.string(),
        body: z.string(), // Viktig: Definer denne i schema
    }),
});

const meldinger = defineCollection({
    loader: async () => {
        return await fetchDriveContent('meldinger');
    },
    schema: z.object({
        id: z.string(),
        title: z.string(),
        startDate: z.coerce.string(),
        endDate: z.coerce.string(),
        body: z.string(),
    }),
});
// --- 4. EKSPORT ---
export const collections = { tjenester, meldinger, innstillinger };