/**
 * `@oddkin/core/layout/inspect` — recipe metadata for tooling, and a region check for
 * development. `describeRecipe` is DOM-free; `checkRecipeRegions` reads a rendered root.
 */
import { recipeModel, regionSelector, type LayoutRecipe } from './recipe.js';

export interface RecipeDescription {
  readonly name: string;
  readonly layers: readonly string[];
  readonly scope: string | undefined;
  readonly container:
    { readonly selector: string; readonly name?: string; readonly type: string } | undefined;
  readonly regions: ReadonlyArray<{
    readonly name: string;
    readonly selector: string;
    readonly helpers: readonly string[];
    readonly declarations: Readonly<Record<string, string>>;
    readonly part: boolean;
  }>;
  readonly variants: ReadonlyArray<{
    readonly attribute: string;
    readonly values: Readonly<Record<string, readonly string[]>>;
  }>;
  readonly conditions: ReadonlyArray<{
    readonly key: string;
    readonly kind: 'container' | 'media';
    readonly query: string;
    readonly regions: readonly string[];
    readonly profile?: string;
  }>;
  readonly profiles: readonly string[];
}

/** Regions, helpers, variants, conditions, profiles, parts, container, and layer order. */
export function describeRecipe(recipe: LayoutRecipe): RecipeDescription {
  const model = recipeModel(recipe);
  const host = model.scope ? `.${model.scope}` : ':host';
  return {
    name: model.name,
    layers: ['base', 'variant', 'condition'].map((l) => `${model.layer}.${l}`),
    scope: model.scope,
    container: model.container
      ? {
          selector: model.container.region
            ? regionSelector(model, model.container.region)
            : (model.container.selector ?? host),
          ...(model.container.name ? { name: model.container.name } : {}),
          type: model.container.type,
        }
      : undefined,
    regions: model.regionOrder.map((name) => ({
      name,
      selector: regionSelector(model, name),
      helpers: model.helpers.get(name) ?? [],
      declarations: Object.fromEntries(model.regions.get(name) ?? []),
      part: model.parts.includes(name),
    })),
    variants: [...model.variants].map(([attribute, values]) => ({
      attribute,
      values: Object.fromEntries(
        [...values].map(([value, regions]) => [value, [...regions.keys()]]),
      ),
    })),
    conditions: model.conditions.map((c) => ({
      key: c.key,
      kind: c.kind,
      query: c.query,
      regions: [...c.regions.keys()],
      ...(c.profile ? { profile: c.profile } : {}),
    })),
    profiles: [...model.profiles.keys()],
  };
}

export interface RegionCheck {
  readonly missingRegions: readonly string[];
  readonly missingParts: readonly string[];
}

/**
 * Development check after render: declared regions missing from `root`, and declared
 * public parts without a matching `part` attribute.
 */
export function checkRecipeRegions(recipe: LayoutRecipe, root: ParentNode): RegionCheck {
  const model = recipeModel(recipe);
  const missingRegions = model.regionOrder.filter(
    (region) => !root.querySelector(regionSelector(model, region)),
  );
  const missingParts = model.parts.filter((part) => {
    const element = root.querySelector(regionSelector(model, part));
    return !element || !(element.getAttribute('part') ?? '').split(/\s+/).includes(part);
  });
  return { missingRegions, missingParts };
}
