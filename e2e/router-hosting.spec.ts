// The router example (examples/router) on emulated static hosts, in real browsers: history mode
// needs the host to answer deep paths with the application's document; hash mode needs nothing.
// Each host is a small server started here, answering missing paths the way a class of hosts does:
//   plain      the server's own 404 (any static server or bucket without configuration)
//   rewrite    the application document with 200 (rewrite rules such as `/* /index.html 200`)
//   fallback   the application document as 404.html, with status 404 (GitHub Pages)
//   documents  one document per known route, `/x` redirected to `/x/` (a static build that
//              writes them, on GitHub Pages), and 404.html for anything else
// These reproduce documented host behaviour; no real host was deployed to.
import { readFile, stat } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page, type Route } from '@playwright/test';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const base = '/examples/router/';
const appDocument = join(root, 'examples/router/index.html');
const builtRoutes = ['', 'guides', 'guides/one', 'guides/two', 'long', 'lazy'];
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

type Kind = 'plain' | 'rewrite' | 'fallback' | 'documents';

async function existing(path: string): Promise<string | undefined> {
  try {
    const file = (await stat(path)).isDirectory() ? join(path, 'index.html') : path;
    await stat(file);
    return file;
  } catch {
    return undefined;
  }
}

function startHost(kind: Kind): Promise<Server> {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://host');
    const path = normalize(join(root, decodeURIComponent(url.pathname)));
    if (path !== root && !path.startsWith(root + sep)) return void response.writeHead(403).end();
    const send = async (status: number, file: string) =>
      response
        .writeHead(status, { 'content-type': types[extname(file)] ?? 'application/octet-stream' })
        .end(await readFile(file));
    if (kind === 'documents' && url.pathname.startsWith(base)) {
      const routePath = url.pathname.slice(base.length).replace(/\/$/, '');
      if (builtRoutes.includes(routePath)) {
        if (!url.pathname.endsWith('/'))
          return void response.writeHead(301, { location: `${url.pathname}/${url.search}` }).end();
        return send(200, appDocument);
      }
    }
    const file = await existing(path);
    if (file) return send(200, file);
    if (kind === 'rewrite' && url.pathname.startsWith(base)) return send(200, appDocument);
    if (kind === 'fallback' || kind === 'documents') return send(404, appDocument);
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
  });
  return new Promise((ready) => server.listen(0, '127.0.0.1', () => ready(server)));
}

const hosts = new Map<Kind, Server>();
const at = (kind: Kind, path = '') =>
  `http://127.0.0.1:${(hosts.get(kind)!.address() as AddressInfo).port}${base}${path}`;

test.beforeAll(async () => {
  for (const kind of ['plain', 'rewrite', 'fallback', 'documents'] as const)
    hosts.set(kind, await startHost(kind));
});
test.afterAll(async () => {
  for (const server of hosts.values()) await new Promise((done) => server.close(done));
  hosts.clear();
});

const ready = (page: Page) => expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
const loadId = (page: Page) =>
  page.evaluate(() => (window as unknown as { loadId: string }).loadId);
const link = (page: Page, name: string) => page.getByRole('link', { name, exact: true });
const sectionTop = (page: Page) =>
  page.evaluate(() =>
    Math.round(document.getElementById('section-2')!.getBoundingClientRect().top),
  );

let errors: string[];
test.beforeEach(({ page }) => {
  errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
});
test.afterEach(() => expect(errors).toEqual([]));

