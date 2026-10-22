import { defineConfig, parse } from '@terrazzo/parser';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DTCG_EXTENSION,
  emitDtcg,
  generate,
  resolveToken,
  type ResolveContext,
  type ResolvedTheme,
  type TokenDefinition,
} from '../src/index.js';
import { cases } from './fixtures/cases.js';

// Plan 245: DTCG Format Module 2025.10 output, read back by an independent implementation
// (@terrazzo/parser) with spec-strict units, and compared value by value with Oddkin's resolver.

const defaultTheme = generate(
  JSON.parse(readFileSync(new URL('../themes/default.theme.json', import.meta.url), 'utf8')),
).theme as ResolvedTheme;
const acme = generate(cases['products-density']).theme as ResolvedTheme;

const config = defineConfig(
  // 2025.10 §8.2: dimensions are px or rem only (Terrazzo also accepts em by default).
  { lint: { rules: { 'core/valid-dimension': ['error', { allowedUnits: ['px', 'rem'] }] } } },
  { cwd: new URL('../', import.meta.url) },
);
const read = async (text: string) =>
  (await parse([{ filename: new URL('file:///theme.tokens.json'), src: text }], { config }))
    .tokens as Record<string, { $type: string; $value: unknown; aliasOf?: string }>;

const hex2 = (c: number) =>
  Math.round(c * 255)
    .toString(16)
    .padStart(2, '0');
type Color = { components: number[]; alpha?: number };
const colorCss = (c: Color) =>
  c.alpha !== undefined && c.alpha < 1
    ? `rgb(${c.components.map((v) => Math.round(v * 255)).join(' ')} / ${c.alpha})`
    : `#${c.components.map(hex2).join('')}`;
type Dim = { value: number; unit: string };
const dim = (d: Dim) => `${d.value}${d.unit}`;
type Shadow = { color: Color; offsetX: Dim; offsetY: Dim; blur: Dim; spread: Dim };

/** CSS text of a value as Terrazzo resolved it. */
function css(type: string, value: unknown): string {
  switch (type) {
    case 'color':
      return colorCss(value as Color);
    case 'dimension':
    case 'duration':
      return dim(value as Dim);
    case 'fontFamily':
      return (Array.isArray(value) ? value : [value]).join('|');
    case 'cubicBezier':
      return `cubic-bezier(${(value as number[]).join(', ')})`;
    case 'shadow':
      return (Array.isArray(value) ? value : [value])
        .map((s: Shadow) =>
          [s.offsetX, s.offsetY, s.blur, s.spread].map(dim).concat(colorCss(s.color)).join(' '),
        )
        .join(', ');
    default:
      return String(value);
  }
}

/** The same normal form for Oddkin's literal (unitless 0 is 0px; shadows spell out spread). */
function normal(type: string, literal: string): string {
  const length = (t: string) => (t === '0' ? '0px' : t);
  switch (type) {
    case 'dimension':
      return length(literal);
    case 'fontFamily':
      return literal
        .split(',')
        .map((name) => name.trim().replace(/^"(.*)"$/, '$1'))
        .join('|');
    case 'shadow':
      return literal
        .split(/,(?![^(]*\))/)
        .map((layer) => {
          const color = /rgb\([^)]*\)/.exec(layer)?.[0] as string;
          const lengths = layer.replace(color, '').trim().split(/\s+/).map(length);
          while (lengths.length < 4) lengths.push('0px');
          return [...lengths, color].join(' ');
        })
        .join(', ');
    default:
      return literal;
  }
}

const contexts: Array<[name: string, theme: ResolvedTheme, context: ResolveContext]> = [
  ['default light', defaultTheme, { mode: 'light' }],
  ['default dark', defaultTheme, { mode: 'dark' }],
  ['acme dark clinic', acme, { mode: 'dark', product: 'clinic' }],
  [
    'acme light compact with profiles',
    acme,
    { mode: 'light', density: 'compact', profiles: ['layout.compact', 'navigation.compact'] },
  ],
];

