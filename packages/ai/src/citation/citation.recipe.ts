import { defineLayoutRecipe, stack } from '@oddkin/components/layout';
import { token } from '@oddkin/tokens/refs';

/**
 * Arrangement of the citation (layout-recipes.md §14), as the Figma specimen has it: the preview's
 * source identity (title over host), excerpt, and actions in a column.
 */
export const citationRecipe = defineLayoutRecipe({
  name: 'citation',
  regions: {
    preview: stack({ gap: token('space.sm') }),
    identity: stack({ gap: token('space.2xs') }),
  },
});