test('plain host: history mode cannot start from a deep path or come back to one; hash mode can', async ({
  page,
}) => {
  const direct = await page.goto(at('plain', 'guides/one'));
  expect(direct?.status()).toBe(404);
  await expect(page.locator('body')).toHaveText('Not found');

  // In-app entries work while their document lives; once it is gone, the server is asked.
  await page.goto(at('plain'));
  await ready(page);
  await link(page, 'Long page').click();
  await expect(page).toHaveTitle('Long page · Router example');
  await page.goto(at('plain', 'hash.html#/guides/one'));
  await ready(page);
  const back = await page.goBack();
  expect(back?.status()).toBe(404);
  await expect(page.locator('body')).toHaveText('Not found');

  // Hash mode keeps the application path out of the request.
  await page.goto(at('plain', 'hash.html#/guides/two'));
  await ready(page);
  await expect(page).toHaveTitle('Guide two · Router example');
  await link(page, 'Long page').click();
  await expect(page).toHaveURL(/hash\.html#\/long$/);
  await page.goto(at('plain'));
  await ready(page);
  const hashBack = await page.goBack();
  expect(hashBack?.status()).toBe(200);
  await ready(page);
  await expect(page).toHaveTitle('Long page · Router example');
});

test('rewrite host: deep paths, reloads, and back and forward across documents', async ({
  page,
}) => {
  const direct = await page.goto(at('rewrite', 'guides/one'));
  expect(direct?.status()).toBe(200);
  await ready(page);
  await expect(page).toHaveTitle('Guide one · Router example');
  await expect(page.getByText('The one guide.')).toBeVisible();
  // The first load moves no focus and announces nothing.
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
  await expect(page.locator('body > [aria-live="polite"]')).toHaveText('');

  await link(page, 'Long page').click();
  await expect(page).toHaveTitle('Long page · Router example');
  expect((await page.goto(at('rewrite', 'guides/two')))?.status()).toBe(200);
  await ready(page);
  await expect(page).toHaveTitle('Guide two · Router example');

  await page.goBack();
  await ready(page);
  await expect(page).toHaveTitle('Long page · Router example');
  await page.goBack();
  await ready(page);
  await expect(page).toHaveTitle('Guide one · Router example');
  await expect(page.getByText('The one guide.')).toBeVisible();
  await page.goForward();
  await ready(page);
  await expect(page).toHaveTitle('Long page · Router example');
  await page.goForward();
  await ready(page);
  await expect(page).toHaveTitle('Guide two · Router example');

  const reloaded = await page.reload();
  expect(reloaded?.status()).toBe(200);
  await ready(page);
  await expect(page.getByText('The two guide.')).toBeVisible();

  // Unknown paths get the application's not-found, which this host serves with 200.
  const unknown = await page.goto(at('rewrite', 'guides/three'));
  expect(unknown?.status()).toBe(200);
  await ready(page);
  await expect(page).toHaveTitle('Not found · Router example');
});

test('404.html fallback (GitHub Pages): deep paths work, but every one answers 404', async ({
  page,
}) => {
  const direct = await page.goto(at('fallback', 'guides/one'));
  expect(direct?.status()).toBe(404);
  await ready(page);
  await expect(page).toHaveTitle('Guide one · Router example');
  await expect(page.getByText('The one guide.')).toBeVisible();
  const reloaded = await page.reload();
  expect(reloaded?.status()).toBe(404);
  await ready(page);
  await expect(page).toHaveTitle('Guide one · Router example');
  const unknown = await page.goto(at('fallback', 'guides/three'));
  expect(unknown?.status()).toBe(404);
  await ready(page);
  await expect(page).toHaveTitle('Not found · Router example');
});

test('a document per route (static build on GitHub Pages): 200 after a redirect to the slash form', async ({
  page,
}) => {
  const direct = await page.goto(at('documents', 'guides/one'));
  expect(direct?.status()).toBe(200);
  expect(direct?.request().redirectedFrom()?.url()).toBe(at('documents', 'guides/one'));
  await expect(page).toHaveURL(at('documents', 'guides/one/'));
  await ready(page);
  await expect(page).toHaveTitle('Guide one · Router example');
  await expect(page.getByText('The one guide.')).toBeVisible();

  // In-app links write the path without the slash; a reload goes through the redirect again.
  await link(page, 'Guide two').click();
  await expect(page).toHaveURL(at('documents', 'guides/two'));
  await expect(page.getByText('The two guide.')).toBeVisible();
  const reloaded = await page.reload();
  expect(reloaded?.status()).toBe(200);
  await expect(page).toHaveURL(at('documents', 'guides/two/'));
  await ready(page);
  await expect(page).toHaveTitle('Guide two · Router example');

  const unknown = await page.goto(at('documents', 'guides/three'));
  expect(unknown?.status()).toBe(404);
  await ready(page);
  await expect(page).toHaveTitle('Not found · Router example');
});

test('a deep link to a fragment lands on its section, in both modes', async ({ page }) => {
  await page.goto(at('rewrite', 'long#section-2'));
  await ready(page);
  await expect(page).toHaveTitle('Long page · Router example');
  // 96px is the section's scroll-margin below the fixed navigation.
  await expect.poll(() => sectionTop(page)).toBe(96);
  await page.goto(at('plain', 'hash.html#/long#section-2'));
  await ready(page);
  await expect(page).toHaveTitle('Long page · Router example');
  await expect.poll(() => sectionTop(page)).toBe(96);
});

test('native escapes from a deep document', async ({ page }) => {
  await page.goto(at('rewrite', 'guides/one'));
  await ready(page);
  const id = await loadId(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    link(page, 'Download the example script').click(),
  ]);
  expect(download.suggestedFilename()).toBe('app.js');
  expect(await loadId(page)).toBe(id);
  await link(page, 'Hash-mode page').click(); // rel="external" inside the base path
  await expect(page).toHaveURL(at('rewrite', 'hash.html'));
  await ready(page);
  expect(await loadId(page)).not.toBe(id);
});

