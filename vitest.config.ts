import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node', // or 'jsdom' if you need browser APIs
    include: ['src/**/*.test.ts', 'src/**/*.test.js'], // or wherever your tests are
    // workaround for astro:content
    alias: {
      'astro:content': new URL('./src/__mocks__/astroContent.ts', import.meta.url).pathname,
    },
    coverage: {
      provider: 'v8', // or 'istanbul'
      reporter: ['text', 'json', 'html'],
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
