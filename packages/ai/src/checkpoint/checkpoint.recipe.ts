import { defineLayoutRecipe, stack } from '@oddkin/components/layout';
import { token } from '@oddkin/tokens/refs';

/** Arrangement of the checkpoint (layout-recipes.md §14): its card and the restore confirmation, stacked. */
export const checkpointRecipe = defineLayoutRecipe({
  name: 'checkpoint',
  regions: {
    base: stack({ gap: token('space.xs') }),
    confirm: stack({ gap: token('space.xs') }),
  },
});
