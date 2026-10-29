import { join } from 'node:path';
import { build } from 'esbuild';
import { expect, test, type Frame, type Page } from '@playwright/test';

// Two realms on one page (core-contracts.md §5.1): the document and a same-origin frame, each with
// its own copy of @oddkin/core and its own custom element registry (tests/realms/). The bundles
// are built in memory and served by request interception.
const fixture = 'tests/realms';
let bundles: Record<string, string>;

test.beforeAll(async () => {
  bundles = {};
  for (const name of ['parent', 'frame']) {
    const result = await build({
      entryPoints: [join(fixture, `${name}.js`)],
      bundle: true,
      write: false,
      format: 'esm',
      target: 'es2022',
      platform: 'browser',
      conditions: ['development'],
      logLevel: 'warning',
    });
    bundles[name] = result.outputFiles[0]!.text;
  }
});

interface Realm {
  core: {
    OddkinElement: new () => HTMLElement;
    OddkinError: new (...args: never[]) => Error;
    define(name: string, element: CustomElementConstructor): void;
  };
}
type PageRealm = typeof globalThis & { parentRealm: Realm & { count: { value: number } } };
type FrameRealm = typeof globalThis & { frameRealm: Realm & { reported: string[] } };
type Field = HTMLElement & { value: string };

async function open(page: Page): Promise<{ frame: Frame; errors: string[] }> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route(`**/${fixture}/*.bundle.js`, (route) => {
    const name = /\/(\w+)\.bundle\.js$/.exec(route.request().url())?.[1] ?? '';
    return route.fulfill({ contentType: 'text/javascript', body: bundles[name] ?? '' });
  });
  await page.goto(`/${fixture}/`);
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await expect(page.frameLocator('#frame').locator('body')).toHaveAttribute('data-ready', 'true');
  const frame = page.frame({ url: /frame\.html$/ });
  if (!frame) throw new Error('no frame');
  return { frame, errors };
}

/** Styles the input's shadow root applies to its control, to compare across documents. */
const controlStyle = (page: Page) =>
  page.evaluate(() => {
    const el = (document.querySelector('#moving') ??
      document.querySelector('iframe')?.contentDocument?.querySelector('#moving')) as Field;
    const view = el.ownerDocument.defaultView!;
    const style = view.getComputedStyle(el.shadowRoot!.querySelector('input')!);
    return [style.borderTopLeftRadius, style.paddingLeft, style.fontSize, style.minHeight];
  });

test('each realm has its own registry and its own copy of core', async ({ page }) => {
  const { errors } = await open(page);
  const realms = await page.evaluate(() => {
    const view = document.querySelector('iframe')!.contentWindow as unknown as FrameRealm;
    return {
      bothDefineTheButton: Boolean(
        view.customElements.get('odd-button') && customElements.get('odd-button'),
      ),
      ownButton: view.customElements.get('odd-button') !== customElements.get('odd-button'),
      inputOnlyHere:
        Boolean(customElements.get('odd-input')) && !view.customElements.get('odd-input'),
      ownCore: view.frameRealm.core !== (globalThis as PageRealm).parentRealm.core,
    };
  });
  expect(realms).toEqual({
    bothDefineTheButton: true,
    ownButton: true,
    inputOnlyHere: true,
    ownCore: true,
  });
  expect(errors).toEqual([]);
});

test('an element moved into the frame keeps its class, styles, events, and form association', async ({
  page,
}) => {
  const { frame, errors } = await open(page);
  const before = await controlStyle(page);
  const moved = await page.evaluate(() => {
    const el = document.querySelector('#moving') as Field;
    const frameDocument = document.querySelector('iframe')!.contentDocument!;
    const heard: string[] = [];
    el.addEventListener('input', () => heard.push(el.value));
    Object.assign(globalThis, { heard });
    frameDocument.querySelector('#frame-form')!.append(el);
    return {
      inFrame: el.ownerDocument === frameDocument,
      sameClass: el instanceof customElements.get('odd-input')!,
    };
  });
  expect(moved).toEqual({ inFrame: true, sameClass: true });
  // Constructed sheets belong to one document: the element adopts its styles again there.
  expect(await controlStyle(page)).toEqual(before);
  // Its validity and value take part in the frame's form.
  expect(await frame.evaluate(() => document.querySelector('form')!.checkValidity())).toBe(false);
  await page.frameLocator('#frame').getByLabel('Email').fill('ada@example.com');
  expect(
    await frame.evaluate(() => {
      const form = document.querySelector('form')!;
      return [form.checkValidity(), new FormData(form).get('email')];
    }),
  ).toEqual([true, 'ada@example.com']);
  expect(await page.evaluate(() => (globalThis as { heard?: string[] }).heard?.at(-1))).toBe(
    'ada@example.com',
  );

  // And back: the page's form has it again, with its value and styles.
  const back = await page.evaluate(() => {
    const form = document.querySelector('#parent-form') as HTMLFormElement;
    const frameDocument = document.querySelector('iframe')!.contentDocument!;
    form.append(frameDocument.querySelector('#moving')!);
    return new FormData(form).get('email');
  });
  expect(back).toBe('ada@example.com');
  expect(await controlStyle(page)).toEqual(before);
  expect(errors).toEqual([]);
});

test("the page realm's readable is reported in the frame's template and followed when bridged", async ({
  page,
}) => {
  const { frame, errors } = await open(page);
  const mirror = page.frameLocator('#frame').locator('f-mirror');
  await expect(mirror.locator('output.direct')).toHaveText('1');
  await expect(mirror.locator('output.bridged')).toHaveText('1');
  await page.evaluate(() => {
    (globalThis as PageRealm).parentRealm.count.value = 5;
  });
  await expect(mirror.locator('output.bridged')).toHaveText('5');
  // Bound as is, it keeps its first value; the frame's development build says so once.
  await expect(mirror.locator('output.direct')).toHaveText('1');
  expect(await frame.evaluate(() => (globalThis as FrameRealm).frameRealm.reported)).toEqual([
    'reactive.readable.foreign',
  ]);
  expect(errors).toEqual([]);
});

test('errors cross realms by code', async ({ page }) => {
  await open(page);
  const collision = await page.evaluate(() => {
    const { core } = (globalThis as PageRealm).parentRealm;
    const view = document.querySelector('iframe')!.contentWindow as unknown as FrameRealm;
    let error: unknown;
    try {
      core.define('odd-button', class extends core.OddkinElement {});
    } catch (caught) {
      error = caught;
    }
    return {
      code: (error as { code?: string } | undefined)?.code,
      here: error instanceof core.OddkinError,
      there: error instanceof view.frameRealm.core.OddkinError,
    };
  });
  expect(collision).toEqual({ code: 'registry.collision', here: true, there: false });
});
