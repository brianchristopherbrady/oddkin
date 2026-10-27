import { token } from '@oddkin/tokens/refs';
import { defineLayoutRecipe, row, stack } from '../layout/index.js';

/** Arrangement of the chosen values of `odd-combobox multiple` (layout-recipes.md §14): the chips in a row that wraps around the input. */
export const comboboxRecipe = defineLayoutRecipe({
  name: 'combobox',
  regions: {
    chips: row({ gap: token('control.gap'), wrap: true }),
    count: row({ gap: token('space.xs') }),
    avatars: row({ gap: '0' }),
    'review-bar': row({ gap: '0', justify: 'end' }),
    // The review below the field and the popup's selection panel: a column of parts.
    panel: stack({ gap: token('space.xs') }),
    // The panel's summary, its disclosure, and each chosen row: text at the start, an action at the end.
    spread: row({ gap: token('space.xs'), justify: 'space-between' }),
  },
});
