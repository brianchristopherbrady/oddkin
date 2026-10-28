import { token } from '@oddkin/tokens/refs';
import { defineLayoutRecipe, row, stack } from '../layout/index.js';

/** Arrangement of the calendar (layout-recipes.md §14): the month heading, grid, and actions in a column, and the header and action rows. */
export const calendarRecipe = defineLayoutRecipe({
  name: 'calendar',
  regions: {
    calendar: stack({ gap: token('space.sm') }),
    header: row({ gap: token('space.xs') }),
    actions: row({ gap: token('space.xs'), justify: 'space-between' }),
  },
});
