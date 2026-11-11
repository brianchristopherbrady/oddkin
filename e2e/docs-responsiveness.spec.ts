import { execFileSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve, sep } from 'node:path';
import type { ComponentPageData, WorkbenchIndex } from '@oddkin/workbench/data';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const docs = process.env['ODDKIN_DOCS_TEST_URL'] ?? 'http://127.0.0.1:4177';
const route = '/foundations/responsive';
// A cold frame imports the actual published component and its authored example graph.
const previewLoad = 60_000;

const canvas = (page: Page) => page.frameLocator('#behavior-lab-frame');

async function ready(page: Page): Promise<void> {
  await expect(page.locator('#behavior-lab-status')).toHaveAttribute('data-state', 'ready', {
    timeout: previewLoad,
  });
}

async function openLab(page: Page, site = docs): Promise<void> {
  await page.goto(`${site}${route}`);
  await expect(page.locator('#main h1')).toHaveText('Responsiveness');
  await expect(page.locator('#behavior-component')).toBeEnabled({ timeout: previewLoad });
  await ready(page);
}

async function selectExample(page: Page, tag: string, example = 'default'): Promise<void> {
  await page.locator('#behavior-component').selectOption(tag);
  await ready(page);
  await expect(page.locator(`#behavior-example option[value="${example}"]`)).toBeAttached({
    timeout: previewLoad,
  });
  await page.locator('#behavior-example').selectOption(example);
  await ready(page);
  await expect(canvas(page).locator(tag)).toBeAttached({ timeout: previewLoad });
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function validExamples(page: ComponentPageData): string[] {
  return page.examples.flatMap((example) => {
    const definition = example['definition'];
    return typeof example['name'] === 'string' &&
      record(definition) &&
      !record(example['incorrect']) &&
      !record(definition['incorrect'])
      ? [example['name']]
      : [];
  });
}

/** The source of truth is this build's catalog, not a copied component or variant count. */
async function catalog(request: APIRequestContext, site = docs): Promise<ComponentPageData[]> {
  const indexResponse = await request.get(`${site}/_oddkin/index.json`);
  expect(indexResponse.ok()).toBe(true);
  const index = (await indexResponse.json()) as WorkbenchIndex;
  const pages = await Promise.all(
    index.registry.pages
      .filter((page) => page.kind === 'component' && page.visible)
      .map(async (page) => {
        const file = index.pages[page.id];
        expect(file, `${page.id} has published page data`).toBeTruthy();
        const response = await request.get(`${site}/_oddkin/${file}`);
        expect(response.ok(), `${page.id} can load its published page data`).toBe(true);
        return (await response.json()) as ComponentPageData;
      }),
  );
  return pages;
}

async function expectCapacity(page: Page): Promise<void> {
  const allocation = await canvas(page)
    .locator('#behavior-allocation')
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        capacity:
          element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
        name: style.containerName,
        type: style.containerType,
      };
    });
  expect(allocation.name.split(/\s+/)).toContain('odd-container');
  expect(allocation.type).toContain('inline-size');
  await expect
    .poll(async () => {
      const actual = await canvas(page)
        .locator('#behavior-allocation')
        .evaluate((element) => {
          const style = getComputedStyle(element);
          return (
            element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
          );
        });
      return Math.abs(
        Number(await page.locator('#behavior-lab-metrics').getAttribute('data-capacity')) - actual,
      );
    })
    .toBeLessThanOrEqual(1);
  expect(allocation.capacity).toBeGreaterThan(0);
}

interface PolicyViolation {
  readonly directive: string;
  readonly target: string;
}

