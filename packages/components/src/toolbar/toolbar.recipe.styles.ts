// Generated from ./toolbar.recipe.ts by packages/components/test/recipes.test.ts (UPDATE_FIXTURES=1).
// Do not edit: change the recipe and regenerate.
import { unsafeCSS } from '@oddkin/core/styles';

export const toolbarRecipeStyles = unsafeCSS(
  '@layer odd.layout.base, odd.layout.variant, odd.layout.condition;\n@layer odd.layout.base {\n  .toolbar {\n    display: flex;\n    flex-direction: row;\n    align-items: center;\n    gap: var(--odd-space-sm);\n    flex-wrap: wrap;\n    min-inline-size: 0;\n  }\n}\n@layer odd.layout.variant {\n  :host(:where([orientation="vertical"])) .toolbar {\n    flex-direction: column;\n    align-items: stretch;\n    flex-wrap: nowrap;\n  }\n}\n',
);
