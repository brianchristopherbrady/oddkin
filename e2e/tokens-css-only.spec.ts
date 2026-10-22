import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import {
  generate,
  resolveToken,
  type ResolveContext,
  type ResolvedTheme,
} from '../packages/tokens/dist/index.js';

const config: unknown = JSON.parse(readFileSync('examples/tokens-css-only/theme.json', 'utf8'));
const theme = generate(config).theme as ResolvedTheme;

const rgb = (hex: string | undefined) => {
  const h = (hex ?? '').slice(1);
  return `rgb(${[0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(', ')})`;
};
const px = (rem: string | undefined) => `${Number.parseFloat(rem ?? '') * 16}px`;

for (const scheme of ['light', 'dark'] as const) {
  test(`CSS-only page follows a ${scheme} system preference and nested scopes without script`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/examples/tokens-css-only/');
    expect(await page.evaluate(() => document.scripts.length)).toBe(0);

    await expect(page.locator('body')).toHaveCSS(
      'background-color',
      rgb(resolveToken(theme, 'color.surface.sunken', { mode: scheme })),
    );

    const scopes: Array<[string, ResolveContext]> = [
      ['#root-panel', { mode: scheme }],
      ['#dark-panel', { mode: 'dark' }],
      ['#dark-product-panel', { mode: 'dark', product: 'lighthouse' }],
      ['#dark-product-light-panel', { mode: 'light', product: 'lighthouse' }],
      ['#compact-panel', { mode: scheme, density: 'compact' }],
      [
        '#profile-compact-panel',
        { mode: scheme, density: 'compact', profiles: ['layout.compact'] },
      ],
    ];
    for (const [selector, context] of scopes) {
      const panel = page.locator(selector);
      const action = page.locator(`${selector} > .action`);
      await expect(panel, selector).toHaveCSS(
        'background-color',
        rgb(resolveToken(theme, 'color.surface.default', context)),
      );
      await expect(panel, selector).toHaveCSS(
        'color',
        rgb(resolveToken(theme, 'color.text.primary', context)),
      );
      await expect(action, selector).toHaveCSS(
        'background-color',
        rgb(resolveToken(theme, 'color.action.default', context)),
      );
      await expect(action, selector).toHaveCSS(
        'color',
        rgb(resolveToken(theme, 'color.text.on-action', context)),
      );
      await expect(action, selector).toHaveCSS(
        'min-height',
        px(resolveToken(theme, 'control.height.md', context)),
      );
      await expect(panel, selector).toHaveCSS(
        'padding-top',
        px(resolveToken(theme, 'card.padding', context)),
      );
    }
    await expect(page.locator('#profile-panel')).toHaveCSS(
      'padding-top',
      px(resolveToken(theme, 'card.padding', { profiles: ['layout.compact'] })),
    );
    await expect(page.locator('#dark-panel')).toHaveCSS('color-scheme', 'dark');

    // rem outputs follow the consumer's root font size; nothing assumes 16px.
    await page.evaluate(() => (document.documentElement.style.fontSize = '20px'));
    await expect(page.locator('#root-panel > .action')).toHaveCSS(
      'min-height',
      `${Number.parseFloat(resolveToken(theme, 'control.height.md') ?? '') * 20}px`,
    );
  });
}

// Plan 242: the first rendered frame already follows the system preference (no flash), measured
// from an init script, which is not part of the page (the page itself still runs no script).
for (const scheme of ['light', 'dark'] as const) {
  test(`CSS-only page paints its first frame in the ${scheme} scheme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.addInitScript(() => {
      const frames: Array<{ scheme: string; body: string | null }> = [];
      (window as unknown as { __frames: typeof frames }).__frames = frames;
      const record = () => {
        frames.push({
          scheme: getComputedStyle(document.documentElement).colorScheme,
          body: document.body ? getComputedStyle(document.body).backgroundColor : null,
        });
        // Until the page has loaded and two frames have shown the body (bounded).
        const shown = frames.filter((f) => f.body !== null).length;
        if ((document.readyState !== 'complete' || shown < 2) && frames.length < 600)
          requestAnimationFrame(record);
        else (window as unknown as { __done: boolean }).__done = true;
      };
      requestAnimationFrame(record);
    });
    await page.goto('/examples/tokens-css-only/');
    await page.waitForFunction(() => (window as unknown as { __done?: boolean }).__done === true);
    const { frames, fcp } = await page.evaluate(() => ({
      frames: (window as unknown as { __frames: Array<{ scheme: string; body: string | null }> })
        .__frames,
      fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
    }));
    const sunken = rgb(resolveToken(theme, 'color.surface.sunken', { mode: scheme }));
    // Every frame, from the first, has the scheme and the body background of the preference.
    expect(frames[0]?.scheme).toBe(scheme);
    for (const frame of frames) {
      expect(frame.scheme).toBe(scheme);
      if (frame.body !== null) expect(frame.body).toBe(sunken);
    }
    expect(frames.some((f) => f.body !== null)).toBe(true);
    test.info().annotations.push({
      type: 'first-contentful-paint',
      description: fcp === null ? 'not reported by this engine' : `${Math.round(fcp)} ms`,
    });
  });
}

// Plan 242: forced colours on the CSS-only page. Token sizes still apply, the UA's system colours
// replace token colours, and controls keep a visible boundary and focus outline.
test('CSS-only page under forced colours', async ({ page, browserName }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/examples/tokens-css-only/');
  const active = await page.evaluate(() => matchMedia('(forced-colors: active)').matches);
  test.skip(!active, `${browserName} does not emulate forced-colors`);

  const system = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.cssText =
      'color: CanvasText; background-color: Canvas; border: 1px solid ButtonText';
    document.body.append(probe);
    const style = getComputedStyle(probe);
    const result = {
      text: style.color,
      canvas: style.backgroundColor,
      button: style.borderTopColor,
    };
    probe.remove();
    return result;
  });
  const forced = await page.evaluate(
    (text) => getComputedStyle(document.querySelector('#root-panel') as Element).color === text,
    system.text,
  );
  // WebKit reports the media feature but keeps author colours, so nothing here can be measured.
  test.skip(
    !forced,
    `${browserName} emulates the forced-colors media query without forcing colours`,
  );
  await expect(page.locator('#root-panel')).toHaveCSS('color', system.text);
  await expect(page.locator('#dark-panel')).toHaveCSS('background-color', system.canvas);

  const action = page.locator('#root-panel > .action');
  await expect(action).toHaveCSS('min-height', px(resolveToken(theme, 'control.height.md')));
  // A transparent border becomes visible in forced colours; `border: 0` would leave none.
  await expect(action).toHaveCSS('border-top-style', 'solid');
  expect(
    Number.parseFloat(await action.evaluate((el) => getComputedStyle(el).borderTopWidth)),
  ).toBeGreaterThan(0);
  expect(await action.evaluate((el) => getComputedStyle(el).borderTopColor)).not.toBe(
    'rgba(0, 0, 0, 0)',
  );

  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(action).toBeFocused();
  await expect(action).toHaveCSS('outline-style', 'solid');
  await expect(action).toHaveCSS('outline-width', resolveToken(theme, 'focus.width') ?? '');
});
