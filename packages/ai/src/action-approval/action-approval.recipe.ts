import { defineLayoutRecipe, row, stack } from '@oddkin/components/layout';
import { token } from '@oddkin/tokens/refs';

/**
 * Arrangement of the approval (layout-recipes.md §14): the card's parts, its risk and expiry in a
 * wrapping row, the proposed changes, each change's label over its Before and After blocks (the
 * shared diff view's), and the scope choice and each of its options (a control-indicator `.choice`
 * row from the components' styles above its description), each stacked. The reason is a textarea
 * in an `odd-disclosure`, which arranges its content itself.
 */
export const actionApprovalRecipe = defineLayoutRecipe({
  name: 'action-approval',
  regions: {
    base: stack({ gap: token('space.xs') }),
    meta: row({ gap: token('space.xs'), wrap: true }),
    changes: stack({ gap: token('space.xs') }),
    change: stack({ gap: token('space.xs') }),
    sides: stack({ gap: token('space.xs') }),
    side: stack({ gap: token('space.xs') }),
    'scope-choice': stack({ gap: token('space.xs') }),
    'scope-option': stack({ gap: token('space.2xs') }),
  },
});
