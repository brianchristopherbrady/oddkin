// Generated from ./checkbox-group.recipe.ts by packages/components/test/recipes.test.ts (UPDATE_FIXTURES=1).
// Do not edit: change the recipe and regenerate.
import { unsafeCSS } from '@oddkin/core/styles';

export const checkboxGroupRecipeStyles = unsafeCSS(
  '@layer odd.layout.base, odd.layout.variant, odd.layout.condition;\n@layer odd.layout.base {\n  .options {\n    display: flex;\n    flex-direction: column;\n    gap: var(--odd-space-lg);\n    min-inline-size: 0;\n    align-items: start;\n  }\n}\n@layer odd.layout.variant {\n  :host(:where([orientation="horizontal"])) .options {\n    flex-direction: row;\n    flex-wrap: wrap;\n  }\n}\n',
);
