import { expect, test } from '@playwright/test';

// The binding rule, observed: render() runs and shadow-DOM writes per step, identical for
// elements authored in plain JavaScript and in TypeScript.
const expected = [
  ['Direct binding: three writes in one task', 0, 1, '3'],
  ['Render-tracked .value: three writes in one task', 1, 1, '3'],
  ['Both paths reach one value (coalesced)', 1, 1, 'small 1'],
  ['Event handler reads .value (snapshot)', 0, 0, 'read 0'],
  ['Later write after a handler read', 0, 0, 'async callback read 5'],
  ['No-op write (same value)', 0, 0, '3'],
  ['Public property set by DOM code', 1, 1, 'Hello, Ada; updated(label)'],
  ['Same public value again', 0, 0, 'Hello, Ada; updated calls +0'],
  ['Attribute set by markup or DOM code', 1, 1, 'Hello, Grace'],
  ['Update boundary (updateComplete)', 1, 1, 'before await 3, after 4'],
].map(([rule, renders, writes, result]) => ({ rule, renders, writes, result }));

test('binding rule walkthrough gives the same counts in plain JS and TypeScript', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/examples/binding-rule/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const results = await page.evaluate(
    () => (globalThis as unknown as { walkthrough: Record<string, unknown> }).walkthrough,
  );
  expect(results['js']).toEqual(expected);
  expect(results['ts']).toEqual(expected);

  const table = page.getByRole('table', { name: 'Plain JavaScript elements' });
  await expect(
    table.getByRole('row', { name: /Direct binding: three writes in one task/ }),
  ).toContainText('013');
  await expect(page.getByRole('table', { name: 'TypeScript elements' })).toBeVisible();
  expect(errors).toEqual([]);
});
