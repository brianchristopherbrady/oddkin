import { defineLayoutRecipe, row, stack } from '@oddkin/components/layout';
import { token } from '@oddkin/tokens/refs';

/**
 * Arrangement of the artifact (layout-recipes.md §14), as the Figma specimen has it: header,
 * toolbar, notes, and the preview or source in a column; the title and revision in a row that
 * wraps; the actions, then the view choice at the row's end.
 */
export const artifactRecipe = defineLayoutRecipe({
  name: 'artifact',
  regions: {
    base: stack({ gap: token('space.xs') }),
    header: row({ gap: token('space.sm'), wrap: true }),
    toolbar: row({ gap: token('space.xs'), justify: 'space-between', wrap: true }),
  },
});
