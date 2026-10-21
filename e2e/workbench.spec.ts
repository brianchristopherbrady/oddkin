import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { startDevServer } from '../packages/workbench/dist/node/index.js';
import { acmeProject, removeProject } from '../packages/workbench/test/node-project.js';

// The Workbench shell over the real @oddkin/components, served by `oddkin workbench dev`
// (port 4175, started by the Playwright configuration from tests/fixtures/workbench-oddkin).
const base = 'http://localhost:4175/';
const at = (path: string) => new URL(path, base).href;
const axeSource = readFileSync(
  createRequire(import.meta.url).resolve('axe-core/axe.min.js'),
  'utf8',
);

async function open(page: Page, path: string, heading: string) {
  await page.goto(at(path));
  await expect(page.locator('main h1')).toHaveText(heading);
}

/** axe-core WCAG 2.0, 2.1, and 2.2 A and AA rules over the whole document. */
async function axeViolations(page: Page): Promise<string[]> {
  await page.evaluate(axeSource);
  return page.evaluate(async () => {
    const axe = (
      window as unknown as {
        axe: {
          run(
            context: Document,
            options: object,
          ): Promise<{ violations: { id: string; nodes: { target: unknown }[] }[] }>;
        };
      }
    ).axe;
    const result = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    });
    return result.violations.map((v) => `${v.id}: ${JSON.stringify(v.nodes.map((n) => n.target))}`);
  });
}

