import {defineConfig} from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
    vite: {
        plugins: [tailwindcss()],
        optimizeDeps: {
            entries: ['src/pages/admin/index.astro'],
            include: ['easymde', 'flatpickr', 'flatpickr/dist/l10n/no.js'],
        },
        server: {
            proxy: {
                '/tiles': {
                    target: 'https://basemaps.cartocdn.com',
                    changeOrigin: true,
                    rewrite: (path) => path.replace(/^\/tiles/, '/rastertiles/voyager'),
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
        filter: (page) => !page.includes('/admin') && !page.includes('/robots.txt'),
    })],
});