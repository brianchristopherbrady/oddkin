import { defineLayoutRecipe, row, stack } from '@oddkin/components/layout';
import { token } from '@oddkin/tokens/refs';

/**
 * Arrangement of the context picker (layout-recipes.md §14), as the Figma specimen has it: the
 * stacked items; each item's details (name over kind), status, and actions in a centred row that
 * wraps; and the URL field beside its button.
 */
export const contextPickerRecipe = defineLayoutRecipe({
  name: 'context-picker',
  regions: {
    base: stack({ gap: token('space.sm') }),
    list: stack({ gap: token('space.2xs') }),
    row: row({ gap: token('space.sm'), wrap: true }),
    details: stack({ gap: token('space.2xs') }),
    tools: row({ gap: token('space.xs') }),
    url: row({ gap: token('space.2xs'), align: 'stretch', wrap: true }),
  },
});
