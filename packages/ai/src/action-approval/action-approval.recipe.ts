import { defineLayoutRecipe, stack } from '@oddkin/components/layout';
import { token } from '@oddkin/tokens/refs';

/**
 * Arrangement of the approval (layout-recipes.md §14): the card's parts, the proposed changes, each
 * change's label and its before and after lines, and the scope choice and each of its options (a
 * control-indicator `.choice` row from the components' styles above its description), each
 * stacked. The reason is a textarea in an `odd-disclosure`, which arranges its content itself.
 */
export const actionApprovalRecipe = defineLayoutRecipe({
  name: 'action-approval',
  regions: {
    base: stack({ gap: token('space.xs') }),
    changes: stack({ gap: token('space.xs') }),
    change: stack({ gap: token('space.xs') }),
    'scope-choice': stack({ gap: token('space.xs') }),
    'scope-option': stack({ gap: token('space.2xs') }),
  },
});
