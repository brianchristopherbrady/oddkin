import { defineLayoutRecipe, stack } from '@oddkin/components/layout';
import { token } from '@oddkin/tokens/refs';

/** Arrangement of the sources (layout-recipes.md §14): the items in a column, and each item's title, host, and excerpt in a tighter one. */
export const sourcesRecipe = defineLayoutRecipe({
  name: 'sources',
  regions: { list: stack({ gap: token('space.xs') }), item: stack({ gap: '0.125rem' }) },
});
