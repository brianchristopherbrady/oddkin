import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type FrameLocator } from '@playwright/test';
import { startDevServer, type DevServer } from '../packages/workbench/dist/node/index.js';

// Several themes on a shared base, and the products of a file, in Theme Studio (P1.5 item 4):
// a product edited through its own entries, a new product from a brand colour, Compare, and
// saving the file edited alone. A dev server of its own over a copy of the default theme as the
// base, with the library's own generator and merge.
const dir = join(process.cwd(), '.tmp', `e2e-theme-products-${process.pid}`);
const original = readFileSync('packages/tokens/themes/default.theme.json', 'utf8');
const clinicText = '{\n  "extends": "./base.theme.json",\n  "brand": { "primary": "#0a7d33" }\n}\n';
const portalText =
  '{\n  "extends": "./base.theme.json",\n  "products": {\n    "kiosk": { "brand": { "primary": "#aa0000" } }\n  }\n}\n';
let server: DevServer;

test.beforeAll(async () => {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'oddkin.config.json'),
    JSON.stringify({
      library: { packages: ['@oddkin/components'] },
      branding: { name: 'Theme products' },
      themeStudio: { themes: { clinic: './clinic.theme.json', portal: './portal.theme.json' } },
    }),
  );
  writeFileSync(join(dir, 'base.theme.json'), original);
  writeFileSync(join(dir, 'clinic.theme.json'), clinicText);
  writeFileSync(join(dir, 'portal.theme.json'), portalText);
  server = await startDevServer({ config: dir, port: 0, host: '127.0.0.1' });
});

test.afterAll(async () => {
  await server?.close();
  rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

/** A token's value on a frame's preview container, where the product setting applies. */
const token = (frame: FrameLocator, name: string) =>
  frame
    .locator('[data-oddkin-preview]')
    .evaluate(
      (element, property) => getComputedStyle(element).getPropertyValue(property).trim(),
      name,
    );

test("edits a file's products, adds one, compares, and saves the file alone", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(new URL('theme-studio', server.url).href);
  const studio = page.locator('oddkin-workbench-theme-studio');
  const light = page.frameLocator('oddkin-workbench-theme-studio .wb-pair iframe').first();
  await expect(light.locator('figure[data-role="primaryAction"] > odd-button')).toBeAttached({
    timeout: 45_000,
  });
  const picker = page.locator('#ts-file');
  await expect(picker).toHaveValue('clinic.theme.json');

  // A product of a file: its own entries, and the frames show it.
  await picker.selectOption({ label: 'portal / kiosk' });
  await expect(light.locator('[data-oddkin-preview]')).toHaveAttribute('data-odd-product', 'kiosk');
  const primary = page.locator('#ts-brand-primary');
  await expect(primary).toHaveValue('#aa0000');
  await expect(page.locator('#ts-status-danger')).toHaveCount(0);
  const before = await token(light, '--odd-ref-brand-500');
  await primary.fill('#7a3fd1');
  await primary.press('Tab');
  await expect
    .poll(() => token(light, '--odd-ref-brand-500'), { timeout: 30_000 })
    .not.toBe(before);

  // A new product from a brand colour.
  await page.locator('#ts-new-product').fill('museum');
  await page.locator('#ts-new-brand').fill('#00aa55');
  await page.getByRole('button', { name: 'Add product' }).click();
  await expect(picker.locator('option:checked')).toHaveText('portal / museum');
  await expect(light.locator('[data-oddkin-preview]')).toHaveAttribute(
    'data-odd-product',
    'museum',
  );

  // Compare: clinic beside it, in light and dark, on the same screen.
  await studio.getByRole('checkbox', { name: 'clinic' }).check();
  const compared = studio.getByRole('region', { name: 'clinic' });
  await expect(compared.locator('iframe')).toHaveCount(2);
  const clinic = compared.frameLocator('iframe').first();
  await expect(clinic.locator('figure[data-role="primaryAction"] > odd-button')).toBeAttached({
    timeout: 45_000,
  });
  await expect.poll(() => token(clinic, '--odd-ref-brand-500'), { timeout: 30_000 }).not.toBe('');
  await studio.getByRole('checkbox', { name: 'clinic' }).uncheck();
  await expect(compared).toHaveCount(0);

  // Saving writes the file edited, its own entries alone.
  const save = page.getByRole('button', { name: 'Save to portal.theme.json…' });
  await expect(save).toBeEnabled({ timeout: 30_000 });
  await save.click();
  const write = page
    .getByRole('region', { name: 'Changes to portal.theme.json' })
    .getByRole('button', { name: 'Write portal.theme.json' });
  await expect(write).toBeEnabled({ timeout: 30_000 });
  await write.click();
  await expect(page.locator('#export')).toContainText('Saved portal.theme.json.');
  expect(JSON.parse(readFileSync(join(dir, 'portal.theme.json'), 'utf8'))).toEqual({
    extends: './base.theme.json',
    products: {
      kiosk: { brand: { primary: '#7a3fd1' } },
      museum: { brand: { primary: '#00aa55' } },
    },
  });
  expect(readFileSync(join(dir, 'clinic.theme.json'), 'utf8')).toBe(clinicText);
  expect(readFileSync(join(dir, 'base.theme.json'), 'utf8')).toBe(original);
  expect(errors).toEqual([]);
});
