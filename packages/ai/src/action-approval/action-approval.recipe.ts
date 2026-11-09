import { defineLayoutRecipe, stack } from '@oddkin/components/layout';
import { token } from '@oddkin/tokens/refs';

/**
 * Arrangement of the approval (layout-recipes.md §14): the card's parts, the proposed changes, each
 * change's label and its before and after lines, the scopes to choose from, and the reason field,
 * each stacked. Each scope is a control-indicator `.choice` row from the components' styles.
 */
export const actionApprovalRecipe = defineLayoutRecipe({
  name: 'action-approval',
  regions: {
    base: stack({ gap: token('space.xs') }),
    changes: stack({ gap: token('space.xs') }),
    change: stack({ gap: token('space.xs') }),
    scopes: stack({ gap: token('space.2xs') }),
    reason: stack({ gap: token('space.2xs') }),
  },
});
