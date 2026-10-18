import { readFile, writeFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createLayoutHelpers, defineLayoutRecipe, grid, row, stack } from '../src/layout/index.js';
import { describeRecipe } from '../src/layout/inspect.js';
import { recipes, sideNav } from './fixtures/recipes.js';

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return (error as { code?: string }).code;
  }
  return undefined;
};

describe('layout recipes', () => {
  for (const [name, recipe] of Object.entries(recipes)) {
    it(`${name}: deterministic CSS matching the committed fixture (UPDATE_FIXTURES=1 to regenerate)`, async () => {
      const url = new URL(`./fixtures/${name}.recipe.css.txt`, import.meta.url);
      if (process.env['UPDATE_FIXTURES']) await writeFile(url, recipe.cssText);
      expect(recipe.cssText).toBe(await readFile(url, 'utf8'));
      expect(recipe.styles.cssText).toBe(recipe.cssText);
    });
  }

  it('layers base → variant → condition and emits only changed declarations in later layers', () => {
    const css = sideNav.cssText;
    expect(css.startsWith('@layer recipe.base, recipe.variant, recipe.condition;\n')).toBe(true);
    expect(css).toContain(
      ':host {\n    display: block;\n    container-type: inline-size;\n    container-name: side-nav;\n  }',
    );
    expect(css).toContain(':host(:where([align="end"])) .footer {\n    justify-content: end;\n  }');
    expect(css).toContain(
      '@container side-nav (min-inline-size: 40rem) {\n    .content {\n      grid-template-columns: repeat(3, minmax(0, 1fr));\n    }',
    );
    expect(css).toContain('    .root {\n      --demo-item-padding: 1rem;\n    }');
  });

  it('extends without mutating the original', () => {
    const before = sideNav.cssText;
    const compact = sideNav.extend({
      name: 'compact-side-nav',
      regions: { footer: row({ justify: 'end', wrap: false }) },
    });
    expect(sideNav.cssText).toBe(before);
    expect(compact.cssText).not.toBe(before);
    const footer = describeRecipe(compact).regions.find((r) => r.name === 'footer');
    expect(footer?.declarations).toMatchObject({ 'justify-content': 'end', 'flex-wrap': 'nowrap' });
    expect(describeRecipe(compact).conditions.map((c) => c.key)).toEqual(['navigation.expanded']);
    const wider = sideNav.extend({
      when: { 'navigation.expanded': { header: row({ justify: 'end' }) } },
    });
    expect(describeRecipe(wider).conditions[0]?.regions).toEqual(['content', 'header']);
  });

  it('describes regions, helpers, variants, conditions, parts, and layers', () => {
    const description = describeRecipe(sideNav);
    expect(description).toMatchObject({
      name: 'side-nav',
      layers: ['recipe.base', 'recipe.variant', 'recipe.condition'],
      container: { selector: ':host', name: 'side-nav', type: 'inline-size' },
      variants: [{ attribute: 'align', values: { start: ['footer'], end: ['footer'] } }],
      conditions: [
        {
          key: 'navigation.expanded',
          kind: 'container',
          query: 'side-nav (min-inline-size: 40rem)',
          regions: ['content'],
          profile: 'comfortable',
        },
      ],
      profiles: ['comfortable'],
    });
    expect(description.regions.map((r) => [r.name, r.helpers, r.part])).toEqual([
      ['root', ['stack'], false],
      ['header', ['row'], false],
      ['content', ['grid'], true],
      ['footer', ['row'], false],
    ]);
  });

  it('scopes light-DOM region classes', () => {
    expect(recipes.page.cssText).toContain('.page__main {');
    expect(recipes.page.cssText).toContain('.page__aside {\n    flex-basis: 16rem;');
    expect(
      describeRecipe(recipes.page).regions.find((r) => r.name === 'aside')?.declarations,
    ).toMatchObject({ 'flex-basis': '16rem', 'flex-grow': '1' });
  });

  it('binds helper defaults to a design system without core knowing it', () => {
    const branded = createLayoutHelpers({
      gap: 'var(--acme-gap)',
      itemMin: 'var(--acme-item-min)',
    });
    expect(branded.stack().declarations).toContainEqual(['gap', 'var(--acme-gap)']);
    expect(branded.autoGrid().declarations).toContainEqual([
      'grid-template-columns',
      'repeat(auto-fill, minmax(min(var(--acme-item-min), 100%), 1fr))',
    ]);
  });

  it('reports definition errors with stable codes', () => {
    const regions = { root: stack(), content: grid() };
    expect(codeOf(() => defineLayoutRecipe({ regions: { root: [row(), grid()] } }))).toBe(
      'recipe.helper.conflict',
    );
    expect(
      codeOf(() => defineLayoutRecipe({ regions, variants: { size: { lg: { footer: row() } } } })),
    ).toBe('recipe.region.unknown');
    expect(
      codeOf(() => defineLayoutRecipe({ regions, when: { 'page.wide': { content: grid() } } })),
    ).toBe('recipe.condition.unknown');
    expect(
      codeOf(() =>
        defineLayoutRecipe({
          regions,
          when: { '@container (min-width: 40rem)': { content: grid({ columns: 2 }) } },
        }),
      ),
    ).toBe('recipe.container.missing');
    expect(
      codeOf(() =>
        defineLayoutRecipe({
          regions,
          container: { region: 'content' },
          when: { '@container (min-width: 40rem)': { content: grid({ columns: 2 }) } },
        }),
      ),
    ).toBe('recipe.container.self');
    expect(
      codeOf(() =>
        defineLayoutRecipe({
          regions,
          container: { name: 'x' },
          when: { '@container x (min-width: 40rem)': { profile: 'dense' } },
        }),
      ),
    ).toBe('recipe.profile.unknown');
    expect(codeOf(() => defineLayoutRecipe({ regions: { profile: stack() } }))).toBe(
      'recipe.region.reserved',
    );
    expect(
      codeOf(() => defineLayoutRecipe({ regions: { root: stack({ gap: '1rem; color: red' }) } })),
    ).toBe('recipe.value.invalid');
    expect(codeOf(() => grid({ columns: 0 }))).toBe('recipe.value.invalid');
    expect(codeOf(() => defineLayoutRecipe({ regions: {} }))).toBe('recipe.region.missing');
    expect(codeOf(() => defineLayoutRecipe({ regions, layer: 'Odd.layout' }))).toBe(
      'recipe.layer.invalid',
    );
    expect(codeOf(() => defineLayoutRecipe({ regions, layer: 'odd..layout' }))).toBe(
      'recipe.layer.invalid',
    );
  });

  it('nests recipe layers under a dotted prefix', () => {
    const recipe = defineLayoutRecipe({ regions: { root: stack() }, layer: 'odd.layout' });
    expect(recipe.cssText).toContain(
      '@layer odd.layout.base, odd.layout.variant, odd.layout.condition;',
    );
  });

  it('accepts inline media conditions and named containers declared by ancestors', () => {
    const recipe = defineLayoutRecipe({
      regions: { root: stack(), content: grid() },
      when: {
        '@media (min-width: 64rem)': { content: grid({ columns: 2 }) },
        '@container shell (min-width: 48rem)': { content: grid({ columns: 3 }) },
      },
    });
    expect(recipe.cssText).toContain('@media (min-width: 64rem) {');
    expect(recipe.cssText).toContain('@container shell (min-width: 48rem) {');
  });
});
