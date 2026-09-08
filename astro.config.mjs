import {defineConfig} from 'astro/config';
import {loadEnv} from 'vite';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// CARTO krever ?key= på tile-URL-er. I prod settes nøkkelen av CloudFront-funksjonen;
// lokalt leses den fra .env (gitignorert). Vite laster .env først etter at denne fila er
// evaluert, så process.env er tom her — derfor loadEnv. Uten nøkkel fungerer proxyen
// fortsatt, men tiles kommer vannmerket.
const CARTO_API_KEY = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '').CARTO_API_KEY;

export default defineConfig({
    vite: {
        plugins: [tailwindcss()],
        optimizeDeps: {
            entries: ['src/pages/admin/index.astro'],
            // marked + dompurify lastes klient-side via InfoBanner på alle sider.
            // Uten pre-bundling oppdager Vite dem on-demand ved første sidelast og
            // tvinger en full page-reload — som under last kan rive ned axe-core sin
            // execution context midt i UU-skann (flaky E2E). Pre-bundling fjerner racet.
            include: ['easymde', 'flatpickr', 'flatpickr/dist/l10n/no.js', 'marked', 'dompurify'],
        },
        server: {
            proxy: {
                '/tiles': {
                    target: 'https://basemaps.cartocdn.com',
                    changeOrigin: true,
                    rewrite: (path) => {
                        const rewritten = path.replace(/^\/tiles/, '/rastertiles/voyager');
                        if (!CARTO_API_KEY) return rewritten;
                        const skille = rewritten.includes('?') ? '&' : '?';
                        return `${rewritten}${skille}key=${encodeURIComponent(CARTO_API_KEY)}`;
                    },
                },
                '/api/kontakt': {
                    target: 'http://localhost:3001',
                    changeOrigin: false,
                },
            },
        },
    },
    devToolbar: { enabled: process.env.SECURE_DEV !== 'true' },
    site: 'https://www.tennerogtrivsel.no',
    integrations: [sitemap({
        filter: (page) => !page.includes('/admin') && !page.includes('/robots.txt') && !page.includes('/prisliste'),
    })],
});