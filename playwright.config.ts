import { defineConfig, devices } from '@playwright/test';

const port = 4173;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    // CI uploads these on failure, so Linux-only failures can be inspected in the trace viewer.
    trace: process.env['CI'] ? 'retain-on-failure' : 'off',
  },
  webServer: [
    {
      command: `node scripts/serve-static.mjs --port ${port}`,
      url: `http://localhost:${port}/examples/plain-html/`,
      reuseExistingServer: !process.env['CI'],
    },
    {
      // Packed consumers (core-only, CSS-only, components-only, full application), each packed
      // only when a test first requests it.
      command: 'node scripts/packed-consumers.mjs --port 4174',
      url: 'http://127.0.0.1:4174/__health',
      reuseExistingServer: !process.env['CI'],
    },
    {
      // The Workbench dev server over the real components (e2e/workbench*.spec.ts).
      // An IP literal: `localhost` can bind ::1 only, and Firefox then sometimes refuses to connect.
      command:
        'node packages/workbench/dist/node/bin.js workbench dev --config tests/fixtures/workbench-oddkin --port 4175 --host 127.0.0.1 --no-watch',
      url: 'http://127.0.0.1:4175/_oddkin/index.json',
      reuseExistingServer: !process.env['CI'],
    },
    {
      // Oddkin docs app, shell and exported package assets (e2e/docs.spec.ts).
      command: 'npm run dev',
      url: 'http://127.0.0.1:4177/',
      reuseExistingServer: !process.env['CI'],
    },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
