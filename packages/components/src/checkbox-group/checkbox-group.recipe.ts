import { token } from '@oddkin/tokens/refs';
import { defineLayoutRecipe, row, stack } from '../layout/index.js';

/**
 * Arrangement of the checkbox group (layout-recipes.md §14): the options in a column, or with
 * `orientation="horizontal"` in a row that wraps.
 */
export const checkboxGroupRecipe = defineLayoutRecipe({
  name: 'checkbox-group',
  regions: { options: stack({ gap: token('space.lg'), align: 'start' }) },
  variants: {
    orientation: {
      horizontal: { options: row({ gap: token('space.lg'), align: 'start', wrap: true }) },
    },
  },
});
