import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { describeRecipe } from '@oddkin/core/layout/inspect';
import { createLayoutHelpers } from '@oddkin/core/layout';
import {
  LAYOUT_DEFAULTS,
  autoGrid,
  condition,
  defineLayoutRecipe,
  grid,
  row,
  split,
  stack,
} from '../src/layout/index.js';

const built = readFileSync(new URL('../dist/css/layout.css', import.meta.url), 'utf8');
const body = (selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\>:]/g, '\\$&');
  return (new RegExp(`\\n  ${escaped} \\{([^}]*)\\}`).exec(built)?.[1] ?? '')
    .split(';')
    .map((d) => d.trim())
    .filter(Boolean);
};

describe('Oddkin-bound helpers', () => {
  it('default gaps and minimums to the layout roles', () => {
    expect(LAYOUT_DEFAULTS).toEqual({
      gap: 'var(--odd-layout-gap)',
      itemMin: 'var(--odd-layout-item-min)',
      sideWidth: 'var(--odd-layout-sidebar-width)',
      mainMin: 'var(--odd-layout-main-min)',
    });
    expect(stack().declarations).toContainEqual(['gap', 'var(--odd-layout-gap)']);
    expect(row({ wrap: true }).declarations).toContainEqual(['flex-wrap', 'wrap']);
    expect(grid({ columns: 3 }).declarations).toContainEqual([
      'grid-template-columns',
      'repeat(3, minmax(0, 1fr))',
    ]);
    expect(autoGrid().declarations).toContainEqual([
      'grid-template-columns',
      'repeat(auto-fill, minmax(min(var(--odd-layout-item-min), 100%), 1fr))',
    ]);
    expect(split({ side: 'nav', main: 'body' }).regions?.['nav']).toContainEqual([
      'flex-basis',
      'var(--odd-layout-sidebar-width)',
    ]);
  });

  it('turn a named condition into its at-rule for component styles', () => {
    expect(condition('page.wide').cssText).toBe('@media (min-width: 64rem)');
    expect(condition('navigation.expanded').cssText).toBe(
      '@container shell (min-inline-size: 48rem)',
    );
  });
});

describe('defineLayoutRecipe', () => {
  const recipe = defineLayoutRecipe({
    name: 'demo',
    container: { name: 'shell' },
    regions: { root: stack(), content: grid({ columns: 1 }) },
    when: { 'navigation.expanded': { content: grid({ columns: 3 }) } },
  });

  it('resolves Oddkin condition names and layers under odd.layout', () => {
    expect(recipe.cssText).toContain(
      '@layer odd.layout.base, odd.layout.variant, odd.layout.condition;',
    );
    expect(recipe.cssText).toContain('@container shell (min-inline-size: 48rem)');
    expect(describeRecipe(recipe).conditions.map((c) => c.query)).toEqual([
      'shell (min-inline-size: 48rem)',
    ]);
  });

  it('keeps caller conditions and layer prefixes, and reports unknown names', () => {
    const own = defineLayoutRecipe({
      layer: 'app',
      regions: { root: stack() },
      conditions: { 'page.wide': '@media (min-width: 80rem)' },
      when: { 'page.wide': { root: stack({ gap: '2rem' }) } },
    });
    expect(own.cssText).toContain('@media (min-width: 80rem)');
    expect(own.cssText).toContain('@layer app.base');
    expect(() =>
      defineLayoutRecipe({ regions: { root: stack() }, when: { 'page.huge': { root: stack() } } }),
    ).toThrowError(expect.objectContaining({ code: 'recipe.condition.unknown' }));
  });
});

describe('layout.css', () => {
  it('starts with the canonical order and keeps every class in odd.layout', () => {
    expect(
      built.startsWith(
        '@layer odd.reset, odd.tokens, odd.base, odd.layout, odd.components, odd.utilities;\n\n@layer odd.layout {\n',
      ),
    ).toBe(true);
    for (const selector of [
      '.odd-stack',
      '.odd-row',
      '.odd-cluster',
      '.odd-grid',
      '.odd-auto-grid',
      '.odd-split',
    ])
      expect(body(selector).length, selector).toBeGreaterThan(0);
  });

  it('uses the helpers’ declarations with an override property per option', () => {
    const helpers = createLayoutHelpers();
    const pairs = (selector: string) => body(selector).map((d) => d.split(/:\s*/, 2).join(': '));
    const expected = helpers
      .stack({ gap: 'var(--odd-stack-gap, var(--odd-layout-gap))' })
      .declarations.map(([p, v]) => `${p}: ${v}`);
    expect(pairs('.odd-stack')).toEqual(expected);
    expect(pairs('.odd-split > :first-child')).toContain(
      'flex-basis: var(--odd-split-side-width, var(--odd-layout-sidebar-width))',
    );
    expect(pairs('.odd-grid')).toContain(
      'grid-template-columns: repeat(var(--odd-grid-columns, 2), minmax(0, 1fr))',
    );
  });
});
