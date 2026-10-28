import { defineLayoutRecipe, stack } from '@oddkin/components/layout';
import { token } from '@oddkin/tokens/refs';

/**
 * Arrangement of the usage meter (layout-recipes.md §14): the entries stacked. Each entry's
 * term and value columns are component geometry (sized columns).
 */
export const usageMeterRecipe = defineLayoutRecipe({
  name: 'usage-meter',
  regions: { list: stack({ gap: token('space.xs') }) },
});
