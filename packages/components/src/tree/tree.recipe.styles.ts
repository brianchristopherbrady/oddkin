// Generated from ./tree.recipe.ts by packages/components/test/recipes.test.ts (UPDATE_FIXTURES=1).
// Do not edit: change the recipe and regenerate.
import { unsafeCSS } from '@oddkin/core/styles';

export const treeRecipeStyles = unsafeCSS(
  '@layer odd.layout.base, odd.layout.variant, odd.layout.condition;\n@layer odd.layout.base {\n  .root {\n    display: flex;\n    flex-direction: column;\n    gap: var(--odd-space-sm);\n    min-inline-size: 0;\n  }\n  .tree {\n    display: flex;\n    flex-direction: column;\n    gap: var(--odd-navigation-item-gap);\n    min-inline-size: 0;\n  }\n  .state {\n    display: flex;\n    flex-direction: row;\n    align-items: center;\n    gap: var(--odd-space-sm);\n    flex-wrap: nowrap;\n    min-inline-size: 0;\n  }\n}\n',
);
