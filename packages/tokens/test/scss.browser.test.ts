import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { conditions } from '../src/conditions/index.js';
import { cssVariable, generate, type ResolvedTheme } from '../src/generate/index.js';
import { token, type TokenName } from '../src/refs/index.js';
import { probes } from './fixtures/scss-consumer.js';

// Equivalent consumption in three engines (theming-and-styling.md §11.5): the Sass modules, compiled
// by Dart Sass in scss.test.ts (fixtures/scss-consumer.css.txt), style elements exactly as CSS
// var() references and the TypeScript token() and conditions modules do.
const config: unknown = await (
  await fetch(new URL('../themes/default.theme.json', import.meta.url))
).json();
const result = generate(config);
const theme = result.theme as ResolvedTheme;
const compiled = await (
  await fetch(new URL('./fixtures/scss-consumer.css.txt', import.meta.url))
).text();
const list = probes(theme);
const names = [...theme.conditions.keys()] as Array<keyof typeof conditions>;

describe('Sass, CSS, and TypeScript consumption in a real cascade', () => {
  const sheet = new CSSStyleSheet();
  let root: HTMLElement;

  beforeAll(() => {
    // The CSS route writes var() by hand; the TypeScript route uses token() and the conditions module.
    const css = list.map(
      ({ name, property }, i) => `.css-${i} { ${property}: var(${cssVariable(name)}); }`,
    );
    const ts = list.map(
      ({ name, property }, i) => `.ts-${i} { ${property}: ${token(name as TokenName)}; }`,
    );
    const when = names.map(
      (name, j) => `${conditions[name].atRule} { .ts-when-${j} { --matched: 1; } }`,
    );
    sheet.replaceSync([result.css, compiled, ...css, ...ts, ...when].join('\n'));
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    root = document.createElement('div');
    document.body.append(root);
  });

  afterAll(() => {
    root.remove();
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== sheet);
  });

  const scope = (attributes: string) => {
    const element = document.createElement('div');
    element.innerHTML = `<div ${attributes}></div>`;
    root.append(element);
    return element.firstElementChild as HTMLElement;
  };
  const probe = (parent: HTMLElement, className: string) => {
    const element = document.createElement('i');
    element.className = className;
    parent.append(element);
    return element;
  };
  const computed = (element: Element, property: string) =>
    getComputedStyle(element).getPropertyValue(property);

  it('value() gives every token’s value in each mode, as var() resolves it at the theme’s base', () => {
    const modes = { light: scope('data-odd-mode="light"'), dark: scope('data-odd-mode="dark"') };
    list.forEach(({ name, property, mode }, i) => {
      const parent = modes[mode ?? 'light'];
      const [value, reference] = [probe(parent, `value-${i}`), probe(parent, `css-${i}`)];
      expect(computed(value, property), `${name} ${mode ?? ''}`).toBe(
        computed(reference, property),
      );
      expect(computed(value, property), name).not.toBe('');
    });
  });

  it('token() in Sass and TypeScript follows mode, density, and profile scopes as var() does', () => {
    const nested = scope('data-odd-mode="dark"');
    nested.innerHTML =
      '<div data-odd-density="compact"><div data-odd-profile="layout.compact"></div></div>';
    const inner = nested.querySelector('[data-odd-profile]') as HTMLElement;
    list.forEach(({ name, property }, i) => {
      const [sass, ts, css] = ['ref', 'ts', 'css'].map((route) => probe(inner, `${route}-${i}`));
      const expected = computed(css as Element, property);
      expect(
        [computed(sass as Element, property), computed(ts as Element, property)],
        name,
      ).toEqual([expected, expected]);
    });
  });

  it('when() in Sass matches exactly where the conditions module’s query matches', () => {
    let matched = 0;
    for (const width of ['20rem', '100rem']) {
      const host = scope(`style="container: shell / inline-size; inline-size: ${width}"`);
      names.forEach((name, j) => {
        const [sass, ts] = [probe(host, `when-${j}`), probe(host, `ts-when-${j}`)];
        expect(computed(sass, '--matched'), `${name} at ${width}`).toBe(computed(ts, '--matched'));
        if (computed(sass, '--matched').trim() === '1') matched++;
      });
    }
    // The container condition matches in the wide host only, so both outcomes are exercised.
    expect(matched).toBeGreaterThan(0);
    expect(matched).toBeLessThan(names.length * 2);
  });
});
