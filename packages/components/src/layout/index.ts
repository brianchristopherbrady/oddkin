/**
 * `@oddkin/components/layout` — layout helpers and recipes bound to Oddkin's layout roles and
 * named conditions. DOM-free: recipes produce CSS text and shared stylesheets. The page-author
 * classes built from the same helpers ship as `@oddkin/components/css/layout.css`.
 * Contract: docs/architecture/layout-recipes.md §3, §6, §7.
 */
import {
  createLayoutHelpers,
  defineLayoutRecipe as defineRecipe,
  type LayoutRecipe,
  type RecipeDefinition,
} from '@oddkin/core/layout';
import { unsafeCSS, type CSSResult } from '@oddkin/core/styles';
import { conditions, type ConditionName } from '@oddkin/tokens/conditions';
import { token } from '@oddkin/tokens/refs';

export type {
  AutoGridOptions,
  GridOptions,
  LayoutHelper,
  LayoutRecipe,
  RecipeDefinition,
  RowOptions,
  SplitOptions,
  StackOptions,
} from '@oddkin/core/layout';
export type { ConditionName } from '@oddkin/tokens/conditions';

/** Helper defaults: the theme's layout roles, so gaps and minimums follow themes and density. */
export const LAYOUT_DEFAULTS = Object.freeze({
  gap: token('layout.gap'),
  itemMin: token('layout.item-min'),
  sideWidth: token('layout.sidebar-width'),
  mainMin: token('layout.main-min'),
});

export const {
  stack,
  row,
  grid,
  autoGrid,
  split,
  css: declarations,
} = createLayoutHelpers(LAYOUT_DEFAULTS);

/**
 * The at-rule that opens a named condition's block, for component styles:
 * css`${condition('page.wide')} { .content { … } }`.
 */
export function condition(name: ConditionName): CSSResult {
  return unsafeCSS(conditions[name].atRule);
}

/**
 * `defineLayoutRecipe` from `@oddkin/core/layout` with Oddkin's named conditions available in
 * `when` (merged under any `conditions` you pass) and the `odd.layout` layer prefix.
 */
export function defineLayoutRecipe(definition: RecipeDefinition): LayoutRecipe {
  return defineRecipe({
    layer: 'odd.layout',
    ...definition,
    conditions: { ...conditions, ...definition.conditions },
  });
}
