import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hostStyles, focusRingStyles, visuallyHiddenStyles } from '../src/styles/index.js';
import { documentStylesheets } from '../src/css/index.js';

// Shared style primitives and the opt-in document stylesheets (built by `npm run build`).
const built = (name: string) =>
  readFileSync(new URL(`../dist/css/${name}.css`, import.meta.url), 'utf8');
const declarations = (text: string, selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const body = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(text)?.[1] ?? '';
  return body
    .split(';')
    .map((d) => d.trim().replace(/\s+/g, ' '))
    .filter(Boolean);
};

describe('shared style primitives', () => {
  it('keeps structural primitives free of theme tokens', () => {
    for (const sheet of [hostStyles, visuallyHiddenStyles])
      expect(sheet.cssText).not.toMatch(/--odd-/);
    expect(focusRingStyles.cssText).toMatch(/var\(--odd-color-focus-ring\)/);
  });

  it('confines !important to the hidden-attribute guarantee', () => {
    const important = [hostStyles, focusRingStyles, visuallyHiddenStyles]
      .flatMap((s) => s.cssText.split('}'))
      .filter((rule) => rule.includes('!important'))
      .map((rule) => rule.split('{')[0]!.trim());
    expect(important).toEqual([':host([hidden])', '[hidden]']);
  });
});

describe('document stylesheets', () => {
  const order =
    '@layer odd.reset, odd.tokens, odd.base, odd.layout, odd.components, odd.utilities;';

  it('start with the canonical layer order and keep every rule in their layer', () => {
    for (const [name, sheet] of Object.entries(documentStylesheets)) {
      const text = built(name);
      expect(text.startsWith(`${order}\n\n@layer ${sheet.layer} {\n`), name).toBe(true);
      expect(text.trimEnd().endsWith('}'), name).toBe(true);
      expect(text).not.toMatch(/!important/);
    }
  });

  it('share the visually hidden rules with the shadow-root primitive', () => {
    expect(declarations(built('utilities'), '.odd-visually-hidden')).toEqual(
      declarations(visuallyHiddenStyles.cssText, '.visually-hidden'),
    );
  });

  it('use the same focus ring as components', () => {
    const ring = declarations(focusRingStyles.cssText, ':focus-visible');
    expect(declarations(built('base'), ':focus-visible')).toEqual(ring);
    expect(declarations(built('utilities'), '.odd-focus-ring:focus-visible')).toEqual(ring);
  });
});