/** Watch both the host and its same-origin example frame. */
async function watchPolicy(page: Page, browserName: string): Promise<() => PolicyViolation[]> {
  const violations: PolicyViolation[] = [];
  await page.exposeBinding('__docsResponsivePolicy', (_source, violation: PolicyViolation) => {
    // The docs suite already records WebKit's native-select style-src-attr reports. Keep this
    // exception specific to those targets, rather than hiding arbitrary inline-style failures.
    if (
      browserName === 'webkit' &&
      violation.directive === 'style-src-attr' &&
      /^(select|#document)$/.test(violation.target)
    )
      return;
    violations.push(violation);
  });
  await page.addInitScript(() => {
    document.addEventListener(
      'securitypolicyviolation',
      (event) => {
        const target = event.target as Element | Document | null;
        const report = (
          window as unknown as {
            __docsResponsivePolicy: (violation: { directive: string; target: string }) => void;
          }
        ).__docsResponsivePolicy;
        report({
          directive: event.violatedDirective,
          target: target instanceof Element ? target.localName : (target?.nodeName ?? ''),
        });
      },
      true,
    );
  });
  return () => violations;
}

/** Ordinary folder-index hosting, with no development-server route fallback. */
function pagesHost(dir: string): Server {
  const types: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
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

test.describe('docs responsiveness', () => {
  test.describe.configure({ timeout: 90_000 });

  test('keeps the guidance readable before the interactive lab starts', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
      const page = await context.newPage();
      const response = await page.goto(`${docs}${route}`);
      expect(response?.status()).toBe(200);
      expect(response?.headers()['content-security-policy']).toContain("default-src 'none'");
      await expect(page.locator('#main h1')).toHaveText('Responsiveness');
      await expect(page.locator('#behavior-lab')).toContainText('requires JavaScript');
      await expect(
        page.getByRole('heading', { name: 'Define the composition contract' }),
      ).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Preserve active work' })).toBeVisible();
      await expect(page.locator('#behavior-lab iframe')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('derives component and correct-example choices from the current published catalog', async ({
    page,
    request,
  }) => {
    const published = await catalog(request);
    await openLab(page);
    const componentTags = await page.locator('#behavior-component option').evaluateAll((options) =>
      options
        .map((option) => (option as HTMLOptionElement).value)
        .filter((value) => value.startsWith('odd-'))
        .sort(),
    );
    expect(componentTags).toEqual(published.map((component) => component.tag).sort());
    expect(new Set(componentTags).size).toBe(componentTags.length);

    await selectExample(page, 'odd-textarea', 'inForm');
    const textarea = published.find((component) => component.tag === 'odd-textarea');
    expect(textarea).toBeDefined();
    const names = await page
      .locator('#behavior-example option')
      .evaluateAll((options) =>
        options.map((option) => (option as HTMLOptionElement).value).sort(),
      );
    expect(names).toEqual(validExamples(textarea!).sort());
    await expect(
      canvas(page).getByRole('textbox', { name: 'Feedback', exact: true }),
    ).toBeVisible();
    await expect(canvas(page).getByRole('button', { name: 'Send', exact: true })).toBeVisible();
  });

  test('reports missing fixture setup as unavailable and recovers on another authored example', async ({
    page,
    request,
  }) => {
    const textarea = (await catalog(request)).find((component) => component.tag === 'odd-textarea');
    expect(textarea?.exampleModule).toBeTruthy();
    const fixtureUrl = new URL(textarea!.exampleModule!, docs).href;
    await page.route(fixtureUrl, (request) => request.abort('failed'));
    await openLab(page);
    await selectExample(page, 'odd-textarea');
    await page.locator('#behavior-example').selectOption('inForm');
    const status = page.locator('#behavior-lab-status');
    await expect(status).toHaveAttribute('data-state', 'error', { timeout: previewLoad });
    // A fixture failure is a frame notification, not a rejected mount request. Check after the
    // same settling boundary the UI uses, so a later mount acknowledgement cannot mask it.
    await canvas(page)
      .locator('body')
      .evaluate(async () => {
        const controller = (
          window as unknown as {
            oddkinBehaviorCanvas?: { settle(): Promise<unknown> };
          }
        ).oddkinBehaviorCanvas;
        if (!controller) throw new Error('The docs behavior canvas did not initialize.');
        await controller.settle();
      });
    await expect(status).toHaveAttribute('data-state', 'error');
    await expect(status).toContainText('Example unavailable');
    await expect(canvas(page).getByRole('button', { name: 'Send', exact: true })).toHaveCount(0);
    await page.locator('#behavior-example').selectOption('default');
    await ready(page);
    await expect(
      canvas(page).getByRole('textbox', { name: 'Project description', exact: true }),
    ).toBeVisible();
    await page.unroute(fixtureUrl);
  });

  test('reveals and focuses the current source from a fresh isolated citation example', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    // A new page and preview realm start directly on this public example. The test imports no
    // component definitions and does not visit a composition that could register its siblings.
    await page.goto(`${docs}${route}?component=odd-citation`);
    await expect(page.locator('#main h1')).toHaveText('Responsiveness');
    await ready(page);
    await expect(page.locator('#behavior-component')).toHaveValue('odd-citation');
    await expect(page.locator('#behavior-example')).toHaveValue('default');
    const preview = canvas(page);
    const citation = preview.locator('#behavior-preview odd-citation');
    const sources = preview.locator('#behavior-preview odd-sources');
    await expect(citation).toHaveJSProperty('presentation', 'popover');
    await expect(sources).toBeVisible();
    expect(
      await sources.evaluate((element) => {
        const definition = customElements.get('odd-sources');
        return definition !== undefined && element.constructor === definition;
      }),
    ).toBe(true);
    const identity = await citation.evaluate((element) => ({
      sourceId: String(Reflect.get(element, 'sourceId') ?? ''),
      title: String(
        (Reflect.get(element, 'source') as { title?: string } | undefined)?.title ?? '',
      ),
    }));
    expect(identity.sourceId).toBeTruthy();
    expect(identity.title).toBeTruthy();
    const row = sources.locator('[part="item"]').filter({ hasText: identity.title });
    await expect(row).toHaveAttribute('data-source-id', identity.sourceId);
    await expect(row).toHaveAttribute('data-revealed', 'false');
    const marker = citation.locator('[part="trigger"]');
    await marker.click();
    await expect(marker).toHaveAttribute('aria-expanded', 'true');
    await citation.getByRole('button', { name: 'Show in sources', exact: true }).click();
    await expect(row).toHaveAttribute('data-revealed', 'true');
    await expect(marker).toHaveAttribute('aria-expanded', 'false');
    await expect(row).toBeFocused();
    expect(errors).toEqual([]);
  });

  test('keeps the latest working selection when an earlier metadata request fails late', async ({
    page,
    request,
  }) => {
    const indexResponse = await request.get(`${docs}/_oddkin/index.json`);
    expect(indexResponse.ok()).toBe(true);
    const index = (await indexResponse.json()) as WorkbenchIndex;
    const file = index.pages['components/odd-checkbox'];
    expect(file).toBeTruthy();
    const delayedUrl = new URL(`/_oddkin/${file}`, docs).href;
    let metadataHeld = false;
    let releaseMetadata!: () => void;
    let finishMetadata!: () => void;
    const held = new Promise<void>((resolve) => (releaseMetadata = resolve));
    const finished = new Promise<void>((resolve) => (finishMetadata = resolve));
    await page.route(delayedUrl, async (request) => {
      metadataHeld = true;
      await held;
      try {
        await request.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'The earlier example is temporarily unavailable.' }),
        });
      } finally {
        finishMetadata();
      }
    });
    try {
      await openLab(page);
      await page.locator('#behavior-component').selectOption('odd-checkbox');
      await expect.poll(() => metadataHeld).toBe(true);
      await expect(page.locator('#behavior-example')).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Reset example', exact: true })).toBeDisabled();
      await expect(page.locator('#behavior-component')).toBeEnabled();
      await selectExample(page, 'odd-textarea');
      await expect(page.locator('#behavior-example')).toBeEnabled();
      await expect(page.getByRole('button', { name: 'Reset example', exact: true })).toBeEnabled();
      const field = canvas(page).getByRole('textbox', { name: 'Project description', exact: true });
      await field.fill('Keep the newer selection and its unfinished draft.');
      await field.evaluate((element) => (element as HTMLTextAreaElement).setSelectionRange(5, 14));
      const originalField = await field.elementHandle();
      releaseMetadata();
      await finished;
      // Let the delivered response and its promise reactions cross a normal render boundary.
      // This observes the actual UI; it does not replace the host's error or mount machinery.
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            let first = 0;
            let second = 0;
            const done = () => {
              clearTimeout(timer);
              cancelAnimationFrame(first);
              cancelAnimationFrame(second);
              resolve();
            };
            const timer = setTimeout(done, 120);
            first = requestAnimationFrame(() => {
              second = requestAnimationFrame(done);
            });
          }),
      );
      await expect(page.locator('#behavior-component')).toHaveValue('odd-textarea');
      await expect(page.locator('#behavior-lab-status')).toHaveAttribute('data-state', 'ready');
      await expect(field).toHaveValue('Keep the newer selection and its unfinished draft.');
      await expect(field).toBeFocused();
      expect(await field.evaluate((current, previous) => current === previous, originalField)).toBe(
        true,
      );
      expect(
        await field.evaluate((element) => ({
          start: (element as HTMLTextAreaElement).selectionStart,
          end: (element as HTMLTextAreaElement).selectionEnd,
        })),
      ).toEqual({ start: 5, end: 14 });
    } finally {
      releaseMetadata();
      await page.unroute(delayedUrl);
    }
  });

  test('keeps a real form draft and neighboring work mounted as its allocation changes', async ({
    page,
  }) => {
    await openLab(page);
    await selectExample(page, 'odd-textarea', 'inForm');
    const preview = canvas(page);
    const field = preview.getByRole('textbox', { name: 'Feedback', exact: true });
    const note = preview.getByRole('textbox', { name: 'Neighboring draft', exact: true });
    const draft = 'Keep the review draft while the available space changes.';
    await field.fill(draft);
    await note.fill('A neighboring task also keeps its draft.');
    const originalField = await field.elementHandle();
    const originalNote = await note.elementHandle();

    await page.locator('#behavior-density').selectOption('compact');
    await expect(preview.locator('#behavior-preview')).toHaveAttribute(
      'data-odd-density',
      'compact',
    );
    await page.locator('#behavior-purpose').selectOption('bounded');
    await expect(preview.locator('#behavior-allocation')).toHaveAttribute(
      'data-purpose',
      'bounded',
    );
    await page.locator('#behavior-mode').selectOption('dark');
    await expect(preview.locator('#behavior-preview')).toHaveAttribute('data-odd-mode', 'dark');
    await page.locator('#behavior-direction').selectOption('rtl');
    await expect(preview.locator('#behavior-preview')).toHaveAttribute('dir', 'rtl');
    await page.locator('#behavior-width').focus();
    await page.keyboard.press('Home');
    await expect(page.locator('#behavior-width')).toHaveValue('240');
    await ready(page);
    await expectCapacity(page);
    await expect(field).toHaveValue(draft);
    await expect(note).toHaveValue('A neighboring task also keeps its draft.');
    expect(await field.evaluate((current, previous) => current === previous, originalField)).toBe(
      true,
    );
    expect(await note.evaluate((current, previous) => current === previous, originalNote)).toBe(
      true,
    );

    await field.focus();
    await field.evaluate((element) => (element as HTMLTextAreaElement).setSelectionRange(5, 17));
    await page.setViewportSize({ width: 320, height: 900 });
    await expectCapacity(page);
    await expect(field).toBeFocused();
    expect(
      await field.evaluate((element) => ({
        start: (element as HTMLTextAreaElement).selectionStart,
        end: (element as HTMLTextAreaElement).selectionEnd,
      })),
    ).toEqual({ start: 5, end: 17 });
    expect(await field.evaluate((current, previous) => current === previous, originalField)).toBe(
      true,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);

    // This is the authored form's actual submit handler, rather than a synthetic success flag.
    await preview.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(preview.locator('output[name="submitted"]')).toHaveText(
      new URLSearchParams({ feedback: draft }).toString(),
    );
    await page.locator('#behavior-purpose').selectOption('flow');
    await expect(preview.locator('#behavior-allocation')).toHaveAttribute('data-purpose', 'flow');
    await expect(field).toHaveValue(draft);
    await page.getByRole('button', { name: 'Reset example', exact: true }).click();
    await ready(page);
    await expect(field).toHaveValue('');
    await expect(preview.locator('output[name="submitted"]')).toHaveText('');
    await expect(note).toHaveValue('A neighboring task also keeps its draft.');
  });

  test('keeps a composed question draft across disclosure changes and waits for its host outcome', async ({
    page,
  }) => {
    await openLab(page);
    await page.locator('#behavior-component').selectOption('scenario:review-in-disclosure');
    await ready(page);
    await expect(page.locator('#behavior-example')).toBeDisabled();
    const preview = canvas(page);
    const disclosure = preview.locator('odd-disclosure').locator('[part="summary"]');
    await expect(disclosure).toHaveJSProperty('tagName', 'SUMMARY');
    await expect(disclosure).toHaveText('Review details');
    const question = preview.locator('odd-question');
    const title = question.getByRole('textbox', { name: 'Title', exact: true });
    const draft = 'Release review with the design team';
    await title.fill(draft);
    const originalField = await title.elementHandle();
    await disclosure.click();
    await expect(title).toBeHidden();
    expect(await originalField!.evaluate((element) => element.isConnected)).toBe(true);
    await disclosure.click();
    await expect(title).toHaveValue(draft);
    expect(await title.evaluate((current, previous) => current === previous, originalField)).toBe(
      true,
    );
    await page.locator('#behavior-purpose').selectOption('bounded');
    await expect(preview.locator('#behavior-allocation')).toHaveAttribute(
      'data-purpose',
      'bounded',
    );
    await expectCapacity(page);
    await expect(page.locator('#behavior-lab-metrics')).toHaveAttribute('data-shift', '0');
    await question.evaluate((element) => {
      element.addEventListener(
        'odd-question-answer',
        (event) => {
          element.setAttribute(
            'data-observed-answer',
            JSON.stringify((event as CustomEvent<unknown>).detail),
          );
        },
        { once: true },
      );
    });
    await question.getByRole('button', { name: 'Answer', exact: true }).click();
    await expect(question).toHaveAttribute('data-observed-answer', /questionId/);
    const intent = JSON.parse((await question.getAttribute('data-observed-answer'))!);
    expect(intent).toMatchObject({ questionId: 'q2', revision: 1 });
    expect(JSON.stringify(intent)).toContain(draft);
    await expect
      .poll(() =>
        question.evaluate(
          (element) =>
            (element as HTMLElement & { question?: { status: string } }).question?.status,
        ),
      )
      .toBe('answered');
    await expect(page.locator('#behavior-lab-metrics')).toHaveAttribute('data-shift', '0');
  });

  test('opens a modal only on its action and preserves its active field through resizing', async ({
    page,
  }) => {
    await openLab(page);
    await selectExample(page, 'odd-dialog');
    const preview = canvas(page);
    const dialog = preview.getByRole('dialog', { name: 'Rename workspace', exact: true });
    const opener = preview.getByRole('button', { name: 'Rename', exact: true });
    await expect(dialog).toBeHidden();
    await page.setViewportSize({ width: 320, height: 900 });
    await expect(dialog).toBeHidden();
    // Keyboard activation owns a clear focus-return target in every supported engine.
    await opener.focus();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    const field = preview.getByRole('textbox', { name: 'Workspace name', exact: true });
    await field.fill('Field notes for the release');
    await field.evaluate((element) => (element as HTMLInputElement).setSelectionRange(6, 11));
    const originalField = await field.elementHandle();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(dialog).toBeVisible();
    await expect(field).toBeFocused();
    expect(await field.evaluate((current, previous) => current === previous, originalField)).toBe(
      true,
    );
    expect(
      await field.evaluate((element) => ({
        start: (element as HTMLInputElement).selectionStart,
        end: (element as HTMLInputElement).selectionEnd,
      })),
    ).toEqual({ start: 6, end: 11 });
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(field).toHaveValue('Field notes for the release');
    expect(await field.evaluate((current, previous) => current === previous, originalField)).toBe(
      true,
    );
    await preview.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(preview.locator('odd-dialog')).toHaveJSProperty('returnValue', 'save');
  });

  test('disposes the preview when the docs router replaces the authored page', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await openLab(page);
    const liveFrames = () =>
      page.evaluate(async () => {
        const { previewProtocolStats } = await import('@oddkin/workbench/preview');
        return previewProtocolStats().liveFrames;
      });
    const mountedFrames = await liveFrames();
    expect(mountedFrames).toBeGreaterThan(0);
    const baseline = mountedFrames - 1;
    const originalDocument = await page.evaluateHandle(() => window.document);
    const frame = await page.locator('#behavior-lab-frame').elementHandle();
    // The existing search command uses the docs router. The destination has no live previews,
    // so its own work cannot conceal a leaked frame from this page.
    await page.getByRole('link', { name: 'Search docs', exact: true }).click();
    const search = page.getByRole('dialog', { name: 'Search docs', exact: true });
    await search.getByRole('combobox').fill('scope ownership');
    await search.getByRole('option', { name: 'Case study: scope ownership', exact: true }).click();
    await expect(page.locator('#main h1')).toHaveText('Scope ownership for navigation', {
      timeout: previewLoad,
    });
    expect(await page.evaluate((previous) => window.document === previous, originalDocument)).toBe(
      true,
    );
    expect(await frame!.evaluate((element) => element.isConnected)).toBe(false);
    await expect(page.locator('#behavior-lab')).toHaveCount(0);
    await expect.poll(liveFrames).toBe(baseline);
    await page.goBack();
    await ready(page);
    await expect(page.locator('#behavior-lab-frame')).toHaveCount(1);
    expect(errors).toEqual([]);
  });
});

