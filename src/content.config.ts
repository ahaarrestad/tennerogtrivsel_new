import {defineCollection, z} from 'astro:content';
import {glob} from 'astro/loaders'; // Viktig for Astro 5

const tjenester = defineCollection({
    loader: glob({pattern: '**/[^_]*.{md,mdx}', base: "./src/content/tjenester"}),
    schema: z.object({
        title: z.string(),
        ingress: z.string(),
    }),
});

/*
const meldinger = defineCollection({
    loader: glob({ pattern: '**!/[^_]*.{md,mdx}', base: "./src/content/meldinger" }),
    schema: z.object({
        title: z.string(),
        startDate: z.date(),
        endDate: z.date(),
    }),
});

*/
import {google} from 'googleapis';
import matter from 'gray-matter';
import dotenv from 'dotenv';

// Laster .env manuelt for å være helt sikker på at de er tilgjengelige under build
dotenv.config();

const meldinger = defineCollection({
    loader: async () => {
        const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        const key = process.env.GOOGLE_PRIVATE_KEY;
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;


        // DIAGNOSE-LOGG
        if (!key) {
            console.error("❌ KRITISK FEIL: GOOGLE_PRIVATE_KEY er helt tom i process.env!");
            return [];
        }

        console.log("🔍 Nøkkel-sjekk: Lengde er", key.length, "tegn.");

        // 1. Sjekk at vi har alle variabler
        if (!email || !key || !folderId) {
            console.error("❌ Mangler miljøvariabler! Sjekk .env");
            console.log("Email funnet:", !!email);
            console.log("Key funnet:", !!key);
            console.log("Folder ID funnet:", !!folderId);
            return [];
        }

        try {
            // Fjerner ytre anførselstegn (") og enkle fnutter (') hvis de finnes,
            // og gjør om bokstavelig "\n" til faktiske linjeskift.
            const formattedKey = key
                .trim()
                .replace(/^['"]|['"]$/g, '')
                .replace(/\\n/g, '\n');

            // DIAGNOSE: Se nøyaktig hva biblioteket mottar
            console.log("🔍 Nøkkel starter med:", formattedKey.substring(0, 25));


            // Vi lager et objekt som ser nøyaktig ut som en service-account.json fil
            const credentials = {
                client_email: email,
                private_key: formattedKey,
            };

            const auth = new google.auth.GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/drive.readonly'],
            });

            // Vi må hente ut en "client" fra GoogleAuth-objektet
            const authClient = await auth.getClient();

            console.log("✅ Autentisering OK via GoogleAuth Credentials");

            const drive = google.drive({version: 'v3', auth});

            // 1. FINN ID-EN TIL UNDERMAPPEN "meldinger"
            const folderRes = await drive.files.list({
                q: `'${folderId}' in parents and name = 'meldinger' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
                fields: 'files(id, name)',
            });

            const subFolder = folderRes.data.files?.[0];

            if (!subFolder) {
                console.error("❌ Fant ikke undermappen 'meldinger' i hovedmappen.");
                return [];
            }

            const meldingerFolderId = subFolder.id;
            console.log(`✅ Fant undermappe: ${subFolder.name} (ID: ${meldingerFolderId})`);

            // 2. HENT FILER FRA UNDERMAPPEN
            const res = await drive.files.list({
                q: `'${meldingerFolderId}' in parents and name contains '.md' and trashed = false`,
                fields: 'files(id, name)',
            });

            const files = res.data.files || [];
            console.log(`📂 Fant ${files.length} filer i Google Drive mappen`);

            const messages = [];

            // 5. Hent innholdet i hver fil
            for (const file of files) {
                console.log(`📄 Henter innhold fra: ${file.name}`);

                const response = await drive.files.get({
                    fileId: file.id!,
                    alt: 'media',
                });

                // Vi tvinger innholdet til string hvis det kommer som objekt
                const rawContent = typeof response.data === 'string'
                    ? response.data
                    : JSON.stringify(response.data);

                // 'gray-matter' skiller Frontmatter (YAML) fra selve Markdown-teksten
                const {data, content} = matter(rawContent);

                messages.push({
                    id: file.id!,
                    title: data.title || 'Uten tittel',
                    startDate: data.startDate || '',
                    endDate: data.endDate || '',
                    body: content, // Selve teksten i meldingen
                });
            }

            return messages;

        } catch (error: any) {
            console.error("❌ Feil i Google Drive Loader:");
            if (error.response) {
                console.error("Status:", error.response.status);
                console.error("Data:", error.response.data);
            } else {
                console.error("Melding:", error.message);
            }
            return [];
        }
    },
    // Definerer strukturen slik at Astro kan validere innholdet
    schema: z.object({
        id: z.string(),
        title: z.string(),
        // z.coerce.string() tar imot både tekst og Date-objekter
        // og gjør dem om til en tekststreng automatisk.
        startDate: z.coerce.string(),
        endDate: z.coerce.string(),
        body: z.string(),
    })
});

export const collections = {tjenester, meldinger};