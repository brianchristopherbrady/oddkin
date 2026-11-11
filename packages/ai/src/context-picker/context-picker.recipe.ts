import { defineLayoutRecipe, row, stack } from '@oddkin/components/layout';
import { token } from '@oddkin/tokens/refs';

/**
 * Arrangement of the context picker (layout-recipes.md §14), as Figma's C07 surface has it (page
 * 767:2): the surface's stacked header, search, scope, status, results, and footer; the title
 * beside Close; the scope beside Selected; each result's indicator, icon, and text in a row; the
 * feedback's lines; and the footer's count, actions, and buttons.
 */
export const contextPickerRecipe = defineLayoutRecipe({
  name: 'context-picker',
  regions: {
    surface: stack({ gap: token('space.xs') }),
    header: row({ justify: 'space-between', gap: token('space.sm') }),
    'scope-row': row({ gap: token('space.xs'), wrap: true }),
    browse: stack({ gap: token('space.2xs') }),
    containers: stack({ gap: token('space.2xs') }),
    results: stack({ gap: token('space.none') }),
    feedback: stack({ gap: token('space.xs'), align: 'start' }),
    footer: row({ gap: token('space.xs'), wrap: true }),
  },
});
