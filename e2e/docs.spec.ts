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
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Web components, design tokens, and the tools around them.',
  );

  // An authored page reached from a link is the server's document for that path; on wide screens
  // the sidebar (odd-side-nav over the server's links) lists the section's pages, and a page
  // under one of them marks it.
  await page.getByRole('link', { name: 'Get started' }).click();
  await expect(page).toHaveURL(`${docs}/getting-started`);
  await expect(page.getByRole('navigation', { name: 'Documentation' })).toBeVisible({
    timeout: catalogLoad,
  });
  // Its links are the odd-side-nav host's children, slotted into its shadow nav.
  const sidebar = page.locator('#docs-nav');
  await page.getByRole('link', { name: 'Use tokens only' }).click();
  await expect(page).toHaveURL(`${docs}/getting-started/tokens`);
  await expect(page.getByRole('heading', { name: 'Tokens only', level: 1 })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Getting started' })).toHaveAttribute(
    'aria-current',
    'true',
  );

  // The layout guide's route loads its element modules before it commits (catalogLoad).
  await sidebar.getByRole('link', { name: 'Guides' }).click();
  await page.getByRole('link', { name: 'Read the layout guide' }).click();
  await page.getByRole('link', { name: 'side navigation guide' }).click();
  await expect(page.getByRole('heading', { name: 'Side navigation', exact: true })).toBeVisible({
    timeout: catalogLoad,
  });
  // The embedded panel has example headings of its own ("declarative"): match the guide's exactly.
  await expect(
    page.getByRole('heading', { name: 'Recipe and regions', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Data-driven', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Declarative', exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Hybrid composition', exact: true }),
  ).toBeVisible();
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

  // A route in another section shows that section's sidebar.
  const primary = page.getByRole('navigation', { name: 'Primary' });
  await primary.getByRole('link', { name: 'Components' }).click();
  await expect(page).toHaveURL(`${docs}/components`, { timeout: catalogLoad });
  await expect(page.getByRole('heading', { name: 'Component catalog' })).toBeVisible({
    timeout: catalogLoad,
  });
  await expect(sidebar.getByRole('link', { name: 'Browse all' })).toHaveAttribute(
    'aria-current',
    'page',
  );
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
  await expect(page.getByRole('searchbox', { name: 'Search components' })).toBeVisible({
    timeout: catalogLoad,
  });

  // A shadow-root link inside the panel navigates through the docs router; the reference page
  // shows the component's documented default example live, in a frame.
  await page.getByRole('link', { name: 'View reference: Button', exact: true }).click();
  await expect(page).toHaveURL(`${docs}/components/odd-button`);
  await expect(page.locator('#main h1')).toHaveText('Button');
  await expect(sidebar.getByRole('link', { name: 'Button', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  const buttonPanel = page.locator('oddkin-component-panel');
  await expect(
    buttonPanel.getByText("import '@oddkin/components/define/button';", { exact: true }),
  ).toBeVisible();
  await expect(
    page.frameLocator('oddkin-component-panel iframe').first().locator('odd-button'),
  ).toHaveText('Save', { timeout: catalogLoad });
  // The documentation layout (Figma 20:2190): section links, one scrolling controls region, and
  // no token or usage sections; example cards show live elements.
  await expect(
    buttonPanel.getByRole('navigation', { name: 'Page sections' }).getByRole('link'),
  ).toHaveText(['Overview', 'Controls', 'Examples', 'Accessibility']);
  await expect(buttonPanel.getByRole('heading', { level: 2 })).toHaveText([
    'Overview',
    'Interactive example',
    'Source and package',
    'States and examples',
    'Reference',
    'Accessibility',
    'Known limitations',
  ]);
  const controls = buttonPanel.getByRole('region', { name: 'Controls and API' });
  await expect(controls).toHaveAttribute('tabindex', '0');
  await expect(controls).toHaveCSS('overflow-y', 'auto');
  const specimen = buttonPanel.locator('.example-preview').first();
  await specimen.scrollIntoViewIfNeeded();
  await expect(specimen.locator('odd-button')).toHaveText('Save');

  // Foundations are authored pages; their tables and swatches come from the tokens inspection.
  await primary.getByRole('link', { name: 'Foundations' }).click();
  await expect(page.getByRole('heading', { name: 'Foundations', level: 1 })).toBeVisible();
  await page.getByRole('link', { name: 'Read about spacing' }).click();
  await expect(page).toHaveURL(`${docs}/foundations/spacing`);
  await expect(page.getByRole('rowheader', { name: 'space.md' })).toBeVisible();

  // Search is odd-command-palette over every page and component (Ctrl K or the header button).
  // Before the shell runs, the button is a link to /search: wait for the shell (data-docs-js).
  await expect(page.locator('html[data-docs-js]')).toBeAttached({ timeout: catalogLoad });
  await page.getByRole('link', { name: 'Search docs' }).click();
  const palette = page.getByRole('dialog', { name: 'Search docs' });
  await palette.getByRole('combobox').fill('scope ownership');
  await palette.getByRole('option', { name: 'Case study: scope ownership' }).click();
  await expect(page).toHaveURL(`${docs}/architecture/scope-ownership`);
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

  await page.goto(`${docs}/search?q=navigation`);
  await expect(page.getByRole('heading', { name: 'Search Oddkin docs' })).toBeVisible({
    timeout: catalogLoad,
  });
  await expect(page.getByRole('link', { name: 'Side navigation layout guide' })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Component catalog' })).toBeVisible({
    timeout: catalogLoad,
  });

  await page.route('**/apps/docs/dist/main.js', (route) => route.abort());
  await page.goto(`${docs}/getting-started/components`);
  await expect(
    page.getByRole('heading', { name: 'Components in any app', level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("import '@oddkin/components/define/button';")).toBeVisible();
  await page.goto(`${docs}/installation`);
  await expect(page.getByRole('table', { name: 'Oddkin packages' })).toContainText('@oddkin/core');
  await page.goto(`${docs}/support/browsers`);
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
  await expect(page.getByRole('heading', { name: 'Component catalog' })).toBeVisible({
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

test('the AI page shows a live conversation and links every AI element to its reference', async ({
  page,
}) => {
  const metadata = (await (
    await page.request.get(`${docs}/public/@oddkin/ai/oddkin.metadata.json`)
  ).json()) as { components: Record<string, { tag: string }> };
  const tags = Object.values(metadata.components).map(({ tag }) => tag);
  await page.goto(`${docs}/ai`);
  await expect(page.getByRole('heading', { name: 'AI interfaces', level: 1 })).toBeVisible({
    timeout: catalogLoad,
  });
  // The conversation and composer examples, composed; the conversation renders its records.
  await expect(page.locator('.ai-example odd-conversation')).toContainText(
    'Summarize the release notes.',
    { timeout: catalogLoad },
  );
  await expect(
    page.locator('.ai-example odd-conversation > odd-prompt-input[slot="composer"]'),
  ).toBeAttached();
  await expect(
    page.getByRole('heading', { name: `${tags.length} interaction elements` }),
  ).toBeVisible();
  const links = page.locator('.ai-element-links a');
  expect(
    (await links.evaluateAll((list) => list.map((a) => a.getAttribute('href')))).sort(),
  ).toEqual(tags.map((tag) => `/components/${tag}`).sort());
  await page.locator('.ai-element-links a[href="/components/odd-prompt-input"]').click();
  await expect(page.locator('#main .page-header .eyebrow')).toHaveText('AI · odd-prompt-input', {
    timeout: catalogLoad,
  });
  await expect(page.locator('oddkin-component-panel')).toBeVisible();
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
  // beside other runs, and over 4 s with the machine busy (2026-10-28, Firefox and WebKit; the
  // docs sidebar measured no part of it). A fixed budget failed as the catalog grew, so it grows
  // with it.
  test.setTimeout(30_000 + components.length * 5_000);
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
    // The first reference page also loads the component panel's modules (catalogLoad).
    await expect(page.locator('#main .page-header .eyebrow')).toHaveText(new RegExp(` · ${tag}$`), {
      timeout: catalogLoad,
    });
    const panel = page.locator('oddkin-component-panel');
    await expect(panel.getByRole('heading', { name: 'Overview', level: 2 })).toBeVisible();
    await expect(panel.getByText(`import '${registration}';`, { exact: true })).toBeVisible();
    await page.goBack();
    // The catalog renders its 54 live previews again (seconds in Firefox under load).
    await expect(page.getByRole('heading', { name: 'Component catalog' })).toBeVisible({
      timeout: catalogLoad,
    });
  }
});
