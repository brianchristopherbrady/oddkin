import { token } from '@oddkin/tokens/refs';
import { defineLayoutRecipe, row } from '../layout/index.js';

/** Arrangement of the progress head (layout-recipes.md §14): the label and the value text at the two ends of one row, on a shared baseline. */
export const progressRecipe = defineLayoutRecipe({
  name: 'progress',
  regions: {
    head: row({ gap: '0', align: 'baseline', justify: 'space-between' }),
  },
});
