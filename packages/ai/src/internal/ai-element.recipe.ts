import { defineLayoutRecipe, row } from '@oddkin/components/layout';
import { token } from '@oddkin/tokens/refs';

/** Arrangement every `@oddkin/ai` element shares (layout-recipes.md §14): its action row, centred and wrapping. */
export const aiElementRecipe = defineLayoutRecipe({
  name: 'ai-element',
  regions: { actions: row({ gap: token('space.xs'), wrap: true }) },
});
