import { readFile, writeFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  cssStats,
  gamutMap,
  generate,
  generateSpacing,
  parseColor,
  resolveToken,
  toHex,
  type Diagnostic,
} from '../src/index.js';
import { DiagnosticList } from '../src/generate/diagnostics.js';
import { cases } from './fixtures/cases.js';

const spacing = (config: unknown) => {
  const diagnostics = new DiagnosticList();
  const steps = generateSpacing(config, diagnostics);
  return {
    steps: steps?.map((s) => [
      s.name,
      `${s.value.value === 0 ? '0' : `${s.value.value}${s.value.unit}`}`,
    ]),
    diagnostics: diagnostics.items,
  };
};

const codes = (diagnostics: readonly Diagnostic[]) => diagnostics.map((d) => [d.code, d.path]);

describe('spacing strategies', () => {
  it('multiples: 0.25rem × 1, 2, 3, 4.5, 9', () => {
    expect(
      spacing({
        strategy: 'multiples',
        unit: '0.25rem',
        steps: { xs: 1, sm: 2, md: 3, lg: 4.5, xl: 9 },
      }).steps,
    ).toEqual([
      ['xs', '0.25rem'],
      ['sm', '0.5rem'],
      ['md', '0.75rem'],
      ['lg', '1.125rem'],
      ['xl', '2.25rem'],
    ]);
  });

  it('ratio: 0.75rem, 1.5, two steps each side, rounded to 4 decimals in the source unit', () => {
    expect(
      spacing({ strategy: 'ratio', base: '0.75rem', ratio: 1.5, stepsBelow: 2, stepsAbove: 2 })
        .steps,
    ).toEqual([
      ['xs', '0.3333rem'],
      ['sm', '0.5rem'],
      ['md', '0.75rem'],
      ['lg', '1.125rem'],
      ['xl', '1.6875rem'],
    ]);
  });

  it('keeps existing names and values when steps are added', () => {
    const before =
      spacing({ strategy: 'ratio', base: '0.75rem', ratio: 1.5, stepsBelow: 2, stepsAbove: 2 })
        .steps ?? [];
    const after =
      spacing({ strategy: 'ratio', base: '0.75rem', ratio: 1.5, stepsBelow: 4, stepsAbove: 3 })
        .steps ?? [];
    for (const step of before) expect(after).toContainEqual(step);
    expect(after.map(([name]) => name)).toEqual([
      '3xs',
      '2xs',
      'xs',
      'sm',
      'md',
      'lg',
      'xl',
      '2xl',
    ]);
  });

  it('supports explicit scales, custom ratio names, and explicit snapping', () => {
    expect(spacing({ strategy: 'explicit', steps: { none: '0', md: '1rem' } }).steps).toEqual([
      ['none', '0'],
      ['md', '1rem'],
    ]);
    expect(
      spacing({
        strategy: 'ratio',
        base: '1rem',
        ratio: 2,
        stepsBelow: 1,
        stepsAbove: 1,
        names: ['small', 'base', 'large'],
      }).steps,
    ).toEqual([
      ['small', '0.5rem'],
      ['base', '1rem'],
      ['large', '2rem'],
    ]);
    expect(
      spacing({
        strategy: 'ratio',
        base: '0.75rem',
        ratio: 1.5,
        stepsBelow: 2,
        stepsAbove: 0,
        snap: '0.125rem',
      }).steps,
    ).toEqual([
      ['xs', '0.375rem'],
      ['sm', '0.5rem'],
      ['md', '0.75rem'],
    ]);
  });

  it('reports invalid strategies with codes and JSON-pointer paths', () => {
    expect(
      codes(
        spacing({ strategy: 'multiples', unit: '0.25rem', steps: { md: 3 }, ratio: 1.5 })
          .diagnostics,
      ),
    ).toEqual([['strategy.conflict', '/spacing/ratio']]);
    expect(codes(spacing({ strategy: 'geometric' }).diagnostics)).toEqual([
      ['strategy.unknown', '/spacing/strategy'],
    ]);
    expect(
      codes(spacing({ strategy: 'multiples', unit: '4', steps: { md: Infinity } }).diagnostics),
    ).toEqual([
      ['unit.invalid', '/spacing/unit'],
      ['number.nonFinite', '/spacing/steps/md'],
    ]);
    expect(
      codes(
        spacing({ strategy: 'ratio', base: '1rem', ratio: 1, stepsBelow: 1, stepsAbove: 13 })
          .diagnostics,
      ),
    ).toEqual([
      ['scale.invalidParameter', '/spacing/ratio'],
      ['scale.invalidParameter', '/spacing/stepsAbove'],
    ]);
    expect(
      codes(
        spacing({
          strategy: 'ratio',
          base: '1rem',
          ratio: 2,
          stepsBelow: 1,
          stepsAbove: 1,
          names: ['a', 'b'],
        }).diagnostics,
      ),
    ).toEqual([['scale.namesMismatch', '/spacing/names']]);
    expect(
      codes(spacing({ strategy: 'explicit', steps: { md: '1rem' }, snap: '2px' }).diagnostics),
    ).toEqual([
      ['unit.discouraged', '/spacing/snap'],
      ['unit.mismatch', '/spacing/snap'],
    ]);
    expect(codes(spacing({ strategy: 'explicit', steps: { md: '12px' } }).diagnostics)).toEqual([
      ['unit.discouraged', '/spacing/steps/md'],
    ]);
    expect(
      codes(
        spacing({
          strategy: 'ratio',
          base: '1rem',
          ratio: 2,
          stepsBelow: 1,
          stepsAbove: 1,
          names: ['a', 'a', 'b'],
        }).diagnostics,
      ),
    ).toEqual([['token.duplicate', '/spacing']]);
  });
});

