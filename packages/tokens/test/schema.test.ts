import { Ajv2020 } from 'ajv/dist/2020.js';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { generate, type ThemeConfig } from '../src/index.js';
import { cases } from './fixtures/cases.js';

const schema = JSON.parse(
  await readFile(new URL('../schema/theme-config.v1.schema.json', import.meta.url), 'utf8'),
) as {
  properties: Record<string, unknown>;
};
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(schema);

describe('theme-config.v1 JSON Schema', () => {
  it('accepts the fixture and documentation configurations', () => {
    const documented: ThemeConfig = {
      name: 'acme',
      preset: 'oddkin-default',
      brand: { primary: '#5b46e8' },
      spacing: {
        strategy: 'multiples',
        unit: '0.25rem',
        steps: { xs: 1, sm: 2, md: 3, lg: 4.5, xl: 9 },
      },
      modes: ['light', 'dark'],
      products: { clinic: { brand: { primary: '#0f766e' } } },
      density: { compact: { scale: 0.75 } },
      conditions: {
        'navigation.expanded': { container: 'side-nav', minInlineSize: '40rem' },
        'page.wide': { media: { minWidth: '64rem' } },
      },
      profiles: {
        'navigation.compact': {
          'navigation.item.padding.inline': '{space.sm}',
          'layout.gap': '{space.xs}',
        },
      },
      overrides: { 'color.surface.default': { light: '#fbfaff', dark: '{ref.neutral.950}' } },
    };
    for (const config of [...Object.values(cases), documented]) {
      expect(validate(config), JSON.stringify(validate.errors)).toBe(true);
      expect(generate(config).ok).toBe(true);
    }
  });

  it('rejects structural errors the generator also reports', () => {
    const invalid: unknown[] = [
      {},
      { brand: { primary: '#000' }, colour: {} },
      { brand: { primary: 'blue' } },
      {
        brand: { primary: '#000' },
        spacing: { strategy: 'multiples', unit: '0.25rem', steps: { md: 3 }, ratio: 1.5 },
      },
      { brand: { primary: '#000' }, modes: ['dim'] },
      { brand: { primary: '#000' }, density: { compact: { scale: 0 } } },
      { brand: { primary: '#000' }, products: { Clinic: {} } },
    ];
    for (const config of invalid) {
      expect(validate(config), JSON.stringify(config)).toBe(false);
      expect(generate(config).ok, JSON.stringify(config)).toBe(false);
    }
  });

  // Theme Studio validates drafts with the generator alone, so it must never accept what the schema
  // rejects. Every value of complete configurations is replaced with each wrong-typed value in turn.
  it('the generator accepts no draft the schema rejects', () => {
    const complete: unknown[] = [
      {
        $schema: './schema.json',
        name: 'acme',
        preset: 'oddkin-default',
        brand: { primary: '#5b46e8', neutral: '#78716c' },
        status: { danger: '#dc2626', success: '#16a34a', warning: '#d97706' },
        spacing: {
          strategy: 'multiples',
          unit: '0.25rem',
          steps: { xs: 1, sm: 2, md: 3, lg: 4.5, xl: 9 },
          snap: '0.125rem',
        },
        modes: ['light', 'dark'],
        products: { clinic: { brand: { primary: '#0f766e', neutral: '#78716c' } } },
        density: { compact: { scale: 0.75 } },
        conditions: {
          'navigation.expanded': { container: 'side-nav', minInlineSize: '40rem' },
          'page.wide': { media: { minWidth: '64rem' } },
        },
        profiles: {
          'navigation.compact': {
            'navigation.item.padding.inline': '{space.sm}',
            'layout.gap': { light: '{space.xs}', dark: '{space.xs}' },
          },
        },
        overrides: {
          'color.surface.default': { light: '#fbfaff', dark: '{ref.neutral.950}' },
          'radius.md': '0.5rem',
        },
      },
      {
        brand: { primary: '#5b46e8' },
        spacing: {
          strategy: 'ratio',
          base: '0.75rem',
          ratio: 1.5,
          stepsBelow: 2,
          stepsAbove: 3,
          names: ['xs', 'sm', 'md', 'lg', 'xl', '2xl'],
        },
      },
      {
        brand: { primary: '#5b46e8' },
        spacing: {
          strategy: 'explicit',
          steps: { xs: '0.25rem', sm: '0.5rem', md: '1rem', lg: '1.5rem' },
        },
      },
    ];
    const wrong: unknown[] = [null, 3, 'x', [], {}, true, -1, 0];
    const paths = (value: unknown, prefix: string[] = []): string[][] =>
      typeof value === 'object' && value !== null
        ? Object.entries(value).flatMap(([key, child]) => [
            [...prefix, key],
            ...paths(child, [...prefix, key]),
          ])
        : [];
    const replaced = (root: unknown, path: string[], value: unknown): unknown => {
      const copy = structuredClone(root) as Record<string, unknown>;
      let node = copy;
      for (const key of path.slice(0, -1)) node = node[key] as Record<string, unknown>;
      node[path.at(-1) as string] = value;
      return copy;
    };
    let drafts = 0;
    for (const config of complete) {
      expect([validate(config), generate(config).ok]).toEqual([true, true]);
      for (const path of paths(config)) {
        for (const value of wrong) {
          const draft = replaced(config, path, value);
          drafts++;
          if (generate(draft).ok)
            expect(validate(draft), `/${path.join('/')} = ${JSON.stringify(value)}`).toBe(true);
        }
      }
    }
    expect(drafts).toBe(584);
  });

  it('covers exactly the top-level ThemeConfig keys', () => {
    const keys: Array<keyof ThemeConfig> = [
      '$schema',
      'name',
      'preset',
      'brand',
      'status',
      'spacing',
      'modes',
      'products',
      'density',
      'conditions',
      'profiles',
      'overrides',
    ];
    expect(Object.keys(schema.properties).sort()).toEqual([...keys].sort());
  });
});
