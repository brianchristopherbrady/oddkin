/**
 * Layout recipes: named regions, variants, and responsive conditions compiled once into
 * ordinary layered CSS. DOM-free; evaluated at module scope; no ResizeObserver or
 * re-render is involved in responsiveness. Contract: docs/architecture/layout-recipes.md.
 */
import { DEV } from '../internal/dev.js';
import { MoteError, reportMoteError } from '../diagnostics/index.js';
import { isRendering } from '../internal/render-context.js';
import { unsafeCSS, type CSSResult } from '../styles/index.js';
import { cssValue, isLayoutHelper, type Declarations, type LayoutHelper } from './helpers.js';

export type RegionDefinition = LayoutHelper | readonly LayoutHelper[];
export type RegionMap = Readonly<Record<string, RegionDefinition>>;

/** Regions to change under a condition, plus an optional profile applied to the root region. */
export type ConditionEntry = { readonly profile?: string } & {
  readonly [region: string]: RegionDefinition | string | undefined;
};

/** A condition from a theme package (`{ kind, query }`) or an inline at-rule string (`'@container (min-width: 40rem)'`). */
export type ConditionInput =
  { readonly kind: 'container' | 'media'; readonly query: string } | string;

export interface RecipeContainer {
  /** A region that becomes the size container. Mutually exclusive with `selector`. */
  readonly region?: string;
  /** Selector of the container; defaults to `:host` (shadow) or `.{scope}` (light DOM). */
  readonly selector?: string;
  readonly name?: string;
  readonly type?: 'inline-size' | 'size';
}

export interface RecipeDefinition {
  /** Used in diagnostics and metadata. */
  readonly name?: string;
  readonly container?: RecipeContainer;
  readonly regions: RegionMap;
  /** `variants.align.end.footer` applies when the host has `align="end"`. */
  readonly variants?: Readonly<Record<string, Readonly<Record<string, RegionMap>>>>;
  /** Keys are condition names (from `conditions`) or inline at-rule strings. `profile` applies to the root region. */
  readonly when?: Readonly<Record<string, ConditionEntry>>;
  readonly conditions?: Readonly<Record<string, ConditionInput>>;
  /** Profile name → custom-property declarations re-declared on the root region inside a condition. */
  readonly profiles?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** Light DOM: region classes become `.{scope}__{region}` and variants match `.{scope}[attr]`. */
  readonly scope?: string;
  /** Regions exposed as public parts (the template writes `part="…"`). */
  readonly parts?: readonly string[];
  /** Cascade-layer prefix. Default `recipe`. */
  readonly layer?: string;
}

type Props = Map<string, string>;
type RegionProps = Map<string, Props>;

interface ConditionModel {
  readonly key: string;
  readonly kind: 'container' | 'media';
  readonly query: string;
  readonly regions: RegionProps;
  readonly profile: string | undefined;
}

/** @internal Normalized recipe used for CSS, `extend`, and inspection. */
export interface RecipeModel {
  readonly name: string;
  readonly scope: string | undefined;
  readonly layer: string;
  readonly container:
    (Required<Pick<RecipeContainer, 'type'>> & Omit<RecipeContainer, 'type'>) | undefined;
  readonly regionOrder: readonly string[];
  readonly helpers: ReadonlyMap<string, readonly string[]>;
  readonly regions: RegionProps;
  readonly variants: ReadonlyMap<string, ReadonlyMap<string, RegionProps>>;
  readonly conditions: readonly ConditionModel[];
  readonly profiles: ReadonlyMap<string, Props>;
  readonly parts: readonly string[];
}

export interface LayoutRecipe {
  readonly name: string;
  /** The only runtime artifact a component needs: `static styles = [recipe.styles]`. */
  readonly styles: CSSResult;
  /** Same text as `styles`, for extraction to `.css` files. */
  readonly cssText: string;
  /** A new recipe; regions merge per property (later wins). The original is never mutated. */
  extend(changes: Partial<RecipeDefinition>): LayoutRecipe;
}

const models = new WeakMap<LayoutRecipe, RecipeModel>();

/** @internal */
export function recipeModel(recipe: LayoutRecipe): RecipeModel {
  const model = models.get(recipe);
  if (!model)
    throw new MoteError(
      'recipe.unknown',
      DEV ? 'Not a layout recipe created by defineLayoutRecipe.' : '',
    );
  return model;
}

const IDENT = /^[a-z][a-z0-9-]*$/;
const RESERVED_REGIONS = new Set(['profile']);
const CONFLICTING = ['display', 'flex-direction'];

function fail(model: { name: string }, code: string, detail: string): never {
  throw new MoteError(code, DEV ? `Recipe "${model.name}": ${detail}` : '');
}

