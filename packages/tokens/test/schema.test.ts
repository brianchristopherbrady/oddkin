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
      preset: 'mote-default',
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
