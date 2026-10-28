import { token } from '@oddkin/tokens/refs';
import { defineLayoutRecipe, row, stack } from '../layout/index.js';

/** Arrangement of the file input (layout-recipes.md §14): the drop surface in a column, its header and each file in rows, the file list, and each file's name over its size. */
export const fileInputRecipe = defineLayoutRecipe({
  name: 'file-input',
  regions: {
    surface: stack({ gap: token('space.xs'), align: 'start' }),
    header: row({ gap: token('space.md') }),
    file: row({ gap: token('space.md') }),
    files: stack({ gap: token('space.sm') }),
    'file-text': stack({ gap: token('space.none') }),
  },
});
