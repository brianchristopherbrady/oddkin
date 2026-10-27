import { token } from '@oddkin/tokens/refs';
import { defineLayoutRecipe, row } from '../layout/index.js';

/** Arrangement of the alert (layout-recipes.md §14): the marker, the message, and the end content in a row that wraps, aligned to the top; the end content is a wrapping row of its own. */
export const alertRecipe = defineLayoutRecipe({
  name: 'alert',
  regions: {
    alert: row({ gap: token('space.sm'), align: 'start', wrap: true }),
    end: row({ gap: token('space.xs'), wrap: true }),
  },
});
