import { token } from '@oddkin/tokens/refs';
import { defineLayoutRecipe, row } from '../layout/index.js';

/**
 * Arrangement of the slider (layout-recipes.md §14): the label and the value in one row on a shared
 * baseline (the value keeps to the end with its own auto margin, also without a label), and the
 * two end labels at the ends of a row.
 */
export const sliderRecipe = defineLayoutRecipe({
  name: 'slider',
  regions: {
    heading: row({ gap: token('space.none'), align: 'baseline' }),
    endpoints: row({ gap: token('space.none'), align: 'baseline', justify: 'space-between' }),
  },
});
