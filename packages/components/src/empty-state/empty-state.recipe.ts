import { token } from '@oddkin/tokens/refs';
import { defineLayoutRecipe, row, stack } from '../layout/index.js';

/** Arrangement of the empty state (layout-recipes.md §14): media, label, description, and footer in a centred column; the footer is a centred row of actions that wraps. */
export const emptyStateRecipe = defineLayoutRecipe({
  name: 'empty-state',
  regions: {
    empty: stack({ gap: token('space.sm'), align: 'center' }),
    footer: row({ gap: token('space.xs'), align: 'stretch', justify: 'center', wrap: true }),
  },
});
