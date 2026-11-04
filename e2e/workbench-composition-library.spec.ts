import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { startDevServer, type DevServer } from '../packages/workbench/dist/node/index.js';

// Theme Studio's composition screens with a library's own elements (P1.6): @plain/widgets has no
// renderer of its own, so @oddkin/components' renders its elements with the catalog the analyzer
// generates from its manifest. A dev server of its own, over a project that documents both.
const dir = join(process.cwd(), '.tmp', `e2e-composition-${process.pid}`);
let server: DevServer;

test.beforeAll(async () => {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'oddkin.config.json'),
    JSON.stringify({
      library: { packages: ['@oddkin/components', '@plain/widgets'] },
      themeStudio: { themeConfig: './oddkin.theme.json' },
    }),
  );
  writeFileSync(
    join(dir, 'oddkin.theme.json'),
    readFileSync('packages/tokens/themes/default.theme.json', 'utf8'),
  );
  cpSync(
    'tests/consumers/workbench/plain-widgets',
    join(dir, 'node_modules', '@plain', 'widgets'),
    {
      recursive: true,
    },
  );
  server = await startDevServer({ config: dir, port: 0, host: '127.0.0.1', watch: false });
});

test.afterAll(async () => {
  await server?.close();
  rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

const document = (tone: string) =>
  JSON.stringify({
    version: 1,
    root: [
      {
        element: 'odd-card',
        attributes: { label: 'Labels' },
        children: [
          {
            element: 'plain-chip',
            attributes: { label: 'Draft', tone },
            actions: { 'plain-remove': 'label.remove' },
            children: ['Draft'],
          },
          { element: 'odd-button', slot: 'footer', children: ['Add a label'] },
        ],
      },
    ],
  });

test("renders documents that use a library's own elements beside Oddkin's", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(new URL('theme-studio', server.url).href);
  const frames = [0, 1].map((i) =>
    page.frameLocator('oddkin-workbench-theme-studio iframe').nth(i),
  );
  await expect(frames[0]!.locator('figure[data-role="primaryAction"] > odd-button')).toBeAttached({
    timeout: 45_000,
  });
  await page.locator('#ts-screen').selectOption({ label: 'Your document' });
  const editor = page.locator('#ts-composition');
  await editor.fill(document('info'));
  for (const frame of frames) {
    const chip = frame.locator('odd-card > plain-chip');
    await expect(chip).toHaveAttribute('tone', 'info', { timeout: 20_000 });
    // Registered before it rendered: the element was created upgraded.
    await expect(chip).toHaveJSProperty('label', 'Draft');
    await expect(frame.locator('odd-card > odd-button[slot="footer"]')).toBeAttached();
  }
  await expect(page.getByRole('list', { name: 'Composition diagnostics' })).toHaveCount(0);

  // The library's own types are checked: a tone it does not publish refuses the document.
  await editor.fill(document('loud'));
  await expect(page.getByRole('list', { name: 'Composition diagnostics' })).toContainText(
    '/root/0/children/0/attributes/tone',
  );
  await expect(frames[0]!.locator('plain-chip')).toHaveCount(0);
  expect(errors).toEqual([]);
});
