/**
 * `@mote/core/layout` — unbranded layout recipes and helpers. DOM-free: recipes produce
 * CSS text and a shared stylesheet object. Contract: docs/architecture/layout-recipes.md.
 */
import { createLayoutHelpers } from './helpers.js';

export { createLayoutHelpers, NEUTRAL_DEFAULTS, isLayoutHelper } from './helpers.js';
export type {
  AutoGridOptions,
  Declarations,
  GridOptions,
  LayoutDefaults,
  LayoutHelper,
  LayoutHelpers,
  RowOptions,
  SplitOptions,
  StackOptions,
} from './helpers.js';
export { defineLayoutRecipe } from './recipe.js';
export type {
  ConditionEntry,
  ConditionInput,
  LayoutRecipe,
  RecipeContainer,
  RecipeDefinition,
  RegionDefinition,
  RegionMap,
} from './recipe.js';

/** Helpers with neutral defaults (`gap: 1rem`, `itemMin: 16rem`, `sideWidth: 16rem`, `mainMin: 50%`). */
export const { stack, row, grid, autoGrid, split, css: declarations } = createLayoutHelpers();
