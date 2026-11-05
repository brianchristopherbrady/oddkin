import { defineLayoutRecipe, stack } from '@oddkin/components/layout';
import { token } from '@oddkin/tokens/refs';

/**
 * Arrangement of the approval (layout-recipes.md §14): the card's parts, the proposed changes, each
 * change's label and its before and after lines, and the reason field, each stacked.
 */
export const actionApprovalRecipe = defineLayoutRecipe({
  name: 'action-approval',
  regions: {
    base: stack({ gap: token('space.xs') }),
    changes: stack({ gap: token('space.xs') }),
    change: stack({ gap: token('space.xs') }),
    reason: stack({ gap: token('space.2xs') }),
  },
});
