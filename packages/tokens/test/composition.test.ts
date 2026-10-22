import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { generate } from '../src/index.js';

// Plan 244: legal composition and precedence of scope axes (theming-and-styling.md §5.4),
// redundant settings reported with their configuration paths, and measured CSS growth.

const BASE = { brand: { primary: '#6250e8' } } as const;
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
const codes = (config: unknown) =>
  generate(config).diagnostics.map((d) => [d.code, d.severity, d.path]);
const blocks = (css: string | undefined, attribute: string) =>
  (css ?? '').match(new RegExp(`\\[data-odd-${attribute}[~]?="[^"]+"\\][^{]*\\{[^}]*\\}`, 'g')) ??
  [];

describe('redundant settings', () => {
  it('reports each one where it was written, and none of them changes the output', () => {
    const redundant = {
      ...BASE,
      overrides: {
        'radius.md': '0.5rem',
        'color.text.primary': { light: '{ref.neutral.900}', dark: '{ref.neutral.50}' },
      },
      products: { same: { brand: { primary: '#6250e8' } } },
      density: { compact: { scale: 0.75 }, unchanged: { scale: 1 } },
      profiles: { 'layout.same': { 'layout.item-min': '16rem' } },
    };
    expect(codes(redundant)).toEqual([
      ['override.redundant', 'warning', '/overrides/radius.md'],
      ['override.redundant', 'warning', '/overrides/color.text.primary'],
      ['product.redundant', 'warning', '/products/same'],
      ['density.redundant', 'warning', '/density/unchanged'],
      ['profile.redundant', 'warning', '/profiles/layout.same/layout.item-min'],
    ]);
    const without = {
      ...BASE,
      density: { compact: { scale: 0.75 } },
    };
    const strip = (css: string | undefined) =>
      (css ?? '').replace(/\n\n *\[data-odd-profile~="layout\.same"\][^{]*\{[^}]*\}/, '');
    // The redundant product and density scopes emit nothing; the profile re-declares equal values.
    expect(strip(generate(redundant).css)).toBe(generate(without).css);
    expect(generate(redundant).diagnostics[0]?.message).toContain('preset');
  });

  it('does not report values that differ in any mode', () => {
    expect(
      codes({
        ...BASE,
        overrides: {
          'color.text.primary': { light: '{ref.neutral.900}', dark: '{ref.neutral.100}' },
        },
      }),
    ).toEqual([]);
  });
});

describe('scope axes compose without cross-products', () => {
  const css = (config: object) => generate(config).css ?? '';
  const increment = (config: object) => css(config).length - css(BASE).length;
  const densities = (n: number) =>
    Object.fromEntries(
      Array.from({ length: n }, (_, i) => [`d${i + 1}`, { scale: 1.05 + i * 0.05 }]),
    );
  const profiles = (n: number) =>
    Object.fromEntries(
      Array.from({ length: n }, (_, i) => [`p.${i + 1}`, { 'layout.gap': `${i + 1}rem` }]),
    );
  const products = (n: number) =>
    Object.fromEntries(
      BRANDS.slice(0, n).map((primary, i) => [`b${i + 1}`, { brand: { primary } }]),
    );

  it.each([1, 2, 3, 10])('%i of each axis: one rule per scope, sizes add up exactly', (n) => {
    const one = {
      products: { ...BASE, products: products(n) },
      density: { ...BASE, density: densities(n) },
      profiles: { ...BASE, profiles: profiles(n) },
    };
    const all = { ...BASE, products: products(n), density: densities(n), profiles: profiles(n) };
    // Profiles setting the same role overlap (reported, later wins); nothing else is reported.
    expect(new Set(generate(all).diagnostics.map((d) => d.code))).toEqual(
      new Set(['profile.overlap']),
    );
    expect(blocks(css(all), 'product')).toHaveLength(n);
    expect(blocks(css(all), 'density')).toHaveLength(n);
    // The base preset already has two profiles.
    expect(blocks(css(all), 'profile')).toHaveLength(n + 2);
    // Combined growth is the sum of each axis alone: no product × density × profile rules.
    expect(increment(all)).toBe(
      increment(one.products) + increment(one.density) + increment(one.profiles),
    );
  });

  it('records the measured growth per scope', () => {
    const rows = [1, 2, 3, 10].map((n) => {
      const config = {
        ...BASE,
        products: products(n),
        density: densities(n),
        profiles: profiles(n),
      };
      const text = css(config);
      return { n, raw: text.length, gzip: gzipSync(text, { level: 9 }).length };
    });
    const base = css(BASE);
    const perScope = (rows[3]!.raw - base.length) / 30;
    // A density rule re-declares every density token and its closure; product and profile rules are
    // smaller. Bounded: under 4 KB raw per scope on average, and gzip grows far less than raw.
    expect(perScope).toBeLessThan(4096);
    expect(rows[3]!.gzip - gzipSync(base, { level: 9 }).length).toBeLessThan(
      (rows[3]!.raw - base.length) / 4,
    );
  });
});
