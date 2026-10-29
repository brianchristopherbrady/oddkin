import { expect, request, test, type Page } from '@playwright/test';

// The golden path (priority plan P0.5; scripts/golden-path.mjs, sources in tests/golden-path/).
// From packed tarballs, a library team builds its theme with `oddkin-tokens`, compiles two
// elements on @oddkin/core, writes their metadata with `oddkin-analyze`, packs the library, and
// builds its Workbench site with `oddkin workbench build`. Another team's Vite app installs the
// library's tarball and uses it with the router, state, and an AI element. Served by
// scripts/packed-consumers.mjs on port 4174: the app at /golden-path/, the site under site/.
const base = 'http://127.0.0.1:4174/golden-path/';

interface Report {
  readonly installed: readonly string[];
  readonly library: {
    readonly files: readonly string[];
    readonly elements: readonly string[];
    readonly brand: string;
  };
  readonly steps: readonly { readonly name: string; readonly ms: number }[];
}

let report: Report;

test.beforeAll(async () => {
  // Two installs and six build steps: minutes on a cold npm cache.
  test.setTimeout(900_000);
  const api = await request.newContext();
  try {
    const response = await api.get(`${base}__ready`, { timeout: 890_000 });
    expect(response.ok(), await response.text()).toBe(true);
    report = (await response.json()) as Report;
  } finally {
    await api.dispose();
  }
});

/** A `#rrggbb` color as computed styles report it. */
function rgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

function pageErrors(page: Page, { console = true } = {}): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  if (console)
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
  return errors;
}

test('packs the library with its theme, metadata, and types, and without its sources', () => {
  expect(report.steps.map((step) => step.name)).toEqual([
    'theme',
    'compile',
    'analyze',
    'site',
    'check',
    'bundle',
  ]);
  expect(report.library.elements).toEqual(['acme-greeting', 'acme-tally']);
  expect(report.library.files).toEqual(
    expect.arrayContaining([
      'custom-elements.json',
      'oddkin.metadata.json',
      'theme.json',
      'dist/theme/acme.css',
      'dist/tally/tally.define.js',
      'dist/tally/tally.define.d.ts',
    ]),
  );
  expect(report.library.files.filter((file) => /^src\/|\.examples\./.test(file))).toEqual([]);
  expect(report.library.brand).toMatch(/^#[0-9a-f]{6}$/);
  expect(report.installed).toEqual([
    '@acme/widgets',
    '@oddkin/ai',
    '@oddkin/app',
    '@oddkin/components',
    '@oddkin/core',
    '@oddkin/state',
    '@oddkin/tokens',
  ]);
});

test('the app uses the library on its theme, with the router, state, and an AI element', async ({
  page,
}) => {
  const errors = pageErrors(page);
  await page.goto(base);
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await expect(page).toHaveTitle('Home · Acme');
  // The library's theme reaches the library's element through the tokens it reads.
  const tally = page.locator('acme-tally button');
  const brand = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--odd-ref-brand-600').trim(),
  );
  expect(brand).toBe(report.library.brand);
  expect(await tally.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(rgb(brand));

  // The AI element: a suggested name renames the greeting through the store.
  const greeting = page.locator('acme-greeting p');
  await expect(greeting).toHaveText('Hello, Ada!');
  await page.getByRole('button', { name: 'Grace' }).click();
  await expect(greeting).toHaveText('Hello, Grace!');

  // The tally counts presses, and the view is not rendered again: focus stays on it.
  await tally.click();
  await tally.focus();
  await page.keyboard.press('Enter');
  await expect(tally).toHaveText('Presses: 2');
  await expect(tally).toBeFocused();

  // The router: About reads the store, and Home renders from it again.
  await page
    .getByRole('navigation', { name: 'Pages' })
    .getByRole('link', { name: 'About' })
    .click();
  await expect(page).toHaveTitle('About · Acme');
  await expect(page.locator('main h1')).toBeFocused();
  await expect(page.locator('#summary')).toHaveText('Grace pressed the tally 2 times.');
  await page.getByRole('link', { name: 'Back home' }).click();
  await expect(page).toHaveTitle('Home · Acme');
  await expect(greeting).toHaveText('Hello, Grace!');
  await expect(tally).toHaveText('Presses: 2');
  expect(errors).toEqual([]);
});

test.describe('the library site', () => {
  // Each preview frame loads the library's module graph unbundled (slow in Firefox under load).
  test.describe.configure({ timeout: 90_000 });

  test('lists both elements in the catalog', async ({ page }) => {
    const errors = pageErrors(page, { console: false });
    await page.goto(`${base}site/components`);
    await expect(page.locator('main h1')).toHaveText('Components', { timeout: 30_000 });
    await expect(page.locator('main')).toContainText('Showing 2 of 2 components');
    for (const name of ['Acme greeting', 'Acme tally'])
      await expect(page.locator('main').getByRole('heading', { name, exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('previews the real element on the library theme, with its authored presets', async ({
    page,
  }) => {
    const errors = pageErrors(page, { console: false });
    await page.goto(`${base}site/components/acme-tally`);
    await expect(page.locator('main h1')).toHaveText('Acme tally', { timeout: 30_000 });
    const button = page
      .frameLocator('oddkin-workbench-component iframe')
      .first()
      .locator('acme-tally button');
    await expect(button).toHaveText('Count: 0', { timeout: 45_000 });
    await expect
      .poll(() => button.evaluate((el) => getComputedStyle(el).backgroundColor), {
        timeout: 20_000,
      })
      .toBe(rgb(report.library.brand));

    await page.getByLabel('Preset').selectOption('byFive');
    await expect(button).toHaveText('Points: 0');
    await button.click();
    await expect(button).toHaveText('Points: 5');
    expect(errors).toEqual([]);
  });

  test('opens Theme Studio on the library theme and previews edits on the element', async ({
    page,
  }) => {
    const errors = pageErrors(page, { console: false });
    await page.goto(`${base}site/theme-studio`);
    await expect(page.locator('main h1')).toHaveText('Theme Studio', { timeout: 30_000 });
    const primary = page.locator('input[data-path="/brand/primary"]');
    await expect(primary).toHaveValue('#6d28d9');
    // The example marked as the primary action previews the theme.
    const tally = page
      .frameLocator('oddkin-workbench-theme-studio iframe')
      .first()
      .locator('figure[data-role="primaryAction"] > acme-tally');
    await expect(tally).toBeAttached({ timeout: 45_000 });
    await expect(page.locator('#live-preview .wb-status')).toContainText('Generated in', {
      timeout: 30_000,
    });
    const background = () =>
      tally.evaluate(
        (el) => getComputedStyle(el.shadowRoot!.querySelector('button')!).backgroundColor,
      );
    await expect.poll(background).toBe(rgb(report.library.brand));

    await primary.fill('#0a7d33');
    await primary.dispatchEvent('change');
    await expect
      .poll(async () => {
        const [r = 0, g = 0, b = 0] = ((await background()).match(/\d+/g) ?? []).map(Number);
        return g > r && g > b;
      })
      .toBe(true);
    expect(errors).toEqual([]);
  });
});
