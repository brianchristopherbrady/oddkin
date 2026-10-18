import { token } from '@oddkin/tokens/refs';
import { defineLayoutRecipe, grid, row, stack } from '../layout/index.js';

/**
 * Arrangement of the side navigation. Narrow (the usual sidebar): one column. At 40rem of its
 * own width (a drawer on a wide screen, a site map): top-level entries in three columns. The
 * host is the size container, so this responds to the element, not the viewport.
 */
export const sideNavRecipe = defineLayoutRecipe({
  name: 'side-nav',
  container: { name: 'side-nav' },
  regions: {
    root: stack({ gap: token('navigation.item.gap') }),
    header: row({ justify: 'space-between', wrap: true }),
    content: stack({ gap: token('navigation.item.gap') }),
    footer: row({ wrap: true }),
  },
  when: {
    '@container side-nav (min-inline-size: 40rem)': {
      content: grid({ columns: 3, gap: token('navigation.item.gap') }),
    },
  },
});
