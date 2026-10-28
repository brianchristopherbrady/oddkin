import { defineLayoutRecipe, row } from '@oddkin/components/layout';
import { token } from '@oddkin/tokens/refs';

/** Arrangement of the suggestions (layout-recipes.md §14): the items in a row that wraps. */
export const suggestionsRecipe = defineLayoutRecipe({
  name: 'suggestions',
  regions: { list: row({ gap: token('space.xs'), align: 'stretch', wrap: true }) },
});
