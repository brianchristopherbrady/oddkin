import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { expect, test, type Page } from '@playwright/test';

// The Form example (examples/forms, Figma `Form`): one test per Figma state, in every engine.
const axeSource = readFileSync(
  createRequire(import.meta.url).resolve('axe-core/axe.min.js'),
  'utf8',
);

async function open(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/examples/forms/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  return errors;
}
const field = (page: Page, name: string) => page.getByRole('textbox', { name, exact: true });
/** The WCAG A and AA rules axe finds, by id. */
async function axe(page: Page) {
  await page.evaluate(axeSource);
  return page.evaluate(async () => {
    const axe = (
      window as unknown as {
        axe: { run(c: Document, o: object): Promise<{ violations: { id: string }[] }> };
      }
    ).axe;
    const result = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    });
    return result.violations.map((v) => v.id);
  });
}

test('editing: no errors, no axe violations, the controls submit their values', async ({
  page,
}) => {
  const errors = await open(page);
  expect(await axe(page)).toEqual([]);
  const data = await page.evaluate(() => [
    ...new FormData(document.querySelector('form')!).entries(),
  ]);
  expect(data).toEqual([
    ['project', 'Design system'],
    ['owner', 'avery@example.com'],
    ['notify', 'email'],
  ]);
  expect(errors).toEqual([]);
});

test('invalid: the summary takes focus and links to each invalid control; entries stay', async ({
  page,
}) => {
  await open(page);
  await field(page, 'Project name').fill('');
  await field(page, 'Owner email').fill('avery@');
  await page.getByRole('button', { name: 'Save changes' }).click();
  const summary = page.getByRole('group', { name: 'Please fix 2 fields' });
  await expect(summary).toBeVisible();
  await expect(summary).toBeFocused();
  const links = summary.getByRole('link');
  await expect(links).toHaveCount(2);
  await links.nth(1).click();
  await expect(field(page, 'Owner email')).toBeFocused();
  await expect(field(page, 'Owner email')).toHaveValue('avery@');
  expect(await axe(page)).toEqual([]);
  // Fixing both and saving again submits (odd-input has no implicit submission on Enter).
  await field(page, 'Owner email').fill('avery@example.com');
  await field(page, 'Project name').fill('Design system');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(summary).toBeHidden();
  await expect(page.getByText('Changes saved successfully.')).toBeVisible();
});

test('submitting, then success: the fieldset is disabled while saving; saved values are kept on Cancel', async ({
  page,
}) => {
  await open(page);
  await field(page, 'Project name').fill('Atlas');
  await expect(page.getByText('You have unsaved changes.')).toBeVisible();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('button', { name: /Saving/ })).toBeVisible();
  await expect(field(page, 'Project name')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  expect(await axe(page)).toEqual([]);
  await expect(page.getByText('Changes saved successfully.')).toBeVisible();
  await expect(field(page, 'Project name')).toBeEnabled();
  await expect(page.getByText('You have unsaved changes.')).toBeHidden();
  await field(page, 'Project name').fill('Other');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(field(page, 'Project name')).toHaveValue('Atlas');
  await expect(page.getByText('You have unsaved changes.')).toBeHidden();
});

test('error: a failed save keeps the entries and offers a retry', async ({ page }) => {
  await open(page);
  await page.evaluate(() => (document.body.dataset.saveFails = 'true'));
  await field(page, 'Project name').fill('Atlas');
  await page.getByRole('checkbox', { name: 'Weekly summary' }).check();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Your changes could not be saved.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry save' })).toBeVisible();
  await expect(field(page, 'Project name')).toHaveValue('Atlas');
  await expect(page.getByRole('checkbox', { name: 'Weekly summary' })).toBeChecked();
  await expect(page.getByText('You have unsaved changes.')).toBeVisible();
  expect(await axe(page)).toEqual([]);
});
