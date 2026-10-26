import { token } from '@oddkin/tokens/refs';
import { defineLayoutRecipe, row } from '../layout/index.js';

/** Arrangement of the rating (layout-recipes.md §14): the stars and the value in a row that wraps. */
export const ratingRecipe = defineLayoutRecipe({
  name: 'rating',
  regions: { row: row({ gap: token('space.sm'), wrap: true }) },
});
