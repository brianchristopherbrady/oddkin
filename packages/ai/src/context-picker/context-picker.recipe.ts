import { defineLayoutRecipe, row, stack } from '@oddkin/components/layout';
import { token } from '@oddkin/tokens/refs';

/**
 * Arrangement of the context picker (layout-recipes.md §14), as Figma's C07 surface has it (page
 * 767:2): the content's stacked header, search, scope, status, collection, and footer, `space.xs`
 * apart; the title beside Close; the scope beside Selected; the collection's browse buttons,
 * results, and feedback, and the results themselves, `space.3xs` apart; each result's indicator,
 * icon, and text in a row; the feedback's lines; and the footer's count, actions, and buttons.
 */
export const contextPickerRecipe = defineLayoutRecipe({
  name: 'context-picker',
  regions: {
    content: stack({ gap: token('space.xs') }),
    header: row({ justify: 'space-between', gap: token('space.xs') }),
    'scope-row': row({ gap: token('space.3xs'), wrap: true }),
    collection: stack({ gap: token('space.3xs') }),
    browse: stack({ gap: token('space.3xs') }),
    containers: stack({ gap: token('space.3xs') }),
    results: stack({ gap: token('space.3xs') }),
    feedback: stack({ gap: token('space.xs'), align: 'start' }),
    footer: row({ gap: token('space.xs'), wrap: true }),
  },
});
