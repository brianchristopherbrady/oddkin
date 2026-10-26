import { describe, expect, it } from 'vitest';
import {
  ABOVE_FLOOR_SYNTAX,
  aboveFloorSyntax,
  emitCss,
  generate,
  LAYER_ORDER,
  type ResolvedTheme,
} from '../src/index.js';

const config = { name: 'acme', brand: { primary: '#5b46e8' } };
const theme = generate(config).theme as ResolvedTheme;

/** Declarations as `property: value` lines, independent of indentation and layer wrapping. */
const declarations = (css: string) =>
  css
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('--') || line.startsWith('color-scheme'));

describe('cascade layer of generated token CSS (ADR 0039)', () => {
  it('declares the canonical Oddkin layer order, then every declaration inside odd.tokens', () => {
    const css = emitCss(theme);
    const [, afterHeader = ''] = css.split('*/\n\n');
    expect(
      afterHeader.startsWith(`@layer ${LAYER_ORDER.join(', ')};\n\n@layer odd.tokens {\n`),
    ).toBe(true);
    expect(css.endsWith('\n}\n')).toBe(true);
    const block = afterHeader.slice(afterHeader.indexOf('{'));
    const closing = block.lastIndexOf('}');
    let depth = 0;
    for (let i = 0; i < block.length; i++) {
      if (block[i] === '{') depth++;
      else if (block[i] === '}') depth--;
      // The layer block closes only at the very end: nothing is emitted outside it.
      if (depth === 0) {
        expect(i).toBe(closing);
        break;
      }
    }
  });

  it('emits identical declarations layered and unlayered', () => {
    const unlayered = emitCss(theme, { layer: false });
    expect(unlayered).not.toContain('@layer');
    expect(unlayered).toMatch(/^\/\*[^\n]*\*\/\n\n:root,\n\[data-odd-theme="acme"\] \{\n/);
    expect(declarations(emitCss(theme))).toEqual(declarations(unlayered));
    expect(declarations(unlayered).length).toBeGreaterThan(50);
  });

  it('uses a custom layer without claiming the Oddkin order, and rejects invalid names', () => {
    const css = emitCss(theme, { layer: 'vendor.theme' });
    expect(css).toContain('\n@layer vendor.theme {\n');
    expect(css).not.toContain('odd.reset');
    expect(() => emitCss(theme, { layer: 'not a layer' })).toThrowError(TypeError);
    expect(() => emitCss(theme, { layer: '1st' })).toThrowError(TypeError);
    expect(generate(config, { css: { layer: false } }).css).toBe(emitCss(theme, { layer: false }));
  });
});

describe('token values above the browser floor (css-architecture.md §4.2)', () => {
  const codes = (input: unknown) =>
    generate(input).diagnostics.map((d) => [d.code, d.severity, d.path] as const);

  it('warns, without failing, when a token value uses syntax the floor cannot parse', () => {
    const result = generate({
      ...config,
      overrides: { 'layout.inset': 'max({space.md}, progress(100vw, 20rem, 80rem) * 2rem)' },
    });
    expect(result.ok).toBe(true);
    const found = result.diagnostics.filter((d) => d.code === 'value.syntax.aboveFloor');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ severity: 'warning', path: '/overrides/layout.inset' });
    expect(found[0]?.message).toContain('Chrome 130, Edge 130, Firefox 132, Safari 18.2');
    expect(found[0]?.message).toContain('invalid at computed-value time');
  });

  it('explains the floor when a literal colour fails the colour parser, without a duplicate', () => {
    const result = generate({
      ...config,
      overrides: { 'color.surface.default': 'contrast-color(#ffffff)' },
    });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((d) => d.code)).toEqual(['color.invalid']);
    expect(result.diagnostics[0]?.suggestion).toContain(
      'contrast-color() is not parsed by Chrome 130, Edge 130, Firefox 132, Safari 18.2',
    );
  });

  it('reports above-floor syntax per token, once across modes, and in profiles', () => {
    expect(
      codes({
        ...config,
        overrides: {
          'color.surface.hover': {
            light: 'contrast-color({ref.neutral.100})',
            dark: 'contrast-color({ref.neutral.800})',
          },
        },
      }).filter(([code]) => code === 'value.syntax.aboveFloor'),
    ).toEqual([['value.syntax.aboveFloor', 'warning', '/overrides/color.surface.hover']]);
    expect(
      codes({
        ...config,
        profiles: { 'layout.fluid': { 'layout.gap': 'max({space.sm}, anchor-size(width))' } },
      }).filter(([code]) => code.startsWith('value.') || code.startsWith('unit.')),
    ).toEqual([['value.syntax.aboveFloor', 'warning', '/profiles/layout.fluid/layout.gap']]);
  });

  it('accepts floor syntax, including colour functions and maths the floor parses', () => {
    for (const value of [
      'oklch(0.6 0.15 250)',
      'color-mix(in oklch, #ffffff 20%, #000000)',
      'round(nearest, 1.37rem, 0.25rem)',
      'clamp(1rem, 0.9rem + 0.5vw, 1.25rem)',
      // Within the Baseline 2024 floor (ADR 0046 D1).
      'light-dark(#ffffff, #101010)',
      'oklch(from #3366cc calc(l + 0.1) c h)',
    ]) {
      expect(aboveFloorSyntax(value), value).toEqual([]);
    }
    expect(aboveFloorSyntax('calc(1rem + abs(-2px))').map((e) => e.syntax)).toEqual(['abs()']);
    // Function names inside longer identifiers are not matches.
    expect(aboveFloorSyntax('var(--odd-design-signal)')).toEqual([]);
  });

  it('lists each syntax once with a BCD key', () => {
    const names = ABOVE_FLOOR_SYNTAX.map((e) => e.syntax);
    expect(new Set(names).size).toBe(names.length);
    for (const entry of ABOVE_FLOOR_SYNTAX) {
      expect(entry.bcd).toMatch(/^css\.types\./);
      expect(entry.unsupported.length).toBeGreaterThan(0);
    }
  });
});
