import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'node',
          include: ['packages/*/test/**/*.test.ts', 'tests/**/*.test.ts'],
          exclude: ['**/*.browser.test.ts', '**/node_modules/**'],
          environment: 'node',
        },
      },
      {
        // Framework fixtures (packages/ai/test/frameworks.browser.test.ts) are pre-bundled so a
        // first run does not reload the page mid-test.
        optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client', 'vue'] },
        test: {
          name: 'browser',
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
