import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compileString, NodePackageImporter, type Importer } from 'sass';
import { describe, expect, it } from 'vitest';
import {
  cssVariable,
  emitScssRefs,
  emitScssValues,
  generate,
  type ResolvedTheme,
} from '../src/generate/index.js';
import { literal } from '../src/generate/ts.js';
import { cases } from './fixtures/cases.js';
import { consumerScss, probes } from './fixtures/scss-consumer.js';

// Sass outputs (theming-and-styling.md §6, §11.5), compiled with Dart Sass: token() gives the same
// var() reference as the TypeScript token(), value() the same literal as the values module, and
// when() each condition's literal query. Computed styles are compared in scss.browser.test.ts.
const defaultConfig: unknown = JSON.parse(
  await readFile(new URL('../themes/default.theme.json', import.meta.url), 'utf8'),
);
const theme = generate(defaultConfig).theme as ResolvedTheme;

/** Serves the theme's modules as `refs` and `values`, as a project's own files would be. */
function modules(t: ResolvedTheme): Importer<'sync'> {
  const files: Record<string, string> = { refs: emitScssRefs(t), values: emitScssValues(t) };
  return {
    canonicalize: (url) => (url in files ? new URL(`oddkin:${url}`) : null),
    load: (url) => ({ contents: files[url.pathname] as string, syntax: 'scss' }),
  };
}
const compile = (source: string, t: ResolvedTheme = theme) =>
  compileString(source, { importers: [modules(t)], style: 'expanded' }).css;
const rule = (selector: string, declaration: string) => `${selector} {\n  ${declaration};\n}`;
const SIMPLE = /^(#[0-9a-f]{6}|-?[\d.]+[a-z%]*|cubic-bezier\([^()]*\))$/;

describe('Sass outputs', () => {
  it('compile, with every token, mode, and condition used, to the committed fixture', async () => {
    const css = compile(consumerScss(theme));
    const fixture = new URL('./fixtures/scss-consumer.css.txt', import.meta.url);
    if (process.env['UPDATE_FIXTURES']) await writeFile(fixture, css);
    expect(css).toBe(await readFile(fixture, 'utf8'));
  });

  for (const [label, t] of [
    ['the default theme', theme],
    ['products-density', generate(cases['products-density']).theme as ResolvedTheme],
  ] as const)
    it(`${label}: token() is the var() reference, value() the literal, when() the query`, () => {
      const css = compile(consumerScss(t), t);
      let exact = 0;
      probes(t).forEach(({ name, property, mode }, i) => {
        expect(css, name).toContain(rule(`.ref-${i}`, `${property}: var(${cssVariable(name)})`));
        const value = literal(t, name);
        const expected = typeof value === 'string' ? value : value[mode ?? 'light'];
        expect(css, name).toMatch(new RegExp(`\\.value-${i} \\{\\n  ${property}: `));
        // Values Sass writes back unchanged; colour functions, stacks, and shadows are compared as
        // computed styles in three engines instead.
        if (!SIMPLE.test(expected)) return;
        exact++;
        expect(css, name).toContain(rule(`.value-${i}`, `${property}: ${expected}`));
      });
      expect(exact).toBeGreaterThan(probes(t).length / 2);
      [...t.conditions.values()].forEach((condition, j) =>
        expect(css, condition.name).toContain(
          `${condition.atRule} {\n  .when-${j} {\n    --matched: 1;\n  }\n}`,
        ),
      );
    });

  it('take a fallback, and report unknown names and missing modes as Sass errors', () => {
    expect(compile("@use 'refs' as oddkin; a { b: oddkin.token('space.md', 4px); }")).toContain(
      'b: var(--odd-space-md, 4px);',
    );
    const error = (source: string) => {
      try {
        compile(`@use 'refs' as oddkin; @use 'values'; ${source}`);
      } catch (thrown) {
        // Sass prints an @error string with its quotes.
        return (thrown as Error).message.split('\n')[0]?.replace(/^'(.*)'$/, '$1');
      }
      return 'no error';
    };
    expect(error("a { b: oddkin.token('space.huge'); }")).toBe(
      'No token named "space.huge" in theme "default".',
    );
    expect(error("a { @include oddkin.when('page.huge') { b: c; } }")).toBe(
      'No condition named "page.huge" in theme "default".',
    );
    expect(error("a { b: values.value('color.text.primary'); }")).toBe(
      '"color.text.primary" differs by mode in theme "default": pass $mode: light or $mode: dark.',
    );
    expect(error("a { b: values.value('color.text.primary', $mode: dim); }")).toBe(
      'No mode "dim" in theme "default": use light or dark.',
    );
    expect(error("a { b: values.value('space.huge'); }")).toBe(
      'No token named "space.huge" in theme "default".',
    );
  });

  it('are published for the default theme and load through Sass’s Node package importer', async () => {
    for (const [entry, emitted] of [
      ['@oddkin/tokens/scss/refs', emitScssRefs(theme)],
      ['@oddkin/tokens/scss/values', emitScssValues(theme)],
    ] as const)
      expect(await readFile(new URL(import.meta.resolve(entry)), 'utf8'), entry).toBe(emitted);
    const css = compileString(
      [
        "@use 'pkg:@oddkin/tokens/scss/refs' as oddkin;",
        "@use 'pkg:@oddkin/tokens/scss/values';",
        "a { gap: oddkin.token('space.md'); padding: values.value('space.md'); }",
      ].join('\n'),
      { importers: [new NodePackageImporter(fileURLToPath(new URL('.', import.meta.url)))] },
    ).css;
    expect(css).toBe('a {\n  gap: var(--odd-space-md);\n  padding: 1rem;\n}');
  });
});