describe('theme configuration diagnostics', () => {
  const cases: Array<[string, unknown, Array<[string, string]>]> = [
    ['missing brand', {}, [['config.required', '/brand']]],
    ['bad colour', { brand: { primary: 'blue-ish' } }, [['color.invalid', '/brand/primary']]],
    ['unknown key', { brand: { primary: '#000' }, colour: {} }, [['config.unknownKey', '/colour']]],
    ['bad modes', { brand: { primary: '#000' }, modes: ['dim'] }, [['modes.invalid', '/modes']]],
    [
      'bad product name',
      { brand: { primary: '#000' }, products: { Clinic: {} } },
      [['product.name.invalid', '/products/Clinic']],
    ],
    [
      'bad density',
      { brand: { primary: '#000' }, density: { compact: { scale: 0 } } },
      [['density.invalidScale', '/density/compact/scale']],
    ],
    [
      'unknown override',
      { brand: { primary: '#000' }, overrides: { 'color.text.primry': '#000' } },
      [['override.unknown', '/overrides/color.text.primry']],
    ],
    [
      'missing alias',
      { brand: { primary: '#000' }, overrides: { 'color.text.primary': '{ref.brand.650}' } },
      [['alias.missing', '/tokens/color.text.primary']],
    ],
    [
      'cycle',
      {
        brand: { primary: '#000' },
        overrides: { 'layout.gap': '{layout.inset}', 'layout.inset': '{layout.gap}' },
      },
      [['alias.cycle', '/tokens/layout.inset']],
    ],
    [
      'tier violation',
      { brand: { primary: '#000' }, overrides: { 'radius.md': '{layout.gap}' } },
      [['tier.violation', '/tokens/radius.md']],
    ],
    [
      'invalid CSS',
      { brand: { primary: '#000' }, overrides: { 'font.family.sans': 'x; color: red' } },
      [['value.invalidCss', '/tokens/font.family.sans']],
    ],
    [
      'bad override colour',
      { brand: { primary: '#000' }, overrides: { 'color.text.primary': 'nope' } },
      [['color.invalid', '/overrides/color.text.primary']],
    ],
    [
      'density below target minimum',
      { brand: { primary: '#000' }, density: { tight: { scale: 0.5 } } },
      [
        ['target.belowMinimum', '/density/tight/tokens/control.height.md'],
        ['target.belowMinimum', '/density/tight/tokens/control.height.sm'],
        ['target.belowMinimum', '/density/tight/tokens/navigation.item.min-height'],
      ],
    ],
  ];

  for (const [label, config, expected] of cases) {
    it(label, () => {
      const result = generate(config);
      expect(codes(result.diagnostics)).toEqual(expected);
      expect(result.ok).toBe(false);
    });
  }

  it('suggests the closest name', () => {
    const [diagnostic] = generate({
      brand: { primary: '#000' },
      overrides: { 'color.text.primry': '#000' },
    }).diagnostics;
    expect(diagnostic?.suggestion).toBe('Did you mean "color.text.primary"?');
  });
});

