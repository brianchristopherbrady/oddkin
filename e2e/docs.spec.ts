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
  // The hero is centred beside its live examples, which register after the first paint and grow
  // (about 100 px): a click while they upgrade can end off the link.
  await expect(page.locator('.specimen :not(:defined)')).toHaveCount(0, { timeout: catalogLoad });

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
  // An authored page is the server's document for its path (`data-page`); the URL moves before
  // that document loads. Each step waits for it, so a stop says which one never came (CI,
  // WebKit, d7dfcb6: the journey stopped after "Read the layout guide", not reproduced here).
  await expect(page.locator('main[data-page="guides"]')).toBeAttached({ timeout: catalogLoad });
  await page.getByRole('link', { name: 'Read the layout guide' }).click();
  await expect(page).toHaveURL(`${docs}/guides/layout`);
  await expect(page.locator('main[data-page="guides/layout"]')).toBeAttached({
    timeout: catalogLoad,
  });
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
  // The catalog's filter is mirrored in the URL without a new entry, and typing keeps focus. (A
  // tag: "card" alone also finds odd-voice-input, whose summary says "discard".)
  const search = page.getByRole('searchbox', { name: 'Search components' });
  await search.fill('odd-card');
  await expect(page).toHaveURL(`${docs}/components?q=odd-card`);
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
  // The documentation layout (Figma 20:2190): tabs over the panel's sections, one scrolling
  // controls region, and no token or usage sections; example cards show live elements.
  const tabs = page.getByRole('tablist', { name: 'Component documentation' });
  await expect(tabs.getByRole('tab')).toHaveText([
    'Overview',
    'Controls',
    'Examples',
    'Accessibility',
  ]);
  await expect(tabs.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  const headings = buttonPanel.getByRole('heading', { level: 2 });
  await expect(headings).toHaveText(['Overview', 'Interactive example', 'Source and package']);
  const controls = buttonPanel.getByRole('region', { name: 'Controls and API' });
  await expect(controls).toHaveAttribute('tabindex', '0');
  await expect(controls).toHaveCSS('overflow-y', 'auto');
  // Arrow keys and clicks switch tabs; the URL names the tab, and the example's frame stays.
  const frame = await buttonPanel.locator('iframe').first().elementHandle();
  await tabs.getByRole('tab', { name: 'Overview' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(tabs.getByRole('tab', { name: 'Controls' })).toBeFocused();
  await expect(headings).toHaveText(['Interactive example', 'Reference']);
  await expect(controls.getByRole('button', { name: 'Unset', exact: true })).toHaveCount(0);
  const slots = controls.locator('[data-table="slots"]');
  await expect(slots.getByRole('rowheader', { name: 'default', exact: true })).toBeVisible();
  await expect(slots.locator('input, textarea, select, button')).toHaveCount(0);
  const styles = controls.locator('[data-table="css-properties"]');
  await expect(styles.getByRole('rowheader', { name: /--odd-button-radius/ })).toBeVisible();
  await expect(styles.locator('input, textarea, select, button')).toHaveCount(0);
  const appearance = controls
    .locator('[data-table="attributes"]')
    .getByRole('combobox', { name: 'appearance (attribute)' });
  const liveButton = buttonPanel.frameLocator('iframe').first().locator('odd-button');
  const liveAppearance = () =>
    liveButton.evaluate((element: HTMLElementTagNameMap['odd-button']) => element.appearance);
  await expect(appearance).toHaveValue('');
  await appearance.selectOption('primary');
  await expect.poll(liveAppearance).toBe('primary');
  await buttonPanel.getByRole('button', { name: 'See code', exact: true }).click();
  const generatedCode = buttonPanel.locator('.wb-snippet');
  await expect(generatedCode).toContainText('appearance="primary"');
  await expect(generatedCode).not.toContainText('element.appearance');
  await appearance.selectOption('');
  await expect.poll(liveAppearance).toBe('secondary');
  await expect(generatedCode).not.toContainText('appearance=');
  await buttonPanel.getByRole('button', { name: 'Hide code', exact: true }).click();
  await expect(liveButton).toHaveText('Save');
  await expect(page).toHaveURL(`${docs}/components/odd-button#controls`);
  await tabs.getByRole('tab', { name: 'Controls' }).focus();
  await page.keyboard.press('End');
  await expect(headings).toHaveText(['Accessibility', 'Known limitations']);
  await tabs.getByRole('tab', { name: 'Examples' }).click();
  await expect(page.getByRole('tabpanel', { name: 'Examples' })).toBeVisible();
  await expect(headings).toHaveText(['States and examples']);
  const specimen = buttonPanel.locator('.example-preview').first();
  await specimen.scrollIntoViewIfNeeded();
  await expect(specimen.locator('odd-button')).toHaveText('Save');
  await tabs.getByRole('tab', { name: 'Overview' }).click();
  expect(await frame?.evaluate((element) => element.isConnected)).toBe(true);

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
  for (const tag of ['odd-context-picker', 'odd-prompt-input']) {
    await page.goto(`${docs}/components/${tag}`);
    await expect(page.getByRole('heading', { name: 'Component not found' })).toBeVisible();
  }
  await page.goto(`${docs}/not-a-guide`);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  // Only routes fall back to the app shell; a missing asset is a 404.
  expect((await page.request.get(`${docs}/favicon.ico`)).status()).toBe(404);
});

test('code samples keep their place while their copy buttons register', async ({ page }) => {
  // A click below a sample must not end off its target (the docs journey's lost click, 2026-11-01).
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(/copy-button/, async (route) => {
    await held;
    await route.continue();
  });
  await page.goto(`${docs}/guides/layout`, { waitUntil: 'domcontentloaded' });
  const link = page.getByRole('link', { name: 'side navigation guide' });
  await expect(page.locator('odd-copy-button:not(:defined)').first()).toBeAttached();
  const heights = () =>
    page.locator('.code-toolbar').evaluateAll((bars) => bars.map((bar) => bar.clientHeight));
  const before = { bars: await heights(), link: (await link.boundingBox())?.y };
  release();
  await expect(page.locator('odd-copy-button:not(:defined)')).toHaveCount(0, {
    timeout: catalogLoad,
  });
  expect({ bars: await heights(), link: (await link.boundingBox())?.y }).toEqual(before);
});

test('the header link from the home opens Components beside the sidebar, as loaded directly', async ({
  page,
}) => {
  // The owner's report (2026-11-04): home, then Components in the header, showed the catalog with
  // no sidebar and against the left edge, because the client kept the home's full-width layout.
  // At the owner's width, where the home hides the sidebar.
  await page.setViewportSize({ width: 1155, height: 900 });
  await page.goto(`${docs}/`);
  await expect(page.locator('.specimen :not(:defined)')).toHaveCount(0, { timeout: catalogLoad });
  const sidebar = page.locator('#docs-nav');
  await expect(sidebar).toBeHidden();
  const primary = page.getByRole('navigation', { name: 'Primary' });
  await primary.getByRole('link', { name: 'Components' }).click();
  await expect(page).toHaveURL(`${docs}/components`, { timeout: catalogLoad });
  const heading = page.getByRole('heading', { name: 'Component catalog' });
  await expect(heading).toBeVisible({ timeout: catalogLoad });
  await expect(sidebar).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Browse all' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  const boxes = async () => ({
    sidebar: await sidebar.boundingBox(),
    heading: await heading.boundingBox(),
  });
  const reached = await boxes();
  expect(reached.heading!.x).toBeGreaterThan(reached.sidebar!.x + reached.sidebar!.width);
  // The same layout as the server's document for /components.
  await page.goto(`${docs}/components`);
  await expect(heading).toBeVisible({ timeout: catalogLoad });
  await expect(sidebar).toBeVisible();
  const loaded = await boxes();
  expect(Math.abs(reached.heading!.x - loaded.heading!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(reached.sidebar!.width - loaded.sidebar!.width)).toBeLessThanOrEqual(1);
});

