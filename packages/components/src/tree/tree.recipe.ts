import { token } from '@oddkin/tokens/refs';
import { defineLayoutRecipe, row, stack } from '../layout/index.js';

/**
 * Arrangement of the tree (layout-recipes.md §14): the surface's content and the rows in columns,
 * and the busy and empty rows with the glyph beside the text. odd-picker's tree content shares them
 * through the tree's structural sheet.
 */
export const treeRecipe = defineLayoutRecipe({
  name: 'tree',
  regions: {
    root: stack({ gap: token('space.sm') }),
    tree: stack({ gap: token('navigation.item.gap') }),
    state: row({ gap: token('space.sm') }),
  },
});
