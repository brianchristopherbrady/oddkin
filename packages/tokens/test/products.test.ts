import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { cssVariable, generate } from '../src/generate/index.js';
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
  (css ?? '').replace(/\n\n *\[data-odd-product="[^"]+"\] \{[^}]*\}/g, '');
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
