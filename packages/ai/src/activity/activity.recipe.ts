import { defineLayoutRecipe, row } from '@oddkin/components/layout';
import { token } from '@oddkin/tokens/refs';

/** Arrangement of the activity line (layout-recipes.md §14): indicator, text, and actions in a row that wraps. */
export const activityRecipe = defineLayoutRecipe({
  name: 'activity',
  regions: { base: row({ gap: token('space.xs'), wrap: true }) },
});
