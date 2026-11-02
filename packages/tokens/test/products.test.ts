import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { cssVariable, generate, resolveToken } from '../src/generate/index.js';
import { CONTRAST_ROLES } from '../src/generate/preset.js';
import type { ThemeConfig } from '../src/theme/index.js';

// Multi-product token fixtures (multi-product.md, ADR 0033): 1, 2, 3, and 10 products.

const BRANDS = [
  '#0f766e',
  '#b91c1c',
  '#7c2d12',
  '#1e3a8a',
  '#6d28d9',
  '#047857',
  '#be185d',
  '#0369a1',
  '#4d7c0f',
  '#9a3412',
];
const BASE = { brand: { primary: '#6250e8' } } as const;
const products = (n: number) =>
  Object.fromEntries(BRANDS.slice(0, n).map((primary, i) => [`p${i + 1}`, { brand: { primary } }]));

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
const productRule = (css: string | undefined, name: string) =>
  new RegExp(`\\[data-odd-product="${name}"\\] \\{[^}]*\\}`).exec(css ?? '')?.[0];
const productRules = (css: string | undefined) =>
  (css ?? '').match(/\[data-odd-product="[^"]+"\] \{[^}]*\}/g) ?? [];
const withoutProducts = (css: string | undefined) =>
  (css ?? '').replace(/\n\n *\[data-odd-product="[^"]+"\]( \[data-odd-mode\])? \{[^}]*\}/g, '');
const declared = (rule: string) => rule.match(/--odd-[\w-]+(?=:)/g) ?? [];

describe('multi-product token fixtures', () => {
  it('a single-product theme needs no product configuration and emits no product scopes', () => {
    const { css, diagnostics } = generate(deepFreeze({ ...BASE }));
    expect(diagnostics).toEqual([]);
    expect(productRules(css)).toEqual([]);
  });

  it.each([1, 2, 3, 10])(
    '%i products: valid, deterministic from frozen input, one rule each',
    (n) => {
      const config: ThemeConfig = deepFreeze({ ...BASE, products: products(n) });
      const first = generate(config);
      expect(first.diagnostics).toEqual([]);
      expect(generate(config).css).toBe(first.css);
      const rules = productRules(first.css);
      expect(rules).toHaveLength(n);
      // A product changes brand inputs only: its rule re-declares colour references and the
      // colour roles that read them, and only those whose value differs from the base theme.
      for (const rule of rules)
        for (const name of declared(rule)) expect(name).toMatch(/^--odd-(ref|color)-/);
      // Without the product rules, the output is the single-product theme, except contrast-
      // selected roles: they share one reference step that passes in every product (ADR 0006).
      const single = (generate(BASE).css ?? '').split('\n');
      const changed = withoutProducts(first.css)
        .split('\n')
        .filter((line, i) => line !== single[i]);
      expect(withoutProducts(first.css).split('\n')).toHaveLength(single.length);
      const selected = new Set(CONTRAST_ROLES.map((role) => cssVariable(role.name)));
      for (const line of changed) expect(selected).toContain(/^\s*(--odd-[\w-]+):/.exec(line)?.[1]);
    },
  );

  it('changing one product leaves the base and every other product byte-identical', () => {
    const before = generate({ ...BASE, products: products(10) }).css;
    const after = generate({
      ...BASE,
      products: { ...products(10), p3: { brand: { primary: '#14532d' } } },
    }).css;
    for (let i = 1; i <= 10; i++) {
      const name = `p${i}`;
      if (name === 'p3') expect(productRule(after, name)).not.toBe(productRule(before, name));
      else expect(productRule(after, name), name).toBe(productRule(before, name));
    }
    expect(withoutProducts(after)).toBe(withoutProducts(before));
  });

  it('grows by exactly one rule per product, bounded by the colour tokens', () => {
    const sizes = [0, 1, 2, 3, 10].map((n) => {
      const { css } = generate(n ? { ...BASE, products: products(n) } : BASE);
      const rules = productRules(css);
      return { n, rules, bytes: css!.length, gzip: gzipSync(css!).length };
    });
    const separator = sizes[1]!.bytes - sizes[0]!.bytes - sizes[1]!.rules[0]!.length;
    for (const size of sizes) {
      const ruleBytes = size.rules.reduce((sum, rule) => sum + rule.length + separator, 0);
      expect(size.bytes - sizes[0]!.bytes, `${size.n} products`).toBe(ruleBytes);
    }
    const limit = Math.max(...sizes[4]!.rules.map((rule) => declared(rule).length));
    expect(limit).toBeLessThanOrEqual(declared(sizes[1]!.rules[0]!).length);
    // gzip grows by less than the raw rules: product rules share their structure.
    expect(sizes[4]!.gzip - sizes[0]!.gzip).toBeLessThan(sizes[4]!.bytes - sizes[0]!.bytes);
  });
});

describe('product colour roles (products.<id>.overrides)', () => {
  const shipped = JSON.parse(
    readFileSync(new URL('../themes/default.theme.json', import.meta.url), 'utf8'),
  ) as ThemeConfig;
  const green = (overrides?: Record<string, unknown>) =>
    ({
      ...shipped,
      products: { green: { brand: { primary: '#047857' }, ...(overrides ? { overrides } : {}) } },
    }) as ThemeConfig;
  const ACTIONS = {
    'color.action.default': { light: '{ref.brand.700}', dark: '{ref.brand.300}' },
    'color.action.hover': { light: '{ref.brand.800}', dark: '{ref.brand.200}' },
    'color.action.pressed': { light: '{ref.brand.900}', dark: '{ref.brand.400}' },
  };

  it('recolour the actions, links, and focus ring the default theme pins (multi-product.md §9)', () => {
    const pinned = generate(green());
    // Brand inputs alone change the product's ramps, not the roles the theme pins.
    expect(resolveToken(pinned.theme!, 'color.link', { product: 'green', mode: 'light' })).toBe(
      '#6250e8',
    );
    const recoloured = generate(green(ACTIONS));
    expect(recoloured.diagnostics).toEqual([]);
    const theme = recoloured.theme!;
    for (const mode of ['light', 'dark'] as const) {
      const step = resolveToken(theme, mode === 'light' ? 'ref.brand.700' : 'ref.brand.300', {
        product: 'green',
        mode,
      });
      for (const role of ['color.action.default', 'color.link', 'color.focus.ring'])
        expect(resolveToken(theme, role, { product: 'green', mode }), `${role} ${mode}`).toBe(step);
      expect(resolveToken(theme, 'color.link', { mode })).toBe(
        resolveToken(pinned.theme!, 'color.link', { mode }),
      );
    }
    // Still one rule, and one more that re-applies the roles in mode scopes inside the product.
    expect(productRules(recoloured.css)).toHaveLength(1);
    const roles = [
      '--odd-color-action-default',
      '--odd-color-action-hover',
      '--odd-color-action-pressed',
      '--odd-color-link',
      '--odd-color-focus-ring',
    ];
    expect(declared(productRule(recoloured.css, 'green')!)).toEqual(expect.arrayContaining(roles));
    const reapplied = /\[data-odd-product="green"\] \[data-odd-mode\] \{[^}]*\}/.exec(
      recoloured.css ?? '',
    )?.[0];
    expect(declared(reapplied ?? '')).toEqual(expect.arrayContaining(roles));
    expect(declared(reapplied ?? '')).not.toContain('--odd-ref-brand-700');
    expect(withoutProducts(recoloured.css)).toBe(withoutProducts(pinned.css));
    expect(pinned.css).not.toContain('[data-odd-mode] {');
  });

  it('changing one product’s roles leaves the base and every other product byte-identical', () => {
    const before = generate({ ...BASE, products: products(10) }).css;
    const surface = { 'color.surface.default': { light: '#fffaf5', dark: '{ref.neutral.900}' } };
    const after = generate({
      ...BASE,
      products: { ...products(10), p3: { brand: { primary: BRANDS[2]! }, overrides: surface } },
    }).css;
    for (let i = 1; i <= 10; i++) {
      const name = `p${i}`;
      if (name === 'p3') expect(productRule(after, name)).not.toBe(productRule(before, name));
      else expect(productRule(after, name), name).toBe(productRule(before, name));
    }
    expect(withoutProducts(after)).toBe(withoutProducts(before));
  });

  it('a product that sets only roles is not redundant', () => {
    expect(generate({ ...BASE, products: { quiet: {} } }).diagnostics.map((d) => d.code)).toEqual([
      'product.redundant',
    ]);
    const surface = { 'color.surface.default': { light: '#fbfaff', dark: '{ref.neutral.900}' } };
    const { diagnostics, css } = generate({
      ...BASE,
      products: { quiet: { overrides: surface } },
    });
    expect(diagnostics.map((d) => d.code)).not.toContain('product.redundant');
    expect(declared(productRule(css, 'quiet')!)).toContain('--odd-color-surface-default');
  });

  it('report what a product cannot override at the product’s path', () => {
    const { ok, diagnostics } = generate({
      ...BASE,
      products: {
        p: {
          brand: { primary: '#0f766e' },
          overrides: {
            'ref.brand.500': '#000000',
            'space.md': '1rem',
            'card.padding': '1rem',
            'color.acton.default': '#000000',
            'color.link': 3,
            'color.focus.ring': '{color.nope}',
          },
        },
      },
    } as never);
    expect(ok).toBe(false);
    const at = (token: string) => `/products/p/overrides/${token}`;
    expect(diagnostics.map((d) => [d.code, d.path])).toEqual([
      ['product.category', at('ref.brand.500')],
      ['product.category', at('space.md')],
      ['product.category', at('card.padding')],
      ['override.unknown', at('color.acton.default')],
      ['override.invalid', at('color.link')],
      ['alias.missing', at('color.focus.ring')],
    ]);
    expect(diagnostics[0]?.suggestion).toContain('set brand.primary or brand.neutral');
    expect(diagnostics[3]?.suggestion).toBe('Did you mean "color.action.default"?');
  });

  it('warn about a role the base already has, and suggest the product’s own fix for contrast', () => {
    const redundant = generate(green({ 'color.link': '{color.action.default}' }));
    expect(redundant.diagnostics.map((d) => [d.code, d.path])).toEqual([
      ['override.redundant', '/products/green/overrides/color.link'],
    ]);
    const low = generate(
      green({ 'color.action.default': { light: '{ref.brand.600}', dark: '{ref.brand.300}' } }),
    );
    expect(low.ok).toBe(true);
    expect(low.diagnostics.map((d) => [d.code, d.path])).toEqual([
      ['contrast.fail', '/tokens/color.link'],
    ]);
    expect(low.diagnostics[0]?.message).toContain('in light mode for product "green"');
    expect(low.diagnostics[0]?.suggestion).toContain(
      'Set products["green"].overrides["color.link"].light to "{ref.brand.700}"',
    );
  });
});
