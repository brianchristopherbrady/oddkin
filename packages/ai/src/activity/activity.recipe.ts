import { defineLayoutRecipe, row, stack } from '@oddkin/components/layout';
import { token } from '@oddkin/tokens/refs';

/**
 * Arrangement of the activity line (layout-recipes.md §14): indicator, text, and actions in a row
 * that wraps; the wait's badge above its counts.
 */
export const activityRecipe = defineLayoutRecipe({
  name: 'activity',
  regions: {
    base: row({ gap: token('space.sm'), wrap: true }),
    waiting: stack({ gap: token('space.xs'), align: 'start' }),
  },
});
