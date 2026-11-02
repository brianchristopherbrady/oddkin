/**
 * Theme files that build on a base file (`extends`): the merge, and which file set a value.
 * Pure and DOM-free, so Theme Studio merges in the browser as the CLI does in Node. Contract:
 * theming-and-styling.md §1.1.
 */

/** How a value merges: replaced whole, merged key by key (`each` for every key), or by named key. */
type MergeRule =
  'replace' | { readonly each: MergeRule } | { readonly keys: Readonly<Record<string, MergeRule>> };

const MAP: MergeRule = { each: 'replace' };

/**
 * Maps of named entries merge by name; their values, `spacing`, `modes`, and every other value
 * are replaced whole. Products and profiles merge one level deeper.
 */
const THEME: MergeRule = {
  keys: {
    brand: MAP,
    status: MAP,
    overrides: MAP,
    density: MAP,
    conditions: MAP,
    profiles: { each: MAP },
    products: { each: { keys: { brand: MAP, overrides: MAP } } },
  },
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const childRule = (rule: MergeRule, key: string): MergeRule =>
  rule === 'replace' ? 'replace' : 'each' in rule ? rule.each : (rule.keys[key] ?? 'replace');

function merge(base: unknown, layer: unknown, rule: MergeRule): unknown {
  if (rule === 'replace' || !isRecord(layer)) return layer;
  // Entries are collected in a Map and defined with fromEntries, so a "__proto__" key stays data.
  const out = new Map(Object.entries(isRecord(base) ? base : {}));
  for (const [key, value] of Object.entries(layer)) {
    // In a map of named entries, null removes the base's entry; elsewhere it is a value.
    if (value === null && 'each' in rule) out.delete(key);
    else out.set(key, merge(out.get(key), value, childRule(rule, key)));
  }
  return Object.fromEntries(out);
}

/**
 * The theme `layer` on top of `base` (theming-and-styling.md §1.1). Objects of named entries merge
 * by key: `brand`, `status`, `overrides`, `products` (and each product's `brand` and
 * `overrides`), `density`, `conditions`, and `profiles` (and each profile's roles); `null` there
 * removes the base's entry. Everything else, `spacing` and `modes` included, is replaced whole,
 * as is each entry's value. `$schema` comes from `layer`; `layer`'s `extends` is consumed, and
 * `base`'s is kept, so a base that still extends another is reported by the generator until it is
 * merged too. Neither input is changed.
 */
export function mergeThemes(base: object, layer: object): Record<string, unknown> {
  const { $schema: _schema, ...inherited } = base as Record<string, unknown>;
  const { extends: _extends, ...own } = layer as Record<string, unknown>;
  return merge(inherited, own, THEME) as Record<string, unknown>;
}

/** One file of a theme and the model it holds, before merging. */
export interface ThemeLayer {
  /** Where the model came from: a file path, or any label a tool gives it. */
  readonly file: string;
  readonly config: unknown;
}

function has(value: unknown, segments: readonly string[]): boolean {
  let current = value;
  for (const segment of segments) {
    if (!isRecord(current) || !Object.hasOwn(current, segment)) return false;
    current = current[segment];
  }
  return true;
}

/**
 * The layer that set the value at `path`, a JSON pointer into the merged model such as a
 * diagnostic's path, given the layers from the root base to the file (`loadConfig`'s `layers`).
 * A value replaced whole belongs to the last layer that sets it; a merged entry, to the last layer
 * that sets that entry. Undefined for a path no layer sets (a generated token's `/tokens/…`).
 */
export function layerOf<L extends ThemeLayer>(layers: readonly L[], path: string): L | undefined {
  const segments = path
    .split('/')
    .slice(1)
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
  let rule = THEME;
  for (let depth = 1; depth <= segments.length; depth++) {
    rule = childRule(rule, segments[depth - 1] as string);
    if (rule !== 'replace' && depth < segments.length) continue;
    const prefix = segments.slice(0, depth);
    for (let i = layers.length - 1; i >= 0; i--)
      if (has((layers[i] as L).config, prefix)) return layers[i];
    return undefined;
  }
  return undefined;
}