for (const [failure, fail] of [
  ['a network error', (route: Route) => route.abort('failed')],
  ['HTTP 404', (route: Route) => route.fulfill({ status: 404, body: 'Not found' })],
  ['HTTP 503', (route: Route) => route.fulfill({ status: 503, body: 'Unavailable' })],
] as const) {
  test(`a lazy route whose module request fails (${failure}) shows the error; retrying and reloading`, async ({
    page,
  }) => {
    await page.route('**/examples/router/lazy.js', fail);
    await page.goto(at('rewrite'));
    await ready(page);
    await link(page, 'Lazy page').click();
    await expect(page).toHaveURL(at('rewrite', 'lazy'));
    await expect(page.getByText(/^This page failed:/)).toBeVisible();
    await expect(page).toHaveTitle('Lazy page · Router example');

    await page.unroute('**/examples/router/lazy.js');
    // No engine keeps the failed module fetch: refresh() loads it in place.
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByText('Loaded from lazy.js.')).toBeVisible();
    await expect(page).toHaveURL(at('rewrite', 'lazy'));

    const reloaded = await page.reload();
    expect(reloaded?.status()).toBe(200);
    await ready(page);
    await expect(page.getByText('Loaded from lazy.js.')).toBeVisible();
  });
}

// A document from an earlier deploy asks for a module the current deploy no longer has. The
// failure is the route's error whatever the host answers, and only a new document helps.
for (const [kind, answer] of [
  ['rewrite', '200 text/html; charset=utf-8'],
  ['fallback', '404 text/html; charset=utf-8'],
  ['plain', '404 text/plain; charset=utf-8'],
] as const) {
  test(`${kind} host: a module a later deploy removed fails its route, and navigation goes on`, async ({
    page,
  }) => {
    const responses: string[] = [];
    page.on('response', (r) => {
      if (r.url().endsWith('removed-chunk.js'))
        responses.push(`${r.status()} ${r.headers()['content-type']}`);
    });
    await page.goto(at(kind));
    await ready(page);
    await link(page, 'Removed page').click();
    await expect(page).toHaveURL(at(kind, 'removed'));
    await expect(page.getByText(/^This page failed:/)).toBeVisible();
    await expect(page).toHaveTitle('Removed page · Router example');
    await expect.poll(() => responses).toEqual([answer]);
    await link(page, 'Guide two').click();
    await expect(page.getByText('The two guide.')).toBeVisible();
  });
}

test('a slow lazy route superseded by another link never commits', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((done) => (release = done));
  let requested!: () => void;
  const started = new Promise<void>((done) => (requested = done));
  await page.route('**/examples/router/lazy.js', async (route) => {
    requested();
    await gate;
    await route.continue();
  });
  await page.goto(at('rewrite'));
  await ready(page);
  const entries = await page.evaluate(() => history.length);

  await link(page, 'Lazy page').click();
  await started;
  await expect(page).toHaveURL(at('rewrite')); // nothing commits before the load settles
  await link(page, 'Guide two').click();
  await expect(page).toHaveTitle('Guide two · Router example');
  const arrived = page.waitForResponse('**/examples/router/lazy.js');
  release();
  await arrived;
  await page.waitForTimeout(300);
  await expect(page).toHaveURL(at('rewrite', 'guides/two'));
  await expect(page).toHaveTitle('Guide two · Router example');
  expect(await page.evaluate(() => history.length)).toBe(entries + 1);
  await page.goBack();
  await expect(page).toHaveTitle('Home · Router example');
});
