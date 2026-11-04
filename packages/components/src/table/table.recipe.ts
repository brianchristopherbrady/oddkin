import { token } from '@oddkin/tokens/refs';
import { defineLayoutRecipe, row } from '../layout/index.js';

/**
 * Arrangement of the table (layout-recipes.md §14): a sort button's label beside its mark, and
 * the busy and error rows' content with the glyph beside the text. The table itself is a native
 * table.
 */
export const tableRecipe = defineLayoutRecipe({
  name: 'table',
  regions: {
    sort: row({ gap: token('space.2xs') }),
    state: row({ gap: token('space.sm') }),
  },
});
