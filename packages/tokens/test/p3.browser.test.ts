import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  cssVariable,
  generate,
  resolveToken,
  type ResolveContext,
  type ResolvedTheme,
} from '../src/generate/index.js';
import { cases } from './fixtures/cases.js';

// Display P3 values in three engines (theming-and-styling.md §10.7). The CSS re-declares them
// under (color-gamut: p3); the tests force that query to match, or not, to check both displays,
// and then check the display the browser reports.
const result = generate(cases['wide-gamut']);
const theme = result.theme as ResolvedTheme;
const css = result.css ?? '';
const P3_QUERY = '@media (color-gamut: p3)';

/** `rgb(…)` or `color(display-p3 …)` channels as numbers in 0–1. */
function channels(color: string): { space: string; values: number[] } {
  const p3 = /^color\(display-p3 ([^)]*)\)$/.exec(color.trim());
  if (p3) return { space: 'display-p3', values: (p3[1] as string).split(/\s+/).map(Number) };
  const hex = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (hex)
    return {
      space: 'srgb',
      values: [0, 2, 4].map((i) => parseInt((hex[1] as string).slice(i, i + 2), 16) / 255),
    };
  const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(color.trim());
  if (rgb) return { space: 'srgb', values: [rgb[1], rgb[2], rgb[3]].map((c) => Number(c) / 255) };
  return { space: color, values: [] };
}

const probes: Array<{ id: string; context: ResolveContext }> = [
  { id: 'root', context: { mode: 'light' } },
  { id: 'dark', context: { mode: 'dark' } },
  { id: 'coral', context: { mode: 'light', product: 'coral' } },
  { id: 'coral-dark', context: { mode: 'dark', product: 'coral' } },
  { id: 'coral-theme', context: { mode: 'light' } },
];
// Roles that alias P3 steps in the base theme or the product, and a step neither changes.
const roles = ['color.link', 'color.action.default', 'color.focus.ring', 'color.info.foreground'];

describe('Display P3 values in a real cascade', () => {
  const sheet = new CSSStyleSheet();
  let root: HTMLElement;

  beforeAll(() => {
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    root = document.createElement('div');
    root.innerHTML = `
      <div data-odd-mode="light"><i id="root"></i>
        <div data-odd-mode="dark"><i id="dark"></i></div>
        <div data-odd-product="coral"><i id="coral"></i>
          <div data-odd-mode="dark"><i id="coral-dark"></i></div>
          <div data-odd-theme="vivid"><i id="coral-theme"></i></div>
        </div>
      </div>`;
    document.body.append(root);
  });

  afterAll(() => {
    root.remove();
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== sheet);
  });

  const check = (gamut: 'srgb' | 'p3') => {
    for (const { id, context } of probes) {
      const probe = root.querySelector(`#${id}`) as HTMLElement;
      for (const role of roles) {
        probe.style.color = `var(${cssVariable(role)})`;
        const expected = channels(resolveToken(theme, role, { ...context, gamut }) as string);
        const actual = channels(getComputedStyle(probe).color);
        expect(actual.space, `${id} ${role}`).toBe(expected.space);
        actual.values.forEach((v, i) =>
          expect(v, `${id} ${role}`).toBeCloseTo(expected.values[i] as number, 3),
        );
      }
    }
  };

  it('a P3 display gets the P3 values in every scope, products and nested themes included', () => {
    sheet.replaceSync(css.replaceAll(P3_QUERY, '@media all'));
    check('p3');
    // The roles under test reach P3 values in some scopes and sRGB values in others.
    const resolved = probes.flatMap(({ context }) =>
      roles.map((role) => resolveToken(theme, role, { ...context, gamut: 'p3' }) ?? ''),
    );
    expect(resolved.some((color) => color.startsWith('color(display-p3'))).toBe(true);
    expect(resolved.some((color) => color.startsWith('#'))).toBe(true);
  });

  it('an sRGB display keeps the sRGB values', () => {
    sheet.replaceSync(css.replaceAll(P3_QUERY, '@media not all'));
    check('srgb');
  });

  it('the generated query follows the display the browser reports', () => {
    sheet.replaceSync(css);
    check(matchMedia('(color-gamut: p3)').matches ? 'p3' : 'srgb');
  });
});
