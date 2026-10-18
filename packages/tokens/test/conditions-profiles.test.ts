import { describe, expect, it } from 'vitest';
import { generate, resolveToken, type Diagnostic } from '../src/index.js';
import { conditions } from '../src/conditions/index.js';

const codes = (diagnostics: readonly Diagnostic[]) => diagnostics.map((d) => [d.code, d.path]);
const base = { brand: { primary: '#5b46e8' } };

describe('conditions', () => {
  it('serializes container and media conditions to literal queries', () => {
    const { theme, diagnostics } = generate({
      ...base,
      conditions: {
        'navigation.expanded': { container: 'side-nav', minInlineSize: '40rem' },
        'card.stacked': { container: true, maxWidth: '30rem' },
        'page.band': { media: { minWidth: '40rem', maxWidth: '64rem' } },
        'motion.calm': { media: { prefersReducedMotion: 'reduce', forcedColors: 'none' } },
      },
    });
    expect(diagnostics).toEqual([]);
    const get = (name: string) => theme?.conditions.get(name);
    expect(get('navigation.expanded')).toMatchObject({
      kind: 'container',
      query: 'side-nav (min-inline-size: 40rem)',
      atRule: '@container side-nav (min-inline-size: 40rem)',
      origin: 'configured',
    });
    expect(get('card.stacked')?.atRule).toBe('@container (max-width: 30rem)');
    expect(get('page.band')?.atRule).toBe('@media (min-width: 40rem) and (max-width: 64rem)');
    expect(get('motion.calm')?.query).toBe(
      '(prefers-reduced-motion: reduce) and (forced-colors: none)',
    );
    expect(get('page.wide')?.origin).toBe('preset');
  });

  it('exports the default conditions without a DOM', () => {
    expect(conditions['navigation.expanded'].atRule).toBe(
      '@container shell (min-inline-size: 48rem)',
    );
    expect(Object.keys(conditions)).toEqual([
      'motion.reduced',
      'navigation.expanded',
      'page.medium',
      'page.wide',
    ]);
  });

  it('rejects values queries cannot use, and warns about px', () => {
    const result = (condition: unknown) =>
      codes(generate({ ...base, conditions: { 'x.y': condition } }).diagnostics);
    expect(result({ container: 'nav', minInlineSize: 'var(--w)' })).toEqual([
      ['condition.unit.invalid', '/conditions/x.y/minInlineSize'],
    ]);
    expect(result({ container: 'nav', minWidth: '50%' })).toEqual([
      ['condition.unit.invalid', '/conditions/x.y/minWidth'],
    ]);
    expect(result({ container: 'nav', minWidth: '40' })).toEqual([
      ['condition.unit.invalid', '/conditions/x.y/minWidth'],
    ]);
    expect(result({ container: 'nav', minWidth: '640px' })).toEqual([
      ['condition.unit.px', '/conditions/x.y/minWidth'],
    ]);
    expect(result({ media: { minInlineSize: '40rem' } })).toEqual([
      ['condition.feature.unsupported', '/conditions/x.y/media/minInlineSize'],
    ]);
    expect(result({ media: { prefersReducedMotion: 'sometimes' } })).toEqual([
      ['condition.feature.invalid', '/conditions/x.y/media/prefersReducedMotion'],
    ]);
    expect(result({ container: 'nav', minWidth: '50rem', maxWidth: '40rem' })).toEqual([
      ['condition.range.empty', '/conditions/x.y/minWidth'],
    ]);
    expect(result({ container: 'none', minWidth: '1rem' })).toEqual([
      ['condition.container.invalid', '/conditions/x.y/container'],
    ]);
    expect(result({ container: 'nav' })).toEqual([['condition.empty', '/conditions/x.y']]);
    expect(result({ width: '1rem' })).toEqual([['condition.kind', '/conditions/x.y']]);
  });
});

