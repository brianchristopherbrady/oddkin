// Generated from ./side-nav.recipe.ts by packages/components/test/recipes.test.ts (UPDATE_FIXTURES=1).
// Do not edit: change the recipe and regenerate.
import { unsafeCSS } from '@oddkin/core/styles';

export const sideNavRecipeStyles = unsafeCSS(
  '@layer odd.layout.base, odd.layout.variant, odd.layout.condition;\n@layer odd.layout.base {\n  :host {\n    display: block;\n    container-type: inline-size;\n    container-name: side-nav;\n  }\n  .root {\n    display: flex;\n    flex-direction: column;\n    gap: var(--odd-navigation-item-gap);\n    min-inline-size: 0;\n  }\n  .header {\n    display: flex;\n    flex-direction: row;\n    align-items: center;\n    gap: var(--odd-layout-gap);\n    flex-wrap: wrap;\n    min-inline-size: 0;\n    justify-content: space-between;\n  }\n  .content {\n    display: flex;\n    flex-direction: column;\n    gap: var(--odd-navigation-item-gap);\n    min-inline-size: 0;\n  }\n  .footer {\n    display: flex;\n    flex-direction: row;\n    align-items: center;\n    gap: var(--odd-layout-gap);\n    flex-wrap: wrap;\n    min-inline-size: 0;\n  }\n}\n@layer odd.layout.condition {\n  @container side-nav (min-inline-size: 40rem) {\n    .content {\n      display: grid;\n      grid-template-columns: repeat(3, minmax(0, 1fr));\n    }\n  }\n}\n',
);
