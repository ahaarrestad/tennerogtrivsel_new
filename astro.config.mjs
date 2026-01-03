// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()]
  },

  // VIKTIG: Erstatt med din faktiske domeneadresse
  site: 'https://www.tennerogtrivsel.no',
  integrations: [sitemap()],
});