test('the catalog lists Citation under Display and omits the other AI components', async ({
  page,
}) => {
  const core = (await (
    await page.request.get(`${docs}/public/@oddkin/components/oddkin.metadata.json`)
  ).json()) as { components: Record<string, { tag: string }> };
  const all = Object.keys(core.components).length + 1;
  await page.goto(`${docs}/components?category=AI`);
  await expect(page.getByRole('heading', { name: 'Component catalog' })).toBeVisible({
    timeout: catalogLoad,
  });
  const filters = page.locator('oddkin-catalog-panel .wb-categories button');
  await expect(filters.filter({ hasText: /^AI$/ })).toHaveCount(0);
  await expect(page.getByText(`Showing ${all} of ${all} components`)).toBeVisible();
  await expect(
    page.locator('oddkin-catalog-panel .wb-card-package').filter({ hasText: '@oddkin/ai' }),
  ).toHaveCount(1);
  // Each card names the package its component installs from, after the tag.
  await expect(
    page.locator(
      'oddkin-catalog-panel odd-card:has(a[href="/components/odd-button"]) .wb-card-tag',
    ),
  ).toHaveText(/^\s*odd-button\s+@oddkin\/components\s*$/);
  await expect(page.locator('a[href="/components?category=AI"]')).toHaveCount(0);
  for (const tag of ['odd-context-picker', 'odd-prompt-input'])
    await expect(page.locator(`a[href="/components/${tag}"]`)).toHaveCount(0);
  const display = page.getByRole('region', { name: /^Display \(\d+\)$/ });
  await expect(
    display.locator('odd-card:has(a[href="/components/odd-citation"]) .wb-card-tag'),
  ).toHaveText(/^\s*odd-citation\s+@oddkin\/ai\s*$/);
  await display.locator('a[href="/components/odd-citation"]').click();
  await expect(page.locator('#main .page-header .eyebrow')).toHaveText('Display · odd-citation', {
    timeout: catalogLoad,
  });
  await expect(page.locator('oddkin-component-panel')).toBeVisible();
  await page.goto(`${docs}/ai`);
  await expect(page.getByRole('heading', { name: 'AI tooling', level: 1 })).toBeVisible();
  await expect(page.locator('a[href="/components?category=AI"]')).toHaveCount(0);
  await page.goto(docs);
  await expect(page.locator('a[href="/components?category=AI"]')).toHaveCount(0);
});

