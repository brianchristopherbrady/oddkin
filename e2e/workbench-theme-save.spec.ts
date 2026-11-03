import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { startDevServer, type DevServer } from '../packages/workbench/dist/node/index.js';

// Saving Theme Studio's draft to its theme file (workbench.md §9), on a dev server of its own
// over a copy of the default theme, so no shared file is written.
const dir = join(process.cwd(), '.tmp', `e2e-theme-save-${process.pid}`);
const theme = join(dir, 'oddkin.theme.json');
const original = readFileSync('packages/tokens/themes/default.theme.json', 'utf8');
let server: DevServer;

test.beforeAll(async () => {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'oddkin.config.json'),
    JSON.stringify({
      library: { packages: ['@oddkin/components'] },
      branding: { name: 'Theme save' },
      themeStudio: { themeConfig: './oddkin.theme.json' },
    }),
  );
  writeFileSync(theme, original);
  server = await startDevServer({ config: dir, port: 0, host: '127.0.0.1' });
});

test.afterAll(async () => {
  await server?.close();
  rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

test("writes Theme Studio's draft to the theme file after showing the diff", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(new URL('theme-studio', server.url).href);
  const light = page.frameLocator('oddkin-workbench-theme-studio iframe').first();
  await expect(light.locator('figure[data-role="primaryAction"] > odd-button')).toBeAttached({
    timeout: 45_000,
  });
  await page.locator('#ts-screen').selectOption({ label: 'Settings form' });
  await expect(light.locator('odd-card > odd-textarea')).toBeAttached({ timeout: 20_000 });
  const cell = page.locator('input[data-path="/overrides/color.action.default/light"]');
  const save = page.getByRole('button', { name: 'Save to oddkin.theme.json…' });
  await expect(save).toBeEnabled({ timeout: 30_000 });
  // The click that ends the edit (the field's change) reviews the edited draft.
  await cell.fill('#0a7d33');
  await save.click();
  const changes = page.getByRole('region', { name: 'Changes to oddkin.theme.json' });
  await expect(changes.locator('pre')).toContainText(
    '-    "color.action.default": { "light": "#6250e8", "dark": "#b4a8ff" },\n' +
      '+    "color.action.default": { "light": "#0a7d33", "dark": "#b4a8ff" },',
  );
  expect(readFileSync(theme, 'utf8')).toBe(original);

  // Writing waits for the generator to accept the draft, as an export does.
  const write = changes.getByRole('button', { name: 'Write oddkin.theme.json' });
  await expect(write).toBeEnabled();
  await write.click();
  await expect(page.locator('#export')).toContainText('Saved oddkin.theme.json.');
  // Only the edited line changed, in the file's own layout.
  expect(readFileSync(theme, 'utf8')).toBe(
    original.replace(
      '"color.action.default": { "light": "#6250e8"',
      '"color.action.default": { "light": "#0a7d33"',
    ),
  );

  // The dev server rebuilds with the saved file as the baseline; the draft and screen stay.
  const data = new URL('_oddkin/pages/theme-studio.json', server.url).href;
  await expect
    .poll(async () => JSON.stringify(await (await page.request.get(data)).json()))
    .toContain('#0a7d33');
  await expect(page.locator('#ts-screen')).toHaveValue('composition:settings-form');
  await expect(light.locator('odd-card > odd-textarea')).toBeAttached();
  await expect(cell).toHaveValue('#0a7d33');
  await save.click();
  await expect(page.locator('#export')).toContainText(
    'oddkin.theme.json already holds this draft.',
  );
});
