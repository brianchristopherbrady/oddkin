import { expect, test, type Locator, type Page } from '@playwright/test';

// Regression scenarios from css-architecture.md §15 (F01, F03, F07, F11, F14, F16) on the
// CSS compatibility gallery and the components-only example, under their strict CSPs.

// Several tests open more than one page or context; allow for a busy machine.
test.describe.configure({ timeout: 60_000 });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const violations: Array<{ directive: string; target: string; sample: string }> = [];
    (window as unknown as { __violations: typeof violations }).__violations = violations;
    document.addEventListener('securitypolicyviolation', (event) => {
      const target = event.target as Node | null;
      violations.push({
        directive: event.violatedDirective,
        target: target?.nodeName ?? '',
        sample: event.sample,
      });
    });
  });
});

async function open(page: Page, path: string, browserName: string) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(path);
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  return async () => {
    expect(errors).toEqual([]);
    const violations = await page.evaluate(
      () =>
        (window as unknown as { __violations: Array<{ directive: string; target: string }> })
          .__violations,
    );
    // WebKit reports one style-src-attr violation per native <select> from its own internal
    // rendering, without page code (verified on a minimal page; Chromium and Firefox report
    // none). Every other violation fails the test.
    expect(
      violations.filter(
        (v) =>
          !(browserName === 'webkit' && v.directive === 'style-src-attr' && v.target === 'SELECT'),
      ),
    ).toEqual([]);
  };
}

const inner = (host: Locator, selector: string, property: string) =>
  host.evaluate(
    (el, [s, p]) => getComputedStyle(el.shadowRoot!.querySelector(s!)!).getPropertyValue(p!),
    [selector, property],
  );

