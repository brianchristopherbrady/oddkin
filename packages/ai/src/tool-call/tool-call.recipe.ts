import { defineLayoutRecipe, stack } from '@oddkin/components/layout';
import { token } from '@oddkin/tokens/refs';

/**
 * Arrangement of the tool call (layout-recipes.md §14; Figma page 10): the card's parts stacked
 * `space.md` apart (the summary's name, status, and purpose, Details, the failure, the approval),
 * the arguments and the result in Details stacked the same, each a label over its code, and the
 * failure's message over Retry, which keeps its own width.
 */
export const toolCallRecipe = defineLayoutRecipe({
  name: 'tool-call',
  regions: {
    base: stack({ gap: token('space.md') }),
    summary: stack({ gap: token('space.md') }),
    body: stack({ gap: token('space.md') }),
    section: stack({ gap: token('space.xs') }),
    failure: stack({ gap: token('space.md'), align: 'start' }),
  },
});
