import { defineLayoutRecipe, stack } from '@oddkin/components/layout';
import { token } from '@oddkin/tokens/refs';

/** Arrangement of the transcript (layout-recipes.md §14): the final segments in a column, then the interim line. */
export const transcriptRecipe = defineLayoutRecipe({
  name: 'transcript',
  regions: { base: stack({ gap: token('space.xs') }), list: stack({ gap: token('space.2xs') }) },
});
