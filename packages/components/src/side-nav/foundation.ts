// Skin-free foundation: behavior, anatomy, the extracted layout recipe styles, and structural
// styles (shared host defaults first). Loads no default visual styles, no recipe engine, and
// registers nothing (multi-product.md §4). Import `sideNavRecipe` from `@oddkin/components/side-nav`
// to `extend()` the arrangement.
export { hostStyles } from '../styles/host.styles.js';
export { navRowStructuralStyles } from '../styles/nav-row.structural.styles.js';
export { OddkinSideNav } from './side-nav.js';
export { sideNavTemplate } from './side-nav.template.js';
export { sideNavRecipeStyles } from './side-nav.recipe.styles.js';
export { sideNavStructuralStyles } from './side-nav.structural.styles.js';
