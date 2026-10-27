import { token } from '@oddkin/tokens/refs';
import { defineLayoutRecipe, row } from '../layout/index.js';

/** Arrangement of the chosen values of `odd-combobox multiple` (layout-recipes.md §14): the chips in a row that wraps around the input. */
export const comboboxRecipe = defineLayoutRecipe({
  name: 'combobox',
  regions: {
    chips: row({ gap: token('control.gap'), wrap: true }),
  },
});