async function setWidth(page: Page, rem: number) {
  await page.locator('#width').evaluate((el: HTMLInputElement, value) => {
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, rem);
}

test('the gallery shows the emitted CSS and toggles baseline and enhanced stylesheets', async ({
  page,
  browserName,
}) => {
  const clean = await open(page, '/examples/css-gallery/', browserName);
  await expect(page.locator('#token-css')).toContainText(
    '@layer odd.reset, odd.tokens, odd.base, odd.layout, odd.components, odd.utilities;',
  );
  await expect(page.locator('#button-css')).toContainText('@media (hover: hover)');
  await expect(page.locator('#enhancement-css')).toContainText('@supports (field-sizing: content)');
  await expect(page.locator('#support tbody tr')).not.toHaveCount(0);

  const heading = page.locator('#stage-heading');
  const wrapStyle = () =>
    heading.evaluate((el) => getComputedStyle(el).getPropertyValue('text-wrap-style'));
  const supportsBalance = await page.evaluate(() => CSS.supports('text-wrap: balance'));
  if (supportsBalance) expect(await wrapStyle()).toBe('balance');

  // Baseline: without the enhancement stylesheet everything still renders and themes.
  await page.locator('#enhanced').uncheck();
  await expect(page.locator('html')).toHaveAttribute('data-enhanced', 'false');
  if (supportsBalance) expect(await wrapStyle()).not.toBe('balance');
  const save = page.locator('#save');
  const action = await page.locator('#stage').evaluate((stage) => {
    const probe = document.createElement('span');
    probe.style.backgroundColor = 'var(--odd-color-action-default)';
    stage.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  });
  expect(action).not.toBe('rgba(0, 0, 0, 0)');
  expect(await inner(save, 'button', 'background-color')).toBe(action);
  await clean();
});

test('nested opposite-mode surfaces re-resolve roles inside shadow roots', async ({
  page,
  browserName,
}) => {
  const clean = await open(page, '/examples/css-gallery/', browserName);
  await page.locator('#mode').selectOption('light');
  const colorIn = (selector: string) =>
    page.locator(selector).evaluate((scope) => {
      const probe = document.createElement('span');
      probe.style.backgroundColor = 'var(--odd-color-action-default)';
      scope.append(probe);
      const color = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return color;
    });
  const light = await colorIn('#frame');
  const dark = await colorIn('#nested');
  expect(dark).not.toBe(light);
  expect(await inner(page.locator('#nested odd-button'), 'button', 'background-color')).toBe(dark);
  expect(await inner(page.locator('#save'), 'button', 'background-color')).toBe(light);
  expect(await page.locator('#nested').evaluate((el) => getComputedStyle(el).colorScheme)).toBe(
    'dark',
  );
  await clean();
});

test('the frame width, not the viewport, drives the container layout', async ({
  page,
  browserName,
}) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  const clean = await open(page, '/examples/css-gallery/', browserName);
  const columns = () =>
    page
      .locator('.native')
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  await setWidth(page, 50);
  expect(await columns()).toBe(2);
  await setWidth(page, 20);
  expect(await columns()).toBe(1);
  // Long content wraps inside the narrow frame instead of overflowing it.
  await page.locator('#long').check();
  const overflow = await page
    .locator('#frame')
    .evaluate((frame) => frame.scrollWidth - frame.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await clean();
});

test('reduced motion slows the spinner and clearing loading removes it', async ({
  page,
  browserName,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const clean = await open(page, '/examples/css-gallery/', browserName);
  // The spinner is a flex item, so its inline-block display is blockified: test visibility.
  const spinner = () =>
    page.locator('#save').evaluate((host) => {
      const s = getComputedStyle(host.shadowRoot!.querySelector('[part="spinner"]')!);
      return { shown: s.display !== 'none', duration: s.animationDuration };
    });
  await page.locator('#loading').check();
  await expect.poll(spinner).toEqual({ shown: true, duration: '3s' });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(spinner).toEqual({ shown: true, duration: '0.8s' });
  // The final state never depends on an animation finishing.
  await page.locator('#loading').uncheck();
  await expect.poll(async () => (await spinner()).shown).toBe(false);
  await clean();
});

test('keyboard focus keeps a visible outline in forced colors', async ({ page, browserName }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  const clean = await open(page, '/examples/components-only/', browserName);
  const active = await page.evaluate(() => matchMedia('(forced-colors: active)').matches);
  test.skip(!active, `${browserName} does not emulate forced colors in Playwright`);
  await page.getByLabel('Email').focus();
  await page.keyboard.press('Tab');
  const reset = page.locator('odd-button').first();
  await expect(reset).toBeFocused();
  const style = await reset.evaluate((host) => {
    const s = getComputedStyle(host.shadowRoot!.querySelector('button')!);
    return {
      outline: s.outlineStyle,
      width: parseFloat(s.outlineWidth),
      border: `${s.borderTopStyle} ${s.borderTopWidth}`,
    };
  });
  expect(style.outline).toBe('solid');
  expect(style.width).toBeGreaterThanOrEqual(2);
  expect(style.border).toBe('solid 1px');
  await clean();
});

test('hover feedback appears only where the primary pointer can hover', async ({
  browser,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'touch-primary emulation (isMobile) is Chromium-only');
  const baseURL = test.info().project.use.baseURL;
  for (const [options, hovers] of [
    [{}, true],
    [{ isMobile: true, hasTouch: true }, false],
  ] as const) {
    const context = await browser.newContext({
      ...options,
      ...(baseURL ? { baseURL } : {}),
      viewport: { width: 900, height: 900 },
    });
    const page = await context.newPage();
    await page.goto('/examples/css-gallery/');
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
    expect(await page.evaluate(() => matchMedia('(hover: hover)').matches)).toBe(hovers);
    const save = page.locator('#save');
    const before = await inner(save, 'button', 'background-color');
    await save.hover();
    const after = await inner(save, 'button', 'background-color');
    if (hovers) expect(after).not.toBe(before);
    else expect(after).toBe(before);
    await context.close();
  }
});

test('pages reflow at 320 CSS pixels without horizontal scrolling', async ({
  page,
  browserName,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const path of ['/examples/components-only/', '/examples/css-gallery/']) {
    const clean = await open(page, path, browserName);
    if (path.includes('gallery')) await page.locator('#long').check();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
    await clean();
  }
});
