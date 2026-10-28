import { expect, request, test, type Page } from '@playwright/test';

// The optional autoloader (ADR 0046 D9): `@oddkin/components/autoload` registers each odd-* tag
// on its first appearance, from the workspace build and from tarballs installed outside the
// workspace (scripts/packed-consumers.mjs, consumer `autoload`), under the pages' strict CSP.
// Beside it, the same markup with explicit define imports, the recommended production path:
// requests and time to defined are recorded for both as annotations.
const packed = 'http://127.0.0.1:4174/autoload';
const TAGS = ['odd-alert', 'odd-badge', 'odd-button', 'odd-card', 'odd-input'];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const violations: string[] = [];
    (window as unknown as { __violations: string[] }).__violations = violations;
    document.addEventListener('securitypolicyviolation', (event) =>
      violations.push(`${event.violatedDirective}: ${event.blockedURI}`),
    );
  });
});

/** Open a page and wait until every odd-* element is defined: the module requests and the time. */
async function measure(page: Page, url: string) {
  const errors: string[] = [];
  const modules: string[] = [];
  const onError = (error: Error) => errors.push(error.message);
  const onRequest = (r: { url(): string }) => {
    if (r.url().endsWith('.js')) modules.push(r.url());
  };
  page.on('pageerror', onError);
  page.on('request', onRequest);
  await page.goto(url);
  const defined = await page.evaluate(async (tags) => {
    await Promise.all(tags.map((tag) => customElements.whenDefined(tag)));
    return {
      ms: performance.now(),
      undefined: document.querySelectorAll(':not(:defined)').length,
    };
  }, TAGS);
  const violations = await page.evaluate(
    () => (window as unknown as { __violations: string[] }).__violations,
  );
  page.off('request', onRequest);
  return { errors, modules, violations, ...defined };
}

for (const [name, base] of [
  ['workspace build', '/examples/autoload'],
  ['packed tarballs', packed],
] as const)
  test.describe(name, () => {
    test.beforeAll(async () => {
      if (base !== packed) return;
      test.setTimeout(180_000);
      const api = await request.newContext();
      try {
        const response = await api.get(`${packed}/__ready`, { timeout: 170_000 });
        expect(response.ok(), await response.text()).toBe(true);
      } finally {
        await api.dispose();
      }
    });

    test('registers every element on the page, like explicit imports, under the strict CSP', async ({
      page,
      browserName,
    }) => {
      const auto = await measure(page, `${base}/`);
      expect(auto.errors).toEqual([]);
      expect(auto.violations).toEqual([]);
      expect(auto.undefined).toBe(0);
      const loaded = auto.modules.filter((url) => /\.define\.js$/.test(url));
      // One import per tag the page uses (odd-card needs no other definition).
      expect(loaded.map((url) => url.split('/').at(-1)).sort()).toEqual(
        TAGS.map((tag) => `${tag.slice(4)}.define.js`).sort(),
      );
      const explicit = await measure(page, `${base}/explicit.html`);
      expect(explicit.errors).toEqual([]);
      expect(explicit.violations).toEqual([]);
      expect(explicit.undefined).toBe(0);
      test.info().annotations.push({
        type: 'measure',
        description: `${browserName} ${name}: autoload ${auto.modules.length} module requests, defined at ${Math.round(auto.ms)} ms; explicit ${explicit.modules.length} requests, ${Math.round(explicit.ms)} ms`,
      });
    });
  });

test.describe('behaviour', () => {
  test('elements added later and in observed shadow roots load once per tag; unknown tags are reported', async ({
    page,
  }) => {
    const { errors } = await measure(page, '/examples/autoload/');
    const modules: string[] = [];
    page.on('request', (r) => modules.push(r.url()));
    const result = await page.evaluate(async () => {
      const main = document.querySelector('main')!;
      // Trusted Types: build the markup without HTML strings.
      for (const text of ['One', 'Two']) {
        const chip = document.createElement('odd-chip');
        chip.textContent = text;
        main.append(chip);
      }
      await customElements.whenDefined('odd-chip');
      const host = document.createElement('div');
      main.append(host);
      const root = host.attachShadow({ mode: 'open' });
      const { observe } = (await import('@oddkin/components/autoload')) as {
        observe: (root: ShadowRoot) => () => void;
      };
      const stop = observe(root);
      root.append(document.createElement('odd-spinner'));
      await customElements.whenDefined('odd-spinner');
      stop();
      // After stop, the shadow root is no longer watched.
      root.append(document.createElement('odd-skeleton'));
      await new Promise((resolve) => setTimeout(resolve, 300));
      main.append(document.createElement('odd-nope'));
      await new Promise((resolve) => setTimeout(resolve, 300));
      return {
        chip: !!customElements.get('odd-chip'),
        spinner: !!customElements.get('odd-spinner'),
        skeleton: !!customElements.get('odd-skeleton'),
      };
    });
    expect(result).toEqual({ chip: true, spinner: true, skeleton: false });
    expect(modules.filter((url) => url.endsWith('/chip.define.js'))).toHaveLength(1);
    expect(errors.some((message) => message.includes('autoload.tag.unknown'))).toBe(true);
    expect(errors.filter((message) => !message.includes('autoload.tag.unknown'))).toEqual([]);
  });

  test('a definition that fails to load is reported, and a later load() tries again', async ({
    page,
  }) => {
    const { errors } = await measure(page, '/examples/autoload/');
    await page.route('**/avatar.define.js', (route) => route.abort());
    const reported = await page.evaluate(async () => {
      const { setErrorHandler } = (await import('@oddkin/core/diagnostics')) as {
        setErrorHandler: (handler: (error: unknown, context: { code: string }) => void) => void;
      };
      const codes: string[] = [];
      setErrorHandler((_error, context) => codes.push(context.code));
      document.querySelector('main')!.append(document.createElement('odd-avatar'));
      await new Promise((resolve) => setTimeout(resolve, 300));
      return codes;
    });
    expect(reported).toEqual(['autoload.import.failed']);
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => !!customElements.get('odd-avatar'))).toBe(false);
    await page.unroute('**/avatar.define.js');
    const retried = await page.evaluate(async () => {
      const { load } = (await import('@oddkin/components/autoload')) as {
        load: (tag: string) => Promise<void>;
      };
      return load('odd-avatar').then(
        () => 'defined',
        (error: unknown) => `rejected: ${String(error)}`,
      );
    });
    // Chromium 156, Firefox 157, and WebKit 27.2 fetch a module again after a network failure.
    expect(retried).toBe('defined');
    expect(errors).toEqual([]);
  });
});
