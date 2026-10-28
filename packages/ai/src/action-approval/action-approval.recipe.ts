import { defineLayoutRecipe, row, stack } from '@oddkin/components/layout';
import { token } from '@oddkin/tokens/refs';

/**
 * Arrangement of the approval (layout-recipes.md §14): the card's parts and the proposed changes
 * stacked, each change's label and values in a row that wraps, and the reason field stacked.
 */
export const actionApprovalRecipe = defineLayoutRecipe({
  name: 'action-approval',
  regions: {
    base: stack({ gap: token('space.xs') }),
    changes: stack({ gap: token('space.2xs') }),
    change: row({ gap: token('space.xs'), align: 'stretch', wrap: true }),
    reason: stack({ gap: token('space.2xs') }),
  },
});
