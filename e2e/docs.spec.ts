import { expect, test } from '@playwright/test';

const docs = 'http://127.0.0.1:4177';

test('docs guides, metadata references, local search, and shadow-root links', async ({ page }) => {
  const requests: string[] = [];
  const cspErrors: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  page.on('console', (message) => {
    if (message.type() === 'error' && /content security policy/i.test(message.text()))
      cspErrors.push(message.text());
  });

  const response = await page.goto(`${docs}/`);
  expect(response?.status()).toBe(200);
  expect(response?.headers()['content-security-policy']).toContain("default-src 'none'");
  await expect(page.getByRole('heading', { name: 'Getting started' })).toBeVisible();
  await expect(page.getByText('Start with Oddkin tokens')).toBeVisible();
  expect(requests.some((url) => /\/packages\/components\/.*\.js$/.test(url))).toBe(false);

  await page.locator('.side-nav a[href="/layout/side-nav"]').click();
  await expect(page.getByRole('heading', { name: 'Side navigation', exact: true })).toBeVisible();
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
  expect(
    await page.locator('oddkin-doc-panel').evaluate((element) => element.shadowRoot?.mode),
  ).toBe('open');

  await page.getByRole('link', { name: 'Browse all components' }).click();
  await expect(page).toHaveURL(`${docs}/components`);
  await expect(page.getByRole('heading', { name: 'Component references' })).toBeVisible();
  await page.getByRole('link', { name: 'Read odd-button' }).click();
  await expect(page).toHaveURL(`${docs}/components/odd-button`);
  await expect(page.locator('#main h1')).toHaveText('<odd-button>');
  await expect(page.getByRole('cell', { name: '"primary" | "secondary" | "ghost"' })).toBeVisible();
  await expect(
    page.getByText("import '@oddkin/components/define/button';", { exact: false }),
  ).toBeVisible();

  await page.locator('.side-nav a[href="/foundations"]').click();
  await expect(page.getByRole('heading', { name: 'Design foundations' })).toBeVisible();
  await page.getByRole('link', { name: 'Read spacing' }).click();
  await expect(page).toHaveURL(`${docs}/foundations/spacing`);
  await expect(page.getByRole('cell', { name: '--odd-space-md' })).toBeVisible();

  await page.locator('#site-search').fill('navigation');
  await page.locator('#site-search').press('Enter');
  await expect(page).toHaveURL(`${docs}/search?q=navigation`);
  await expect(page.getByRole('heading', { name: 'Search Oddkin docs' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Side navigation layout guide' })).toBeVisible();

  await page.locator('.side-nav a[href="/architecture/scope-ownership"]').click();
  await expect(page.getByRole('heading', { name: 'Scope ownership for navigation' })).toBeVisible();
  expect(cspErrors).toEqual([]);
});

test('initial guide is readable before client boot and async metadata shows pending then ready', async ({
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
  await page.goto(`${docs}/`);
  await expect(page.getByRole('heading', { name: 'Getting started' })).toBeVisible();
  await expect(page.locator('#route-status')).toHaveText('Loading the requested page…');
  releaseMetadata?.();
  await expect(page.getByRole('heading', { name: 'Use design tokens' })).toBeVisible();

  await page.route('**/apps/docs/dist/main.js', (route) => route.abort());
  await page.goto(`${docs}/`);
  await expect(page.getByRole('heading', { name: 'Getting started', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Read the token reference' })).toBeVisible();
});

test('metadata loading error is visible and the retry action recovers', async ({ page }) => {
  let fail = true;
  await page.route('**/public/@oddkin/components/oddkin.metadata.json', async (route) => {
    if (fail) {
      fail = false;
      await route.fulfill({ status: 503, body: 'temporarily unavailable' });
    } else await route.continue();
  });

  await page.goto(`${docs}/`);
  await expect(
    page.getByRole('heading', { name: 'Documentation could not be loaded' }),
  ).toBeVisible();
  await expect(page.getByText(/HTTP 503/)).toBeVisible();
  await page.getByRole('button', { name: 'Retry loading docs' }).click();
  await expect(page.getByRole('heading', { name: 'Use design tokens' })).toBeVisible();
});

test('unknown local references render a not-found state', async ({ page }) => {
  await page.goto(`${docs}/components/odd-unknown`);
  await expect(page.getByRole('heading', { name: 'Component not found' })).toBeVisible();
  await page.goto(`${docs}/not-a-guide`);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});
