import { token } from '@oddkin/tokens/refs';
import { defineLayoutRecipe, row } from '../layout/index.js';

/** Arrangement of the breadcrumbs (layout-recipes.md §14): the trail of links and separators in a row that wraps. */
export const breadcrumbsRecipe = defineLayoutRecipe({
  name: 'breadcrumbs',
  regions: {
    list: row({ gap: token('space.sm'), wrap: true }),
  },
});
