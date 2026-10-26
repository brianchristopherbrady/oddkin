import { token } from '@oddkin/tokens/refs';
import { defineLayoutRecipe, row } from '../layout/index.js';

/**
 * Arrangement of the command palette (layout-recipes.md §14): the search field's row (glyph,
 * input, hint), the busy and empty rows, and the keyboard hints in a row that wraps.
 */
export const commandPaletteRecipe = defineLayoutRecipe({
  name: 'command-palette',
  regions: {
    search: row({ gap: token('space.sm') }),
    state: row({ gap: token('space.sm') }),
    footer: row({ gap: token('space.md'), align: 'stretch', wrap: true }),
  },
});
