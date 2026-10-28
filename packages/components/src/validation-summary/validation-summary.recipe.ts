import { token } from '@oddkin/tokens/refs';
import { defineLayoutRecipe, row, stack } from '../layout/index.js';

/** Arrangement of the validation summary (layout-recipes.md §14): the summary and its list in columns, and the heading row with its marker. */
export const validationSummaryRecipe = defineLayoutRecipe({
  name: 'validation-summary',
  regions: {
    summary: stack({ gap: token('space.sm') }),
    header: row({ gap: token('space.xs'), align: 'start' }),
    list: stack({ gap: token('space.sm') }),
  },
});
