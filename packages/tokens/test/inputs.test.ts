import { describe, expect, it } from 'vitest';
import {
  emitInspectJson,
  generate,
  resolveToken,
  type ResolvedTheme,
} from '../src/generate/index.js';
import { INPUT_BOUNDS } from '../src/generate/inputs.js';
import { mergeThemes, type ThemeConfig } from '../src/theme/index.js';

// Foundation inputs beside spacing (theming-and-styling.md §10.3; P1.1 for Theme Studio's controls).
const BASE = { brand: { primary: '#6250e8' } } as const;
const theme = (config: object) => {
  const result = generate({ ...BASE, ...config });
  expect(result.diagnostics).toEqual([]);
  return result.theme as ResolvedTheme;
};
const value = (t: ResolvedTheme, name: string) => resolveToken(t, name, { mode: 'light' });
const codes = (config: object) =>
  generate({ ...BASE, ...config }).diagnostics.map((d) => [d.code, d.path]);

describe('foundation inputs', () => {
  it('change nothing when unset, or set to 1', () => {
    const css = generate(BASE).css;
    for (const config of [
      { radius: {}, motion: {}, typography: {} },
      { radius: { scale: 1 }, motion: { scale: 1 } },
    ])
      expect(generate({ ...BASE, ...config }).css).toBe(css);
  });

  it('radius.scale multiplies radius.xs to radius.2xl, and the roles that read them follow', () => {
    const half = theme({ radius: { scale: 0.5 } });
    expect(
      ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', 'full'].map((s) => value(half, `radius.${s}`)),
    ).toEqual(['0', '0.0625rem', '0.125rem', '0.25rem', '0.375rem', '0.5rem', '0.75rem', '9999px']);
    expect(value(half, 'control.radius')).toBe('0.25rem');
    const square = theme({ radius: { scale: 0 } });
    expect(value(square, 'radius.2xl')).toBe('0');
    expect(value(square, 'radius.full')).toBe('9999px');
    expect(value(theme({ radius: { scale: 3 } }), 'radius.md')).toBe('1.5rem');
  });

  it('motion.scale multiplies the durations in whole milliseconds, and reduced motion stays 0ms', () => {
    const t = theme({ motion: { scale: 0.5 } });
    expect(
      ['fast', 'normal', 'slow', 'slower'].map((s) => value(t, `motion.duration.${s}`)),
    ).toEqual(['50ms', '100ms', '150ms', '250ms']);
    expect(t.tokens.get('motion.duration.normal')?.reducedMotion).toBe('0ms');
    expect(value(theme({ motion: { scale: 0.333 } }), 'motion.duration.fast')).toBe('33ms');
    expect(generate({ ...BASE, motion: { scale: 2 } }).css).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{[^}]*--odd-motion-duration-slower: 0ms;/,
    );
  });

  it('typography.scale generates font.size.xs to font.size.4xl, with md = base, and text styles follow', () => {
    const t = theme({ typography: { scale: { base: '1rem', ratio: 1.25 } } });
    expect(
      ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl'].map((s) => value(t, `font.size.${s}`)),
    ).toEqual([
      '0.64rem',
      '0.8rem',
      '1rem',
      '1.25rem',
      '1.5625rem',
      '1.9531rem',
      '2.4414rem',
      '3.0518rem',
    ]);
    expect(value(t, 'type.display.size')).toBe(value(t, `font.size.${'4xl'}`));
  });

  it('label what they generate in the inspection, and explicit overrides still win', () => {
    const result = generate({
      ...BASE,
      radius: { scale: 2 },
      typography: { scale: { base: '1rem', ratio: 1.2 } },
      overrides: { 'radius.lg': '0.3rem' },
    });
    const inspected = JSON.parse(emitInspectJson(result.theme as ResolvedTheme)) as {
      tokens: Array<{ name: string; origin: string; provenance?: string; value: unknown }>;
    };
    const token = (name: string) => inspected.tokens.find((t) => t.name === name);
    expect(token('radius.md')).toMatchObject({
      origin: 'generated',
      provenance: '0.5rem × 2 (radius.scale)',
      value: '1rem',
    });
    expect(token('font.size.lg')).toMatchObject({
      origin: 'generated',
      provenance: '1rem × 1.2^1 (typography.scale)',
    });
    expect(token('radius.lg')).toMatchObject({ origin: 'overridden', value: '0.3rem' });
    expect(token('motion.duration.fast')).toMatchObject({ origin: 'preset' });
  });

  it('report a wrong or out-of-range value at the input’s pointer', () => {
    expect(codes({ radius: { scale: 3.5 } })).toEqual([
      ['scale.invalidParameter', '/radius/scale'],
    ]);
    expect(codes({ radius: { scale: -0.1 } })).toEqual([
      ['scale.invalidParameter', '/radius/scale'],
    ]);
    expect(codes({ radius: { scale: '1' } })).toEqual([
      ['scale.invalidParameter', '/radius/scale'],
    ]);
    expect(codes({ motion: { scale: 0 } })).toEqual([['scale.invalidParameter', '/motion/scale']]);
    expect(codes({ motion: { scale: 2.1 } })).toEqual([
      ['scale.invalidParameter', '/motion/scale'],
    ]);
    const scale = (s: object) => codes({ typography: { scale: s } });
    expect(scale({ base: '1rem', ratio: 1 })).toEqual([
      ['scale.invalidParameter', '/typography/scale/ratio'],
    ]);
    expect(scale({ base: '1rem', ratio: 2.5 })).toEqual([
      ['scale.invalidParameter', '/typography/scale/ratio'],
    ]);
    expect(scale({ ratio: 1.2 })).toEqual([['config.required', '/typography/scale/base']]);
    expect(scale({ base: '1rem' })).toEqual([['config.required', '/typography/scale/ratio']]);
    expect(scale({ base: '0', ratio: 1.2 })).toEqual([['unit.invalid', '/typography/scale/base']]);
    expect(scale({ base: '16px', ratio: 1.2 })).toEqual([
      ['unit.discouraged', '/typography/scale/base'],
    ]);
    expect(codes({ radius: 2 })).toEqual([['config.type', '/radius']]);
    expect(codes({ typography: { scale: 1.2 } })).toEqual([['config.type', '/typography/scale']]);
    const unknown = generate({ ...BASE, radius: { scal: 1 } }).diagnostics;
    expect(unknown.map((d) => [d.code, d.path, d.suggestion])).toEqual([
      ['config.unknownKey', '/radius/scal', 'Did you mean "scale"?'],
    ]);
  });

  it('hold the bounds the schema states', async () => {
    const { readFile } = await import('node:fs/promises');
    const schema = JSON.parse(
      await readFile(new URL('../schema/theme-config.v1.schema.json', import.meta.url), 'utf8'),
    ) as { properties: Record<string, { properties: Record<string, Record<string, unknown>> }> };
    const field = (domain: string, name: string) => schema.properties[domain]!.properties[name]!;
    expect(field('radius', 'scale')).toMatchObject({ ...INPUT_BOUNDS.radius, default: 1 });
    expect(field('motion', 'scale')).toMatchObject({ ...INPUT_BOUNDS.motion, default: 1 });
    const ratio = (field('typography', 'scale')['properties'] as Record<string, object>)['ratio'];
    expect(ratio).toMatchObject({ ...INPUT_BOUNDS.ratio, default: 1.2 });
  });

  it('merge by key when a file extends a base, and null removes a base’s input', () => {
    const base: ThemeConfig = {
      ...BASE,
      radius: { scale: 2 },
      motion: { scale: 0.5 },
      typography: { scale: { base: '1rem', ratio: 1.2 } },
    };
    const kept = mergeThemes(base, { extends: './base.json', radius: { scale: 1.5 } });
    expect(kept).toMatchObject({ radius: { scale: 1.5 }, motion: { scale: 0.5 } });
    const removed = mergeThemes(base, {
      extends: './base.json',
      radius: { scale: null },
      motion: { scale: null },
      typography: { scale: null },
    });
    expect(removed).toMatchObject({ radius: {}, motion: {}, typography: {} });
    const t = theme(removed);
    expect([
      value(t, 'radius.md'),
      value(t, 'motion.duration.fast'),
      value(t, 'font.size.lg'),
    ]).toEqual(['0.5rem', '100ms', '1.125rem']);
  });
});
