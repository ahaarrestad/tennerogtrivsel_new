import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders'; // Viktig for Astro 5

const tjenester = defineCollection({
    loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: "./src/content/tjenester" }),
    schema: z.object({
        title: z.string(),
        ingress: z.string(),
    }),
});

const meldinger = defineCollection({
    loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: "./src/content/meldinger" }),
    schema: z.object({
        title: z.string(),
        startDate: z.date(),
        endDate: z.date(),
    }),
});


export const collections = { tjenester, meldinger};