describe('profiles', () => {
  it('emits attribute-scoped role overrides with their alias closure and nested-scope re-application', () => {
    const { theme, css } = generate(base);
    const compact = theme?.scopes.find((s) => s.kind === 'profile' && s.name === 'layout.compact');
    expect(compact?.changed).toEqual(['layout.gap', 'layout.inset']);
    expect([...(compact?.tokens.keys() ?? [])]).toContain('card.padding');
    expect(css).toContain(
      '[data-odd-profile~="layout.compact"],\n  [data-odd-profile~="layout.compact"] :is([data-odd-mode], [data-odd-product], [data-odd-density], [data-odd-theme]) {',
    );
    expect(resolveToken(theme as never, 'card.padding', { profiles: ['layout.compact'] })).toBe(
      '1rem',
    );
    expect(
      resolveToken(theme as never, 'navigation.item.padding.block', {
        profiles: ['navigation.compact'],
      }),
    ).toBe('calc(0.5rem / 2)');
  });

  it('emits profiles after products and densities so they win on the same element', () => {
    const { css } = generate({ ...base, products: { clinic: { brand: { primary: '#0f766e' } } } });
    const order = [
      '[data-odd-product="clinic"]',
      '[data-odd-density="compact"]',
      '[data-odd-profile~="navigation.compact"]',
    ].map((s) => css?.indexOf(s) ?? -1);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every((i) => i > 0)).toBe(true);
  });

  it('may override only layout and component roles, with valid values and references', () => {
    const result = (profile: unknown) =>
      codes(generate({ ...base, profiles: { 'x.dense': profile } }).diagnostics);
    expect(result({ 'space.md': '0.5rem' })).toEqual([
      ['profile.category', '/profiles/x.dense/space.md'],
    ]);
    expect(result({ 'color.text.primary': '#000' })).toEqual([
      ['profile.category', '/profiles/x.dense/color.text.primary'],
    ]);
    expect(result({ 'layout.gapp': '0.5rem' })).toEqual([
      ['profile.unknown', '/profiles/x.dense/layout.gapp'],
    ]);
    expect(result({ 'layout.item-min': 'wide' })).toEqual([
      ['unit.invalid', '/profiles/x.dense/layout.item-min'],
    ]);
    expect(result({ 'layout.item-min': '{space.huge}' })).toEqual([
      ['alias.missing', '/profiles/x.dense/layout.item-min'],
    ]);
    expect(result({ 'layout.item-min': '{card.padding}' })).toEqual([
      ['tier.violation', '/profiles/x.dense/layout.item-min'],
    ]);
  });

  it('never lowers a target below the minimum, alone or combined with a density', () => {
    const alone = generate({
      ...base,
      profiles: { 'navigation.tiny': { 'navigation.item.min-height': '1rem' } },
    });
    expect(codes(alone.diagnostics)).toEqual([
      ['target.belowMinimum', '/profiles/navigation.tiny/navigation.item.min-height'],
      [
        'target.belowMinimum',
        '/profiles/navigation.tiny/density/compact/navigation.item.min-height',
      ],
    ]);
    const combined = generate({
      ...base,
      density: { compact: { scale: 0.7 } },
      profiles: { 'navigation.short': { 'navigation.item.min-height': '{control.height.sm}' } },
    });
    expect(codes(combined.diagnostics)).toEqual([
      ['target.belowMinimum', '/density/compact/tokens/control.height.sm'],
      [
        'target.belowMinimum',
        '/profiles/navigation.short/density/compact/navigation.item.min-height',
      ],
    ]);
  });

  it('warns when profiles overlap and states which wins', () => {
    const result = generate({
      ...base,
      profiles: { 'page.dense': { 'layout.gap': '{space.xs}' } },
    });
    expect(result.ok).toBe(true);
    expect(codes(result.diagnostics)).toEqual([
      ['profile.overlap', '/profiles/page.dense/layout.gap'],
    ]);
    expect(result.diagnostics[0]?.suggestion).toContain('"page.dense" wins');
  });
});

describe('unit policy', () => {
  const result = (overrides: Record<string, string>) =>
    codes(generate({ ...base, overrides }).diagnostics);

  it('requires unitless line heights, valid font weights, and lengths with units', () => {
    expect(result({ 'line-height.normal': '24px' })).toEqual([
      ['unit.invalid', '/tokens/line-height.normal'],
    ]);
    expect(result({ 'font.weight.bold': '1200' })).toEqual([
      ['unit.invalid', '/tokens/font.weight.bold'],
    ]);
    expect(result({ 'radius.md': '8' })).toEqual([['unit.invalid', '/tokens/radius.md']]);
    expect(result({ 'radius.md': 'calc({space.xs} / 2)' })).toEqual([]);
  });

  it('warns about px where sizes should follow the reader’s font size, and allows px borders', () => {
    expect(result({ 'font.size.md': '16px' })).toEqual([
      ['unit.discouraged', '/tokens/font.size.md'],
    ]);
    expect(result({ 'control.height.md': '40px' })).toEqual([
      ['unit.discouraged', '/tokens/control.height.md'],
      ['target.unitMismatch', '/tokens/control.height.md'],
      ['target.unitMismatch', '/tokens/navigation.item.min-height'],
    ]);
    expect(result({ 'border.width.default': '1px', 'focus.width': '3px' })).toEqual([]);
  });
});
