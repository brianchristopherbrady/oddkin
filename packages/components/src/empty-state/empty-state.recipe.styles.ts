// Generated from ./empty-state.recipe.ts by packages/components/test/recipes.test.ts (UPDATE_FIXTURES=1).
// Do not edit: change the recipe and regenerate.
import { unsafeCSS } from '@oddkin/core/styles';

export const emptyStateRecipeStyles = unsafeCSS(
  '@layer odd.layout.base, odd.layout.variant, odd.layout.condition;\n@layer odd.layout.base {\n  .empty {\n    display: flex;\n    flex-direction: column;\n    gap: var(--odd-space-sm);\n    min-inline-size: 0;\n    align-items: center;\n  }\n  .footer {\n    display: flex;\n    flex-direction: row;\n    align-items: stretch;\n    gap: var(--odd-space-xs);\n    flex-wrap: wrap;\n    min-inline-size: 0;\n    justify-content: center;\n  }\n}\n',
);
