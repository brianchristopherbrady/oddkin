import { expect, request, test, type Page } from '@playwright/test';

// Workbench from packed packages (priority plan P0.3, M12; scripts/workbench-consumer.mjs). A
// fresh project outside the workspace installs the packed Workbench, the packed Oddkin components,
// and @plain/widgets, a library with a standard Custom Elements Manifest only, each from a
// tarball, and documents both: `oddkin workbench dev` (its URL in the report) and `oddkin
// workbench build`, served by scripts/packed-consumers.mjs under /workbench/.
const packed = 'http://127.0.0.1:4174/workbench/';

interface Report {
  readonly installed: readonly string[];
  readonly build: string;
  readonly dev: string;
}

let report: Report;

test.beforeAll(async () => {
  // One install of seven packed packages and a build: a minute or more on a cold npm cache.
  test.setTimeout(600_000);
  const api = await request.newContext();
  try {
    const response = await api.get(`${packed}__ready`, { timeout: 590_000 });
    expect(response.ok(), await response.text()).toBe(true);
    report = (await response.json()) as Report;
  } finally {
    await api.dispose();
  }
});

function pageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

async function open(page: Page, url: string, heading: string) {
  await page.goto(url);
  await expect(page.locator('main h1')).toHaveText(heading, { timeout: 30_000 });
}

/** The preview frame of the component page. */
const preview = (page: Page) => page.frameLocator('oddkin-workbench-component iframe').first();

