import { expect, test, type Page } from '@playwright/test';
import { bundleConsumers } from '../examples/duplicate-core/build.mjs';

// Two independently built consumers on one page, each bundling its own copy of @oddkin/core
// (core-contracts.md §5.1). The bundles are built in memory and served by request interception.
let bundles: { a: string; b: string };

test.beforeAll(async () => {
  bundles = await bundleConsumers();
});

interface Copy {
  core: {
    signal: unknown;
    OddkinElement: unknown;
    OddkinError: new (...args: never[]) => Error;
    effect(fn: () => void): () => void;
    fromExternal(source: unknown): { readonly value: number };
    toExternal(readable: unknown): unknown;
  };
}
type Page2 = typeof globalThis & {
  consumerA: Copy & { count: { value: number } };
  consumerB: Copy & {
    collision: unknown;
    reported: string[];
    buttonClass: CustomElementConstructor;
  };
};

async function open(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/examples/duplicate-core/dist/consumer-*.js', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: route.request().url().endsWith('consumer-a.js') ? bundles.a : bundles.b,
    }),
  );
  await page.goto('/examples/duplicate-core/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  return errors;
}

test('each consumer runs on its own copy of core', async ({ page }) => {
  const errors = await open(page);
  const distinct = await page.evaluate(() => {
    const { consumerA: a, consumerB: b } = globalThis as Page2;
    return {
      signal: a.core.signal !== b.core.signal,
      element: a.core.OddkinElement !== b.core.OddkinElement,
      button: customElements.get('odd-button') !== b.buttonClass,
    };
  });
  expect(distinct).toEqual({ signal: true, element: true, button: true });
  await expect(page.locator('a-greeting p')).toHaveText('A says hello, Ada');
  await expect(page.getByRole('button', { name: 'Registered by consumer A' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a tag registered from another copy is diagnosed, not replaced', async ({ page }) => {
  await open(page);
  const collision = await page.evaluate(() => {
    const { consumerA: a, consumerB: b } = globalThis as Page2;
    const error = b.collision as { code?: string; message?: string } | undefined;
    return {
      code: error?.code,
      thisCopy: error instanceof b.core.OddkinError,
      otherCopy: error instanceof a.core.OddkinError,
      message: String(error?.message),
    };
  });
  // Errors cross copies by `code`; `instanceof` only holds for the copy that threw.
  expect(collision).toMatchObject({ code: 'registry.collision', thisCopy: true, otherCopy: false });
  expect(collision.message).toContain('two copies or versions of a package');
});

test("another copy's readable is reported in a template and followed when bridged", async ({
  page,
}) => {
  const errors = await open(page);
  const direct = page.locator('b-mirror output.direct');
  const bridged = page.locator('b-mirror output.bridged');
  await expect(direct).toHaveText('1');
  await expect(bridged).toHaveText('1');
  await page.evaluate(() => {
    (globalThis as Page2).consumerA.count.value = 5;
  });
  await expect(bridged).toHaveText('5');
  // Bound as is, it keeps its first value; development builds say so once.
  await expect(direct).toHaveText('1');
  const reported = await page.evaluate(() => (globalThis as Page2).consumerB.reported);
  expect(reported).toEqual(['reactive.readable.foreign']);
  expect(errors).toEqual([]);
});

test("effects do not track another copy's readables; fromExternal bridges them", async ({
  page,
}) => {
  await open(page);
  const runs = await page.evaluate(async () => {
    const { consumerA: a, consumerB: b } = globalThis as Page2;
    const direct: number[] = [];
    const bridged: number[] = [];
    const stopDirect = b.core.effect(() => {
      direct.push(a.count.value);
    });
    const source = b.core.fromExternal(b.core.toExternal(a.count));
    const stopBridged = b.core.effect(() => {
      bridged.push(source.value);
    });
    a.count.value = 7;
    await new Promise((resolve) => setTimeout(resolve, 20));
    stopDirect();
    stopBridged();
    return { direct, bridged };
  });
  expect(runs).toEqual({ direct: [1], bridged: [1, 7] });
});
