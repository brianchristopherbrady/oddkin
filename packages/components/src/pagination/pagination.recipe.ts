import { token } from '@oddkin/tokens/refs';
import { defineLayoutRecipe, row } from '../layout/index.js';

/** Arrangement of the pagination (layout-recipes.md §14): the position and the page list apart in a row that wraps, and the pages in a row that wraps. */
export const paginationRecipe = defineLayoutRecipe({
  name: 'pagination',
  regions: {
    pagination: row({ gap: token('space.sm'), wrap: true, justify: 'space-between' }),
    list: row({ gap: token('space.xs'), wrap: true }),
  },
});
