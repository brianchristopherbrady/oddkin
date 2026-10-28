import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

// `oddkin workbench build` of tests/fixtures/workbench-oddkin under a subpath, served by the
// plain static server on port 4173: no rewrites, no Workbench or analyzer backend. Each page path
// is its own copy of the shell, as on a host that serves one document per known route.
const fixture = 'tests/fixtures/workbench-oddkin';

test.describe('static Workbench build under a subpath', () => {
  // One build per browser, in order: the tests share it.
  test.describe.configure({ mode: 'default', timeout: 90_000 });
  let base = '';

  test.beforeAll(({}, testInfo) => {
    testInfo.setTimeout(180_000);
    const dir = `.oddkin/static-${testInfo.project.name}`;
    base = `/${fixture}/${dir}/`;
    execFileSync(
      process.execPath,
      [
        'packages/workbench/dist/node/bin.js',
        'workbench',
        'build',
        '--config',
        fixture,
        '--out',
        join(fixture, dir),
        '--base',
        base,
      ],
      { stdio: 'pipe' },
    );
  });

  async function open(page: Page, path: string, heading: string) {
    await page.goto(`${base}${path}`);
    await expect(page.locator('main h1')).toHaveText(heading, { timeout: 30_000 });
  }

  test('loads deep links, refreshes, and navigates inside the base path', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await open(page, 'components/odd-button', 'Button');
    const frame = page.frameLocator('oddkin-workbench-component iframe').first();
    await expect(frame.locator('odd-button')).toHaveText('Save', { timeout: 30_000 });
    await page.reload();
    await expect(page.locator('main h1')).toHaveText('Button', { timeout: 30_000 });

    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link').first().click();
    await expect(page.locator('main h1')).toHaveText('Foundations');
    expect(new URL(page.url()).pathname).toBe(`${base}foundations`);
    await page.locator('odd-card.wb-card').getByRole('link', { name: 'Spacing' }).click();
    await expect(page.locator('main h1')).toHaveText('Spacing');
    expect(new URL(page.url()).pathname).toBe(`${base}foundations/spacing`);
    await page.goBack();
    await expect(page.locator('main h1')).toHaveText('Foundations');
    await page.goBack();
    await expect(page.locator('main h1')).toHaveText('Button');
    // The base URL itself goes to the first primary destination.
    await open(page, '', 'Foundations');
    expect(new URL(page.url()).pathname).toBe(`${base}foundations`);
    expect(errors).toEqual([]);
  });

  test('redirects legacy routes in the app, keeping their query', async ({ page }) => {
    await open(page, 'playground?component=odd-input&preset=x', 'Input');
    expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(
      `${base}components/odd-input?preset=x`,
    );
    await open(page, 'foundations/theme-studio', 'Theme Studio');
    expect(new URL(page.url()).pathname).toBe(`${base}theme-studio`);
    // 404.html, for hosts that serve it for unknown paths, is the shell: the app says so.
    await open(page, '404.html', 'Page not found');
  });

  test('restores a copied example link', async ({ page }) => {
    await open(page, 'components/odd-button', 'Button');
    const frame = page.frameLocator('oddkin-workbench-component iframe').first();
    await expect(frame.locator('odd-button')).toHaveText('Save', { timeout: 30_000 });
    await page
      .locator('tr[data-row="property:odd-button#appearance"]')
      .getByRole('radio', { name: 'primary' })
      .check();
    await expect(frame.locator('odd-button')).toHaveAttribute('appearance', 'primary');
    await page.getByRole('button', { name: 'Copy example link' }).click();
    const link = await page.locator('input[type="url"]').inputValue();
    expect(link).toMatch(
      new RegExp(`^http://localhost:4173${base}components/odd-button\\?preview=`),
    );

    await page.goto(link);
    await expect(page.locator('main h1')).toHaveText('Button', { timeout: 30_000 });
    await expect(
      page.frameLocator('oddkin-workbench-component iframe').first().locator('odd-button'),
    ).toHaveAttribute('appearance', 'primary', { timeout: 30_000 });
  });

  test('generates and applies Theme Studio edits in the browser', async ({ page }) => {
    await open(page, 'theme-studio', 'Theme Studio');
    const primary = page
      .frameLocator('oddkin-workbench-theme-studio iframe')
      .first()
      .locator('figure[data-role="primaryAction"] > :last-child');
    await expect(primary).toBeAttached({ timeout: 45_000 });
    await expect(page.locator('#live-preview .wb-status')).toContainText('Generated in', {
      timeout: 30_000,
    });
    const cell = page.locator('input[data-path="/overrides/color.action.default/light"]');
    await cell.fill('#0a7d33');
    await cell.dispatchEvent('change');
    await expect
      .poll(() =>
        primary.evaluate(
          (el) => getComputedStyle(el.shadowRoot?.querySelector('button') ?? el).backgroundColor,
        ),
      )
      .toBe('rgb(10, 125, 51)');
  });
});
