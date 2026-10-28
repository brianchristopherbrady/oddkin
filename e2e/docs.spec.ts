import { expect, test } from '@playwright/test';

const docs = 'http://127.0.0.1:4177';
// The catalog panel's modules load before its route commits: seconds in Firefox, unbundled.
const catalogLoad = 15_000;

test('docs guides, metadata references, local search, and shadow-root links', async ({
  page,
  browserName,
}) => {
  // One journey through ten routes: Firefox took 17.8 s alone and 25.1 s beside the other engines
  // (2026-10-22), too close to the default 30 s.
  test.slow();
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __csp: string[] }).__csp = seen;
    document.addEventListener(
      'securitypolicyviolation',
      (event) => {
        const target = event.composedPath()[0];
        const name = target instanceof Element ? target.localName : (target as Node)?.nodeName;
        seen.push(`${event.violatedDirective} ${name}`);
      },
      true,
    );
  });

  const response = await page.goto(`${docs}/`);
  expect(response?.status()).toBe(200);
  expect(response?.headers()['content-security-policy']).toContain("default-src 'none'");
  await expect(page.getByRole('heading', { name: 'Oddkin', level: 1 })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Oddkin packages' })).toContainText('@oddkin/core');
  expect(requests.some((url) => /\/packages\/components\/.*\.js$/.test(url))).toBe(false);

  // An authored page reached from the navigation is the server's document for that path.
  await page.locator('.side-nav a[href="/start/tokens"]').click();
  await expect(page).toHaveURL(`${docs}/start/tokens`);
  await expect(page.getByRole('heading', { name: 'Tokens only', level: 1 })).toBeVisible();
  await expect(page.locator('.side-nav a[aria-current="page"]')).toHaveText('Tokens only');

  // The layout guide's route loads its element modules before it commits (catalogLoad).
  await page.locator('.side-nav a[href="/layout/side-nav"]').click();
  await expect(page.getByRole('heading', { name: 'Side navigation', exact: true })).toBeVisible({
    timeout: catalogLoad,
  });
  await expect(page.getByRole('heading', { name: 'Recipe and regions' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Data-driven' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Declarative' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Hybrid composition' })).toBeVisible();
  await expect(
    page.locator('pre').filter({ hasText: '<odd-side-nav id="sections"' }),
  ).toContainText('slot="footer"');
  await expect(
    page.locator('pre').filter({ hasText: "document.querySelector('#sections')" }),
  ).toContainText('nav.items =');
  // The public Workbench panel (plan 867), in an open shadow root, with no preview frame.
  const sideNavPanel = page.locator('oddkin-component-panel');
  expect(await sideNavPanel.evaluate((element) => element.shadowRoot?.mode)).toBe('open');
  await expect(sideNavPanel.getByRole('heading', { name: 'Overview', level: 2 })).toBeVisible();
  expect(requests.some((url) => /\/packages\/components\/.*\.js$/.test(url))).toBe(false);

  await page.locator('.side-nav a[href="/components"]').click();
  await expect(page).toHaveURL(`${docs}/components`, { timeout: catalogLoad });
  await expect(page.getByRole('heading', { name: 'Component references' })).toBeVisible();
  // The catalog's filter is mirrored in the URL without a new entry, and typing keeps focus.
  const search = page.getByRole('searchbox', { name: 'Search components' });
  await search.fill('card');
  await expect(page).toHaveURL(`${docs}/components?q=card`);
  await expect(search).toBeFocused();
  await expect(page.getByText(/Showing 1 of \d+ components/)).toBeVisible();
  await search.fill('');
  await expect(page).toHaveURL(`${docs}/components`);
  // Filtering added no history entries: Back returns to the guide.
  await page.goBack();
  await expect(page).toHaveURL(`${docs}/layout/side-nav`);
  await page.goForward();
  await expect(page.getByRole('searchbox', { name: 'Search components' })).toBeVisible();
  // Catalog cards render with odd-card: the only component module the docs load.
  const componentModules = () =>
    requests
      .filter((url) => /\/packages\/components\/.*\.js$/.test(url))
      .map((url) => new URL(url).pathname);
  expect(componentModules().every((path) => /\/(card|styles)\//.test(path))).toBe(true);
  const before = componentModules().length;

  // A shadow-root link inside the panel navigates through the docs router.
  await page.getByRole('link', { name: 'Button', exact: true }).click();
  await expect(page).toHaveURL(`${docs}/components/odd-button`);
  await expect(page.locator('#main h1')).toHaveText('<odd-button>');
  const buttonPanel = page.locator('oddkin-component-panel');
  await expect(
    buttonPanel.getByText("import '@oddkin/components/define/button';", { exact: true }),
  ).toBeVisible();
  await expect(buttonPanel.getByText('Preview unavailable')).toBeVisible();
  expect(componentModules()).toHaveLength(before);

  await page.locator('.side-nav a[href="/foundations"]').click();
  await expect(page.getByRole('heading', { name: 'Design foundations' })).toBeVisible();
  await page.getByRole('link', { name: 'Read spacing' }).click();
  await expect(page).toHaveURL(`${docs}/foundations/spacing`);
  await expect(page.getByRole('rowheader', { name: 'space.md --odd-space-md' })).toBeVisible();

  await page.locator('#site-search').fill('navigation');
  await page.locator('#site-search').press('Enter');
  await expect(page).toHaveURL(`${docs}/search?q=navigation`);
  await expect(page.getByRole('heading', { name: 'Search Oddkin docs' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Side navigation layout guide' })).toBeVisible();

  await page.locator('.side-nav a[href="/architecture/scope-ownership"]').click();
  await expect(page.getByRole('heading', { name: 'Scope ownership for navigation' })).toBeVisible();
  // WebKit reports style-src-attr for every <select> inserted under a strict style-src, even one
  // made with createElement on a page without Oddkin code (verification.md, 2026-10-21); once the
  // select is detached the event targets the document.
  // Nothing else may violate the policy.
  const violations = await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
  expect(
    violations.filter(
      (v) => !(browserName === 'webkit' && /^style-src-attr (select|#document)$/.test(v)),
    ),
  ).toEqual([]);
});

test('authored pages are readable before client boot and metadata pages show pending then ready', async ({
  page,
}) => {
  let releaseMetadata: (() => void) | undefined;
  const metadataGate = new Promise<void>((resolve) => {
    releaseMetadata = resolve;
  });
  await page.route('**/public/@oddkin/components/oddkin.metadata.json', async (route) => {
    await metadataGate;
    await route.continue();
  });
  await page.goto(`${docs}/components`);
  await expect(page.locator('#route-status')).toHaveText('Loading the requested page…');
  releaseMetadata?.();
  await expect(page.getByRole('heading', { name: 'Component references' })).toBeVisible({
    timeout: catalogLoad,
  });

  await page.route('**/apps/docs/dist/main.js', (route) => route.abort());
  await page.goto(`${docs}/start/components`);
  await expect(
    page.getByRole('heading', { name: 'Components in any app', level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("import '@oddkin/components/define/button';")).toBeVisible();
  await page.goto(`${docs}/browser-support`);
  // Generated from docs/compatibility/features.json on the server.
  await expect(page.getByRole('table', { name: /Supported browsers/ })).toContainText('Firefox');
  await expect(page.getByRole('table', { name: 'Platform features by adoption' })).toBeVisible();
});

test('metadata loading error is visible and the retry action recovers', async ({ page }) => {
  let fail = true;
  await page.route('**/public/@oddkin/components/oddkin.metadata.json', async (route) => {
    if (fail) {
      fail = false;
      await route.fulfill({ status: 503, body: 'temporarily unavailable' });
    } else await route.continue();
  });

  await page.goto(`${docs}/components`);
  await expect(
    page.getByRole('heading', { name: 'Documentation could not be loaded' }),
  ).toBeVisible();
  await expect(page.getByText(/HTTP 503/)).toBeVisible();
  await page.getByRole('button', { name: 'Retry loading docs' }).click();
  await expect(page.getByRole('heading', { name: 'Component references' })).toBeVisible({
    timeout: catalogLoad,
  });
});

test('unknown local references render a not-found state', async ({ page }) => {
  await page.goto(`${docs}/components/odd-unknown`);
  await expect(page.getByRole('heading', { name: 'Component not found' })).toBeVisible();
  await page.goto(`${docs}/not-a-guide`);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  // Only routes fall back to the app shell; a missing asset is a 404.
  expect((await page.request.get(`${docs}/favicon.ico`)).status()).toBe(404);
});

test('every published component is listed under its category and has a reference page', async ({
  page,
}) => {
  const metadata = (await (
    await page.request.get(`${docs}/public/@oddkin/components/oddkin.metadata.json`)
  ).json()) as {
    components: Record<string, { tag: string; category?: string; registration?: string }>;
    categories: Record<string, { label: string }>;
  };
  const components = Object.values(metadata.components);
  expect(components.length).toBeGreaterThan(0);
  // A round trip per component (reference page, then back to the catalog): 0.4 s in Chromium,
  // 0.65 s in WebKit, and 0.85 s in Firefox alone (54 components, 2026-10-27), about twice that
  // beside other runs. A fixed budget failed as the catalog grew, so it grows with it.
  test.setTimeout(30_000 + components.length * 2_000);
  const count = (category: string) => components.filter((c) => c.category === category).length;

  await page.goto(`${docs}/components`);
  await expect(
    page.getByText(`Showing ${components.length} of ${components.length} components`),
  ).toBeVisible();
  for (const { tag, category } of components) {
    const label = category ? metadata.categories[category]?.label : undefined;
    expect(label, `${tag} has a category with a label`).toBeTruthy();
    const group = page.getByRole('region', {
      name: `${label} (${count(category as string)})`,
      exact: true,
    });
    await expect(group.locator(`a[href="/components/${tag}"]`)).toBeVisible();
  }
  // Each reference page renders from the published metadata, reached through the catalog's links.
  for (const { tag, registration } of components) {
    await page.locator(`oddkin-catalog-panel a[href="/components/${tag}"]`).click();
    await expect(page.locator('#main h1')).toHaveText(`<${tag}>`);
    const panel = page.locator('oddkin-component-panel');
    await expect(panel.getByRole('heading', { name: 'Overview', level: 2 })).toBeVisible();
    await expect(panel.getByText(`import '${registration}';`, { exact: true })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Component references' })).toBeVisible();
  }
});
