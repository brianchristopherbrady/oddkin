import { describe, expect, it } from 'vitest';
import { compileValue, cssVariable, emitCss, generate, type ResolvedTheme } from '../src/index.js';
import type { TokenDefinition } from '../src/generate/graph.js';
import { cases } from './fixtures/cases.js';

// ADR 0046 D2: the experimental light-dark() output (CssOptions.modeColors). Bytes and browser
// equivalence: research/experiments/light-dark (smaller, not equivalent; the toggles stay the default).

const escape = (selector: string) => selector.replace(/[[\]"=~.]/g, '\\$&');
const body = (css: string, selector: string) =>
  new RegExp(`${escape(selector)} \\{\\n([^}]*)\\}`).exec(css)?.[1] ?? '';
const declarations = (text: string): Record<string, string> =>
  Object.fromEntries(
    [...text.matchAll(/(--[\w-]+|color-scheme): ([^;\n]*);/g)].map((m) => [m[1], m[2]]),
  );
const differsByMode = (t: TokenDefinition) =>
  typeof t.value === 'object' && t.value.light !== t.value.dark;

describe('modeColors: light-dark() for colours that differ by mode', () => {
  const config = cases['products-density'];
  const result = generate(config);
  const theme = result.theme as ResolvedTheme;
  const toggles = result.css ?? '';
  const lightDark = generate(config, { css: { modeColors: 'light-dark' } }).css ?? '';
  const BASE = '[data-odd-theme="acme"]';

  it('defaults to the toggles, byte for byte', () => {
    expect(generate(config, { css: { modeColors: 'toggles' } }).css).toBe(toggles);
    expect(toggles).not.toContain('light-dark(');
  });

  it('writes each such colour once as light-dark() and every other value as before', () => {
    const before = declarations(body(toggles, BASE));
    const after = declarations(body(lightDark, BASE));
    expect(Object.keys(after)).toEqual(Object.keys(before));
    const colours = [...theme.tokens.values()].filter(
      (t) => t.type === 'color' && differsByMode(t),
    );
    expect(colours.length).toBeGreaterThan(20);
    for (const t of theme.tokens.values()) {
      const name = cssVariable(t.name);
      if (!colours.includes(t)) {
        expect(after[name], t.name).toBe(before[name]);
        continue;
      }
      const { light, dark } = t.value as { light: string; dark: string };
      expect(after[name], t.name).toBe(
        `light-dark(${compileValue(light, theme.modes)}, ${compileValue(dark, theme.modes)})`,
      );
    }
  });

  it('re-declares in mode scopes only what still depends on the toggles', () => {
    const toggled = [...theme.tokens.values()]
      .filter((t) => t.type !== 'color' && differsByMode(t))
      .map((t) => cssVariable(t.name));
    expect(toggled.length).toBeGreaterThan(0);
    for (const mode of ['light', 'dark', 'system']) {
      const declared = declarations(body(lightDark, `[data-odd-mode="${mode}"]`));
      expect(Object.keys(declared)).toEqual([
        'color-scheme',
        '--odd-mode-light',
        '--odd-mode-dark',
        ...toggled,
      ]);
    }
    // An alias of a light-dark() colour resolves where it is used, as the colour does.
    expect(body(toggles, '[data-odd-mode="dark"]')).toContain('--odd-color-focus-ring:');
  });

  it('writes product colours as light-dark() too, with no toggles left in them', () => {
    const before = declarations(body(toggles, '[data-odd-product="clinic"]'));
    const after = declarations(body(lightDark, '[data-odd-product="clinic"]'));
    expect(Object.keys(after)).toEqual(Object.keys(before));
    expect(Object.values(before).some((v) => v.includes('var(--odd-mode-'))).toBe(true);
    expect(Object.values(after).some((v) => v.includes('var(--odd-mode-'))).toBe(false);
    expect(Object.values(after).filter((v) => v.startsWith('light-dark(')).length).toBe(
      Object.values(before).filter((v) => v.includes('var(--odd-mode-')).length,
    );
  });

  it('keeps a light-dark() colour in the mode scopes when either of its values reads a toggled token', () => {
    const token = (name: string, type: string, value: TokenDefinition['value']) =>
      [name, { name, type, value, category: 'semantic', origin: 'preset' }] as const;
    const synthetic = {
      name: 'probe',
      modes: ['light', 'dark'],
      scopes: [],
      conditions: new Map(),
      tokens: new Map([
        token('opacity.scrim', 'number', { light: '0.4', dark: '0.6' }),
        token('color.scrim', 'color', { light: '#000000', dark: 'rgb(0 0 0 / {opacity.scrim})' }),
        token('color.plain', 'color', { light: '#000000', dark: '#ffffff' }),
      ]),
    } as unknown as ResolvedTheme;
    const css = emitCss(synthetic, { layer: false, modeColors: 'light-dark' });
    expect(Object.keys(declarations(body(css, '[data-odd-mode="dark"]')))).toEqual([
      'color-scheme',
      '--odd-mode-light',
      '--odd-mode-dark',
      '--odd-opacity-scrim',
      '--odd-color-scrim',
    ]);
    expect(declarations(body(css, '[data-odd-theme="probe"]'))['--odd-color-scrim']).toBe(
      'light-dark(#000000, rgb(0 0 0 / var(--odd-opacity-scrim)))',
    );
    expect(declarations(body(css, '[data-odd-mode="dark"]'))['--odd-color-scrim']).toBe(
      'light-dark(#000000, rgb(0 0 0 / var(--odd-opacity-scrim)))',
    );
  });
});
