// src/pages/robots.txt.ts
import type { APIRoute } from 'astro';
import { generateRobotsTxt } from '../scripts/generate-robots.js';

export const GET: APIRoute = ({ request }) => {
    const url = new URL(request.url);
    const prodUrl = "https://www.tennerogtrivsel.no";
    const sitemapUrl = new URL('sitemap-index.xml', prodUrl).href;

    const robotsTxt = generateRobotsTxt(url.hostname, sitemapUrl);

    return new Response(robotsTxt.trim(), {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
};
