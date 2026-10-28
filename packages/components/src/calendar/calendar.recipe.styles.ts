// Generated from ./calendar.recipe.ts by packages/components/test/recipes.test.ts (UPDATE_FIXTURES=1).
// Do not edit: change the recipe and regenerate.
import { unsafeCSS } from '@oddkin/core/styles';

export const calendarRecipeStyles = unsafeCSS(
  '@layer odd.layout.base, odd.layout.variant, odd.layout.condition;\n@layer odd.layout.base {\n  .calendar {\n    display: flex;\n    flex-direction: column;\n    gap: var(--odd-space-sm);\n    min-inline-size: 0;\n  }\n  .header {\n    display: flex;\n    flex-direction: row;\n    align-items: center;\n    gap: var(--odd-space-xs);\n    flex-wrap: nowrap;\n    min-inline-size: 0;\n  }\n  .actions {\n    display: flex;\n    flex-direction: row;\n    align-items: center;\n    gap: var(--odd-space-xs);\n    flex-wrap: nowrap;\n    min-inline-size: 0;\n    justify-content: space-between;\n  }\n}\n',
);
