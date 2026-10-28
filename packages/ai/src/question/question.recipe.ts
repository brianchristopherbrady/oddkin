import { defineLayoutRecipe, row, stack } from '@oddkin/components/layout';
import { token } from '@oddkin/tokens/refs';

/**
 * Arrangement of the question (layout-recipes.md §14): the form, the options, and each free-text
 * field stacked; each option's control beside its label, centred.
 */
export const questionRecipe = defineLayoutRecipe({
  name: 'question',
  regions: {
    form: stack({ gap: token('space.xs') }),
    options: stack({ gap: token('space.2xs') }),
    option: row({ gap: token('space.xs') }),
    field: stack({ gap: token('space.2xs') }),
  },
});
