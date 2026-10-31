import { expect, request, test, type Page } from '@playwright/test';

// A coding agent's pages, built from the packaged agent kit alone (tests/agent-run/README.md):
// a "Notification settings" card as markup (index.html) and as a composition document rendered
// with renderComposition (composition.html). scripts/packed-consumers.mjs installs the packed
// core, tokens, and components and serves the agent's files exactly as written, its own import
// maps included, at /agent-run/.
const site = 'http://127.0.0.1:4174/agent-run/';

interface Report {
  readonly installed: readonly string[];
  /** The import map each page needs, computed from the installed packages. */
  readonly maps: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

let report: Report;

test.beforeAll(async () => {
  // Three packages packed and installed: a minute or more on a cold npm cache.
  test.setTimeout(600_000);
  const api = await request.newContext();
  try {
    const response = await api.get(`${site}__ready`, { timeout: 590_000 });
    expect(response.ok(), await response.text()).toBe(true);
    report = (await response.json()) as Report;
  } finally {
    await api.dispose();
  }
});

/** Page errors, console errors, and failed requests; call the result to read them. */
function watch(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console: ${m.text()}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400) problems.push(`${r.status()} ${r.url()}`);
  });
  return () => problems;
}

test('the import map of each page maps exactly what the page loads, to the exported files', async ({
  page,
}) => {
  expect(report.installed).toEqual(
    expect.arrayContaining(['@oddkin/components', '@oddkin/core', '@oddkin/tokens']),
  );
  for (const file of ['index.html', 'composition.html']) {
    await page.goto(`${site}${file}`);
    const written = await page.evaluate(
      () =>
        JSON.parse(document.querySelector('script[type="importmap"]')?.textContent ?? '{}')
          .imports as Record<string, string>,
    );
    expect(written, file).toEqual(report.maps[file]);
  }
});

test('the settings page validates the email before saving', async ({ page }) => {
  const problems = watch(page);
  await page.goto(`${site}index.html`);
  const email = page.getByRole('textbox', { name: 'Email' });
  const save = page.getByRole('button', { name: 'Save' });
  await expect(page.getByRole('heading', { name: 'Notification settings' })).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Weekly digest' })).toBeVisible();
  await expect
    .poll(() => page.locator('#frequency').evaluate((el) => (el as HTMLInputElement).value))
    .toBe('weekly');
  // Empty, then not an address: the field shows the browser's message and nothing is saved.
  await save.click();
  await expect
    .poll(() => page.locator('#email').evaluate((el) => (el as never as { error: string }).error))
    .not.toBe('');
  await email.fill('not-an-address');
  await save.click();
  await expect(page.getByText('Settings saved.')).toHaveCount(0);
  await expect
    .poll(() => page.locator('#email').evaluate((el) => (el as HTMLInputElement).validity.valid))
    .toBe(false);
  await email.fill('ada@example.com');
  await save.click();
  await expect(page.locator('odd-alert[tone="success"]')).toHaveText('Settings saved.');
  expect(problems()).toEqual([]);
});

test('the composition page renders the document and reports its action', async ({ page }) => {
  const problems = watch(page);
  await page.goto(`${site}composition.html`);
  const app = page.locator('#app');
  await expect(app.locator('odd-card')).toHaveCount(1);
  expect(
    await app.evaluate((el) =>
      [...el.querySelectorAll('*')]
        .map((child) => child.localName)
        .filter((name) => name.startsWith('odd-') || name === 'h1'),
    ),
  ).toEqual(['odd-card', 'h1', 'odd-input', 'odd-switch', 'odd-select', 'odd-button']);
  await expect
    .poll(() =>
      page
        .locator('#frequency')
        .evaluate((el) => (el as never as { options: unknown[] }).options.length),
    )
    .toBe(3);
  await app.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('#actions li')).toHaveText(['settings.save']);
  expect(problems()).toEqual([]);
});
