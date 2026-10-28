import { defineLayoutRecipe, row, stack } from '@oddkin/components/layout';
import { token } from '@oddkin/tokens/refs';

/**
 * Arrangement of the conversation (layout-recipes.md §14): the scroller above the composer, the
 * messages of the feed, and the history and empty rows, centred and wrapping.
 */
export const conversationRecipe = defineLayoutRecipe({
  name: 'conversation',
  regions: {
    base: stack({ gap: token('space.xs') }),
    feed: stack({ gap: token('space.lg') }),
    history: row({ gap: token('space.xs'), align: 'stretch', wrap: true, justify: 'center' }),
    empty: row({ gap: token('space.xs'), align: 'stretch', wrap: true, justify: 'center' }),
  },
});
