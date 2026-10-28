import { defineLayoutRecipe, row, stack } from '@oddkin/components/layout';
import { token } from '@oddkin/tokens/refs';

/**
 * Arrangement of the tool call (layout-recipes.md §14): the summary and the failure line in
 * centred rows that wrap, the body's input and output stacked. The host stacks the call and its
 * approval itself: a region is a class, and the host has none.
 */
export const toolCallRecipe = defineLayoutRecipe({
  name: 'tool-call',
  regions: {
    summary: row({ gap: token('space.xs'), wrap: true }),
    body: stack({ gap: token('space.xs') }),
    failure: row({ gap: token('space.xs'), wrap: true }),
  },
});
