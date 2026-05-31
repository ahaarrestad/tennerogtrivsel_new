import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.PORT ?? '4321';

export default defineConfig({
  testDir: './tests',
  testIgnore: ['**/csp-check.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 14'] },
    },
  ],
  webServer: {
    command: process.env.CI ? 'npm run preview' : `PORT=${PORT} npm run dev:secure`,
    url: `http://localhost:${PORT}/admin`,
    reuseExistingServer: !process.env.CI,
  },
});