function regionProps(
  owner: { name: string },
  where: string,
  map: RegionMap,
  known: ReadonlySet<string> | undefined,
  helpersOut?: Map<string, string[]>,
): RegionProps {
  const out: RegionProps = new Map();
  const add = (region: string, declarations: Declarations, source: string) => {
    if (known && !known.has(region)) {
      fail(
        owner,
        'recipe.region.unknown',
        `${where} names region "${region}", which the recipe does not define (regions: ${[...known].join(', ')}).`,
      );
    }
    const props = out.get(region) ?? new Map<string, string>();
    for (const [property, value] of declarations) {
      const previous = props.get(property);
      if (
        CONFLICTING.includes(property) &&
        previous !== undefined &&
        previous !== value &&
        source === 'combined'
      ) {
        fail(
          owner,
          'recipe.helper.conflict',
          `${where}, region "${region}", layer ${where.split(' ')[0]}: helpers set conflicting ${property} (${previous} and ${value}).`,
        );
      }
      props.set(property, value);
    }
    out.set(region, props);
  };
  for (const [region, definition] of Object.entries(map)) {
    if (region === 'profile') continue;
    const helpers = Array.isArray(definition) ? definition : [definition];
    if (!helpers.every(isLayoutHelper))
      fail(
        owner,
        'recipe.region.invalid',
        `${where}, region "${region}": expected layout helpers (stack(), row(), grid(), …).`,
      );
    const fresh = !out.has(region);
    helpers.forEach((helper: LayoutHelper, i: number) => {
      add(region, helper.declarations, fresh && i > 0 ? 'combined' : 'single');
      for (const [other, declarations] of Object.entries(helper.regions ?? {}))
        add(other, declarations, 'single');
      if (helpersOut) helpersOut.set(region, [...(helpersOut.get(region) ?? []), helper.helper]);
    });
  }
  return out;
}

function mergeRegionProps(base: RegionProps, changes: RegionProps): RegionProps {
  const out: RegionProps = new Map([...base].map(([region, props]) => [region, new Map(props)]));
  for (const [region, props] of changes) {
    const target = out.get(region) ?? new Map<string, string>();
    for (const [property, value] of props) target.set(property, value);
    out.set(region, target);
  }
  return out;
}

function parseCondition(
  owner: { name: string },
  key: string,
  conditions: Readonly<Record<string, ConditionInput>>,
): { kind: 'container' | 'media'; query: string } {
  const input = conditions[key] ?? (key.startsWith('@') ? key : undefined);
  if (input === undefined) {
    fail(
      owner,
      'recipe.condition.unknown',
      `condition "${key}" is not in the supplied conditions (${Object.keys(conditions).join(', ') || 'none'}). Supply conditions: { … } or an inline '@container …' / '@media …' key.`,
    );
  }
  if (typeof input === 'string') {
    const match = /^@(container|media)\s+(.+)$/s.exec(input.trim());
    if (!match)
      fail(
        owner,
        'recipe.condition.invalid',
        `condition "${key}" must start with @container or @media.`,
      );
    return {
      kind: match[1] as 'container' | 'media',
      query: cssQuery(owner, key, match[2] as string),
    };
  }
  if ((input.kind !== 'container' && input.kind !== 'media') || typeof input.query !== 'string') {
    fail(
      owner,
      'recipe.condition.invalid',
      `condition "${key}" must be { kind: 'container' | 'media', query }.`,
    );
  }
  return { kind: input.kind, query: cssQuery(owner, key, input.query) };
}

function cssQuery(owner: { name: string }, key: string, query: string): string {
  if (/[;{}<>\\]|\/\*/.test(query) || query.trim() === '')
    fail(owner, 'recipe.condition.invalid', `condition "${key}" has an invalid query.`);
  return query.trim();
}

