import { defineLayoutRecipe, row, stack } from '@oddkin/components/layout';
import { token } from '@oddkin/tokens/refs';

/**
 * Arrangement of the prompt input (layout-recipes.md §14): the toolbar and each attachment in
 * centred rows that wrap, the attachments in a row that wraps, and the issues stacked. The form
 * itself is component geometry: the text area and the toolbar share its bordered box.
 */
export const promptInputRecipe = defineLayoutRecipe({
  name: 'prompt-input',
  regions: {
    toolbar: row({ gap: token('space.xs'), wrap: true }),
    attachments: row({ gap: token('space.xs'), align: 'stretch', wrap: true }),
    issues: stack({ gap: token('space.xs') }),
    attachment: row({ gap: token('space.2xs'), wrap: true }),
  },
});
