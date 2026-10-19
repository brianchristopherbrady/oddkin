import { defineConfig, devices } from '@playwright/test';

const port = 4173;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  reporter: process.env['CI'] ? 'github' : 'list',
  use: { baseURL: `http://localhost:${port}` },
  webServer: [
    {
      command: `node scripts/serve-static.mjs --port ${port}`,
      url: `http://localhost:${port}/examples/plain-html/`,
      reuseExistingServer: !process.env['CI'],
    },
    {
      // Packs core, tokens, and components only when a test first requests the packed page.
      command: 'node examples/components-only/packed.mjs --port 4174',
      url: 'http://localhost:4174/__health',
      reuseExistingServer: !process.env['CI'],
    },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
