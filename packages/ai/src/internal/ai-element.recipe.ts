import { defineLayoutRecipe, row, stack } from '@oddkin/components/layout';
import { token } from '@oddkin/tokens/refs';

/**
 * Arrangement every `@oddkin/ai` element shares (layout-recipes.md §14): its action row, centred and
 * wrapping, and the decision row's stack of its error, actions, and pending or reason line, space.sm
 * apart (Figma page 08, `Oddkin/AI/Internal/DecisionRow`).
 */
export const aiElementRecipe = defineLayoutRecipe({
  name: 'ai-element',
  regions: {
    actions: row({ gap: token('space.xs'), wrap: true }),
    decision: stack({ gap: token('space.sm') }),
  },
});
