import { expect, test, type Page } from '@playwright/test';

// examples/editable-list: keyed odd-input rows in a native form, under a strict CSP.

test.describe.configure({ timeout: 60_000 });

async function open(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.addInitScript(() => {
    const violations: string[] = [];
    (window as unknown as { __violations: string[] }).__violations = violations;
    document.addEventListener('securitypolicyviolation', (event) =>
      violations.push(`${event.violatedDirective}: ${event.blockedURI}`),
    );
  });
  await page.goto('/examples/editable-list/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  return async () => {
    expect(
      await page.evaluate(() => (window as unknown as { __violations: string[] }).__violations),
    ).toEqual([]);
    expect(errors).toEqual([]);
  };
}

const member = (page: Page, n: number) => page.getByRole('group', { name: `Member ${n}` });
const saved = async (page: Page) =>
  JSON.parse((await page.locator('#result').textContent()) ?? '[]') as Array<{
    id: string;
    name: string;
    email: string;
  }>;

test('edit, reorder, remove, undo, add, and submit the rows in display order', async ({ page }) => {
  const clean = await open(page);
  await member(page, 2).getByRole('textbox', { name: 'Name' }).fill('Grace Brewster Hopper');
  await member(page, 2).getByRole('button', { name: 'Move up' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Grace Brewster Hopper moved to position 1 of 3.',
  );
  // The moved row keeps its typed value; the focused button moved with it.
  await expect(member(page, 1).getByRole('textbox', { name: 'Name' })).toHaveValue(
    'Grace Brewster Hopper',
  );

  await member(page, 3).getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByRole('status')).toHaveText('Removed Katherine Johnson.');
  const undo = page.getByRole('button', { name: 'Undo' });
  await expect(undo).toBeFocused();
  await expect(page.getByRole('group')).toHaveCount(2);
  await page.keyboard.press('Enter');
  await expect(undo).toBeHidden();
  await expect(member(page, 3).getByRole('textbox', { name: 'Name' })).toBeFocused();
  await expect(member(page, 3).getByRole('textbox', { name: 'Name' })).toHaveValue(
    'Katherine Johnson',
  );

  await page.getByRole('button', { name: 'Add member' }).click();
  const added = member(page, 4);
  await expect(added.getByRole('textbox', { name: 'Name' })).toBeFocused();
  await page.keyboard.type('Dorothy Vaughan');
  await added.getByRole('textbox', { name: 'Email' }).fill('dorothy@example.com');

  await page.getByRole('button', { name: 'Save team' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved 4 members.');
  expect(await saved(page)).toEqual([
    { id: 'grace', name: 'Grace Brewster Hopper', email: 'grace@example.com' },
    { id: 'ada', name: 'Ada Lovelace', email: 'ada@example.com' },
    { id: 'katherine', name: 'Katherine Johnson', email: 'katherine@example.com' },
    { id: 'new-1', name: 'Dorothy Vaughan', email: 'dorothy@example.com' },
  ]);
  await clean();
});

test('a row reaching an edge hands focus to its other move button', async ({ page }) => {
  const clean = await open(page);
  const up = member(page, 2).getByRole('button', { name: 'Move up' });
  await up.focus();
  await page.keyboard.press('Enter');
  await expect(member(page, 1).getByRole('button', { name: 'Move up' })).toBeDisabled();
  await expect(member(page, 1).getByRole('button', { name: 'Move down' })).toBeFocused();
  await expect(member(page, 1).getByRole('textbox', { name: 'Name' })).toHaveValue('Grace Hopper');
  await clean();
});

test('native and model validation point at the right row and field', async ({ page }) => {
  const clean = await open(page);
  // Native: an empty added row blocks submission and shows its own errors.
  await page.getByRole('button', { name: 'Add member' }).click();
  await page.getByRole('button', { name: 'Save team' }).click();
  await expect(member(page, 4).getByRole('textbox', { name: 'Name' })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(member(page, 1).getByRole('textbox', { name: 'Name' })).not.toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(page.locator('#result')).toHaveText('Nothing saved yet.');
  await member(page, 4).getByRole('button', { name: 'Remove' }).click();

  // Model: a duplicate address passes native checks and is caught on save.
  const email = member(page, 3).getByRole('textbox', { name: 'Email' });
  await email.fill('ADA@example.com');
  await page.getByRole('button', { name: 'Save team' }).click();
  await expect(page.getByRole('status')).toHaveText('Not saved: 1 problem.');
  await expect(email).toBeFocused();
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await expect(member(page, 3)).toContainText('Member 1 already uses this address.');
  await expect(member(page, 1).getByRole('textbox', { name: 'Email' })).not.toHaveAttribute(
    'aria-invalid',
    'true',
  );
  // Editing the field clears its error.
  await email.fill('katherine@example.com');
  await expect(email).not.toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('button', { name: 'Save team' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved 3 members.');
  await clean();
});

test('the simulated server check rejects a taken address and blocks submission', async ({
  page,
}) => {
  const clean = await open(page);
  const email = member(page, 2).getByRole('textbox', { name: 'Email' });
  await email.fill('grace@taken.example');
  await expect(member(page, 2)).toContainText('This address already belongs to another team.');
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('button', { name: 'Save team' }).click();
  await expect(page.locator('#result')).toHaveText('Nothing saved yet.');
  await clean();
});

test('reflows at 320 CSS pixels and at 200% text without horizontal scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  const clean = await open(page);
  const overflow = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
  expect(await overflow()).toBeLessThanOrEqual(0);
  await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
  expect(await overflow()).toBeLessThanOrEqual(0);
  await clean();
});
