import { expect, test } from '@playwright/test';

test('plain-HTML consumer loads every package through an import map', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/examples/plain-html/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await expect(
    page.getByRole('list', { name: 'Loaded packages' }).getByRole('listitem'),
  ).toHaveText([
    '@oddkin/core',
    '@oddkin/tokens',
    '@oddkin/state',
    '@oddkin/app',
    '@oddkin/components',
  ]);
  await expect(page.locator('body')).toHaveAttribute('data-state-deps', '@oddkin/core');
  expect(errors).toEqual([]);
});
