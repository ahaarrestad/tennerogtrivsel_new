import {defineCollection, z} from 'astro:content';
import { glob } from 'astro/loaders';
import fs from 'fs';
import path from 'path';

const innstillinger = defineCollection({
    loader: async () => {
        const filePath = path.join(process.cwd(), 'src/content/innstillinger.json');
        if (!fs.existsSync(filePath)) return [];
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content) as Array<Record<string, unknown>>;
        return data.map((item) => ({
            id: (item.id as string) || '',
            value: (item.value as string) || ''
        }));
    },
    schema: z.object({
        id: z.string(),
        value: z.string(),
    })
});

const tannleger = defineCollection({
    loader: async () => {
        const filePath = path.join(process.cwd(), 'src/content/tannleger.json');
        if (!fs.existsSync(filePath)) return [];
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content) as Array<Record<string, unknown>>;
        return data.map((t, index) => ({
            id: (t.id as string) || `tannlege-${index}`,
            ...t
        }));
    },
    schema: z.object({
        id: z.string(),
        name: z.string(),
        title: z.string(),
        description: z.string(),
        image: z.string().optional(),
        imageConfig: z.object({
            scale: z.number().default(1.0),
            positionX: z.number().default(50),
            positionY: z.number().default(50)
        }).optional()
    }),
});

const meldinger = defineCollection({
    loader: glob({ pattern: '**/[^_]*.{md,mdoc}', base: './src/content/meldinger' }),
    schema: z.object({
        title: z.string(),
        startDate: z.coerce.date(),
        endDate: z.coerce.date(),
    }),
});

const tjenester = defineCollection({
    loader: glob({ pattern: '**/[^_]*.{md,mdoc}', base: './src/content/tjenester' }),
    schema: z.object({
        id: z.string(),
        title: z.string(),
        ingress: z.string(),
        active: z.boolean().default(true),
        priority: z.number().default(99),
    }),
});

const galleri = defineCollection({
    loader: async () => {
        const filePath = path.join(process.cwd(), 'src/content/galleri.json');
        if (!fs.existsSync(filePath)) return [];
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content) as Array<Record<string, unknown>>;
        return data.map((g, index) => ({
            id: (g.id as string) || `galleri-${index}`,
            ...g
        }));
    },
    schema: z.object({
        id: z.string(),
        title: z.string(),
        image: z.string().optional(),
        altText: z.string().optional(),
        order: z.number().default(99),
        type: z.string().default('galleri'),
        imageConfig: z.object({
            scale: z.number().default(1.0),
            positionX: z.number().default(50),
            positionY: z.number().default(50)
        }).optional()
    }),
});

const prisliste = defineCollection({
    loader: async () => {
        const filePath = path.join(process.cwd(), 'src/content/prisliste.json');
        if (!fs.existsSync(filePath)) return [];
        const content = fs.readFileSync(filePath, 'utf-8');
        const raw = JSON.parse(content) as Record<string, unknown> | Array<Record<string, unknown>>;
        const items = Array.isArray(raw) ? raw : ((raw.items as Array<Record<string, unknown>>) || []);
        return items.map((item, index) => ({
            id: `prisliste-${index}`,
            ...item,
        }));
    },
    schema: z.object({
        id: z.string(),
        kategori: z.string(),
        behandling: z.string(),
        pris: z.union([z.string(), z.number()]),
        sistOppdatert: z.string().default(''),
        order: z.number().default(0),
    }),
});

const kontaktskjema = defineCollection({
    loader: async () => {
        const filePath = path.join(process.cwd(), 'src/content/kontaktskjema.json');
        if (!fs.existsSync(filePath)) {
            return [{ id: 'kontaktskjema', aktiv: false, tittel: '', tekst: '', tema: [] }];
        }
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return [{ id: 'kontaktskjema', ...data }];
    },
    schema: z.object({
        id: z.string(),
        aktiv: z.boolean().default(false),
        tittel: z.string().default(''),
        tekst: z.string().default(''),
        tema: z.array(z.string()).default([]),
    }),
});

// --- 4. EKSPORT ---
export const collections = {tjenester, meldinger, innstillinger, tannleger, galleri, prisliste, kontaktskjema};