import {defineCollection, z} from 'astro:content';
import { glob } from 'astro/loaders';
import fs from 'fs';
import path from 'path';

const innstillinger = defineCollection({
    loader: async () => {
        const filePath = path.join(process.cwd(), 'src/content/innstillinger.json');
        if (!fs.existsSync(filePath)) return [];
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        return data.map((item: any) => ({
            id: item.id || '',
            value: item.value || ''
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
        const data = JSON.parse(content);
        return data.map((t: any, index: number) => ({
            id: t.id || `tannlege-${index}`,
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
        const data = JSON.parse(content);
        return data.map((g: any, index: number) => ({
            id: g.id || `galleri-${index}`,
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
        const data = JSON.parse(content);
        const items = Array.isArray(data) ? data : (data.items || []);
        return items.map((item: any, index: number) => ({
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
    }),
});

// --- 4. EKSPORT ---
export const collections = {tjenester, meldinger, innstillinger, tannleger, galleri, prisliste};