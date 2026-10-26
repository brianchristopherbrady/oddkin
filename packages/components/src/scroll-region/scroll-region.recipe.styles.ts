// Generated from ./scroll-region.recipe.ts by packages/components/test/recipes.test.ts (UPDATE_FIXTURES=1).
// Do not edit: change the recipe and regenerate.
import { unsafeCSS } from '@oddkin/core/styles';

export const scrollRegionRecipeStyles = unsafeCSS(
  '@layer odd.layout.base, odd.layout.variant, odd.layout.condition;\n@layer odd.layout.base {\n  .content {\n    display: flex;\n    flex-direction: column;\n    gap: var(--odd-scroll-region-gap, var(--odd-layout-gap));\n    min-inline-size: 0;\n  }\n}\n',
);
