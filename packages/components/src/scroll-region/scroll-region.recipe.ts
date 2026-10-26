import { token } from '@oddkin/tokens/refs';
import { defineLayoutRecipe, stack } from '../layout/index.js';

/**
 * Arrangement of the scroll region's content (layout-recipes.md §14): the children in a column,
 * `--odd-scroll-region-gap` apart (Figma `Oddkin/Layout/ScrollRegion`: `layout.gap`).
 */
export const scrollRegionRecipe = defineLayoutRecipe({
  name: 'scroll-region',
  regions: {
    content: stack({ gap: `var(--odd-scroll-region-gap, ${token('layout.gap')})` }),
  },
});
