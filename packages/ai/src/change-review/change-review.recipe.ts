import { autoGrid, defineLayoutRecipe, stack } from '@oddkin/components/layout';
import { token } from '@oddkin/tokens/refs';

/**
 * Arrangement of the change review (layout-recipes.md §14): the stacked proposals, each one's
 * parts stacked, and a side-by-side diff in as many 14rem columns as fit.
 */
export const changeReviewRecipe = defineLayoutRecipe({
  name: 'change-review',
  regions: {
    list: stack({ gap: token('space.sm') }),
    proposal: stack({ gap: token('space.xs') }),
    split: autoGrid({ min: '14rem', fill: 'auto-fit', gap: token('space.sm') }),
  },
});
