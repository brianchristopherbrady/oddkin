import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { foundationsFrom, type InspectedToken, type TokenInspection } from '../src/foundations.js';

const token = (
  name: string,
  category: string,
  definition: unknown,
  origin = 'preset',
): InspectedToken => ({
  name,
  cssVariable: `--x-${name.replace(/\./g, '-')}`,
  category,
  type: 'dimension',
  origin,
  definition,
  value: definition,
});
const source = { package: '@acme/tokens', export: './inspect/acme.json' };

describe('foundationsFrom', () => {
  it('reads scales, roles, and aliases from the inspection without recomputing', () => {
    const inspection: TokenInspection = {
      theme: 'acme',
      modes: ['light', 'dark'],
      tokens: [
        token('space.sm', 'foundation', '0.5rem'),
        token('space.lg', 'foundation', '2rem', 'generated'),
        token('gap.default', 'semantic', '{space.sm}'),
        token('panel.inset', 'component', '{space.lg}'),
        token('space.alias', 'foundation', '{space.sm}'),
        token('color.text', 'semantic', { light: '#111', dark: '#eee' }, 'overridden'),
        token('ref.blue.500', 'reference', '#00f'),
        token('radius.md', 'foundation', '4px'),
        token('button.radius', 'component', '{radius.md}'),
      ],
    };
    const foundations = foundationsFrom(inspection, source);
    expect(Object.keys(foundations)).toEqual([
      'foundation:spacing',
      'foundation:color',
      'foundation:borders-and-radii',
    ]);
    expect(foundations['foundation:spacing']).toEqual({
      id: 'spacing',
      sections: [
        { id: 'scale', available: true },
        { id: 'semantic-vocabulary', available: true },
      ],
      generation: {
        value: { theme: 'acme', origins: ['generated', 'preset'], source },
        provenance: 'extracted',
      },
      // An alias of a step is vocabulary, not a scale step.
      tokens: ['space.lg', 'space.sm'],
      vocabularies: [
        { id: 'semantic', entries: [{ name: 'gap.default', token: 'space.sm' }] },
        { id: 'component-mappings', entries: [{ name: 'panel.inset', token: 'space.lg' }] },
      ],
    });
    expect(foundations['foundation:color']).toMatchObject({
      tokens: ['color.text'],
      variations: ['mode'],
      sections: [
        { id: 'semantic-roles', available: true },
        { id: 'palettes-and-ramps', available: true },
      ],
    });
    expect(foundations['foundation:borders-and-radii']).toMatchObject({
      tokens: ['radius.md'],
      sections: [
        { id: 'border-widths-and-styles', available: false, reason: 'no border width tokens' },
        { id: 'radii', available: true },
        { id: 'component-mappings', available: true },
      ],
      vocabularies: [
        { id: 'component-mappings', entries: [{ name: 'button.radius', token: 'radius.md' }] },
      ],
    });
  });

  it('omits foundations a theme has no tokens for', () => {
    const inspection: TokenInspection = {
      theme: 'bare',
      modes: ['light'],
      tokens: [token('color.text', 'semantic', '#111')],
    };
    const foundations = foundationsFrom(inspection, source);
    expect(Object.keys(foundations)).toEqual(['foundation:color']);
    expect(foundations['foundation:color']).not.toHaveProperty('variations');
  });

  it('claims a mode variation only for roles given per mode', () => {
    const flat: TokenInspection = {
      theme: 'flat',
      modes: ['light', 'dark'],
      tokens: [
        token('color.text', 'semantic', '#111'),
        // An object value that is not keyed by modes is not a mode variation.
        token('color.shadow', 'semantic', { offset: '0 1px', color: '#000' }),
      ],
    };
    expect(foundationsFrom(flat, source)['foundation:color']).not.toHaveProperty('variations');
  });

  it('published @oddkin/components metadata matches the default theme inspection it references', () => {
    const read = (path: string) =>
      JSON.parse(readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8'));
    const metadata = read('../../components/oddkin.metadata.json');
    const inspection = read('../../tokens/dist/inspect/default.inspect.json') as TokenInspection;
    expect(metadata.foundations).toEqual(
      foundationsFrom(inspection, { package: '@oddkin/tokens', export: './inspect/default.json' }),
    );
    // Every referenced token exists in the inspection, with the value the inspection states.
    const names = new Set(inspection.tokens.map((t) => t.name));
    for (const foundation of Object.values(metadata.foundations) as {
      tokens: string[];
      vocabularies: { entries: { name: string; token: string }[] }[];
    }[]) {
      for (const name of foundation.tokens) expect(names).toContain(name);
      for (const vocabulary of foundation.vocabularies ?? [])
        for (const entry of vocabulary.entries) {
          expect(names).toContain(entry.name);
          expect(names).toContain(entry.token);
        }
    }
  });
});