test.describe('Workbench shell', () => {
  test('navigates from the registry with titles, focus, and announcements', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await open(page, '', 'Foundations');
    // Without a home page the base URL is the first primary destination.
    expect(new URL(page.url()).pathname).toBe('/foundations');
    await expect(page).toHaveTitle('Foundations · Oddkin components');
    const primary = page.getByRole('navigation', { name: 'Primary' }).getByRole('link');
    await expect(primary).toHaveText(['Foundations', 'Components', 'Theme Studio']);
    await expect(primary.first()).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.wb-eyebrow')).toHaveText('Design system');
    // Cards: only the foundations the library supplies, with declared dates; no Theme Studio.
    const cards = page.locator('odd-card.wb-card');
    await expect(cards.locator('h2')).toHaveText(['Color', 'Spacing', 'Borders and radii']);
    await expect(cards.first().locator('time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}$/);
    await expect(
      page.getByRole('navigation', { name: 'Foundations' }).getByRole('link'),
    ).toHaveText(['Color', 'Spacing', 'Borders and radii']);

    await cards.getByRole('link', { name: 'Spacing' }).click();
    await expect(page.locator('main h1')).toHaveText('Spacing');
    expect(new URL(page.url()).pathname).toBe('/foundations/spacing');
    await expect(page).toHaveTitle('Spacing · Oddkin components');
    await expect(page.locator('main h1')).toBeFocused();
    await expect(page.locator('body > [aria-live="polite"]')).toHaveText(
      'Spacing · Oddkin components',
    );
    await expect(primary.first()).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('.wb-sidebar a[aria-current="page"]')).toHaveText('Spacing');
    await expect(page.locator('.wb-eyebrow')).toHaveText('Foundations');

    await page.getByRole('link', { name: 'All foundations' }).click();
    await expect(page.locator('main h1')).toHaveText('Foundations');
    await page.goBack();
    await expect(page.locator('main h1')).toHaveText('Spacing');
    await page.goForward();
    await expect(page.locator('main h1')).toHaveText('Foundations');
    expect(errors).toEqual([]);
  });

  test('serves deep links and legacy routes, and says when a page does not exist', async ({
    page,
  }) => {
    // Six full page loads.
    test.setTimeout(90_000);
    await open(page, 'components/odd-button', 'Button');
    await page.reload();
    await expect(page.locator('main h1')).toHaveText('Button');
    await expect(page.locator('.wb-eyebrow')).toHaveText(/^Components · /);
    await open(page, 'playground?component=odd-input&preset=x', 'Input');
    expect(page.url()).toBe(at('components/odd-input?preset=x'));
    await open(page, 'foundations/theme-studio', 'Theme Studio');
    expect(new URL(page.url()).pathname).toBe('/theme-studio');
    await open(page, 'foundations/products', 'Products and modes');
    await open(page, 'no/such/page', 'Page not found');
    await expect(page).toHaveTitle('Page not found · Oddkin components');
  });

  test('lists the page’s sections and jumps to them', async ({ page }) => {
    await open(page, 'components/odd-button', 'Button');
    const toc = page.getByRole('navigation', { name: 'On this page' });
    await expect(toc.getByRole('link')).toHaveText([
      'Overview',
      'Interactive example',
      'API',
      'Examples',
      'Tokens',
      'Behavior and accessibility',
      'Source',
      'Known limitations',
    ]);
    await page.setViewportSize({ width: 1280, height: 500 });
    await toc.getByRole('link', { name: 'Known limitations' }).click();
    await expect(page).toHaveURL(at('components/odd-button#known-limitations'));
    await expect(page.locator('section#known-limitations h2')).toBeInViewport();
    await expect(page.locator('main h1')).toHaveText('Button');
  });

  test('searches pages from the registry', async ({ page, browserName }) => {
    await open(page, 'foundations', 'Foundations');
    await page.locator('main h1').click();
    await page.keyboard.press('/');
    const input = page.getByRole('searchbox', { name: 'Search' });
    await expect(input).toBeFocused();
    await input.fill('side');
    const results = page.locator('#wb-search-results a');
    await expect(results).toHaveCount(1);
    await expect(results.first()).toContainText('Side nav');
    await expect(page.locator('#wb-search-status')).toHaveText('1 result');
    // WebKit's default keeps links out of the Tab order; the result is focused directly there.
    if (browserName === 'webkit') await results.first().focus();
    else await page.keyboard.press('Tab');
    await expect(results.first()).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('main h1')).toHaveText('Side nav');
    await expect(input).toHaveValue('');
    await input.fill('zzz');
    await expect(page.locator('#wb-search-status')).toHaveText('No results');
    await input.press('Escape');
    await expect(input).toHaveValue('');
  });

  test('keeps the shell appearance across visits, separate from content', async ({ page }) => {
    await open(page, 'foundations', 'Foundations');
    const background = () =>
      page.evaluate(
        () => getComputedStyle(document.querySelector('oddkin-workbench')!).backgroundColor,
      );
    const light = await background();
    await page.getByLabel('Appearance').selectOption('dark');
    await expect(page.locator('html')).toHaveAttribute('data-odd-mode', 'dark');
    expect(await background()).not.toBe(light);
    await page.reload();
    await expect(page.locator('main h1')).toHaveText('Foundations');
    await expect(page.locator('html')).toHaveAttribute('data-odd-mode', 'dark');
    await expect(page.getByLabel('Appearance')).toHaveValue('dark');
    await page.getByLabel('Appearance').selectOption('system');
  });

  test('collapses the sidebar behind a button at narrow widths', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 800 });
    await open(page, 'foundations/spacing', 'Spacing');
    const toggle = page.getByRole('button', { name: 'Show foundations' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const links = page.getByRole('navigation', { name: 'Foundations' }).getByRole('link');
    await expect(links.first()).toBeHidden();
    await toggle.click();
    await expect(page.getByRole('button', { name: 'Hide foundations' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await links.filter({ hasText: 'Color' }).click();
    await expect(page.locator('main h1')).toHaveText('Color');
    await expect(page.getByRole('button', { name: 'Show foundations' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    // On this page becomes part of the flow, after the header.
    const toc = await page.locator('.wb-toc').boundingBox();
    const heading = await page.locator('main h1').boundingBox();
    expect(toc!.y).toBeGreaterThan(heading!.y);
  });

  test('starts with a skip link to the main content', async ({ page, browserName }) => {
    await open(page, 'components', 'Components');
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    if (browserName === 'webkit') {
      // WebKit's default keeps links out of the Tab order (Safari's "Press Tab to highlight
      // each item" setting), so the link is focused directly there.
      await skip.focus();
    } else {
      await page.keyboard.press('Tab');
    }
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect(page.locator('main')).toBeFocused();
  });

  test('keeps loading after many visits while the page holds a live-update stream', async ({
    page,
  }) => {
    // Pages entering the back/forward cache close their event stream (the page lifecycle
    // service suspends it); Firefox otherwise keeps each connection and stops loading pages
    // once six are held. Nine full page loads.
    test.setTimeout(120_000);
    for (const [path, heading] of [
      ['components/odd-button', 'Button'],
      ['foundations', 'Foundations'],
      ['components', 'Components'],
      ['theme-studio', 'Theme Studio'],
      ['foundations/spacing', 'Spacing'],
      ['components/odd-card', 'Card'],
      ['foundations/color', 'Color'],
      ['components/odd-input', 'Input'],
      ['components/odd-side-nav', 'Side nav'],
    ] as const)
      await open(page, path, heading);
  });

  for (const [path, heading, width] of [
    ['foundations', 'Foundations', 1280],
    ['components', 'Components', 1280],
    ['components/odd-side-nav', 'Side nav', 1280],
    ['foundations/spacing', 'Spacing', 400],
  ] as const) {
    test(`has no axe violations on /${path} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page, path, heading);
      expect(await axeViolations(page)).toEqual([]);
    });
  }

  test('records startup timing', async ({ page }, testInfo) => {
    await open(page, 'components', 'Components');
    const marks = await page.evaluate(() =>
      Object.fromEntries(
        performance.getEntriesByType('mark').map((m) => [m.name, Math.round(m.startTime)]),
      ),
    );
    expect(marks['oddkin-workbench:ready']).toBeGreaterThanOrEqual(
      marks['oddkin-workbench:index']!,
    );
    testInfo.annotations.push({ type: 'startup', description: JSON.stringify(marks) });
    console.log(
      `${testInfo.project.name} startup (ms after navigation start): ${JSON.stringify(marks)}`,
    );
  });
});

test.describe('Workbench live updates', () => {
  test('applies content changes in place and reports invalid edits', async ({ page }) => {
    // A second dev server, three rebuilds.
    test.setTimeout(90_000);
    const dir = acmeProject();
    const server = await startDevServer({ config: dir, port: 0 });
    try {
      await page.goto(new URL('components', server.url).href);
      await expect(page.locator('main h1')).toHaveText('Components');
      await page.evaluate(() => ((window as unknown as { marker: number }).marker = 1));

      writeFileSync(
        join(dir, 'oddkin.docs.ts'),
        "export default { pages: { components: { summary: 'Edited without a reload.' } } };\n",
      );
      await expect(page.locator('.wb-summary')).toHaveText('Edited without a reload.');
      expect(await page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(1);

      const config = join(dir, 'oddkin.config.ts');
      const original = readFileSync(config, 'utf8');
      writeFileSync(config, 'export default { library: { packages: [] } };\n');
      await expect(
        page.getByRole('status').filter({ hasText: 'could not be applied' }),
      ).toBeVisible();
      await expect(page.locator('main h1')).toHaveText('Components');
      writeFileSync(config, original);
      await expect(page.locator('.wb-banner')).toHaveCount(0);
      expect(await page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(1);
    } finally {
      await server.close();
      removeProject(dir);
    }
  });
});
