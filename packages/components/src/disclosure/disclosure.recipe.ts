import { token } from '@oddkin/tokens/refs';
import { defineLayoutRecipe, row } from '../layout/index.js';

/** Arrangement of the disclosure (layout-recipes.md §14): the summary row: the marker beside the label. */
export const disclosureRecipe = defineLayoutRecipe({
  name: 'disclosure',
  regions: {
    summary: row({ gap: token('space.sm') }),
  },
});
