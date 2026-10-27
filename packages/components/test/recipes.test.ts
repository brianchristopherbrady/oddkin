import { readFile, writeFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { alertRecipe } from '../src/alert/alert.recipe.js';
import { alertRecipeStyles } from '../src/alert/alert.recipe.styles.js';
import { comboboxRecipe } from '../src/combobox/combobox.recipe.js';
import { comboboxRecipeStyles } from '../src/combobox/combobox.recipe.styles.js';
import { emptyStateRecipe } from '../src/empty-state/empty-state.recipe.js';
import { emptyStateRecipeStyles } from '../src/empty-state/empty-state.recipe.styles.js';
import { progressRecipe } from '../src/progress/progress.recipe.js';
import { progressRecipeStyles } from '../src/progress/progress.recipe.styles.js';
import { statRecipe } from '../src/stat/stat.recipe.js';
import { statRecipeStyles } from '../src/stat/stat.recipe.styles.js';
import { checkboxGroupRecipe } from '../src/checkbox-group/checkbox-group.recipe.js';
import { checkboxGroupRecipeStyles } from '../src/checkbox-group/checkbox-group.recipe.styles.js';
import { colorPickerRecipe } from '../src/color-picker/color-picker.recipe.js';
import { colorPickerRecipeStyles } from '../src/color-picker/color-picker.recipe.styles.js';
import { commandPaletteRecipe } from '../src/command-palette/command-palette.recipe.js';
import { commandPaletteRecipeStyles } from '../src/command-palette/command-palette.recipe.styles.js';
import { listboxRecipe } from '../src/listbox/listbox.recipe.js';
import { listboxRecipeStyles } from '../src/listbox/listbox.recipe.styles.js';
import { radioGroupRecipe } from '../src/radio-group/radio-group.recipe.js';
import { radioGroupRecipeStyles } from '../src/radio-group/radio-group.recipe.styles.js';
import { ratingRecipe } from '../src/rating/rating.recipe.js';
import { ratingRecipeStyles } from '../src/rating/rating.recipe.styles.js';
import { scrollRegionRecipe } from '../src/scroll-region/scroll-region.recipe.js';
import { scrollRegionRecipeStyles } from '../src/scroll-region/scroll-region.recipe.styles.js';
import { sideNavRecipe } from '../src/side-nav/side-nav.recipe.js';
import { sideNavRecipeStyles } from '../src/side-nav/side-nav.recipe.styles.js';
import { sliderRecipe } from '../src/slider/slider.recipe.js';
import { sliderRecipeStyles } from '../src/slider/slider.recipe.styles.js';
import { treeRecipe } from '../src/tree/tree.recipe.js';
import { treeRecipeStyles } from '../src/tree/tree.recipe.styles.js';

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
  {
    file: '../src/listbox/listbox.recipe.styles.ts',
    exportName: 'listboxRecipeStyles',
    source: './listbox.recipe.ts',
    recipe: listboxRecipe,
    styles: listboxRecipeStyles,
  },
  {
    file: '../src/tree/tree.recipe.styles.ts',
    exportName: 'treeRecipeStyles',
    source: './tree.recipe.ts',
    recipe: treeRecipe,
    styles: treeRecipeStyles,
  },
  {
    file: '../src/command-palette/command-palette.recipe.styles.ts',
    exportName: 'commandPaletteRecipeStyles',
    source: './command-palette.recipe.ts',
    recipe: commandPaletteRecipe,
    styles: commandPaletteRecipeStyles,
  },
  {
    file: '../src/scroll-region/scroll-region.recipe.styles.ts',
    exportName: 'scrollRegionRecipeStyles',
    source: './scroll-region.recipe.ts',
    recipe: scrollRegionRecipe,
    styles: scrollRegionRecipeStyles,
  },
  {
    file: '../src/checkbox-group/checkbox-group.recipe.styles.ts',
    exportName: 'checkboxGroupRecipeStyles',
    source: './checkbox-group.recipe.ts',
    recipe: checkboxGroupRecipe,
    styles: checkboxGroupRecipeStyles,
  },
  {
    file: '../src/radio-group/radio-group.recipe.styles.ts',
    exportName: 'radioGroupRecipeStyles',
    source: './radio-group.recipe.ts',
    recipe: radioGroupRecipe,
    styles: radioGroupRecipeStyles,
  },
  {
    file: '../src/rating/rating.recipe.styles.ts',
    exportName: 'ratingRecipeStyles',
    source: './rating.recipe.ts',
    recipe: ratingRecipe,
    styles: ratingRecipeStyles,
  },
  {
    file: '../src/slider/slider.recipe.styles.ts',
    exportName: 'sliderRecipeStyles',
    source: './slider.recipe.ts',
    recipe: sliderRecipe,
    styles: sliderRecipeStyles,
  },
  {
    file: '../src/color-picker/color-picker.recipe.styles.ts',
    exportName: 'colorPickerRecipeStyles',
    source: './color-picker.recipe.ts',
    recipe: colorPickerRecipe,
    styles: colorPickerRecipeStyles,
  },
  {
    file: '../src/alert/alert.recipe.styles.ts',
    exportName: 'alertRecipeStyles',
    source: './alert.recipe.ts',
    recipe: alertRecipe,
    styles: alertRecipeStyles,
  },
  {
    file: '../src/combobox/combobox.recipe.styles.ts',
    exportName: 'comboboxRecipeStyles',
    source: './combobox.recipe.ts',
    recipe: comboboxRecipe,
    styles: comboboxRecipeStyles,
  },
  {
    file: '../src/empty-state/empty-state.recipe.styles.ts',
    exportName: 'emptyStateRecipeStyles',
    source: './empty-state.recipe.ts',
    recipe: emptyStateRecipe,
    styles: emptyStateRecipeStyles,
  },
  {
    file: '../src/progress/progress.recipe.styles.ts',
    exportName: 'progressRecipeStyles',
    source: './progress.recipe.ts',
    recipe: progressRecipe,
    styles: progressRecipeStyles,
  },
  {
    file: '../src/stat/stat.recipe.styles.ts',
    exportName: 'statRecipeStyles',
    source: './stat.recipe.ts',
    recipe: statRecipe,
    styles: statRecipeStyles,
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
