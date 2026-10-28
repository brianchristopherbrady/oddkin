import { token } from '@oddkin/tokens/refs';
import { defineLayoutRecipe, row } from '../layout/index.js';

/** Arrangement of the dialog (layout-recipes.md §14): the heading beside the close button, and the footer actions in a row that wraps to the end. */
export const dialogRecipe = defineLayoutRecipe({
  name: 'dialog',
  regions: {
    header: row({ gap: token('space.sm'), align: 'start' }),
    footer: row({ gap: token('space.sm'), align: 'stretch', wrap: true, justify: 'end' }),
  },
});
