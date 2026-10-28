import { defineLayoutRecipe, row, stack } from '@oddkin/components/layout';
import { token } from '@oddkin/tokens/refs';

/**
 * Arrangement of the response feedback (layout-recipes.md §14): the actions, the form, and the
 * comment field stacked; each reason's checkbox beside its label, centred.
 */
export const responseFeedbackRecipe = defineLayoutRecipe({
  name: 'response-feedback',
  regions: {
    base: stack({ gap: token('space.xs') }),
    form: stack({ gap: token('space.xs') }),
    check: row({ gap: token('space.xs') }),
    field: stack({ gap: token('space.2xs') }),
  },
});
