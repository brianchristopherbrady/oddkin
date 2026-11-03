import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  gamutMapP3,
  luminance,
  oklchToLinearP3,
  parseColor,
  toDisplayP3,
  type Oklch,
} from '../src/generate/color.js';
import {
  cssVariable,
  emitCss,
  emitDtcg,
  emitInspectJson,
  generate,
  resolveToken,
  ROLE_CONTRACTS,
  type ResolvedTheme,
} from '../src/generate/index.js';
import { P3_MIN_GAIN } from '../src/generate/p3.js';
import { cases } from './fixtures/cases.js';

// Display P3 values (theming-and-styling.md §10.7): with gamut "p3", generated ramp steps whose
// chroma sRGB reduced are also declared in P3 under (color-gamut: p3), unless a contracted pair
// that passes in sRGB would fail with them.
const GREEN = { brand: { primary: 'oklch(0.65 0.25 145)' } };
const theme = (config: object) => {
  const result = generate(config);
  expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
  return result.theme as ResolvedTheme;
};
const oklch = (text: string): Oklch => parseColor(text) as Oklch;

/** Contracted pairs that pass in sRGB and fail with the P3 values, in every mode and product. */
function p3Failures(t: ResolvedTheme): string[] {
  const out: string[] = [];
  const products = t.scopes.filter((s) => s.kind === 'product').map((s) => s.name);
  for (const product of [undefined, ...products])
    for (const mode of t.modes)
      for (const contract of ROLE_CONTRACTS) {
        if (contract.minimum === 0) continue;
        for (const background of contract.backgrounds) {
          const context = { mode, ...(product ? { product } : {}) };
          const [fg, bg] = [contract.foreground, background].map((n) =>
            resolveToken(t, n, context),
          );
          const [fgWide, bgWide] = [contract.foreground, background].map((n) =>
            resolveToken(t, n, { ...context, gamut: 'p3' }),
          );
          if (![fg, bg].every((c) => /^#[0-9a-f]{6}$/i.test(c ?? ''))) continue;
          if (contrastRatio(fg as string, bg as string) < contract.minimum) continue;
          if (contrastRatio(fgWide as string, bgWide as string) < contract.minimum)
            out.push(`${contract.foreground} on ${background} (${mode}, ${product ?? 'base'})`);
        }
      }
  return out;
}

describe('Display P3 values', () => {
  it('convert with the CSS Color 4 matrices', () => {
    expect(oklchToLinearP3(oklch('#ffffff')).map((v) => v.toFixed(5))).toEqual([
      '1.00000',
      '1.00000',
      '1.00000',
    ]);
    expect(toDisplayP3(oklch('#ff0000'))).toBe('color(display-p3 0.9175 0.2003 0.1386)');
    expect(luminance('color(display-p3 1 1 1)')).toBeCloseTo(1, 6);
    for (const hex of ['#6250e8', '#0f766e', '#e11d48', '#ffffff', '#000000'])
      expect(luminance(toDisplayP3(oklch(hex))), hex).toBeCloseTo(luminance(hex), 3);
  });

  it('change nothing unless the theme asks for them', () => {
    for (const config of [GREEN, { brand: { primary: '#6250e8' } }]) {
      const css = generate(config).css;
      expect(css).not.toContain('color-gamut');
      expect(generate({ ...config, gamut: 'srgb' }).css).toBe(css);
    }
  });

  it('map each ramp step sRGB clipped into P3, at the same lightness and hue, where P3 adds visible chroma', () => {
    const t = theme({ ...GREEN, gamut: 'p3' });
    const wide = [...t.tokens.values()].filter((token) => token.p3 !== undefined);
    expect(wide.map((token) => token.name)).toEqual([
      'ref.brand.500',
      'ref.brand.600',
      'ref.brand.700',
      'ref.brand.800',
      'ref.brand.900',
      'ref.brand.950',
      'ref.info.700',
    ]);
    for (const token of t.tokens.values()) {
      if (token.category !== 'reference' || token.origin !== 'generated') continue;
      const [requested, srgb, p3] = [
        ...(token.provenance ?? '').matchAll(/oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/g),
      ].map((m) => m.slice(1).map(Number) as [number, number, number]);
      if (!requested || !srgb) {
        expect(token.p3, `${token.name} fits sRGB`).toBeUndefined();
        continue;
      }
      if (token.p3 === undefined) {
        const gain = gamutMapP3({ l: requested[0], c: requested[1], h: requested[2] }).c - srgb[1];
        expect(gain, token.name).toBeLessThan(P3_MIN_GAIN + 1e-3);
        continue;
      }
      expect(p3, token.name).toBeDefined();
      const w = p3 as [number, number, number];
      expect([w[0], w[2]], token.name).toEqual([requested[0], requested[2]]);
      expect(w[1] - srgb[1], token.name).toBeGreaterThanOrEqual(P3_MIN_GAIN - 1e-3);
      expect(w[1], token.name).toBeLessThanOrEqual(requested[1]);
      // The provenance rounds to four decimals, so the channels agree to about that.
      const channels = (text: string | undefined) =>
        /^color\(display-p3 ([\d.]+) ([\d.]+) ([\d.]+)\)$/
          .exec(text ?? '')
          ?.slice(1)
          .map(Number);
      const expected = channels(toDisplayP3({ l: w[0], c: w[1], h: w[2] })) as number[];
      (channels(token.p3) as number[]).forEach((v, i) =>
        expect(v, token.name).toBeCloseTo(expected[i] as number, 3),
      );
    }
  });

  it('are declared under (color-gamut: p3) after the sRGB values, for the theme and each product', () => {
    const t = theme(cases['wide-gamut'] as object);
    const css = emitCss(t, { layer: false });
    const block = (selectors: string[], tokens: Iterable<{ name: string; p3?: string }>) => {
      const declarations = [...tokens]
        .filter((token) => token.p3 !== undefined)
        .map((token) => `    ${cssVariable(token.name)}: ${token.p3};`);
      return `@media (color-gamut: p3) {\n${selectors.map((s) => `  ${s}`).join(',\n')} {\n${declarations.join('\n')}\n  }\n}\n`;
    };
    const coral = t.scopes.find((s) => s.name === 'coral');
    const base = block([':root', '[data-odd-theme="vivid"]'], t.tokens.values());
    const product = block(['[data-odd-product="coral"]'], coral?.tokens.values() ?? []);
    expect(css).toContain(base);
    expect(css).toContain(product);
    const at = (text: string) => css.indexOf(text);
    expect(at(':root,\n[data-odd-theme="vivid"] {')).toBeLessThan(at(base));
    expect(at(base)).toBeLessThan(at('[data-odd-mode="light"]'));
    expect(at('[data-odd-product="coral"] {')).toBeLessThan(at(product));
    // The product declares its own P3 steps only; its other steps stay sRGB inside it.
    expect([...(coral?.tokens.values() ?? [])].filter((x) => x.p3).map((x) => x.name)).toEqual([
      'ref.brand.300',
      'ref.brand.400',
      'ref.brand.600',
      'ref.brand.700',
    ]);
  });

  it('resolve in a P3 context, through the roles that alias them', () => {
    const t = theme({ ...GREEN, gamut: 'p3' });
    let aliases = 0;
    for (const token of t.tokens.values()) {
      const light = typeof token.value === 'string' ? token.value : token.value.light;
      const target = t.tokens.get(/^\{([^{}]+)\}$/.exec(light)?.[1] ?? '');
      if (target?.p3 === undefined) continue;
      aliases++;
      expect(resolveToken(t, token.name, { mode: 'light', gamut: 'p3' }), token.name).toBe(
        target.p3,
      );
      expect(resolveToken(t, token.name, { mode: 'light' }), token.name).toBe(target.value);
    }
    expect(aliases).toBeGreaterThan(3);
  });

  it('keep every contracted pair that passes in sRGB passing with the P3 values', () => {
    for (const config of [
      cases['wide-gamut'],
      { ...GREEN, gamut: 'p3' },
      { brand: { primary: 'oklch(0.7 0.2 60)' }, gamut: 'p3' },
      { brand: { primary: 'oklch(0.55 0.25 260)' }, gamut: 'p3' },
    ])
      expect(p3Failures(theme(config as object))).toEqual([]);
  });

  it('hold back a P3 value that would fail a contracted pair, and say which pair', () => {
    // ref.brand.600 reaches 4.5:1 on the light canvas in sRGB, but not in P3.
    const config = {
      brand: { primary: 'oklch(0.6 0.25 220)' },
      gamut: 'p3',
      overrides: { 'color.link': { light: '{ref.brand.600}', dark: '{ref.brand.300}' } },
    };
    const result = generate(config);
    const t = result.theme as ResolvedTheme;
    const step = t.tokens.get('ref.brand.600');
    expect(step?.p3).toBeUndefined();
    expect(step?.provenance).toContain(
      '; Display P3 held back: color.link on color.canvas would be 4.44:1 (light), below 4.5:1',
    );
    expect(step?.provenance).not.toContain('Display P3: oklch');
    expect(p3Failures(t)).toEqual([]);
    // The same step keeps its P3 value where no role puts it at risk.
    expect(theme({ ...config, overrides: {} }).tokens.get('ref.brand.600')?.p3).toMatch(
      /^color\(display-p3 /,
    );
    // A pair that already fails in sRGB is the contrast check's to report; it holds nothing back.
    const failing = generate({
      ...GREEN,
      gamut: 'p3',
      overrides: { 'color.link': { light: '{ref.brand.500}', dark: '{ref.brand.300}' } },
    });
    expect(failing.diagnostics.map((d) => [d.code, d.path])).toEqual([
      ['contrast.fail', '/tokens/color.link'],
    ]);
    expect(failing.theme?.tokens.get('ref.brand.500')?.p3).toMatch(/^color\(display-p3 /);
  });

  it('in a product: steps that differ only in P3 are re-declared, and a hold-back stays in the product', () => {
    // Both brands clip ref.brand.300 to the same sRGB colour; only the product's reaches P3.
    const red = theme({
      brand: { primary: 'oklch(0.6 0.2 25)' },
      gamut: 'p3',
      products: { vivid: { brand: { primary: 'oklch(0.6 0.3 25)' } } },
    });
    const own = red.scopes.find((s) => s.name === 'vivid')?.tokens.get('ref.brand.300');
    expect(own?.value).toBe(red.tokens.get('ref.brand.300')?.value);
    expect([red.tokens.get('ref.brand.300')?.p3, own?.p3]).toEqual([
      undefined,
      'color(display-p3 1 0.61 0.5694)',
    ]);
    expect(emitCss(red, { layer: false })).toContain(
      '@media (color-gamut: p3) {\n  [data-odd-product="vivid"] {\n    --odd-ref-brand-300: color(display-p3 1 0.61 0.5694);',
    );

    const sky = theme({
      ...GREEN,
      gamut: 'p3',
      products: {
        sky: {
          brand: { primary: 'oklch(0.6 0.25 220)' },
          overrides: { 'color.link': { light: '{ref.brand.600}', dark: '{ref.brand.300}' } },
        },
      },
    });
    const step = sky.scopes.find((s) => s.name === 'sky')?.tokens.get('ref.brand.600');
    expect(step?.p3).toBeUndefined();
    expect(step?.provenance).toContain(
      '; Display P3 held back: color.link on color.canvas would be 4.44:1 (light, product "sky"), below 4.5:1',
    );
    expect(sky.tokens.get('ref.brand.600')?.p3).toMatch(/^color\(display-p3 /);
    expect(p3Failures(sky)).toEqual([]);
  });

  it('show in the inspection, and are listed as lossy in DTCG with the value in the extension', () => {
    const t = theme({ ...GREEN, gamut: 'p3' });
    const step = t.tokens.get('ref.brand.700');
    const inspected = (
      JSON.parse(emitInspectJson(t)) as { tokens: Array<{ name: string; p3?: string }> }
    ).tokens.find((x) => x.name === 'ref.brand.700');
    expect(inspected?.p3).toBe(step?.p3);
    const dtcg = emitDtcg(t);
    expect(dtcg.mappings.find((m) => m.token === 'ref.brand.700')).toEqual({
      token: 'ref.brand.700',
      kind: 'lossy',
      reason: `the Display P3 value (${step?.p3}) under @media (color-gamut: p3) is only in $extensions`,
    });
    const node = (dtcg.document as Record<string, Record<string, Record<string, unknown>>>)[
      'ref'
    ]?.['brand']?.['700'] as { $extensions: Record<string, { p3?: string }> };
    expect(node.$extensions['dev.oddkin']?.p3).toBe(step?.p3);
  });

  it('report an unknown gamut at /gamut', () => {
    for (const gamut of ['rec2020', 'P3', 3, null, true, {}])
      expect(
        generate({ ...GREEN, gamut }).diagnostics.map((d) => [d.code, d.path]),
        JSON.stringify(gamut),
      ).toEqual([['gamut.invalid', '/gamut']]);
  });
});
