import { createReadStream } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname } from 'node:path';
import { expect, test } from '@playwright/test';
import { buildWorkbench, embedFiles } from '../packages/workbench/dist/node/index.js';

// The embedding contract (packages/workbench/README.md, "Embedding the panels"): a site that
// serves its own page and Workbench's `_oddkin/` files shows the catalog and a component panel
// with a live, editable preview, with no Workbench shell or dev server. The site here is a small
// HTTP server over the files `embedFiles` lists, for the real @oddkin/components
// (tests/fixtures/workbench-oddkin).
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

const host = `import '@oddkin/workbench/panels/catalog/define';
import '@oddkin/workbench/panels/component/define';

const json = async (path) => (await fetch(path)).json();
const index = await json('/_oddkin/index.json');
const href = (route) => '#' + route;
Object.assign(document.querySelector('oddkin-catalog-panel'), { index, href });
Object.assign(document.querySelector('oddkin-component-panel'), {
  index,
  href,
  layout: 'reference',
  frameUrl: '/_oddkin/frame.html',
  page: await json('/_oddkin/' + index.pages['components/odd-button']),
});
`;

let server: Server;
let origin = '';

test.beforeAll(async () => {
  const build = await buildWorkbench({
    config: 'tests/fixtures/workbench-oddkin',
    hosting: { basePath: '/' },
  });
  const { files, diagnostics } = await embedFiles(build);
  expect(diagnostics).toEqual([]);
  const tokens = [...files.keys()].find((path) =>
    /^_oddkin\/m\/@oddkin\/tokens@[^/]+\/dist\/css\/default\.css$/.test(path),
  );
  const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Embedded Workbench panels</title>
    <link rel="stylesheet" href="/${tokens}" />
    <script type="importmap">${build.files.get('shell.importmap.json')}</script>
    <script type="module" src="/host.js"></script>
  </head>
  <body>
    <main>
      <oddkin-catalog-panel></oddkin-catalog-panel>
      <oddkin-component-panel></oddkin-component-panel>
    </main>
  </body>
</html>`;
  server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? '/', 'http://site').pathname).slice(1);
    const body = path === '' ? page : path === 'host.js' ? host : files.get(path);
    if (body === undefined) {
      response.writeHead(404).end();
      return;
    }
    const type = TYPES[extname(path || 'index.html')] ?? 'application/octet-stream';
    response.writeHead(200, { 'content-type': type });
    if (typeof body === 'string') response.end(body);
    else createReadStream(body.source).pipe(response);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

test('a page of its own embeds the catalog and a live, editable component panel', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${origin}/`);
  await expect(
    page.locator('oddkin-catalog-panel').getByRole('link', { name: 'View reference: Button' }),
  ).toBeVisible({ timeout: 20_000 });
  const panel = page.locator('oddkin-component-panel');
  const button = page.frameLocator('oddkin-component-panel iframe').first().locator('odd-button');
  await expect(button).toHaveText('Save', { timeout: 20_000 });
  await panel
    .locator('tr[data-row="property:odd-button#appearance"]')
    .getByRole('combobox', { name: 'appearance (attribute)' })
    .selectOption('primary');
  await expect(button).toHaveAttribute('appearance', 'primary');
  await panel.locator('tr[data-slot=""] input').fill('Embedded');
  await expect(button).toHaveText('Embedded');
  // The reference layout (Figma 20:2190): links to the page's sections, and the controls in one
  // named region that scrolls on its own and takes keyboard focus.
  const links = panel.getByRole('navigation', { name: 'Page sections' }).getByRole('link');
  await expect(links).toHaveText(['Overview', 'Controls', 'Examples', 'Accessibility']);
  const region = panel.getByRole('region', { name: 'Controls and API' });
  await expect(region).toHaveCSS('max-height', '552px');
  await region.focus();
  await expect(region).toBeFocused();
  await links.nth(2).click();
  await expect(panel.locator('#examples-title')).toBeFocused();
  await expect(links.nth(2)).toHaveAttribute('aria-current', 'true');
  expect(errors).toEqual([]);
});
