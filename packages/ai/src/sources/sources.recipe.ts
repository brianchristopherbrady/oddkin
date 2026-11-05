import { defineLayoutRecipe, row, stack } from '@oddkin/components/layout';
import { token } from '@oddkin/tokens/refs';

/**
 * Arrangement of the sources (layout-recipes.md §14), as the Figma specimen has it: the heading and
 * the items in a column; each item's number before its source, whose title and host share a line
 * above the excerpt.
 */
export const sourcesRecipe = defineLayoutRecipe({
  name: 'sources',
  regions: {
    base: stack({ gap: token('space.sm') }),
    list: stack({ gap: token('space.xs') }),
    item: row({ gap: token('space.sm'), align: 'start' }),
    source: stack({ gap: token('space.xs') }),
    line: row({ gap: token('space.sm'), align: 'baseline', wrap: true }),
  },
});
