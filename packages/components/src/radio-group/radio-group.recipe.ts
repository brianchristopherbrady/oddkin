import { token } from '@oddkin/tokens/refs';
import { defineLayoutRecipe, row, stack } from '../layout/index.js';

/**
 * Arrangement of the radio group (layout-recipes.md §14): the options, and the options of each
 * group, in a column; with `orientation="horizontal"`, the options in a row that wraps.
 */
export const radioGroupRecipe = defineLayoutRecipe({
  name: 'radio-group',
  regions: {
    options: stack({ gap: token('space.lg'), align: 'start' }),
    group: stack({ gap: token('space.lg'), align: 'start' }),
  },
  variants: {
    orientation: {
      horizontal: { options: row({ gap: token('space.lg'), align: 'start', wrap: true }) },
    },
  },
});
