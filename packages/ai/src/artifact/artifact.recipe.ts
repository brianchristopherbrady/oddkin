import { defineLayoutRecipe, row, stack } from '@oddkin/components/layout';
import { token } from '@oddkin/tokens/refs';

/** Arrangement of the artifact (layout-recipes.md §14): header, notes, and the preview or source in a column; the header's title, revision, and actions in a row that wraps. */
export const artifactRecipe = defineLayoutRecipe({
  name: 'artifact',
  regions: {
    base: stack({ gap: token('space.xs') }),
    header: row({ gap: token('space.xs'), wrap: true }),
  },
});