test.describe('static docs responsiveness', () => {
  test.describe.configure({ mode: 'default', timeout: 90_000 });
  let server: Server | undefined;
  let site = '';

  test.beforeAll(async ({}, testInfo) => {
    testInfo.setTimeout(180_000);
    const dir = resolve(`.oddkin/docs-responsive-e2e-${testInfo.project.name}`);
    execFileSync(process.execPath, ['apps/docs/build.mjs', '--out', dir], { stdio: 'pipe' });
    server = pagesHost(dir);
    await new Promise<void>((done) => server!.listen(0, '127.0.0.1', done));
    site = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  test.afterAll(() => new Promise<void>((done) => (server ? server.close(() => done()) : done())));

  test('loads the folder-index route, real fixture and isolated frame under the static policy', async ({
    page,
    browserName,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const violations = await watchPolicy(page, browserName);
    await openLab(page, site);
    expect(new URL(page.url()).pathname).toBe(`${route}/`);
    await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute(
      'content',
      /default-src 'none'/,
    );
    await selectExample(page, 'odd-textarea', 'inForm');
    const preview = canvas(page);
    await expect(preview.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute(
      'content',
      /default-src 'none'/,
    );
    await preview.getByRole('textbox', { name: 'Feedback', exact: true }).fill('Static site draft');
    await preview.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(preview.locator('output[name="submitted"]')).toHaveText(
      'feedback=Static+site+draft',
    );
    await page.locator('#behavior-purpose').selectOption('bounded');
    await ready(page);
    await expectCapacity(page);
    await page.reload();
    await ready(page);
    await expect(page.locator('#behavior-lab-frame')).toHaveCount(1);
    expect(violations()).toEqual([]);
    expect(errors).toEqual([]);
  });
});
