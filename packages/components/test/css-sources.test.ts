import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { describe, expect, it } from 'vitest';
import { cssVariable, resolveTheme } from '@oddkin/tokens/generate';
import { cardStyles } from '../src/card/card.styles.js';

// Component styles authored as plain CSS (theming-and-styling.md §7). The committed module is
// generated from the .css file: theme variables become token() calls, so TypeScript checks them
// against TokenName and the analyzer reads them as it reads CSS-in-TS. UPDATE_FIXTURES=1
// regenerates the module.
const authored = [
  {
    css: '../src/card/card.styles.css',
    module: '../src/card/card.styles.ts',
    exportName: 'cardStyles',
    prefix: '--odd-card-',
    styles: cardStyles,
  },
];

const config: unknown = JSON.parse(
  await readFile(new URL('../../tokens/themes/default.theme.json', import.meta.url), 'utf8'),
);
const tokens = new Map(
  [...resolveTheme(config).theme!.tokens.keys()].map((name) => [cssVariable(name), name]),
);

/**
 * The module for one authored stylesheet. A leading comment documents the export; component
 * variables (`prefix`) stay as written; any other `--odd-*` must be a theme token, read without
 * a fallback.
 */
function cssModule(source: string, file: string, exportName: string, prefix: string): string {
  const [, doc = '', body = ''] =
    /^\s*\/\*([\s\S]*?)\*\/\s*([\s\S]*)$/.exec(source.replace(/\r\n/g, '\n')) ?? [];
  if (!doc) throw new Error(`${file}: start with a comment that documents the styles`);
  for (const [, name = '', next] of body.matchAll(/var\(\s*(--odd-[\w-]+)\s*([,)])/g)) {
    if (tokens.has(name) && next === ',')
      throw new Error(`${file}: ${name} is a theme token; read it without a fallback`);
    if (!tokens.has(name) && !name.startsWith(prefix))
      throw new Error(`${file}: ${name} is neither a theme token nor a ${prefix}* variable`);
  }
  let usesToken = false;
  const text = body
    .trimEnd()
    .replace(/[\\`]|\$\{/g, (match) => `\\${match}`)
    .replace(/var\(\s*(--odd-[\w-]+)\s*\)/g, (match, name: string) => {
      const token = tokens.get(name);
      if (!token) return match;
      usesToken = true;
      return `\${token('${token}')}`;
    })
    .split('\n')
    .map((line) => (line ? `  ${line}` : line))
    .join('\n');
  return [
    `// Generated from ${basename(file)} by packages/components/test/css-sources.test.ts (UPDATE_FIXTURES=1).`,
    `// Do not edit: change ${basename(file)} and regenerate.`,
    `import { css } from '@oddkin/core/styles';`,
    ...(usesToken ? [`import { token } from '@oddkin/tokens/refs';`] : []),
    '',
    `/** ${doc.trim().replace(/\s+/g, ' ')} */`,
    `export const ${exportName} = css\`\n${text}\n\`;`,
    '',
  ].join('\n');
}
const formatted = async (text: string, file: URL) => {
  const path = fileURLToPath(file);
  return format(text, { ...(await resolveConfig(path)), filepath: path });
};
const words = (css: string) =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .trim()
    .split(/\s+/);

describe('styles authored as CSS', () => {
  for (const entry of authored) {
    it(`${basename(entry.module)} is generated from ${basename(entry.css)}`, async () => {
      const source = await readFile(new URL(entry.css, import.meta.url), 'utf8');
      const url = new URL(entry.module, import.meta.url);
      const expected = await formatted(
        cssModule(source, entry.css, entry.exportName, entry.prefix),
        url,
      );
      if (process.env['UPDATE_FIXTURES']) await writeFile(url, expected);
      expect(await readFile(url, 'utf8')).toBe(expected);
      // The shipped text is the authored CSS (comments and whitespace aside).
      const [, , body = ''] = /^\s*\/\*([\s\S]*?)\*\/\s*([\s\S]*)$/.exec(source) ?? [];
      expect(words(entry.styles.cssText)).toEqual(words(body));
    });
  }

  it('rejects unknown theme variables and token reads with fallbacks', () => {
    const module = (css: string) => cssModule(`/* Doc. */\n${css}`, 'x.css', 'x', '--odd-x-');
    expect(() => module('a { color: var(--odd-colour-text-primary); }')).toThrow(
      /neither a theme token/,
    );
    expect(() => module('a { gap: var(--odd-space-sm, 4px); }')).toThrow(/without a fallback/);
    expect(() => cssModule('a { color: red; }', 'x.css', 'x', '--odd-x-')).toThrow(/comment/);
    expect(module('a { gap: var(--odd-x-gap, var(--odd-space-sm)); }')).toContain(
      "gap: var(--odd-x-gap, ${token('space.sm')});",
    );
  });
});
