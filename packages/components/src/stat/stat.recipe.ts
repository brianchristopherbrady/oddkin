import { token } from '@oddkin/tokens/refs';
import { defineLayoutRecipe, row, stack } from '../layout/index.js';

/** Arrangement of the stat (layout-recipes.md §14): label, value, and context in a column; the context is a row of the trend glyph and its words. */
export const statRecipe = defineLayoutRecipe({
  name: 'stat',
  regions: {
    base: stack({ gap: token('space.xs') }),
    context: row({ gap: token('space.xs') }),
  },
});