describe('DTCG 2025.10 output', () => {
  for (const [label, theme, context] of contexts) {
    it(`${label}: an independent reader resolves every emitted token to Oddkin's value`, async () => {
      const { text, mappings } = emitDtcg(theme, context);
      const tokens = await read(text);
      const emitted = mappings.filter((m) => m.kind !== 'unsupported').map((m) => m.token);
      expect(Object.keys(tokens).sort()).toEqual([...emitted].sort());
      for (const name of emitted) {
        const token = tokens[name] as { $type: string; $value: unknown };
        const literal = resolveToken(theme, name, context) as string;
        const type = (theme.tokens.get(name) as TokenDefinition).type;
        expect(token.$type, name).toBe(type);
        if (/calc\(/.test(literal)) continue; // checked below: flattened, lossy
        expect(css(type, token.$value), name).toBe(normal(type, literal));
      }
    });
  }

  it('keeps aliases as references, flattens expressions as lossy, and records the context', () => {
    const { document, mappings } = emitDtcg(acme, {
      mode: 'light',
      profiles: ['navigation.compact'],
    });
    const at = (path: string) =>
      path
        .split('.')
        .reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], document) as Record<
        string,
        unknown
      >;
    expect(at('color.selection.background').$value).toBe('{color.action.default}');
    const block = at('navigation.item.padding.block');
    const xs = Number.parseFloat(resolveToken(acme, 'space.xs') as string);
    expect(block.$value).toEqual({ value: Number((xs / 2).toFixed(6)), unit: 'rem' });
    expect(
      (block.$extensions as Record<string, Record<string, unknown>>)[DTCG_EXTENSION]?.['css'],
    ).toBe('calc({space.xs} / 2)');
    expect(mappings.find((m) => m.token === 'navigation.item.padding.block')).toMatchObject({
      kind: 'lossy',
    });
    expect(
      (document['$extensions'] as Record<string, Record<string, unknown>>)[DTCG_EXTENSION],
    ).toMatchObject({
      format: '2025.10',
      theme: 'acme',
      context: { mode: 'light', profiles: ['navigation.compact'] },
    });
  });

  it('lists exactly what the default theme cannot express, with the original values', () => {
    const { document, mappings } = emitDtcg(defaultTheme, { mode: 'light' });
    const by = (kind: string) => mappings.filter((m) => m.kind === kind).map((m) => m.token);
    expect(by('unsupported')).toEqual([
      'elevation.none',
      'letter-spacing.tight',
      'letter-spacing.wide',
      'type.display.letter-spacing',
      'type.eyebrow.letter-spacing',
    ]);
    expect(by('lossy')).toEqual([
      'motion.duration.fast',
      'motion.duration.normal',
      'motion.duration.slow',
      'motion.duration.slower',
    ]);
    expect(mappings).toHaveLength(defaultTheme.tokens.size);
    const root = (
      document['$extensions'] as Record<string, Record<string, Record<string, unknown>>>
    )[DTCG_EXTENSION] as Record<string, Record<string, unknown>>;
    expect(root['unsupported']?.['letter-spacing.tight']).toMatchObject({
      type: 'dimension',
      value: '-0.025em',
    });
    expect(Object.keys(root['conditions'] ?? {})).toContain('page.medium');
  });

  it('is deterministic and uses only names 2025.10 allows', () => {
    const first = emitDtcg(defaultTheme, { mode: 'dark' });
    expect(emitDtcg(defaultTheme, { mode: 'dark' }).text).toBe(first.text);
    const reserved = new Set(['$type', '$value', '$description', '$extensions', '$root']);
    const walk = (node: Record<string, unknown>): void => {
      for (const [key, child] of Object.entries(node)) {
        if (key === '$extensions' || key === '$value') continue;
        expect(key.startsWith('$') ? reserved.has(key) : !/[.{}]/.test(key), key).toBe(true);
        if (child && typeof child === 'object' && !Array.isArray(child))
          walk(child as Record<string, unknown>);
      }
    };
    walk(first.document);
  });

  it('places a token that is also a group at $root and references it there', async () => {
    const token = (name: string, value: string): [string, TokenDefinition] => [
      name,
      { name, category: 'foundation', type: 'dimension', value, origin: 'preset' },
    ];
    const theme: ResolvedTheme = {
      name: 'roots',
      modes: ['light'],
      tokens: new Map([token('gap', '1rem'), token('gap.wide', '2rem'), token('inset', '{gap}')]),
      scopes: [],
      conditions: new Map(),
    };
    const { document, text } = emitDtcg(theme);
    expect((document['inset'] as Record<string, unknown>)['$value']).toBe('{gap.$root}');
    const tokens = await read(text);
    expect(tokens['inset']?.$value).toEqual({ value: 1, unit: 'rem' });
  });
});
