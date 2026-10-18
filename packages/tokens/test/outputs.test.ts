import { readFile, writeFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  emitConditionsModule,
  emitInspectJson,
  emitTokenNameType,
  emitValuesModule,
  generate,
  valuesTree,
} from '../src/index.js';
import { token, tokenVariable } from '../src/refs/index.js';
import { values } from '../src/values/index.js';

const defaultConfig: unknown = JSON.parse(
  await readFile(new URL('../themes/default.theme.json', import.meta.url), 'utf8'),
);
const { theme } = generate(defaultConfig);
if (!theme) throw new Error('default theme failed to generate');

describe('generated default modules', () => {
  const files: Array<[string, string]> = [
    ['default-names.ts', emitTokenNameType(theme)],
    ['default-values.ts', emitValuesModule(theme)],
    ['default-conditions.ts', emitConditionsModule(theme)],
  ];
  for (const [file, expected] of files) {
    it(`src/generated/${file} matches the generator (UPDATE_FIXTURES=1 to regenerate)`, async () => {
      const url = new URL(`../src/generated/${file}`, import.meta.url);
      if (process.env['UPDATE_FIXTURES']) await writeFile(url, expected);
      expect(await readFile(url, 'utf8')).toBe(expected);
    });
  }
});

describe('refs and values', () => {
  it('builds var() references without registration', () => {
    expect(token('space.md')).toBe('var(--odd-space-md)');
    expect(token('color.text.primary', '#000')).toBe('var(--odd-color-text-primary, #000)');
    expect(tokenVariable('layout.item-min')).toBe('--odd-layout-item-min');
    // @ts-expect-error -- unknown names are type errors
    token('space.huge');
  });

  it('exposes literals separately from references, per mode where needed', () => {
    expect(values.space.md).toBe('1rem');
    expect(values.control.height.md).toBe('2.5rem');
    expect(values.color.action.default).toEqual({ light: '#6250e8', dark: '#b4a8ff' });
    // An alias of a mode-dependent role differs per mode too.
    expect(values.color.selection.background).toEqual({ light: '#6250e8', dark: '#b4a8ff' });
    expect(values.motion.duration.normal).toBe('200ms');
    expect(values.layout['item-min']).toBe('16rem');
  });

  it('rejects names that are both a value and a group', () => {
    const tokens = new Map(theme.tokens);
    const extra = { ...(tokens.get('space.md') as never as object), name: 'space.md.half' };
    tokens.set('space.md.half', extra as never);
    expect(() => valuesTree({ ...theme, tokens })).toThrowError(
      /both a value and a group|nests under the value/,
    );
  });
});

describe('inspection metadata', () => {
  it('records definitions, compiled CSS, literals, provenance, and scopes', () => {
    const result = generate({
      brand: { primary: '#5b46e8' },
      products: { clinic: { brand: { primary: '#0f766e' } } },
    });
    const data = JSON.parse(emitInspectJson(result.theme as never, result.diagnostics)) as {
      tokens: Array<Record<string, unknown>>;
      scopes: Array<{ selector: string; changed: string[]; redeclared: string[] }>;
    };
    const action = data.tokens.find((t) => t['name'] === 'color.action.default');
    expect(action).toMatchObject({
      cssVariable: '--odd-color-action-default',
      category: 'semantic',
      origin: 'generated',
      definition: { light: '{ref.brand.600}', dark: '{ref.brand.400}' },
      css: 'var(--odd-mode-light, var(--odd-ref-brand-600)) var(--odd-mode-dark, var(--odd-ref-brand-400))',
    });
    expect(data.scopes.map((s) => s.selector)).toEqual([
      '[data-odd-mode]',
      '[data-odd-product="clinic"]',
      '[data-odd-density="compact"]',
      '[data-odd-profile~="navigation.compact"]',
      '[data-odd-profile~="layout.compact"]',
    ]);
    expect(data.scopes[1]?.redeclared).toContain('color.action.default');
  });
});
