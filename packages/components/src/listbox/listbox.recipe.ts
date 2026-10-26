import { token } from '@oddkin/tokens/refs';
import { defineLayoutRecipe, row } from '../layout/index.js';

/**
 * Arrangement of the listbox's busy and empty rows: the glyph beside the text (layout-recipes.md
 * §14). odd-combobox and odd-picker share them through the listbox's structural sheet.
 */
export const listboxRecipe = defineLayoutRecipe({
  name: 'listbox',
  regions: { state: row({ gap: token('space.sm') }) },
});
