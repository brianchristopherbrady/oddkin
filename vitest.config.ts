import { playwright } from '@vitest/browser-playwright';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The persistent module cache keys a module on its own source, so a module with
    // `import.meta.glob` keeps a stale file list after a file is added (packages/components/test/catalog.ts).
    fsModuleCache: false,
    projects: [
      {
        test: {
          name: 'node',
          include: ['packages/*/test/**/*.test.ts', 'tests/**/*.test.ts'],
          exclude: ['**/*.browser.test.ts', '**/node_modules/**'],
          environment: 'node',
          // Node tests share the machine with three browsers during `npm test`; tests that take
          // under 250 ms alone (schema compilation, temporary workspaces) have exceeded 5 s there.
          testTimeout: 20_000,
        },
      },
      {
        // Framework fixtures (packages/*/test/frameworks*.browser.test.ts) are pre-bundled so a
        // first run does not reload the page mid-test. Svelte components compile for tests only.
        plugins: [svelte()],
        optimizeDeps: {
          include: [
            'react',
            'react-dom',
            'react-dom/client',
            'vue',
            '@angular/compiler',
            '@angular/core',
            '@angular/forms',
            '@angular/platform-browser',
            'svelte',
          ],
        },
        test: {
          name: 'browser',
          // An IP literal: `localhost` can bind ::1 only, and Firefox then sometimes refuses to connect.
          api: { host: '127.0.0.1' },
          include: [
            'packages/*/test/**/*.browser.test.ts',
            'tests/**/*.browser.test.ts',
            'research/experiments/**/*.browser.test.ts',
          ],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }, { browser: 'firefox' }, { browser: 'webkit' }],
          },
        },
      },
    ],
  },
});
