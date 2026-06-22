// Bruk Astros Vite-oppsett slik at .astro-komponenter kan importeres og
// rendres i tester (via experimental_AstroContainer). getViteConfig legger
// til Astros plugins som parser .astro-filer.
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    environment: 'node', // or 'jsdom' if you need browser APIs
    // Nullstill mock-historikk (mock.calls/results) før hver test mot lekkasje
    // mellom tester. Påvirker ikke implementasjoner (vi.mock-factories består).
    clearMocks: true,
    include: [
      'src/**/__tests__/**/*.{ts,js}',
      'lambda/**/__tests__/**/*.mjs',
      'scripts/**/__tests__/**/*.mjs',
    ],
    exclude: ['src/**/__tests__/test-helpers.js'],
    // workaround for astro:content
    alias: {
      'astro:content': new URL('./src/__mocks__/astroContent.ts', import.meta.url).pathname,
    },
    coverage: {
      provider: 'v8', // or 'istanbul'
      reporter: ['text', 'json', 'html'],
      exclude: ['lambda/**'],
      thresholds: {
        lines: 80, // Minimum coverage percentage for statements
        functions: 80, // Minimum coverage percentage for functions
        branches: 80, // Minimum coverage percentage for branches
        statements: 80, // Minimum coverage percentage for statements
      }
    },
    // Note: For UI/Component testing, consider setting environment to 'jsdom'
    // or using a browser-based environment for client-side components.
  },
});
