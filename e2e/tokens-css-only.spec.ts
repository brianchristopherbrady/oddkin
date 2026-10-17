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