test('installs Workbench, the Oddkin components, and the plain library from tarballs', () => {
  expect(report.installed).toEqual(
    expect.arrayContaining([
      '@oddkin/analyzer',
      '@oddkin/components',
      '@oddkin/core',
      '@oddkin/tokens',
      '@oddkin/workbench',
      '@plain/widgets',
    ]),
  );
  expect(report.build).toMatch(/^Workbench build: dist \(\d+ files/);
  expect(report.dev).toBe('http://127.0.0.1:4176/');
});

test.describe('the dev server of a fresh project', () => {
  test.describe.configure({ timeout: 90_000 });

  test('lists both libraries in the catalog', async ({ page }) => {
    await open(page, `${report.dev}components`, 'Components');
    const cards = page.locator('odd-card.wb-card');
    await expect(cards.filter({ hasText: 'odd-button' })).toHaveCount(1);
    await expect(cards.filter({ hasText: 'plain-chip' })).toHaveCount(1);
  });

  test('documents the Oddkin library: its real component, edits in place, presets, Reset, and a link', async ({
    page,
  }) => {
    const errors = pageErrors(page);
    await open(page, `${report.dev}components/odd-button`, 'Button');
    const button = preview(page).locator('odd-button');
    // The default example's values come from the packed metadata: the package ships no sources.
    await expect(button).toHaveText('Save', { timeout: 30_000 });
    await page.getByRole('combobox', { name: 'appearance (attribute)' }).selectOption('primary');
    await expect(button).toHaveAttribute('appearance', 'primary');
    await page.getByLabel('default slot text').fill('Publish');
    await expect(button).toHaveText('Publish');
    await page
      .locator('tr[data-css="--odd-button-background"]')
      .getByRole('textbox')
      .fill('rgb(1, 2, 3)');
    await expect
      .poll(() =>
        button.evaluate(
          (el) => getComputedStyle(el.shadowRoot!.querySelector('button')!).backgroundColor,
        ),
      )
      .toBe('rgb(1, 2, 3)');

    await page.getByLabel('Preset').selectOption('secondary');
    await expect(button).toHaveText('Cancel');
    await page.getByRole('combobox', { name: 'size (attribute)' }).selectOption('lg');
    await expect(button).toHaveAttribute('size', 'lg');
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(preview(page).locator('odd-button')).toHaveText('Cancel', { timeout: 30_000 });
    await expect(preview(page).locator('odd-button')).not.toHaveAttribute('size', 'lg');
    await expect(page.locator('.wb-snippet')).toContainText(
      "import '@oddkin/components/define/button';",
    );

    await page.getByRole('combobox', { name: 'appearance (attribute)' }).selectOption('ghost');
    await page.getByRole('button', { name: 'Copy example link' }).click();
    const link = await page.locator('input[type="url"]').inputValue();
    expect(link).toMatch(/^http:\/\/127\.0\.0\.1:4176\/components\/odd-button\?preview=/);
    await open(page, link, 'Button');
    await expect(preview(page).locator('odd-button')).toHaveAttribute('appearance', 'ghost', {
      timeout: 30_000,
    });
    expect(errors).toEqual([]);
  });

  test("logs an Oddkin component's declared events", async ({ page }) => {
    await open(page, `${report.dev}components/odd-input`, 'Input');
    await preview(page).locator('odd-input input').fill('hello', { timeout: 30_000 });
    await expect(page.locator('.wb-log li').first()).toContainText('input');
  });

  test('documents a standard-CEM library: its preview, every control, the events log, and Reset', async ({
    page,
  }) => {
    const errors = pageErrors(page);
    await open(page, `${report.dev}components/plain-chip`, 'Plain chip');
    const chip = preview(page).locator('plain-chip');
    // The registration is the module with the tag's custom-element-definition export.
    await expect
      .poll(() => chip.evaluate((el) => customElements.get(el.localName) !== undefined), {
        timeout: 30_000,
      })
      .toBe(true);
    await expect(page.locator('.wb-snippet')).toContainText("import '@plain/widgets/chip.js';");

    await page.getByRole('textbox', { name: 'label (attribute)' }).fill('Hello');
    await expect(chip).toHaveAttribute('label', 'Hello');
    await expect(chip.locator('[part="label"]')).toHaveText('Hello');
    await page.getByRole('combobox', { name: 'tone (attribute)' }).selectOption('warning');
    await expect(chip).toHaveAttribute('tone', 'warning');
    await page.getByLabel('count (property)').fill('7');
    await expect
      .poll(() => chip.evaluate((el) => (el as HTMLElement & { count: number }).count))
      .toBe(7);
    await page.getByLabel('default slot text').fill('extra');
    // The light DOM only: Playwright's text assertions also read the chip's shadow root.
    await expect.poll(() => chip.evaluate((el) => el.textContent?.trim())).toBe('extra');
    await page
      .locator('tr[data-css="--plain-chip-background"]')
      .getByRole('textbox')
      .fill('rgb(1, 2, 3)');
    await expect
      .poll(() => chip.evaluate((el) => getComputedStyle(el).backgroundColor))
      .toBe('rgb(1, 2, 3)');
    await page.getByLabel('removable (attribute)').check();
    await chip.locator('[part="remove"]').click();
    await expect(page.locator('.wb-log li').first()).toContainText('plain-remove');
    await expect(page.locator('.wb-log li').first()).toContainText('"label":"Hello"');
    const snippet = page.locator('.wb-snippet');
    await expect(snippet).toContainText('<plain-chip label="Hello" tone="warning" removable>');
    await expect(snippet).toContainText('element.count = 7;');

    await page.getByRole('button', { name: 'Reset' }).click();
    await expect
      .poll(
        () =>
          preview(page)
            .locator('plain-chip')
            .evaluate((el) => el.getAttributeNames()),
        { timeout: 30_000 },
      )
      .toEqual([]);
    expect(errors).toEqual([]);
  });
});

test.describe('the static build under a subpath', () => {
  test.describe.configure({ timeout: 90_000 });

  test('serves deep links and previews both libraries', async ({ page }) => {
    const errors = pageErrors(page);
    await open(page, `${packed}components/odd-button`, 'Button');
    await expect(preview(page).locator('odd-button')).toHaveText('Save', { timeout: 30_000 });
    await page.getByRole('combobox', { name: 'appearance (attribute)' }).selectOption('primary');
    await expect(preview(page).locator('odd-button')).toHaveAttribute('appearance', 'primary');

    await open(page, `${packed}components/plain-chip`, 'Plain chip');
    const chip = preview(page).locator('plain-chip');
    await expect
      .poll(() => chip.evaluate((el) => customElements.get(el.localName) !== undefined), {
        timeout: 30_000,
      })
      .toBe(true);
    await page.getByRole('textbox', { name: 'label (attribute)' }).fill('Static');
    await expect(chip.locator('[part="label"]')).toHaveText('Static');
    expect(new URL(page.url()).pathname).toBe('/workbench/components/plain-chip');
    expect(errors).toEqual([]);
  });
});
