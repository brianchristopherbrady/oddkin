import { describe, expect, it } from 'vitest';
import { emitDtcg, emitInspectJson, emitValuesModule, generate } from '../src/index.js';

// Plan 240 (spacing strategy semantics) and 241 (rem and the consumer's root size);
// theming-and-styling.md §3–§4.

const BRAND = { primary: '#5b46e8' } as const;
const space = (spacing: unknown) => {
  const result = generate({ brand: BRAND, spacing });
  return {
    codes: result.diagnostics.map((d) => [d.code, d.path]),
    steps: Object.fromEntries(
      [...(result.theme?.tokens.values() ?? [])]
        .filter((t) => t.name.startsWith('space.'))
        .map((t) => [t.name.slice('space.'.length), t.value]),
    ),
  };
};
const REQUIRED = { xs: '0.5rem', sm: '0.75rem', md: '1rem', lg: '1.5rem' };

describe('spacing strategies (plan 240)', () => {
  it('requires the steps preset roles alias, reported once at /spacing', () => {
    const explicit = generate({
      brand: BRAND,
      spacing: { strategy: 'explicit', steps: { tiny: '0.1rem' } },
    });
    expect(explicit.diagnostics.map((d) => [d.code, d.path])).toEqual([
      ['spacing.missingStep', '/spacing'],
    ]);
    expect(explicit.diagnostics[0]?.message).toContain('"xs", "sm", "md", "lg"');
    expect(explicit.diagnostics[0]?.suggestion).toContain('/spacing/steps');
    const ratio = generate({
      brand: BRAND,
      spacing: { strategy: 'ratio', base: '1rem', ratio: 1.5, stepsBelow: 1, stepsAbove: 1 },
    });
    expect(ratio.diagnostics.map((d) => [d.code, d.path])).toEqual([
      ['spacing.missingStep', '/spacing'],
    ]);
    expect(ratio.diagnostics[0]?.message).toContain('no step "xs"');
    expect(ratio.diagnostics[0]?.suggestion).toContain('stepsBelow ≥ 2');
    // A reference the user wrote keeps its own error and suggestion.
    const typo = generate({ brand: BRAND, overrides: { 'layout.gap': '{space.mdd}' } });
    expect(typo.diagnostics.map((d) => [d.code, d.path, d.suggestion])).toEqual([
      ['alias.missing', '/overrides/layout.gap', 'Did you mean "{space.md}"?'],
    ]);
  });

  it('bounds counts and factors, allows zero, and keeps explicit values as written', () => {
    expect(
      space({ strategy: 'ratio', base: '1rem', ratio: 1.5, stepsBelow: 13, stepsAbove: 1 }).codes,
    ).toEqual([['scale.invalidParameter', '/spacing/stepsBelow']]);
    expect(
      space({ strategy: 'ratio', base: '1rem', ratio: 1, stepsBelow: 2, stepsAbove: 1 }).codes,
    ).toEqual([['scale.invalidParameter', '/spacing/ratio']]);
    expect(
      space({
        strategy: 'multiples',
        unit: '0.25rem',
        steps: { none: 0, xs: 2, sm: 3, md: 4, lg: -6 },
      }).codes,
    ).toEqual([['scale.invalidParameter', '/spacing/steps/lg']]);
    const multiples = space({
      strategy: 'multiples',
      unit: '0.25rem',
      steps: { none: 0, xs: 2, sm: 3, md: 4, lg: 6 },
    });
    expect(multiples.codes).toEqual([]);
    expect(multiples.steps).toMatchObject({ none: '0', xs: '0.5rem', lg: '1.5rem' });
    // Explicit scales are taken as written, including a negative step for pulls.
    const explicit = space({
      strategy: 'explicit',
      steps: { ...REQUIRED, none: '0', pull: '-0.5rem' },
    });
    expect(explicit.codes).toEqual([]);
    expect(explicit.steps).toMatchObject({ none: '0', pull: '-0.5rem' });
  });

  it('rounds to 4 decimals in the source unit and never converts units', () => {
    const ratio = space({
      strategy: 'ratio',
      base: '1em',
      ratio: 1.5,
      stepsBelow: 2,
      stepsAbove: 1,
    });
    expect(ratio.codes).toEqual([]);
    expect(ratio.steps).toEqual({ xs: '0.4444em', sm: '0.6667em', md: '1em', lg: '1.5em' });
    const px = space({
      strategy: 'explicit',
      steps: { xs: '8px', sm: '12px', md: '16px', lg: '24px' },
    });
    expect(px.steps).toMatchObject({ md: '16px' });
    expect(px.codes.every(([code]) => code === 'unit.discouraged')).toBe(true);
  });

  it('extends without renaming or revaluing existing steps', () => {
    const ratio = (above: number, below: number) =>
      space({ strategy: 'ratio', base: '1rem', ratio: 1.25, stepsBelow: below, stepsAbove: above })
        .steps;
    const small = ratio(1, 2);
    const large = ratio(4, 5);
    for (const [name, value] of Object.entries(small)) expect(large[name], name).toBe(value);
    expect(Object.keys(large).sort()).toEqual(
      ['4xs', '3xs', '2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'].sort(),
    );
    const multiples = (steps: Record<string, number>) =>
      space({
        strategy: 'multiples',
        unit: '0.25rem',
        steps: { xs: 2, sm: 3, md: 4, lg: 6, ...steps },
      }).steps;
    const before = multiples({});
    const after = multiples({ xl: 8, '2xl': 12 });
    for (const [name, value] of Object.entries(before)) expect(after[name], name).toBe(value);
  });
});

describe('rem and the consumer root size (plan 241)', () => {
  const result = generate({ brand: BRAND });
  const theme = result.theme as NonNullable<typeof result.theme>;

  it('declares only custom properties and color-scheme: no root font size, no other property', () => {
    const properties = [...(result.css ?? '').matchAll(/^\s*([a-z-]+)\s*:/gm)].map(
      (m) => m[1] as string,
    );
    expect(properties.length).toBeGreaterThan(100);
    expect(properties.filter((p) => !p.startsWith('--odd-') && p !== 'color-scheme')).toEqual([]);
  });

  it('keeps rem in every output instead of assuming a pixel size', () => {
    expect(result.css).toContain('--odd-space-md: 1rem;');
    expect(emitValuesModule(theme)).toMatch(/md: '1rem'/);
    const inspection = JSON.parse(emitInspectJson(theme)) as {
      tokens: Array<{ name: string; value: unknown }>;
    };
    expect(inspection.tokens.find((t) => t.name === 'space.md')?.value).toBe('1rem');
    const dtcg = emitDtcg(theme).document as { space: { md: { $value: unknown } } };
    expect(dtcg.space.md.$value).toEqual({ value: 1, unit: 'rem' });
  });
});
