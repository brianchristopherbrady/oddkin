import { token } from '@oddkin/tokens/refs';
import { defineLayoutRecipe, row, stack } from '../layout/index.js';

/**
 * Arrangement of the colour picker's popup (layout-recipes.md §14): its controls in a column; the
 * hex and opacity entries side by side, each a label over its input; the suggested colours under
 * their label, in a row that wraps; and the actions at the end of a row that wraps.
 */
export const colorPickerRecipe = defineLayoutRecipe({
  name: 'color-picker',
  regions: {
    controls: stack({ gap: token('space.md') }),
    entries: row({ gap: token('space.sm'), align: 'stretch' }),
    entry: stack({ gap: token('space.xs') }),
    swatches: stack({ gap: token('space.md') }),
    'swatch-row': row({ gap: token('space.sm'), wrap: true }),
    actions: row({ gap: token('space.xs'), justify: 'end', wrap: true }),
  },
});
