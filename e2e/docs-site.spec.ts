import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const docs = 'http://127.0.0.1:4177';
// Metadata routes load the published JSON and a Workbench panel before they commit.
const catalogLoad = 15_000;

/**
 * Records the page's Content-Security-Policy violations. WebKit reports style-src-attr for every
 * <select> inserted under a strict style-src (verification.md, 2026-10-21), so those are left out.
 */
async function watchPolicy(page: Page, browserName: string): Promise<() => Promise<string[]>> {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __csp: string[] }).__csp = seen;
    document.addEventListener(
      'securitypolicyviolation',
      (event) => seen.push(event.violatedDirective),
      true,
    );
  });
  return async () =>
    (await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).filter(
      (directive) => !(browserName === 'webkit' && directive === 'style-src-attr'),
    );
}

test.describe('docs shell', () => {
  test('switches between light and dark and remembers the choice', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(`${docs}/installation`);
    const mode = page.getByRole('button', { name: 'Dark mode' });
    await expect(mode).toHaveAttribute('aria-pressed', 'false');
    const canvas = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const light = await canvas();
    await mode.click();
    await expect(page.locator('html')).toHaveAttribute('data-odd-mode', 'dark');
    await expect(mode).toHaveAttribute('aria-pressed', 'true');
    const dark = await canvas();
    expect(dark).not.toBe(light);
    // Applied before the first paint on the next page, from the stored choice.
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-odd-mode', 'dark');
    expect(await canvas()).toBe(dark);
    await page.getByRole('button', { name: 'Dark mode' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-odd-mode', 'light');
    expect(await canvas()).toBe(light);
  });

  test('puts the sidebar behind a menu button on narrow screens', async ({ page }) => {
    // 320 CSS px: the WCAG reflow width; nothing scrolls sideways.
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`${docs}/installation`);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    const menu = page.getByRole('button', { name: 'Menu' });
    // The menu shows the site map; the section's own links are for wide screens. (Links are
    // found from the odd-side-nav host: they are its children, slotted into its shadow nav.)
    const link = page.locator('#docs-nav').getByRole('link', { name: 'Getting started' });
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeHidden();
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await expect(link).toBeHidden();
    await menu.click();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await expect(link).toBeVisible();
    await link.focus();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await expect(menu).toBeFocused();
    await expect(link).toBeHidden();
  });

  test('opens search with Ctrl K and goes to the chosen component', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${docs}/installation`);
    // The shortcut belongs to the shell's script: wait for it to run (data-docs-js).
    await expect(page.locator('html[data-docs-js]')).toBeAttached({ timeout: catalogLoad });
    await page.keyboard.press('Control+k');
    const palette = page.getByRole('dialog', { name: 'Search docs' });
    await expect(palette.getByRole('combobox')).toBeFocused();
    await palette.getByRole('combobox').fill('copy-button');
    const option = palette.getByRole('option', { name: '<odd-copy-button>' });
    // A component's description is the first "use for" entry of its metadata (loaded on open).
    await expect(option).toContainText('Copying an identifier, a code snippet', {
      timeout: catalogLoad,
    });
    await option.click();
    await expect(page).toHaveURL(`${docs}/components/odd-copy-button`);
    await expect(page.locator('#main h1')).toHaveText('Copy button', {
      timeout: catalogLoad,
    });
    expect(errors).toEqual([]);
  });
});

/** Serves `dir` as GitHub Pages does: a folder's index.html after a slash redirect, else 404.html. */
function pagesHost(dir: string): Server {
  const types: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
  };
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    let path = normalize(join(dir, decodeURIComponent(url.pathname)));
    if (path !== dir && !path.startsWith(dir + sep)) return void response.writeHead(403).end();
    try {
      if ((await stat(path)).isDirectory()) {
        if (!url.pathname.endsWith('/'))
          return void response.writeHead(301, { location: `${url.pathname}/${url.search}` }).end();
        path = join(path, 'index.html');
      }
      const body = await readFile(path);
      response.writeHead(200, {
        'content-type': types[extname(path)] ?? 'application/octet-stream',
      });
      response.end(body);
    } catch {
      response.writeHead(404, { 'content-type': types['.html'] });
      response.end(await readFile(join(dir, '404.html')));
    }
  });
}

test.describe('static docs site', () => {
  test.describe.configure({ mode: 'default', timeout: 90_000 });
  let server: Server | undefined;
  let site = '';

  test.beforeAll(async ({}, testInfo) => {
    testInfo.setTimeout(180_000);
    const dir = resolve(`.oddkin/docs-site-e2e-${testInfo.project.name}`);
    execFileSync(process.execPath, ['apps/docs/build.mjs', '--out', dir], { stdio: 'pipe' });
    server = pagesHost(dir);
    await new Promise<void>((done) => server!.listen(0, '127.0.0.1', done));
    site = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  test.afterAll(() => new Promise<void>((done) => (server ? server.close(() => done()) : done())));

  test('serves each page as its own document under its own policy', async ({
    page,
    browserName,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const violations = await watchPolicy(page, browserName);
    await page.goto(`${site}/`);
    // The home page's examples are real elements, registered on first use by the autoloader.
    await expect(page.locator('.specimen odd-switch')).toHaveJSProperty('checked', true, {
      timeout: catalogLoad,
    });
    const response = await page.goto(`${site}/getting-started`);
    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe('/getting-started/');
    await expect(page.locator('#main h1')).toHaveText('Getting started');
    await expect(page.getByRole('navigation', { name: 'Documentation' })).toBeVisible();
    await page.getByRole('link', { name: 'Use tokens only' }).click();
    await expect(page.locator('#main h1')).toHaveText('Tokens only');
    await expect(
      page.locator('#docs-nav').getByRole('link', { name: 'Getting started' }),
    ).toHaveAttribute('aria-current', 'true');
    expect(await violations()).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('renders metadata routes in the client, and the 404 page for unknown paths', async ({
    page,
    browserName,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const violations = await watchPolicy(page, browserName);
    await page.goto(`${site}/components/odd-button`);
    await expect(page.locator('#main h1')).toHaveText('Button', { timeout: catalogLoad });
    // The live example runs in a same-origin frame under the static policy.
    await expect(
      page.frameLocator('oddkin-component-panel iframe').first().locator('odd-button'),
    ).toHaveText('Save', { timeout: catalogLoad });
    expect(await violations()).toEqual([]);
    const missing = await page.goto(`${site}/not-a-page`);
    expect(missing?.status()).toBe(404);
    // The client renders the not-found state once it has started (seconds under load).
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible({
      timeout: catalogLoad,
    });
    expect(errors).toEqual([]);
  });

  test('grows the example frame while a popup lacks room, and takes its height back', async ({
    page,
    browserName,
  }) => {
    const violations = await watchPolicy(page, browserName);
    await page.goto(`${site}/components/odd-color-picker`);
    const iframe = page.locator('oddkin-component-panel iframe').first();
    const picker = page
      .frameLocator('oddkin-component-panel iframe')
      .first()
      .locator('odd-color-picker');
    const button = picker.getByRole('button', { name: /^Change color/ });
    await expect(button).toBeVisible({ timeout: catalogLoad });
    const height = async () => Math.round((await iframe.boundingBox())!.height);
    const closed = await height();
    const popup = picker.getByRole('dialog', { name: 'Choose color' });
    await button.click();
    await expect(popup).toBeVisible();
    // The whole popup shows (nothing to scroll), and the frame is taller than its 14rem.
    await expect
      .poll(() => popup.evaluate((element) => element.scrollHeight - element.clientHeight))
      .toBe(0);
    expect(await height()).toBeGreaterThan(closed);
    await page.keyboard.press('Escape');
    await expect(popup).toBeHidden();
    await expect.poll(height).toBe(closed);
    expect(await violations()).toEqual([]);
  });

  test('draws each Foundations swatch with its token, in each mode, under the policy', async ({
    page,
    browserName,
  }) => {
    const { tokens } = JSON.parse(
      readFileSync('packages/tokens/dist/inspect/default.inspect.json', 'utf8'),
    ) as { tokens: { name: string; value: Record<string, string> }[] };
    const canvas = tokens.find((token) => token.name === 'color.canvas')!.value;
    const rgb = (hex: string) =>
      `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const violations = await watchPolicy(page, browserName);
    await page.goto(`${site}/foundations/color`);
    for (const mode of ['light', 'dark'])
      await expect(
        page.locator(
          `#roles .mode-scope[data-odd-mode="${mode}"] [data-token="--odd-color-canvas"]`,
        ),
      ).toHaveCSS('background-color', rgb(canvas[mode]!));
    expect(await violations()).toEqual([]);
    expect(errors).toEqual([]);
  });
});
