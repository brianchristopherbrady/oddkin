import { defineLayoutRecipe, row, stack } from '@oddkin/components/layout';
import { token } from '@oddkin/tokens/refs';

/**
 * Arrangement of the inline assistant (layout-recipes.md §14): toolbar, status, and result
 * stacked; the toolbar's actions and the language choice in rows that wrap.
 */
export const inlineAssistRecipe = defineLayoutRecipe({
  name: 'inline-assist',
  regions: {
    base: stack({ gap: token('space.xs') }),
    toolbar: row({ gap: token('space.2xs'), align: 'stretch', wrap: true }),
    language: row({ gap: token('space.xs'), wrap: true }),
  },
});
