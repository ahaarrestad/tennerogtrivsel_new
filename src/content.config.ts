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
            console.log("Fetching file:", file.name);

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

            console.log("Slug complete:", slug);

            results.push({
                id: slug,
                ...data,
                body: content.trim(), // Trim fjerner usynlige tegn i start/slutt
            });
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
export const collections = { tjenester, meldinger };