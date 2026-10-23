import { compose } from '@oddkin/core/element';
import { focusRingStyles } from '../styles/focus-ring.styles.js';
import { hostStyles } from '../styles/host.styles.js';
import { navRowStructuralStyles } from '../styles/nav-row.structural.styles.js';
import { navRowStyles } from '../styles/nav-row.styles.js';
import { OddkinSideNav } from './side-nav.js';
// The recipe's CSS, extracted at build time: registering the element never loads the recipe
// engine. `side-nav.recipe.ts` stays the source (recipes.test.ts keeps them identical).
import { sideNavRecipeStyles } from './side-nav.recipe.styles.js';
import { sideNavStructuralStyles } from './side-nav.structural.styles.js';
import { sideNavStyles } from './side-nav.styles.js';
import { sideNavTemplate } from './side-nav.template.js';

export const sideNavDefinition = compose({
  name: 'odd-side-nav',
  element: OddkinSideNav,
  template: sideNavTemplate,
  styles: [
    hostStyles,
    sideNavRecipeStyles,
    navRowStructuralStyles,
    sideNavStructuralStyles,
    focusRingStyles,
    navRowStyles,
    sideNavStyles,
  ],
});