test('every core docs component is listed under its category and has a reference page', async ({
  page,
}) => {
  const metadata = (await (
    await page.request.get(`${docs}/public/@oddkin/components/oddkin.metadata.json`)
  ).json()) as {
    components: Record<string, { tag: string; category?: string; registration?: string }>;
    categories: Record<string, { label: string }>;
  };
  const components = Object.values(metadata.components).map((component) => ({
    ...component,
    label: component.category ? metadata.categories[component.category]?.label : undefined,
  }));
  const total = components.length + 1; // Citation is the one public component from @oddkin/ai.
  expect(components.length).toBeGreaterThan(0);
  // A round trip per component of @oddkin/components (reference page, then back to the catalog):
  // 0.4 s in Chromium, 0.65 s in WebKit, and 0.85 s in Firefox alone (54 components, 2026-10-27),
  // about twice that beside other runs, and over 4 s with the machine busy (2026-10-28, Firefox
  // and WebKit; the docs sidebar measured no part of it). A fixed budget failed as the catalog
  // grew, so it grows with it.
  test.setTimeout(30_000 + components.length * 5_000);
  const count = (label: string) => components.filter((c) => c.label === label).length;

  await page.goto(`${docs}/components`);
  await expect(page.getByText(`Showing ${total} of ${total} components`)).toBeVisible();
  for (const { tag, label } of components) {
    expect(label, `${tag} has a category with a label`).toBeTruthy();
    const group = page.getByRole('region', {
      name: `${label} (${count(label as string) + (label === 'Display' ? 1 : 0)})`,
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
    // Its live example mounts (the frame loaded the element's registration).
    await expect(
      page.frameLocator('oddkin-component-panel iframe').first().locator(tag),
    ).toBeAttached({ timeout: catalogLoad });
    await page.goBack();
    // The catalog renders its live previews again (seconds in Firefox under load).
    await expect(page.getByRole('heading', { name: 'Component catalog' })).toBeVisible({
      timeout: catalogLoad,
    });
    // The panel has drawn its cards again before the next click (a click on a card being replaced is lost).
    await expect(page.getByText(`Showing ${total} of ${total} components`)).toBeVisible();
  }
});

test('Tree documents selection separately and exposes useful attribute controls', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(`${docs}/components/odd-tree#controls`);
  const panel = page.locator('oddkin-component-panel');
  const controls = panel.getByRole('region', { name: 'Controls and API' });
  const properties = controls.locator('[data-table="properties"]');
  const attributes = controls.locator('[data-table="attributes"]');
  await expect(properties.getByRole('rowheader', { name: /^values\b/ })).toBeVisible();
  await expect(properties.locator('input, textarea, select, button')).toHaveCount(0);
  await expect
    .poll(() =>
      properties
        .locator('tbody tr')
        .first()
        .evaluate((row) => row.getBoundingClientRect().width),
    )
    .toBeGreaterThan(280);
  await expect(attributes.getByRole('rowheader', { name: /^values\b/ })).toHaveCount(0);
  const value = attributes.getByRole('row').filter({
    has: page.getByRole('rowheader', { name: /^value\b/ }),
  });
  await expect(value).toBeVisible();
  await expect(value.locator('input, textarea, select, button')).toHaveCount(0);

  const preview = panel.frameLocator('iframe').first();
  const compactTree = preview.locator('odd-tree');
  await expect(compactTree).toHaveAttribute('density', 'compact');
  const tree = preview.getByRole('tree', { name: 'Project files' });
  await expect(tree.getByRole('treeitem', { name: 'Text field' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  const combobox = tree.getByRole('treeitem', { name: 'Combobox' });
  await combobox.click();
  await expect(combobox).toHaveAttribute('aria-selected', 'true');
  const height = (row: Element) => row.getBoundingClientRect().height;
  const firstRow = tree.getByRole('treeitem', { name: 'Components' });
  const liveHeight = await firstRow.evaluate(height);
  const density = attributes.getByRole('combobox', { name: 'density (attribute)' });
  await expect(density).toHaveValue('compact');
  await density.selectOption('cozy');
  await expect(compactTree).toHaveAttribute('density', 'cozy');
  await expect.poll(() => firstRow.evaluate(height)).toBeGreaterThan(liveHeight);
  await density.selectOption('compact');
  await expect(compactTree).toHaveAttribute('density', 'compact');
  await expect.poll(() => firstRow.evaluate(height)).toBeCloseTo(liveHeight, 0);
  await expect(combobox).toHaveAttribute('aria-selected', 'true');
  await attributes.getByRole('switch', { name: 'multiple (attribute)' }).click();
  await expect(tree).toHaveAttribute('aria-multiselectable', 'true');
  const label = attributes.getByRole('textbox', { name: 'label (attribute)' });
  await expect(label).toHaveValue('Project files');
  await label.fill('Workspace files');
  await expect(
    panel.frameLocator('iframe').first().getByRole('tree', { name: 'Workspace files' }),
  ).toBeVisible();
  await panel.getByRole('button', { name: 'See code', exact: true }).click();
  await expect(panel.locator('.wb-snippet')).toContainText('label="Workspace files"');
  await expect(panel.locator('.wb-snippet')).not.toContainText('element.label');
  await expect(panel.locator('.wb-snippet')).toContainText('density="compact"');
  await page.getByRole('tab', { name: 'Examples' }).click();
  const densityRow = async (example: string) => {
    const card = panel.locator(`[data-example="example:odd-tree/${example}"]`);
    await card.scrollIntoViewIfNeeded();
    const row = card.locator('odd-tree [role="treeitem"]').first();
    await expect(row).toBeVisible();
    return row.evaluate(height);
  };
  const compactHeight = await densityRow('default');
  const cozyHeight = await densityRow('cozy');
  expect(liveHeight).toBeCloseTo(compactHeight, 0);
  expect(compactHeight).toBeLessThan(cozyHeight);
});

test('a live example runs its setup script', async ({ page }) => {
  // The breadcrumbs example's fixture renders its trail (core's html, under the docs' Trusted Types
  // policy) from the example module the docs serve (_oddkin/examples/).
  await page.goto(`${docs}/components/odd-breadcrumbs`);
  const frame = page.frameLocator('oddkin-component-panel iframe').first();
  await expect(frame.getByRole('link', { name: 'Home' })).toBeVisible({ timeout: catalogLoad });
  await expect(page.locator('oddkin-component-panel').getByText(/setup did not run/)).toHaveCount(
    0,
  );
});

test('serves llms.txt, linking the agent kits under its own address', async ({ request }) => {
  const index = await request.get(`${docs}/llms.txt`);
  expect(index.status()).toBe(200);
  expect(index.headers()['content-type']).toContain('text/plain');
  const links = [...(await index.text()).matchAll(/\]\((https?:[^)]+)\)/g)].map(
    ([, href]) => href!,
  );
  expect(links.length).toBeGreaterThan(0);
  for (const href of links) expect(href.startsWith(`${docs}/agent/`), href).toBe(true);
  const aiReferences = `${docs}/agent/oddkin-ai/references/components/`;
  expect(links.filter((href) => href.startsWith(aiReferences))).toEqual([
    `${aiReferences}odd-citation.md`,
  ]);
  for (const tag of ['odd-context-picker', 'odd-prompt-input'])
    expect((await request.get(`${aiReferences}${tag}.md`)).status()).toBe(404);
  const guide = await request.get(links[0]!);
  expect(guide.status()).toBe(200);
  expect(guide.headers()['content-type']).toContain('text/markdown');
});

test('the Table and Command Palette thumbnails fit at desktop and phone widths', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${docs}/components`);
    const catalog = page.locator('oddkin-catalog-panel');
    const preview = (tag: string) =>
      catalog.locator(`li:has(a[href="/components/${tag}"]) .wb-card-preview`);

    const tablePreview = preview('odd-table');
    await tablePreview.scrollIntoViewIfNeeded();
    const table = tablePreview.locator('odd-table table');
    await expect(table.locator('tbody tr')).toHaveCount(4);
    await expect
      .poll(() =>
        tablePreview.evaluate((header) => {
          const example = header
            .querySelector('.catalog-preview')
            ?.shadowRoot?.querySelector('odd-table');
          const actual = example?.shadowRoot?.querySelector('table');
          if (!actual) return false;
          const rect = actual.getBoundingClientRect();
          const frame = header.getBoundingClientRect();
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            rect.top >= frame.top &&
            rect.bottom <= frame.bottom &&
            rect.left >= frame.left &&
            rect.right <= frame.right &&
            Array.from(actual.querySelectorAll('thead th')).every((cell) => {
              const range = actual.ownerDocument.createRange();
              const label = cell.querySelector('.label') ?? cell;
              range.selectNodeContents(label);
              return (
                Array.from(range.getClientRects()).filter((line) => line.width > 0).length === 1
              );
            })
          );
        }),
      )
      .toBe(true);

    const palettePreview = preview('odd-command-palette');
    await palettePreview.scrollIntoViewIfNeeded();
    const frame = palettePreview.frameLocator('iframe');
    await expect(frame.locator('odd-command-palette dialog[open]')).toBeVisible();
    await expect(frame.locator('odd-command-palette [part="item"]').first()).toContainText(
      'New project',
    );
    await expect(frame.locator('[data-oddkin-preview] > odd-button')).toHaveCount(0);
  }
  await page.locator('.mode-toggle').click();
  await expect(
    page.frameLocator('iframe[title="odd-command-palette example"]').locator('html'),
  ).toHaveAttribute('data-odd-mode', 'dark');
});

test('every catalog card shows a live example', async ({ page }) => {
  // Every card in turn (79 on 2026-11-05): Firefox took 21 to 29 s, and over 30 s on a loaded
  // machine, too close to the default 30 s; each new card and fixture adds to it.
  test.slow();
  await page.goto(`${docs}/components`);
  await expect(page.getByText(/Showing \d+ of \d+ components/)).toBeVisible({
    timeout: catalogLoad,
  });
  const previews = page.locator('oddkin-catalog-panel .catalog-preview');
  const count = await previews.count();
  expect(count).toBeGreaterThan(50);
  for (let i = 0; i < count; i++) {
    const preview = previews.nth(i);
    // A preview draws when it scrolls into view, running its example's fixture if it has one.
    const card = await preview.evaluate((host) => {
      host.scrollIntoView({ block: 'center' });
      const link = host.closest('article, li')?.querySelector('a[href*="/components/"]');
      return link?.getAttribute('href')?.split('/').pop();
    });
    await expect
      .poll(
        () =>
          preview.evaluate((host) => {
            const root = host.shadowRoot;
            const stage = root?.querySelector<HTMLElement>('[data-preview-stage]');
            return stage
              ? stage.style.visibility === 'hidden'
                ? 0
                : stage.childElementCount
              : (root?.childElementCount ?? 0);
          }),
        {
          message: `the ${card ?? `card ${i + 1}`} card draws its example`,
          timeout: catalogLoad,
        },
      )
      .toBeGreaterThan(0);
  }
});