describe('colour', () => {
  it('round-trips in-gamut sRGB colours', () => {
    for (const hex of ['#5b46e8', '#0f766e', '#ffffff', '#000000', '#777777', '#facc15']) {
      expect(toHex(parseColor(hex) as never)).toBe(hex);
    }
  });

  it('maps out-of-gamut colours by reducing chroma only', () => {
    const requested = { l: 0.7, c: 0.4, h: 145 };
    const mapped = gamutMap(requested);
    expect([mapped.l, mapped.h]).toEqual([0.7, 145]);
    expect(mapped.c).toBeLessThan(0.4);
    expect(mapped.c).toBeGreaterThan(0.1);
  });

  it('computes WCAG 2 contrast', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBe(21);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });

  it('chooses passing roles for a wide range of brand colours, in every mode and product', () => {
    const brands = [
      '#5b46e8',
      '#0f766e',
      '#e11d48',
      '#facc15',
      '#22c55e',
      '#06b6d4',
      '#000000',
      '#ffffff',
      '#808080',
      '#ff00ff',
      '#7c2d12',
      '#a3e635',
      '#f97316',
      '#1e3a8a',
    ];
    for (const primary of brands) {
      const result = generate({ brand: { primary } });
      expect(result.diagnostics, primary).toEqual([]);
    }
    const products = Object.fromEntries(
      brands.map((primary, i) => [`p${i}`, { brand: { primary } }]),
    );
    const all = generate({ brand: { primary: '#5b46e8' }, products });
    expect(all.diagnostics).toEqual([]);
  });

  it('reports, but never silently fixes, overrides that fail contrast', () => {
    const result = generate({
      brand: { primary: '#5b46e8' },
      overrides: { 'color.text.secondary': { light: '#bbbbbb', dark: '{ref.neutral.300}' } },
    });
    expect(result.ok).toBe(true);
    expect(result.diagnostics.map((d) => [d.code, d.severity, d.path])).toEqual([
      ['contrast.fail', 'warning', '/tokens/color.text.secondary'],
    ]);
    expect(result.diagnostics[0]?.message).toContain('an override is involved');
    expect(resolveToken(result.theme as never, 'color.text.secondary', { mode: 'light' })).toBe(
      '#bbbbbb',
    );
  });
});

describe('brand-only theme', () => {
  const result = generate({ brand: { primary: '#5b46e8' } });

  it('is complete and valid from one colour', () => {
    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
    const names = [...(result.theme?.tokens.keys() ?? [])];
    for (const name of [
      'ref.brand.600',
      'space.md',
      'color.action.default',
      'color.text.primary',
      'control.height.md',
      'layout.gap',
      'navigation.item.padding.inline',
    ]) {
      expect(names).toContain(name);
    }
  });

  it('records provenance for every token', () => {
    for (const token of result.theme?.tokens.values() ?? [])
      expect(['preset', 'generated', 'configured', 'overridden']).toContain(token.origin);
    expect(result.theme?.tokens.get('ref.brand.600')?.provenance).toMatch(/^oklch\(0\.54 /);
    expect(result.theme?.tokens.get('color.action.default')?.provenance).toContain(
      '4.5:1 against color.text.on-action',
    );
  });

  it('switches mode-dependent roles with toggles, not cross-product selectors', () => {
    const css = result.css ?? '';
    expect(css).toContain(
      '--mote-color-action-default: var(--mote-mode-light, var(--mote-ref-brand-600)) var(--mote-mode-dark, var(--mote-ref-brand-400));',
    );
    expect(css).toContain('--mote-mode-dark: ;');
    expect(css).not.toMatch(/\[data-mote-mode="dark"\]\s+\[data-mote-product/);
  });
});

describe('scopes and alias closure', () => {
  const { theme } = generate(cases['products-density']);
  const scope = (name: string) => theme?.scopes.find((s) => `${s.kind}:${s.name}` === name);

  it('re-declares only changed tokens and their dependents', () => {
    const clinic = scope('product:clinic');
    expect(clinic?.changed.every((n) => /^ref\.(brand|neutral)\./.test(n))).toBe(true);
    expect([...(clinic?.tokens.keys() ?? [])]).toEqual(
      expect.arrayContaining(['ref.brand.600', 'color.action.default', 'color.surface.selected']),
    );
    expect(clinic?.tokens.has('space.md')).toBe(false);
    const compact = scope('density:compact');
    expect([...(compact?.tokens.keys() ?? [])]).toEqual(
      expect.arrayContaining([
        'space.md',
        'layout.gap',
        'control.padding.inline.md',
        'navigation.item.min-height',
      ]),
    );
    expect(compact?.tokens.has('color.action.default')).toBe(false);
    expect(resolveToken(theme as never, 'navigation.item.min-height', { density: 'compact' })).toBe(
      '1.875rem',
    );
  });

  it('keeps emitted rule growth linear in scope axes', () => {
    const stats = cssStats(theme as never);
    expect(stats.mode).toBeLessThan(40);
    for (const count of Object.values(stats.scopes)) expect(count).toBeLessThan(60);
  });
});

describe('determinism', () => {
  for (const [name, config] of Object.entries(cases)) {
    it(`${name}: identical output across runs and matches the committed fixture`, async () => {
      const first = generate(config);
      const second = generate(structuredClone(config));
      expect(first.ok).toBe(true);
      expect(second.css).toBe(first.css);
      const fixture = new URL(`./fixtures/${name}.css.txt`, import.meta.url);
      if (process.env['UPDATE_FIXTURES']) await writeFile(fixture, first.css ?? '');
      expect(first.css).toBe(await readFile(fixture, 'utf8'));
    });
  }
});
