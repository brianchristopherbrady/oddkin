import { defineLayoutRecipe, row, stack } from '@oddkin/components/layout';
import { token } from '@oddkin/tokens/refs';

/**
 * Arrangement of a message (layout-recipes.md §14): header, content, and footer in a column; the
 * header's role and status in a row that wraps; the parts of the content and the edit form in
 * columns.
 */
export const messageRecipe = defineLayoutRecipe({
  name: 'message',
  regions: {
    base: stack({ gap: token('space.xs') }),
    header: row({ gap: token('space.xs'), wrap: true }),
    content: stack({ gap: token('space.sm') }),
    edit: stack({ gap: token('space.xs') }),
  },
});
