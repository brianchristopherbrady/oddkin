import { describe, expect, it } from 'vitest';
import { css, isCSSVariableReference, unsafeCSS, type CSSResult } from '../src/styles/index.js';

const text = (result: CSSResult) => result.cssText.replace(/\s+/g, ' ').trim();

describe('css interpolation grammar', () => {
  it('accepts custom-property references with plain fallbacks', () => {
    for (const value of [
      'var(--odd-space-md)',
      ' var(--x) ',
      'var(--x, 0.75rem)',
      'var(--x,#fff)',
      'var(--x, var(--y, 1px))',
      'var(--x, calc(1rem + 2px))',
      'var(--x, oklch(62% 0.12 250 / 0.5))',
      'var(--font, system-ui, sans-serif)',
    ]) {
      expect(isCSSVariableReference(value), value).toBe(true);
    }
  });

  it('rejects anything that could escape a declaration or load resources', () => {
    for (const value of [
      'red',
      '--x',
      'var(x)',
      'var(--x); color: red',
      'var(--x) } body { color: red',
      'var(--x, red; }',
      'var(--x, url(https://example.test/a.png))',
      'var(--x, image-set("a.png" 1x))',
      'var(--x, "text")',
      'var(--x, red !important)',
      'var(--x, a /* comment */)',
      'var(--x, @import)',
      'var(--x, calc(1px)) )',
      'var(--x, ((1px)',
      'var(--x) var(--y)',
      `var(--x, ${'1px '.repeat(200)})`,
    ]) {
      expect(isCSSVariableReference(value), value).toBe(false);
    }
  });

  it('interpolates references, numbers, and fragments; rejects other strings', () => {
    const gap = 'var(--odd-space-md, 0.75rem)';
    const result = css`
      a {
        gap: ${gap};
        z-index: ${2};
        ${css`
          color: red;
        `}
      }
    `;
    expect(text(result)).toBe('a { gap: var(--odd-space-md, 0.75rem); z-index: 2; color: red; }');
    expect(
      () => css`
        a {
          color: ${'red'};
        }
      `,
    ).toThrowError(/not allowed/);
    expect(
      () => css`
        a {
          width: ${Number.NaN}px;
        }
      `,
    ).toThrowError(/not allowed/);
    expect(
      text(css`
        a {
          color: ${unsafeCSS('red')};
        }
      `),
    ).toBe('a { color: red; }');
  });
});