/** Container name a container query targets, or undefined for the nearest container. */
function queriedName(query: string): string | undefined {
  const match = /^([a-zA-Z_][\w-]*)\s*\(/.exec(query);
  return match && !['not', 'style', 'scroll-state'].includes(match[1] as string)
    ? match[1]
    : undefined;
}

function buildModel(definition: RecipeDefinition, base?: RecipeModel): RecipeModel {
  const name = definition.name ?? base?.name ?? 'recipe';
  const owner = { name };
  const scope = definition.scope ?? base?.scope;
  if (scope !== undefined && !IDENT.test(scope))
    fail(owner, 'recipe.scope.invalid', `scope "${scope}" must be a lowercase identifier.`);
  const layer = definition.layer ?? base?.layer ?? 'recipe';
  if (!/^[a-z][a-z0-9-]*$/.test(layer))
    fail(owner, 'recipe.layer.invalid', `layer prefix "${layer}" must be a lowercase identifier.`);

  const helpers = new Map<string, string[]>(
    base ? [...base.helpers].map(([k, v]) => [k, [...v]]) : [],
  );
  const regionOrder = [...(base?.regionOrder ?? [])];
  for (const region of Object.keys(definition.regions ?? {})) {
    if (!IDENT.test(region))
      fail(
        owner,
        'recipe.region.invalid',
        `region name "${region}" must be a lowercase identifier.`,
      );
    if (RESERVED_REGIONS.has(region))
      fail(owner, 'recipe.region.reserved', `"${region}" is reserved and cannot be a region name.`);
    if (!regionOrder.includes(region)) regionOrder.push(region);
  }
  const known = new Set(regionOrder);
  if (known.size === 0) fail(owner, 'recipe.region.missing', 'a recipe needs at least one region.');

  const regionChanges = regionProps(owner, 'base', definition.regions ?? {}, known, helpers);
  const regions = mergeRegionProps(base?.regions ?? new Map(), regionChanges);

  const variants = new Map<string, Map<string, RegionProps>>(
    base ? [...base.variants].map(([k, v]) => [k, new Map(v)]) : [],
  );
  for (const [attribute, values] of Object.entries(definition.variants ?? {})) {
    if (!IDENT.test(attribute))
      fail(
        owner,
        'recipe.variant.invalid',
        `variant attribute "${attribute}" must be a lowercase identifier.`,
      );
    const byValue = variants.get(attribute) ?? new Map<string, RegionProps>();
    for (const [value, map] of Object.entries(values)) {
      if (!/^[\w-]+$/.test(value))
        fail(
          owner,
          'recipe.variant.invalid',
          `variant value "${value}" for "${attribute}" must be a simple token.`,
        );
      byValue.set(
        value,
        mergeRegionProps(
          byValue.get(value) ?? new Map(),
          regionProps(owner, `variant ${attribute}="${value}"`, map, known),
        ),
      );
    }
    variants.set(attribute, byValue);
  }

  const conditionInputs = { ...(definition.conditions ?? {}) };
  const profiles = new Map<string, Props>(base ? [...base.profiles] : []);
  for (const [profile, declarations] of Object.entries(definition.profiles ?? {})) {
    profiles.set(
      profile,
      new Map(
        Object.entries(declarations).map(([property, value]) => {
          if (!/^--[\w-]+$/.test(property))
            fail(
              owner,
              'recipe.profile.invalid',
              `profile "${profile}" may only declare custom properties; "${property}" is not one.`,
            );
          return [property, cssValue(value, `recipe "${name}" profile "${profile}" ${property}`)];
        }),
      ),
    );
  }

  const conditions: ConditionModel[] = base ? [...base.conditions] : [];
  for (const [key, entry] of Object.entries(definition.when ?? {})) {
    const inherited = conditions.find((c) => c.key === key);
    const { kind, query } =
      inherited && conditionInputs[key] === undefined
        ? inherited
        : parseCondition(owner, key, conditionInputs);
    const profile = (entry as { profile?: unknown }).profile;
    if (profile !== undefined && (typeof profile !== 'string' || !profiles.has(profile))) {
      fail(
        owner,
        'recipe.profile.unknown',
        `condition "${key}" applies unknown profile ${JSON.stringify(profile)}; supply profiles: { … }.`,
      );
    }
    const index = conditions.findIndex((c) => c.key === key);
    const previous = index >= 0 ? conditions[index] : undefined;
    const merged: ConditionModel = {
      key,
      kind,
      query,
      regions: mergeRegionProps(
        previous?.regions ?? new Map(),
        regionProps(owner, `condition "${key}"`, entry as RegionMap, known),
      ),
      profile: (profile as string | undefined) ?? previous?.profile,
    };
    if (index >= 0) conditions[index] = merged;
    else conditions.push(merged);
  }

  const containerInput = definition.container ?? base?.container;
  let container: RecipeModel['container'];
  if (containerInput) {
    if (containerInput.region && containerInput.selector)
      fail(owner, 'recipe.container.invalid', 'container takes region or selector, not both.');
    if (containerInput.region && !known.has(containerInput.region))
      fail(
        owner,
        'recipe.region.unknown',
        `container region "${containerInput.region}" is not defined.`,
      );
    if (containerInput.name !== undefined && !/^[a-zA-Z_][\w-]*$/.test(containerInput.name))
      fail(
        owner,
        'recipe.container.invalid',
        `container name "${containerInput.name}" is not a CSS identifier.`,
      );
    container = { ...containerInput, type: containerInput.type ?? 'inline-size' };
  }
  for (const condition of conditions) {
    if (condition.kind !== 'container') continue;
    const target = queriedName(condition.query);
    if (!target && !container) {
      fail(
        owner,
        'recipe.container.missing',
        `condition "${condition.key}" queries the nearest container, but the recipe declares no container and the query names none.`,
      );
    }
    const selfRegion = container?.region;
    const matchesOwn = !target || target === container?.name;
    if (selfRegion && matchesOwn && condition.regions.has(selfRegion)) {
      fail(
        owner,
        'recipe.container.self',
        `condition "${condition.key}" styles region "${selfRegion}", which is the container it queries; a container query only styles descendants.`,
      );
    }
  }

  const parts = definition.parts ?? base?.parts ?? [];
  for (const part of parts)
    if (!known.has(part)) fail(owner, 'recipe.region.unknown', `part "${part}" is not a region.`);

  return {
    name,
    scope,
    layer,
    container,
    regionOrder,
    helpers,
    regions,
    variants,
    conditions,
    profiles,
    parts,
  };
}

export function regionSelector(model: Pick<RecipeModel, 'scope'>, region: string): string {
  return model.scope ? `.${model.scope}__${region}` : `.${region}`;
}

function rule(selector: string, props: Props | undefined, indent: string): string {
  if (!props || props.size === 0) return '';
  const body = [...props].map(([p, v]) => `${indent}  ${p}: ${v};`).join('\n');
  return `${indent}${selector} {\n${body}\n${indent}}\n`;
}

/** Declarations that differ from the base region; identical values add nothing to the cascade. */
function changedFrom(base: Props | undefined, props: Props | undefined): Props | undefined {
  if (!props || !base) return props;
  return new Map([...props].filter(([property, value]) => base.get(property) !== value));
}

function layerBlock(name: string, body: string): string {
  return body ? `@layer ${name} {\n${body}}\n` : '';
}

export function compileRecipe(model: RecipeModel): string {
  const { layer } = model;
  const host = model.scope ? `.${model.scope}` : ':host';
  const ordered = (regions: RegionProps) => [...model.regionOrder].filter((r) => regions.has(r));

  let base = '';
  if (model.container) {
    const selector = model.container.region
      ? regionSelector(model, model.container.region)
      : (model.container.selector ?? host);
    const props: Props = new Map();
    // A host size container must be block-level to be sized by its context.
    if (selector === ':host') props.set('display', 'block');
    props.set('container-type', model.container.type);
    if (model.container.name) props.set('container-name', model.container.name);
    base += rule(selector, props, '  ');
  }
  for (const region of ordered(model.regions))
    base += rule(regionSelector(model, region), model.regions.get(region), '  ');

  let variants = '';
  for (const [attribute, values] of model.variants) {
    for (const [value, regions] of values) {
      const context = model.scope
        ? `:where(.${model.scope}[${attribute}="${value}"])`
        : `:host(:where([${attribute}="${value}"]))`;
      for (const region of ordered(regions))
        variants += rule(
          `${context} ${regionSelector(model, region)}`,
          changedFrom(model.regions.get(region), regions.get(region)),
          '  ',
        );
    }
  }

  let conditions = '';
  for (const condition of model.conditions) {
    let body = '';
    for (const region of ordered(condition.regions))
      body += rule(
        regionSelector(model, region),
        changedFrom(model.regions.get(region), condition.regions.get(region)),
        '    ',
      );
    if (condition.profile)
      body += rule(
        regionSelector(model, model.regionOrder[0] as string),
        model.profiles.get(condition.profile),
        '    ',
      );
    if (body) conditions += `  @${condition.kind} ${condition.query} {\n${body}  }\n`;
  }

  return [
    `@layer ${layer}.base, ${layer}.variant, ${layer}.condition;\n`,
    layerBlock(`${layer}.base`, base),
    layerBlock(`${layer}.variant`, variants),
    layerBlock(`${layer}.condition`, conditions),
  ]
    .filter(Boolean)
    .join('');
}

function createRecipe(model: RecipeModel): LayoutRecipe {
  const cssText = compileRecipe(model);
  const recipe: LayoutRecipe = Object.freeze({
    name: model.name,
    styles: unsafeCSS(cssText),
    cssText,
    extend(changes: Partial<RecipeDefinition>): LayoutRecipe {
      return createRecipe(buildModel({ regions: {}, ...changes }, model));
    },
  });
  models.set(recipe, model);
  return recipe;
}

/**
 * Define a layout recipe at module scope. Produces ordinary CSS in cascade layers
 * (`base → variant → condition`); unlayered component CSS overrides it.
 */
export function defineLayoutRecipe(definition: RecipeDefinition): LayoutRecipe {
  if (DEV && isRendering()) {
    reportMoteError(
      new MoteError(
        'recipe.render.definition',
        DEV
          ? `Recipe "${definition.name ?? 'recipe'}" was defined during render. Define recipes once at module scope; recreating them repeats CSS generation and creates new stylesheets.`
          : '',
      ),
      { code: 'recipe.render.definition', origin: definition.name },
    );
  }
  return createRecipe(buildModel(definition));
}
