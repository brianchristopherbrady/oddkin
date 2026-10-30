import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { startDevServer } from '../packages/workbench/dist/node/index.js';
import { acmeProject, removeProject } from '../packages/workbench/test/node-project.js';

// The Workbench shell over the real @oddkin/components, served by `oddkin workbench dev`
// (port 4175, started by the Playwright configuration from tests/fixtures/workbench-oddkin).
const base = 'http://127.0.0.1:4175/';
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

    // The first page's announcement goes out first; the announcer joins messages queued within
    // 120 ms, so a navigation right after load would be announced together with it.
    const live = page.locator('body > [aria-live="polite"]');
    await expect(live).toHaveText('Foundations · Oddkin components');
    await cards.getByRole('link', { name: 'Spacing' }).click();
    await expect(page.locator('main h1')).toHaveText('Spacing');
    expect(new URL(page.url()).pathname).toBe('/foundations/spacing');
    await expect(page).toHaveTitle('Spacing · Oddkin components');
    await expect(page.locator('main h1')).toBeFocused();
    await expect(live).toHaveText('Spacing · Oddkin components');
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

  test('previews each component live in its catalog card as the card nears the view', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await open(page, 'components', 'Components');
    const button = page
      .locator('odd-card.wb-card')
      .filter({ has: page.locator('h3', { hasText: /^Button$/ }) });
    // The first example, upgraded in the card's frame; the shell's realm registers no library element.
    const element = button.frameLocator('iframe').locator('odd-button');
    await expect(element).toHaveText('Save', { timeout: 20_000 });
    expect(await element.evaluate((el) => el.shadowRoot !== null)).toBe(true);
    expect(await page.evaluate(() => customElements.get('odd-button') === undefined)).toBe(true);
    // Outside the tab order: the card's link stays its only stop.
    await expect(button.locator('.wb-card-frame')).toHaveJSProperty('inert', true);
    // Frames load as their cards near the view, so the far cards have none yet. Cards scrolled
    // past before their turn drop out of the queue, so the last one loads after those in flight.
    const hosts = page.locator('.wb-card-frame');
    expect(await hosts.locator('iframe').count()).toBeLessThan(await hosts.count());
    await hosts.last().scrollIntoViewIfNeeded();
    await expect(hosts.last().locator('iframe')).toHaveCount(1, { timeout: 30_000 });
    // Leaving the catalog removes them.
    await page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: 'Foundations' })
      .click();
    await expect(page.locator('main h1')).toHaveText('Foundations');
    await expect(page.locator('iframe')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('lists the page’s sections and jumps to them', async ({ page }) => {
    await open(page, 'components/odd-button', 'Button');
    const toc = page.getByRole('navigation', { name: 'On this page' });
    await expect(toc.getByRole('link')).toHaveText([
      'Overview',
      'Interactive example',
      'Source and package',
      'States and examples',
      'Reference',
      'Tokens',
      'Accessibility',
      'Guidance',
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
    // Every word must match: "side" alone also finds summaries that say "beside".
    await input.fill('side nav');
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

  test.describe('Workbench component detail', () => {
    test('previews the real component in a frame and edits it through the API table', async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await open(page, 'components/odd-button', 'Button');
      const frame = page.frameLocator('oddkin-workbench-component iframe').first();
      // The default authored example: its slot text, from button.examples.ts. The first frame
      // loads the library's module graph unbundled, which takes a few seconds in Firefox.
      await expect(frame.locator('odd-button')).toHaveText('Save', { timeout: 20_000 });
      // Frames load the theme: the button's control is styled by tokens, not the UA default.
      await expect
        .poll(
          () =>
            frame
              .locator('odd-button')
              .evaluate((el) => getComputedStyle(el.ownerDocument.body).backgroundColor),
          { timeout: 20_000 },
        )
        .not.toBe('rgba(0, 0, 0, 0)');
      // The frame is the canvas: the component sits in its middle (Figma 33:6755).
      const offset = await frame.locator('odd-button').evaluate((el) => {
        const box = el.getBoundingClientRect();
        const view = el.ownerDocument.documentElement;
        return [
          Math.round(box.left + box.width / 2 - view.clientWidth / 2),
          Math.round(box.top + box.height / 2 - view.clientHeight / 2),
        ];
      });
      expect(offset.map((value) => Math.abs(value) <= 1)).toEqual([true, true]);

      await page
        .locator('tr[data-row="property:odd-button#appearance"]')
        .getByRole('combobox', { name: 'appearance (attribute)' })
        .selectOption('primary');
      await expect(frame.locator('odd-button')).toHaveAttribute('appearance', 'primary');
      // The shell is not restyled by the preview: no odd-button is registered in the shell.
      expect(await page.evaluate(() => customElements.get('odd-button') === undefined)).toBe(true);

      await page.getByLabel('Preset').selectOption('primary');
      await expect(frame.locator('odd-button')).toHaveText('Continue');
      await expect(page.locator('.wb-snippet')).toContainText(
        "import '@oddkin/components/define/button';",
      );
      await expect(page.locator('.wb-snippet')).toContainText('element.appearance = "primary";');

      await page.getByLabel('Light and dark side by side').check();
      const frames = page.locator('oddkin-workbench-component iframe');
      await expect(frames).toHaveCount(2);
      // Two new frame documents load the module graph again: seconds in WebKit and Firefox when
      // the machine is busy (2026-10-28), so these waits get the first load's allowance.
      await expect
        .poll(
          () =>
            frames.evaluateAll((list) =>
              list.map(
                (f) => (f as HTMLIFrameElement).contentDocument?.documentElement.dataset['oddMode'],
              ),
            ),
          { timeout: 20_000 },
        )
        .toEqual(['light', 'dark']);
      await expect(
        page.frameLocator('oddkin-workbench-component iframe').nth(1).locator('odd-button'),
      ).toHaveText('Continue', { timeout: 20_000 });
      const backgrounds = await frames.evaluateAll((list) =>
        list.map(
          (f) => getComputedStyle((f as HTMLIFrameElement).contentDocument!.body).backgroundColor,
        ),
      );
      expect(backgrounds[0]).not.toBe(backgrounds[1]);
      // The shell's own mode is unchanged by preview settings.
      expect(await page.evaluate(() => document.documentElement.dataset['oddMode'])).toBe('system');
      expect(errors).toEqual([]);
    });

    test('logs declared events and mirrors a declared sync pair', async ({ page }) => {
      await open(page, 'components/odd-input', 'Input');
      const frame = page.frameLocator('oddkin-workbench-component iframe').first();
      const field = frame.locator('odd-input input');
      await field.fill('hello', { timeout: 20_000 });
      await expect(page.locator('.wb-log li').first()).toContainText('input');
      await expect(
        page.locator('tr[data-row="property:odd-input#value"] input[type="text"]'),
      ).toHaveValue('hello');
    });

    test('applies edits made while the preview loads, and follows typing', async ({ page }) => {
      // The owner's report (2026-10-28): an edit made before the first preview had loaded its
      // module graph was lost. The button's registration is held back 2 s to make that window.
      await page.route('**/define/button.js', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 2_000));
        await route.continue();
      });
      await open(page, 'components/odd-button', 'Button');
      await page
        .locator('tr[data-row="property:odd-button#appearance"]')
        .getByRole('combobox', { name: 'appearance (attribute)' })
        .selectOption('primary');
      await page
        .locator('tr[data-row="property:odd-button#size"]')
        .getByRole('combobox', { name: 'size (attribute)' })
        .selectOption('sm');
      const button = page
        .frameLocator('oddkin-workbench-component iframe')
        .first()
        .locator('odd-button');
      await expect(button).toHaveAttribute('appearance', 'primary', { timeout: 20_000 });
      await expect(button).toHaveAttribute('size', 'sm');
      // Typing updates the preview without leaving the field.
      await page.locator('tr[data-slot=""] input').fill('Publish');
      await expect(button).toHaveText('Publish');
      await expect(page.locator('#interactive-example .wb-status')).toBeEmpty();
    });

    test('runs the fixture of an example that needs one, such as the tabs', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await open(page, 'components/odd-tabs', 'Tabs');
      const frame = page.frameLocator('oddkin-workbench-component iframe').first();
      // The tabs' examples build their tabs and panels in a fixture: the preview shows them.
      await expect(frame.getByRole('tab')).toHaveText(['Overview', 'Activity', 'Settings'], {
        timeout: 20_000,
      });
      await expect(
        frame.getByText('This panel belongs to the selected Overview tab.'),
      ).toBeVisible();
      await expect(page.locator('#interactive-example .wb-status')).toBeEmpty();
      expect(errors).toEqual([]);
    });

    test('restyles the preview through its declared CSS custom properties', async ({ page }) => {
      await open(page, 'components/odd-button', 'Button');
      const button = page
        .frameLocator('oddkin-workbench-component iframe')
        .first()
        .locator('odd-button');
      await expect(button).toHaveText('Save', { timeout: 20_000 });
      const row = page.locator('tr[data-css="--odd-button-background"]');
      await row.getByRole('textbox').fill('rgb(1, 2, 3)');
      const background = () =>
        button.evaluate(
          (el) => getComputedStyle(el.shadowRoot!.querySelector('button')!).backgroundColor,
        );
      await expect.poll(background, { timeout: 10_000 }).toBe('rgb(1, 2, 3)');
      await expect(page.locator('.wb-snippet')).toContainText(
        'element.style.setProperty("--odd-button-background", "rgb(1, 2, 3)");',
      );
      await row.getByRole('button', { name: 'Unset' }).click();
      await expect.poll(background, { timeout: 10_000 }).not.toBe('rgb(1, 2, 3)');
      await expect(page.locator('#interactive-example .wb-status')).toBeEmpty();
    });
  });

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
    const server = await startDevServer({ config: dir, port: 0, host: '127.0.0.1' });
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

  /** The Acme project with a published registration entry for its button. */
  function acmeWithRegistration() {
    const dir = acmeProject();
    const file = join(dir, 'node_modules', '@acme', 'ui', 'oddkin.metadata.json');
    const metadata = JSON.parse(readFileSync(file, 'utf8')) as {
      components: Record<string, Record<string, unknown>>;
    };
    metadata.components['component:acme-button']!['registration'] = '@acme/ui/define/button';
    writeFileSync(file, JSON.stringify(metadata));
    return { dir, metadata, file };
  }

  test('refreshes a page whose data changed in place, and reloads for a changed shell', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const { dir, metadata, file } = acmeWithRegistration();
    const server = await startDevServer({ config: dir, port: 0, host: '127.0.0.1' });
    try {
      await page.goto(new URL('components/acme-button', server.url).href);
      await expect(page.locator('main h1')).toHaveText('Button');
      await expect(page.locator('#known-limitations')).toContainText('None documented.');
      await page.evaluate(() => ((window as unknown as { marker: number }).marker = 1));

      // Only this page's data changes: the page refreshes without a document reload.
      metadata.components['component:acme-button']!['limitations'] = [
        { value: 'Edited limitation.', provenance: 'authored' },
      ];
      writeFileSync(file, JSON.stringify(metadata));
      await expect(page.locator('#known-limitations')).toContainText('Edited limitation.');
      expect(await page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(1);

      // The shell page changes (its title comes from branding): the document reloads. Wait for
      // that load: an evaluate racing the reload throws instead of being retried (WebKit, CI #6).
      const reloaded = page.waitForEvent('load', { timeout: 20_000 });
      const config = join(dir, 'oddkin.config.ts');
      writeFileSync(
        config,
        readFileSync(config, 'utf8').replace("name: 'Acme UI'", "name: 'Acme Renamed'"),
      );
      await reloaded;
      expect(
        await page.evaluate(() => (window as unknown as { marker?: number }).marker),
      ).toBeUndefined();
      await expect(page.locator('main h1')).toHaveText('Button');
      await expect(page).toHaveTitle('Button · Acme Renamed');
    } finally {
      await server.close();
      removeProject(dir);
    }
  });

  test('replaces the preview frame when component code changes', async ({ page }) => {
    test.setTimeout(90_000);
    const { dir } = acmeWithRegistration();
    const server = await startDevServer({ config: dir, port: 0, host: '127.0.0.1' });
    try {
      await page.goto(new URL('components/acme-button', server.url).href);
      const frame = page.frameLocator('oddkin-workbench-component iframe').first();
      await expect(frame.locator('acme-button')).toHaveText('★', { timeout: 20_000 });
      const src = await page.locator('oddkin-workbench-component iframe').getAttribute('src');
      expect(src).toContain('generation=1');
      await page.evaluate(() => ((window as unknown as { marker: number }).marker = 1));

      // A dependency's module changed: a fresh frame document loads the new code.
      writeFileSync(
        join(dir, 'node_modules', '@acme', 'icons', 'index.js'),
        "export const icon = '◆';\n",
      );
      await expect(page.locator('oddkin-workbench-component iframe')).toHaveAttribute(
        'src',
        /generation=2/,
      );
      await expect(frame.locator('acme-button')).toHaveText('◆', { timeout: 20_000 });
      expect(await page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(1);
    } finally {
      await server.close();
      removeProject(dir);
    }
  });
});
