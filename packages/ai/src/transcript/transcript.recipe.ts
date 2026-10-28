import { defineLayoutRecipe, stack } from '@oddkin/components/layout';
import { token } from '@oddkin/tokens/refs';

/** Arrangement of the transcript (layout-recipes.md §14): the final segments in a column. */
export const transcriptRecipe = defineLayoutRecipe({
  name: 'transcript',
  regions: { list: stack({ gap: token('space.2xs') }) },
});
