import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Right-to-left and vertical writing modes (M8): component styles in @oddkin/components and
// @oddkin/ai use flow-relative properties only, so `dir` and `writing-mode` mirror them.
// Browser tests check the mirrored result for odd-button and odd-side-nav; e2e/presentation.spec.ts
// checks overflow in right-to-left on every example page.

const root = fileURLToPath(new URL('../../..', import.meta.url));
const sources = ['packages/components/src', 'packages/ai/src'];

const PHYSICAL: [RegExp, string][] = [
  [
    /(?<![\w-])(margin|padding|border|scroll-margin|scroll-padding)-(left|right|top|bottom)\b/,
    'use *-inline-* / *-block-*',
  ],
  [/(?<![\w-])(left|right|top|bottom)\s*:/, 'use inset-inline-* / inset-block-*'],
  [/(?<![\w-])(min-|max-)?(width|height)\s*:/, 'use inline-size / block-size'],
  [/text-align\s*:\s*(left|right)\b/, 'use start / end'],
  [/(?<![\w-])(float|clear)\s*:\s*(left|right)\b/, 'use inline-start / inline-end'],
];
// Allowed physical axes, both unaffected by `dir` in horizontal writing: `overflow-x`/`-y`
// (`overflow-inline`/`-block` need Chrome 135 and Safari 26, above the floor) and
// `resize: vertical | horizontal` (`resize: block` fails the Firefox Android and Safari iOS floor).
// Vertical writing modes are not supported by these components.

function* styleFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* styleFiles(path);
    else if (/\.styles\.(ts|css)$|(^|[\\/])css[\\/]index\.ts$/.test(path)) yield path;
  }
}

/** The CSS text of a module: `css` tagged templates in TypeScript, the whole file for .css. */
const cssOf = (path: string, text: string) =>
  path.endsWith('.css')
    ? [text]
    : [...text.matchAll(/css`([\s\S]*?)`;/g)].map((m) => m[1]!.replace(/\/\*[\s\S]*?\*\//g, ''));

describe('component styles are flow-relative', () => {
  const files = sources.flatMap((dir) => [...styleFiles(join(root, dir))]);

  it('finds the style modules of both packages', () => {
    expect(files.filter((f) => f.includes(join('packages', 'components'))).length).toBeGreaterThan(
      5,
    );
    expect(files.filter((f) => f.includes(join('packages', 'ai'))).length).toBeGreaterThan(20);
  });

  it('declares no physical box, position, size, alignment, or overflow properties', () => {
    const problems: string[] = [];
    for (const file of files) {
      for (const block of cssOf(file, readFileSync(file, 'utf8'))) {
        for (const line of block.split('\n')) {
          for (const [pattern, hint] of PHYSICAL)
            if (pattern.test(line))
              problems.push(`${relative(root, file)}: "${line.trim()}" (${hint})`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
