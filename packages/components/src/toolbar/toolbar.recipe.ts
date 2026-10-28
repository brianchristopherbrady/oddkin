import { token } from '@oddkin/tokens/refs';
import { declarations, defineLayoutRecipe, row, stack } from '../layout/index.js';

/** Arrangement of the toolbar (layout-recipes.md §14): the controls in a row that wraps, or with `orientation="vertical"` in a column that does not. */
export const toolbarRecipe = defineLayoutRecipe({
  name: 'toolbar',
  regions: {
    toolbar: row({ gap: token('space.sm'), wrap: true }),
  },
  variants: {
    orientation: {
      vertical: {
        toolbar: [
          stack({ gap: token('space.sm'), align: 'stretch' }),
          declarations({ 'flex-wrap': 'nowrap' }),
        ],
      },
    },
  },
});
