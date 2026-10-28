import { defineLayoutRecipe, stack } from '@oddkin/components/layout';
import { token } from '@oddkin/tokens/refs';

/** Arrangement of the voice input (layout-recipes.md §14): the record button above its status. */
export const voiceInputRecipe = defineLayoutRecipe({
  name: 'voice-input',
  regions: { base: stack({ gap: token('space.xs') }) },
});
