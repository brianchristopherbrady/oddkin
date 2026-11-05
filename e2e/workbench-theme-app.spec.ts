import { createServer, type Server } from 'node:http';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { startDevServer, type DevServer } from '../packages/workbench/dist/node/index.js';

// A team's own app with Theme Studio's draft (P1.5 item 6): an app on a dev server of its own
// (another origin) loads @oddkin/workbench/theme-link with its theme stylesheet; Theme Studio,
// configured with `themeStudio.app`, opens it and sends each draft's CSS, which replaces that
// stylesheet in the app.
const dir = join(process.cwd(), '.tmp', `e2e-theme-app-${process.pid}`);
let studio: DevServer;
let app: Server;
let appUrl = '';

const page = (studioOrigin: string) => `<!doctype html>
<html lang="en">
  <head>
    <title>Acme app</title>
    <link rel="stylesheet" id="theme" href="/theme.css" />
    <style>
      p {
        color: var(--odd-color-action-default);
      }
    </style>
    <script type="importmap">
      { "imports": { "@oddkin/core/diagnostics": "/core-diagnostics.js" } }
    </script>
    <script type="module">
      import { linkThemeStudio } from '/theme-link.js';
      linkThemeStudio({ studio: ${JSON.stringify(studioOrigin)}, stylesheet: '#theme' });
    </script>
  </head>
  <body>
    <p>Acme</p>
  </body>
</html>`;

test.beforeAll(async () => {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  // The link as built, and its one dependency, which the page's import map resolves.
  const files: Record<string, string> = {
    '/theme-link.js': readFileSync('packages/workbench/dist/theme-link/index.js', 'utf8'),
    '/core-diagnostics.js': readFileSync('packages/core/dist/diagnostics/index.js', 'utf8'),
  };
  let studioOrigin = '';
  app = createServer((req, res) => {
    const script = files[req.url ?? ''];
    const [type, body] = script
      ? ['text/javascript', script]
      : req.url === '/theme.css'
        ? ['text/css', ':root { --odd-color-action-default: rgb(1, 2, 3); }']
        : ['text/html', page(studioOrigin)];
    res.writeHead(200, { 'content-type': `${type}; charset=utf-8` }).end(body);
  });
  await new Promise<void>((resolve) => app.listen(0, '127.0.0.1', resolve));
  appUrl = `http://127.0.0.1:${(app.address() as AddressInfo).port}/`;
  writeFileSync(
    join(dir, 'oddkin.config.json'),
    JSON.stringify({
      library: { packages: ['@oddkin/components'] },
      branding: { name: 'Theme app' },
      themeStudio: { themeConfig: './theme.json', app: appUrl },
    }),
  );
  writeFileSync(join(dir, 'theme.json'), readFileSync('packages/tokens/themes/default.theme.json'));
  studio = await startDevServer({ config: dir, port: 0, host: '127.0.0.1' });
  studioOrigin = new URL(studio.url).origin;
});

test.afterAll(async () => {
  await studio?.close();
  await new Promise((resolve) => app?.close(resolve));
  rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

/** The app's action colour, as its text resolves it. */
const action = (target: Page) => target.locator('p').evaluate((p) => getComputedStyle(p).color);

test("opens the team's app with the draft, which follows each edit there", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(new URL('theme-studio', studio.url).href);
  await expect(page.locator('#live-preview .wb-status').first()).toContainText('Generated in', {
    timeout: 45_000,
  });
  const open = page.getByRole('button', { name: `Open ${appUrl} with the draft` });
  const [popup] = await Promise.all([page.waitForEvent('popup'), open.click()]);
  await popup.waitForLoadState();
  // The app shows the draft in place of its own theme stylesheet, as Theme Studio says.
  await expect(page.locator('#ts-app-status')).toHaveText(
    `Showing the draft in ${new URL(appUrl).origin}.`,
  );
  await expect.poll(() => action(popup)).toBe('rgb(98, 80, 232)');
  expect(await popup.locator('#theme').evaluate((link) => (link as HTMLLinkElement).disabled)).toBe(
    true,
  );
  // An edit in Theme Studio reaches the app without a reload.
  await popup.evaluate(() => ((window as unknown as { kept: boolean }).kept = true));
  const cell = page.locator('input[data-path="/overrides/color.action.default/light"]');
  await cell.fill('#0a7d33');
  await cell.dispatchEvent('change');
  await expect.poll(() => action(popup)).toBe('rgb(10, 125, 51)');
  expect(await popup.evaluate(() => (window as unknown as { kept?: boolean }).kept)).toBe(true);
});
