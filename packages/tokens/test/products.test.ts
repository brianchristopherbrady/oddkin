import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  generate,
  resolveToken,
  type ResolveContext,
  type ResolvedTheme,
} from '../src/generate/index.js';
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
// A product's rule, and the one that re-applies its own roles in its mode scopes.
const scopeRules = (css: string | undefined, name = '[^"]+') =>
  (css ?? '').match(
    new RegExp(`\\[data-odd-product="${name}"\\]( \\[data-odd-mode\\])? \\{[^}]*\\}`, 'g'),
  ) ?? [];
const withoutProducts = (css: string | undefined) =>
  (css ?? '').replace(/\n\n *\[data-odd-product="[^"]+"\]( \[data-odd-mode\])? \{[^}]*\}/g, '');
const declared = (rule: string) => rule.match(/--odd-[\w-]+(?=:)/g) ?? [];
const MODES = ['light', 'dark'] as const;
/** Every token's literal value in one context. */
const resolved = (theme: ResolvedTheme, context: ResolveContext) =>
  Object.fromEntries(
    [...theme.tokens.keys()].map((name) => [name, resolveToken(theme, name, context)]),
  );

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
      // Without the product rules, the output is the single-product theme byte for byte: each
      // brand has its own contrast steps, and a product never moves the base's (§3).
      expect(withoutProducts(first.css)).toBe(generate(BASE).css);
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
      if (name === 'p3') expect(scopeRules(after, name)).not.toEqual(scopeRules(before, name));
      else expect(scopeRules(after, name), name).toEqual(scopeRules(before, name));
    }
    expect(withoutProducts(after)).toBe(withoutProducts(before));
  });

  it('grows by the product rules alone, bounded by the colour tokens', () => {
    const sizes = [0, 1, 2, 3, 10].map((n) => {
      const { css } = generate(n ? { ...BASE, products: products(n) } : BASE);
      return { n, rules: productRules(css), all: scopeRules(css), bytes: css!.length };
    });
    const [none, one] = sizes as [(typeof sizes)[0], (typeof sizes)[0]];
    const length = (rules: string[]) => rules.reduce((sum, rule) => sum + rule.length, 0);
    const separator = (one.bytes - none.bytes - length(one.all)) / one.all.length;
    expect(Number.isInteger(separator)).toBe(true);
    for (const size of sizes)
      expect(size.bytes - none.bytes, `${size.n} products`).toBe(
        length(size.all) + size.all.length * separator,
      );
    const limit = Math.max(...sizes[4]!.rules.map((rule) => declared(rule).length));
    expect(limit).toBeLessThanOrEqual(declared(one.rules[0]!).length);
    // A product's mode scopes re-apply only colour roles its brand needs other steps for.
    for (const rule of sizes[4]!.all.filter((rule) => !sizes[4]!.rules.includes(rule)))
      for (const name of declared(rule)) expect(name).toMatch(/^--odd-color-/);
    // gzip grows by less than the raw rules: product rules share their structure.
    const gzip = (n: number) =>
      gzipSync(generate(n ? { ...BASE, products: products(n) } : BASE).css!).length;
    expect(gzip(10) - gzip(0)).toBeLessThan(sizes[4]!.bytes - none.bytes);
  });
});

describe('product isolation (multi-product.md §3)', () => {
  // P1.1 (2026-11-04): a product's brand used to move the base's contrast-selected steps.
  it.each(['#aa0000', '#00aa55'])(
    'a product with brand %s leaves every base value unchanged, in each mode and gamut',
    (primary) => {
      const bases: ThemeConfig[] = [
        { brand: { primary: '#123456' } },
        { brand: { primary: 'oklch(0.65 0.25 145)' }, gamut: 'p3' },
      ];
      for (const base of bases) {
        const alone = generate(base).theme!;
        const kiosk = generate({ ...base, products: { kiosk: { brand: { primary } } } }).theme!;
        for (const mode of MODES)
          for (const gamut of ['srgb', 'p3'] as const)
            expect(resolved(kiosk, { mode, gamut })).toEqual(resolved(alone, { mode, gamut }));
      }
    },
  );

  it('a product resolves every token as its brand would alone', () => {
    const brands = [...BRANDS, '#aa0000', '#00aa55', '#facc15'];
    const theme = generate({
      ...BASE,
      products: Object.fromEntries(brands.map((primary, i) => [`p${i}`, { brand: { primary } }])),
    }).theme!;
    brands.forEach((primary, i) => {
      const alone = generate({ brand: { primary } }).theme!;
      for (const mode of MODES)
        expect(resolved(theme, { mode, product: `p${i}` }), `${primary} ${mode}`).toEqual(
          resolved(alone, { mode }),
        );
    });
  });

  it('changing one product’s brand changes no value of the base or another product', () => {
    const before = generate({ ...BASE, products: products(10) }).theme!;
    const after = generate({
      ...BASE,
      products: { ...products(10), p3: { brand: { primary: '#14532d' } } },
    }).theme!;
    const others = [undefined, 'p1', 'p2', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10'];
    for (const product of others)
      for (const mode of MODES)
        expect(resolved(after, { mode, product }), `${product} ${mode}`).toEqual(
          resolved(before, { mode, product }),
        );
  });

  it('an override equal to a step is redundant only where no brand needs another step', () => {
    const one = generate({ ...BASE, products: products(1) }).theme!;
    const base = one.tokens.get('color.link')!.value;
    const own = one.scopes[0]!.tokens.get('color.link')!.value;
    // p1's brand needs another link step than the base's.
    expect(one.scopes[0]!.roles).toContain('color.link');
    const codes = (config: object) =>
      generate({ ...BASE, ...config }).diagnostics.map((d) => [d.code, d.path]);
    expect(codes({ overrides: { 'color.link': base } })).toEqual([
      ['override.redundant', '/overrides/color.link'],
    ]);
    // The base's override pins the base's step in p1 too, where it fails: not redundant.
    const fails = [['contrast.fail', '/tokens/color.link']];
    expect(codes({ overrides: { 'color.link': base }, products: products(1) })).toEqual(fails);
    const p1 = (overrides: object) => ({
      products: { p1: { brand: { primary: BRANDS[0]! }, overrides } },
    });
    expect(codes(p1({ 'color.link': own }))).toEqual([
      ['override.redundant', '/products/p1/overrides/color.link'],
    ]);
    expect(codes(p1({ 'color.link': base }))).toEqual(fails);
    // Its own link replaces the step it would take; each role is re-applied once.
    const pinned = generate({ ...BASE, ...p1({ 'color.link': base }) }).theme!.scopes[0]!;
    expect(pinned.roles).toEqual(one.scopes[0]!.roles);
    expect(pinned.tokens.get('color.link')?.value).toEqual(base);
    // Where p1 sets the role itself, the base's override no longer reaches it.
    expect(codes({ overrides: { 'color.link': base }, ...p1({ 'color.link': own }) })).toEqual([
      ['override.redundant', '/overrides/color.link'],
    ]);
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
