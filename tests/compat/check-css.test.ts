import { describe, expect, it } from 'vitest';
import {
  checkRegistry,
  checkTokenSyntax,
  lintCss,
  loadRegistry,
} from '../../scripts/compat/check-css.mjs';

// Contract: ADR 0038, css-architecture.md §3. The real registry and stylesheets are checked by
// `npm run lint:css`; these cases prove the checks catch what they claim to.
const registry = loadRegistry();
const lint = (text: string) => lintCss(text, { file: 'case.css', registry }).problems;

describe('CSS compatibility lint', () => {
  it('accepts floor features and documented floor exceptions', () => {
    expect(
      lint(`
        @layer odd.tokens { :root { --odd-space-md: 1rem; } }
        :host(:where([size='sm'])) .label { padding-inline: max(var(--a, 1rem), 1.5rem); overflow-wrap: anywhere; }
        @container nav (min-width: 40rem) { .item { gap: 1rem; } }
        button { cursor: pointer; }`),
    ).toEqual([]);
  });

  it('requires a gate for a registered enhancement', () => {
    const [problem] = lint('.field { field-sizing: content; }');
    expect(problem).toContain('registered enhancement "field-sizing" but is not gated');
    expect(lint('@supports (field-sizing: content) { .field { field-sizing: content; } }')).toEqual(
      [],
    );
  });

  it('accepts a literal parse-time fallback, but not one that goes through var()', () => {
    expect(lint('h2 { text-wrap: wrap; text-wrap: balance; }')).toEqual([]);
    expect(lint('h2 { text-wrap: balance; }')).toHaveLength(1);
    expect(lint('h2 { text-wrap: var(--wrap); text-wrap: balance; }')).toHaveLength(1);
  });

  it('rejects features outside the floor that are not registered enhancements, even when gated', () => {
    expect(lint('.a { color: oklch(from red l c h); }')[0]).toContain(
      'not a registered enhancement',
    );
    expect(
      lint('@supports (color: light-dark(red, red)) { :root { --c: light-dark(#fff, #000); } }')[0],
    ).toContain('light-dark() in --c');
    expect(lint('.a { interpolate-size: allow-keywords; }')[0]).toContain('interpolate-size');
  });

  it('checks custom property values, whose readers fail at computed-value time', () => {
    expect(lint(':root { --gap: max(1rem, 2cqi); }')).toEqual([]);
    expect(lint(':root { --wrap: 1rem; } .x { --fill: anchor-size(width); }')[0]).toContain(
      'anchor-size() in --fill',
    );
  });

  it('keeps selectors outside the floor out of shared selector lists', () => {
    const problems = lint('details[open], details:open { color: red; }');
    expect(problems.some((p) => p.includes('invalidates the whole rule'))).toBe(true);
    expect(lint('@supports selector(:open) { details:open { color: red; } }')).toEqual([]);
    // Forgiving lists (:is, :where) keep the rest of the rule.
    expect(
      lint('@supports selector(:open) { :where(details:open, dialog:open) { color: red; } }'),
    ).toEqual([]);
  });
});

describe('registry and token syntax checks', () => {
  it('rejects a foundation that the floor does not support and a stale enhancement', () => {
    const bad = structuredClone(registry);
    const balance = bad.features.find((f) => f.id === 'text-wrap-balance')!;
    balance.adoption = 'foundation';
    const layers = bad.features.find((f) => f.id === 'cascade-layers')!;
    layers.adoption = 'enhancement';
    layers.gate = layers.enhanced = layers.differences = 'x';
    const problems = checkRegistry(bad).join('\n');
    expect(problems).toContain(
      '"text-wrap-balance": foundation feature not fully supported by Safari 17.4',
    );
    expect(problems).toContain('"cascade-layers": every floor browser fully supports it');
  });

  it('rejects token syntax entries that disagree with the data', () => {
    expect(
      checkTokenSyntax(
        [{ syntax: 'light-dark()', bcd: 'css.types.color.light-dark', unsupported: ['firefox'] }],
        registry.floor,
      )[0],
    ).toContain('data says unsupported by [safari]');
  });
});
