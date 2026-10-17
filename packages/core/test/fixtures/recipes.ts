import { autoGrid, defineLayoutRecipe, grid, row, split, stack } from '../../src/layout/index.js';

/** The side-navigation recipe from layout-recipes.md §2, with neutral (unbranded) defaults. */
export const sideNav = defineLayoutRecipe({
  name: 'side-nav',
  container: { name: 'side-nav' },
  regions: {
    root: stack(),
    header: row({ justify: 'space-between' }),
    content: grid({ columns: 1 }),
    footer: row({ justify: 'space-between', wrap: true }),
  },
  variants: {
    align: {
      start: { footer: row({ justify: 'start', wrap: true }) },
      end: { footer: row({ justify: 'end', wrap: true }) },
    },
  },
  conditions: {
    'navigation.expanded': { kind: 'container', query: 'side-nav (min-inline-size: 40rem)' },
  },
  profiles: { comfortable: { '--demo-item-padding': '1rem' } },
  when: { 'navigation.expanded': { content: grid({ columns: 3 }), profile: 'comfortable' } },
  parts: ['content'],
});

/** A page-level split + auto grid recipe rendered into light DOM. */
export const page = defineLayoutRecipe({
  name: 'page',
  scope: 'page',
  regions: {
    root: split({ side: 'aside', main: 'main' }),
    aside: stack(),
    main: autoGrid({ min: '12rem' }),
  },
});

export const recipes = { 'side-nav': sideNav, page };
