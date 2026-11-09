import { defineLayoutRecipe, grid, stack } from '@oddkin/components/layout';
import { token } from '@oddkin/tokens/refs';

/**
 * Arrangement of the change review (layout-recipes.md §14): the stacked proposals, the parts of
 * each one stacked, a line diff's Before and After blocks stacked, a side-by-side diff in two
 * columns (one below 30rem: `diffViewStyles`), and each side's label over its text.
 */
export const changeReviewRecipe = defineLayoutRecipe({
  name: 'change-review',
  regions: {
    list: stack({ gap: token('space.sm') }),
    body: stack({ gap: token('space.sm') }),
    sides: stack({ gap: token('space.xs') }),
    split: grid({ columns: 2, gap: token('space.xs') }),
    side: stack({ gap: token('space.xs') }),
  },
});
