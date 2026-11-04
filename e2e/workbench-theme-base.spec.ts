import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type FrameLocator } from '@playwright/test';
import { startDevServer, type DevServer } from '../packages/workbench/dist/node/index.js';

// A theme file on a shared base (P1.1 `extends`) in Theme Studio (P1.5 item 4): each file is its
// own draft, generated with the library's own generator and merge, and saving writes the file
// edited alone. A dev server of its own over a copy of the default theme as the base.
const dir = join(process.cwd(), '.tmp', `e2e-theme-base-${process.pid}`);
const base = join(dir, 'base.theme.json');
const product = join(dir, 'product.theme.json');
const original = readFileSync('packages/tokens/themes/default.theme.json', 'utf8');
const productText =
  '{\n  "extends": "./base.theme.json",\n  "name": "product",\n  "brand": { "primary": "#0a7d33" }\n}\n';
let server: DevServer;

test.beforeAll(async () => {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'oddkin.config.json'),
    JSON.stringify({
      library: { packages: ['@oddkin/components'] },
      branding: { name: 'Theme base' },
      themeStudio: { themeConfig: './product.theme.json' },
    }),
  );
  writeFileSync(base, original);
  writeFileSync(product, productText);
  server = await startDevServer({ config: dir, port: 0, host: '127.0.0.1' });
});

test.afterAll(async () => {
  await server?.close();
  rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

/** A token's value in the light frame. */
const token = (frame: FrameLocator, name: string) =>
  frame
    .locator('html')
    .evaluate((html, property) => getComputedStyle(html).getPropertyValue(property).trim(), name);

test('edits each file of a theme on a base, and saves the file edited alone', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(new URL('theme-studio', server.url).href);
  const light = page.frameLocator('oddkin-workbench-theme-studio iframe').first();
  await expect(light.locator('figure[data-role="primaryAction"] > odd-button')).toBeAttached({
    timeout: 45_000,
  });
  const picker = page.locator('#ts-file');
  const status = page.locator('#ts-impact');
  const primary = page.locator('#ts-brand-primary');
  const action = page.locator('input[data-path="/overrides/color.action.default/light"]');

  // The product file first, as written; what it does not set comes from its base.
  await expect(picker).toHaveValue('product.theme.json');
  await expect(primary).toHaveValue('#0a7d33');
  await expect(page.locator('#ts-brand-primary-origin')).toHaveText(
    'foundation input · set in this file',
  );
  await expect(action).toHaveValue('');
  await expect(action).toHaveAttribute('placeholder', '#6250e8 (from base.theme.json)');
  const inherited = await token(light, '--odd-color-action-default');
  expect(inherited).not.toBe('');

  // The base: an edit to a value the product sets itself changes no product...
  await picker.selectOption('base.theme.json');
  await expect(page.locator('#ts-file-note')).toContainText('Products on it: product.theme.json.');
  await expect(primary).toHaveValue('#6250e8');
  await primary.fill('#123456');
  await primary.press('Tab');
  await expect(status).toHaveText('This edit changes no product. Unchanged: product.theme.json.', {
    timeout: 30_000,
  });
  // ...and one to a value it inherits changes it.
  await action.fill('#aa0000');
  await action.press('Tab');
  await expect(status).toHaveText('This edit changes product.theme.json.', { timeout: 30_000 });

  // The product, generated on the edited base.
  await picker.selectOption('product.theme.json');
  await expect(action).toHaveAttribute('placeholder', '#aa0000 (from base.theme.json)');
  await expect
    .poll(() => token(light, '--odd-color-action-default'), { timeout: 30_000 })
    .not.toBe(inherited);

  // Saving the base writes the base alone, in its own layout.
  await picker.selectOption('base.theme.json');
  const save = page.getByRole('button', { name: 'Save to base.theme.json…' });
  await expect(save).toBeEnabled({ timeout: 30_000 });
  await save.click();
  const changes = page.getByRole('region', { name: 'Changes to base.theme.json' });
  await expect(changes.locator('pre')).toContainText('+  "brand": { "primary": "#123456" },');
  const write = changes.getByRole('button', { name: 'Write base.theme.json' });
  await expect(write).toBeEnabled({ timeout: 30_000 });
  await write.click();
  await expect(page.locator('#export')).toContainText('Saved base.theme.json.');
  expect(readFileSync(base, 'utf8')).toBe(
    original
      .replace('"brand": { "primary": "#6250e8" }', '"brand": { "primary": "#123456" }')
      .replace(
        '"color.action.default": { "light": "#6250e8"',
        '"color.action.default": { "light": "#aa0000"',
      ),
  );
  expect(readFileSync(product, 'utf8')).toBe(productText);

  // Saving the product writes its own values alone: nothing of the base is copied into it.
  await picker.selectOption('product.theme.json');
  await page.locator('#ts-brand-neutral').fill('#5f6270');
  await page.locator('#ts-brand-neutral').press('Tab');
  const saveProduct = page.getByRole('button', { name: 'Save to product.theme.json…' });
  await saveProduct.click();
  const productChanges = page.getByRole('region', { name: 'Changes to product.theme.json' });
  const writeProduct = productChanges.getByRole('button', { name: 'Write product.theme.json' });
  await expect(writeProduct).toBeEnabled({ timeout: 30_000 });
  await writeProduct.click();
  await expect(page.locator('#export')).toContainText('Saved product.theme.json.');
  expect(JSON.parse(readFileSync(product, 'utf8'))).toEqual({
    extends: './base.theme.json',
    name: 'product',
    brand: { primary: '#0a7d33', neutral: '#5f6270' },
  });
  expect(errors).toEqual([]);
});
