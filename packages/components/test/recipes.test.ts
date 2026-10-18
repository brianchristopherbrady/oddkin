import { readFile, writeFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { sideNavRecipe } from '../src/side-nav/side-nav.recipe.js';
import { sideNavRecipeStyles } from '../src/side-nav/side-nav.recipe.styles.js';

// Build-time recipe extraction (layout-recipes.md §9): shipped definitions use the recipe's CSS
// as a precompiled module, so registration entries never load the recipe engine. The extracted
// text must stay byte-identical to the recipe (UPDATE_FIXTURES=1 regenerates it).
const extracted = [
  {
    file: '../src/side-nav/side-nav.recipe.styles.ts',
    exportName: 'sideNavRecipeStyles',
    source: './side-nav.recipe.ts',
    recipe: sideNavRecipe,
    styles: sideNavRecipeStyles,
  },
];

// Single-quoted with escapes, so the generated module is already in Prettier's format.
const literal = (text: string) =>
  `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;

const moduleText = (exportName: string, source: string, cssText: string) =>
  `// Generated from ${source} by packages/components/test/recipes.test.ts (UPDATE_FIXTURES=1).\n` +
  `// Do not edit: change the recipe and regenerate.\n` +
  `import { unsafeCSS } from '@oddkin/core/styles';\n\n` +
  `export const ${exportName} = unsafeCSS(\n  ${literal(cssText)},\n);\n`;

describe('extracted recipe styles', () => {
  for (const entry of extracted) {
    it(`${entry.exportName} matches ${entry.source}`, async () => {
      const url = new URL(entry.file, import.meta.url);
      const expected = moduleText(entry.exportName, entry.source, entry.recipe.cssText);
      if (process.env['UPDATE_FIXTURES']) await writeFile(url, expected);
      expect(await readFile(url, 'utf8')).toBe(expected);
      expect(entry.styles.cssText).toBe(entry.recipe.cssText);
    });
  }
});
