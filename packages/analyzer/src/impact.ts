/**
 * Change impact (change-impact-and-verification.md §2). A comparison snapshot records, by stable
 * id, the hash of every public contract item, definition source, token, product, example, and
 * suite, plus the extracted and declared edges between them. Comparing two snapshots classifies
 * each change, follows edges back to the components, examples, and products that depend on it,
 * and selects the checks to run. Renames are matched only through authoritative records.
 *
 * Inputs are existing artifacts (CEM, `oddkin.metadata.json`, token inspection JSON, product
 * manifests, suite versions); module sources are hashed, never stored. This entry is plain Node:
 * it never loads TypeScript and never executes the analyzed code.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const SNAPSHOT_SCHEMA = 'https://oddkin.dev/schemas/comparison-snapshot/v1.json';
export const IMPACT_SCHEMA = 'https://oddkin.dev/schemas/impact-report/v1.json';

// ---- input shapes (only the fields read here) ----

interface Text {
  readonly text?: string;
}
interface Named {
  readonly name: string;
  readonly description?: string;
}
interface CemMember extends Named {
  readonly kind: string;
  readonly type?: Text;
  readonly default?: string;
  readonly attribute?: string;
  readonly reflects?: boolean;
  readonly readonly?: boolean;
  readonly static?: boolean;
  readonly privacy?: string;
}
interface CemDeclaration extends Named {
  readonly tagName?: string;
  readonly members?: readonly CemMember[];
  readonly attributes?: readonly (Named & { type?: Text; fieldName?: string; default?: string })[];
  readonly events?: readonly (Named & { type?: Text })[];
  readonly slots?: readonly Named[];
  readonly cssParts?: readonly Named[];
  readonly cssProperties?: readonly (Named & { default?: string; syntax?: string })[];
  readonly cssStates?: readonly Named[];
}
export interface CemManifest {
  readonly modules: readonly {
    readonly path?: string;
    readonly declarations?: readonly CemDeclaration[];
  }[];
}
interface SourceRef {
  readonly package?: string;
  readonly module: string;
  readonly name: string;
}
export interface MetadataInput {
  readonly components?: Readonly<
    Record<
      string,
      {
        readonly tag: string;
        readonly registration?: string;
        readonly definition?: {
          readonly extends?: string;
          readonly template?: SourceRef;
          readonly styles?: readonly SourceRef[];
          readonly dependencies?: Readonly<Record<string, string>>;
        };
      }
    >
  >;
  readonly templates?: Readonly<Record<string, unknown>>;
  readonly styles?: Readonly<Record<string, { readonly tokens?: readonly string[] }>>;
  readonly examples?: Readonly<
    Record<
      string,
      {
        readonly component: string;
        readonly name: string;
        readonly file?: string;
        readonly incorrect?: unknown;
        /** Other components its fixture renders. */
        readonly uses?: readonly string[];
      }
    >
  >;
  readonly diagnostics?: readonly {
    readonly code: string;
    readonly message?: string;
    readonly source?: { readonly file?: string; readonly line?: number };
  }[];
}
export interface TokenInspection {
  readonly theme?: string;
  readonly tokens: readonly {
    readonly name: string;
    readonly cssVariable?: string;
    readonly type?: string;
    readonly definition: unknown;
    readonly value?: unknown;
    readonly description?: string;
    readonly provenance?: string;
  }[];
  readonly scopes?: readonly {
    readonly selector: string;
    readonly changed: readonly string[];
    readonly redeclared?: readonly string[];
  }[];
}
/** `product.v1` fields used here. */
export interface ProductManifest {
  readonly id: string;
  readonly version?: string;
  readonly theme?: {
    readonly config?: string;
    readonly product?: string;
    readonly overrides?: Readonly<Record<string, unknown>>;
  };
  /** Applicable component tags; omitted means all. */
  readonly components?: readonly string[];
  readonly examples?: readonly string[];
}
/** An authoritative rename: a migration entry, `@renamedFrom`, or a token replacement. */
export interface Migration {
  readonly from: string;
  readonly to: string;
  /** Where the record lives, e.g. `migrations/0.5.md` or `token deprecation`. */
  readonly source: string;
}

export interface SnapshotInputs {
  readonly packages: readonly {
    readonly name: string;
    readonly version: string;
    readonly manifest: CemManifest;
    readonly metadata: MetadataInput;
    /** `package.json` `exports`; each key becomes an `export:<package>/<key>` item. */
    readonly exports?: Readonly<Record<string, unknown>>;
    /** Source text of published modules and example files by path; only hashes are kept. */
    readonly modules?: Readonly<Record<string, string>>;
  }[];
  readonly theme?: {
    readonly inspection: TokenInspection;
    /** The ThemeConfig; `products` entries are hashed per product, the rest as `theme:base`. */
    readonly config?: Readonly<Record<string, unknown>>;
  };
  readonly products?: readonly ProductManifest[];
  readonly suites?: readonly {
    readonly id: string;
    readonly version: string;
    /** Component tags the suite verifies. */
    readonly targets: readonly string[];
  }[];
  readonly migrations?: readonly Migration[];
  /** Versions of what produced the inputs (analyzer, generator, core, schemas). */
  readonly versions?: Readonly<Record<string, string>>;
}

// ---- snapshot ----

export type ItemKind =
  | 'component'
  | 'class'
  | 'property'
  | 'attribute'
  | 'event'
  | 'method'
  | 'slot'
  | 'part'
  | 'cssprop'
  | 'state'
  | 'registration'
  | 'export'
  | 'definition'
  | 'template'
  | 'style'
  | 'token'
  | 'theme'
  | 'product'
  | 'example'
  | 'suite';

export interface SnapshotItem {
  readonly kind: ItemKind;
  /** SHA-256 of the item's contract facts (descriptions excluded). */
  readonly hash: string;
  /** SHA-256 of its descriptions, so documentation-only changes are told apart. */
  readonly docs?: string;
  readonly package?: string;
  /** Declared type text (properties, attributes, tokens). */
  readonly type?: string;
  /** Units of a dimension token's values, e.g. `rem`. */
  readonly unit?: string;
}

/** `from` depends on `to`. */
export interface SnapshotEdge {
  readonly from: string;
  readonly to: string;
  readonly kind:
    | 'class'
    | 'member'
    | 'definition'
    | 'template'
    | 'style'
    | 'dependency'
    | 'foundation'
    | 'reads'
    | 'alias'
    | 'example'
    | 'applies'
    | 'sets'
    | 'theme'
    | 'suite'
    | 'uses';
  readonly provenance: 'extracted' | 'declared' | 'authored' | 'configuration';
}

export interface ComparisonSnapshot {
  readonly schema: typeof SNAPSHOT_SCHEMA;
  readonly versions: Readonly<Record<string, string>>;
  /** Packages read, with the hashes of the artifacts the items came from. */
  readonly packages: readonly {
    name: string;
    version: string;
    artifacts: Record<string, string>;
  }[];
  readonly items: Readonly<Record<string, SnapshotItem>>;
  readonly edges: readonly SnapshotEdge[];
  /** Dependencies that could not be resolved; they widen selection for their package. */
  readonly unresolved: readonly { item: string; package?: string; reason: string }[];
  /** Product contexts: id and the tokens its scope sets. */
  readonly products: readonly { id: string; sets: string[]; components?: string[] }[];
  readonly migrations: readonly Migration[];
}

const sha256 = (text: string) => `sha256-${createHash('sha256').update(text).digest('hex')}`;
/** JSON with sorted object keys, so equal facts hash equally. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  return JSON.stringify(value ?? null);
}
const hashOf = (value: unknown) => sha256(canonical(value));
const sortBy = <T>(list: T[], key: (item: T) => string) =>
  list.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));

const DIMENSION = /(-?\d*\.?\d+)([a-z%]+)$/i;
function unitsOf(value: unknown): string | undefined {
  const values =
    typeof value === 'string'
      ? [value]
      : value && typeof value === 'object'
        ? Object.values(value).filter((v): v is string => typeof v === 'string')
        : [];
  const units = [...new Set(values.map((v) => DIMENSION.exec(v.trim())?.[2]).filter(Boolean))];
  return units.length ? units.sort().join(' ') : undefined;
}
const refsIn = (definition: unknown) =>
  [...JSON.stringify(definition ?? '').matchAll(/\{([^{}"]+)\}/g)].map((m) => m[1] as string);

/** Build a snapshot from existing artifacts. Never executes the analyzed code. */
export function createSnapshot(inputs: SnapshotInputs): ComparisonSnapshot {
  const items: Record<string, SnapshotItem> = {};
  const edges: SnapshotEdge[] = [];
  const unresolved: { item: string; package?: string; reason: string }[] = [];
  const item = (id: string, value: SnapshotItem) => {
    items[id] = value;
  };
  const edge = (
    from: string,
    to: string,
    kind: SnapshotEdge['kind'],
    provenance: SnapshotEdge['provenance'],
  ) => edges.push({ from, to, kind, provenance });

  // Tokens first: style reads resolve against them.
  const inspection = inputs.theme?.inspection;
  const byVariable = new Map(
    (inspection?.tokens ?? []).map((t) => [t.cssVariable ?? '', t.name] as const),
  );
  const tokenNames = new Set((inspection?.tokens ?? []).map((t) => t.name));
  for (const token of inspection?.tokens ?? []) {
    const unit = unitsOf(token.value);
    item(`token:${token.name}`, {
      kind: 'token',
      hash: hashOf({ type: token.type, definition: token.definition, value: token.value }),
      docs: hashOf({ description: token.description, provenance: token.provenance }),
      ...(token.type ? { type: token.type } : {}),
      ...(unit ? { unit } : {}),
    });
    for (const ref of new Set(refsIn(token.definition)))
      if (tokenNames.has(ref)) edge(`token:${token.name}`, `token:${ref}`, 'alias', 'declared');
  }
  const config = inputs.theme?.config;
  if (config) {
    const { products: _products, ...base } = config as { products?: unknown };
    item('theme:base', { kind: 'theme', hash: hashOf(base) });
  }

  const packages: ComparisonSnapshot['packages'][number][] = [];
  const allTags: string[] = [];
  const read = new Set(inputs.packages.map((p) => p.name));
  const variables = new Set(
    inputs.packages.flatMap((p) =>
      p.manifest.modules.flatMap((m) =>
        (m.declarations ?? []).flatMap((d) => (d.cssProperties ?? []).map((c) => c.name)),
      ),
    ),
  );
  for (const pkg of inputs.packages) {
    const at = (ref: SourceRef) => `${ref.package ?? pkg.name}/${ref.module}#${ref.name}`;
    /** The publisher's item wins: only it can hash the source. */
    const source = (id: string, kind: 'template' | 'style', ref: SourceRef, facts: unknown) => {
      const owner = ref.package ?? pkg.name;
      if (owner !== pkg.name) {
        if (!read.has(owner))
          unresolved.push({
            item: id,
            package: pkg.name,
            reason: `${owner} was not read; edits to ${ref.module} are not detected`,
          });
        if (!items[id]) item(id, { kind, hash: hashOf({ facts, source: null }), package: owner });
        return;
      }
      const text = pkg.modules?.[ref.module];
      if (text === undefined)
        unresolved.push({
          item: id,
          package: pkg.name,
          reason: `source of ${ref.module} not supplied; edits inside it are not detected`,
        });
      item(id, {
        kind,
        hash: hashOf({ facts, source: text === undefined ? null : sha256(text) }),
        package: owner,
      });
    };
    packages.push({
      name: pkg.name,
      version: pkg.version,
      artifacts: {
        'custom-elements.json': hashOf(pkg.manifest),
        'oddkin.metadata.json': hashOf(pkg.metadata),
        ...(pkg.exports ? { 'package.json#exports': hashOf(pkg.exports) } : {}),
      },
    });
    for (const key of Object.keys(pkg.exports ?? {}))
      item(`export:${pkg.name}/${key}`, {
        kind: 'export',
        hash: hashOf(pkg.exports?.[key]),
        package: pkg.name,
      });

    const declarations = new Map(
      pkg.manifest.modules.flatMap((m) =>
        (m.declarations ?? [])
          .filter((d) => d.tagName)
          .map((d) => [d.tagName as string, { d, path: m.path }] as const),
      ),
    );
    for (const [tag, { d, path }] of declarations) {
      allTags.push(tag);
      const component = `component:${tag}`;
      // The class owns behavior and the public API; a derived definition depends on it, not on
      // the foundation's template or skin, which it names itself.
      const owner = `class:${tag}`;
      const text = path ? pkg.modules?.[path] : undefined;
      if (text === undefined)
        unresolved.push({
          item: owner,
          package: pkg.name,
          reason: `source of ${path ?? d.name} not supplied; edits inside it are not detected`,
        });
      item(owner, {
        kind: 'class',
        hash: hashOf({ name: d.name, source: text === undefined ? null : sha256(text) }),
        docs: hashOf(d.description),
        package: pkg.name,
      });
      edge(component, owner, 'class', 'extracted');
      const member = (id: string, kind: ItemKind, facts: object, docs?: string, type?: string) => {
        item(id, {
          kind,
          hash: hashOf(facts),
          ...(docs ? { docs: hashOf(docs) } : {}),
          package: pkg.name,
          ...(type ? { type } : {}),
        });
        edge(owner, id, 'member', 'extracted');
      };
      for (const m of d.members ?? []) {
        if (m.static || m.privacy === 'private' || m.privacy === 'protected') continue;
        const type = m.type?.text;
        if (m.kind === 'method')
          member(`method:${tag}#${m.name}`, 'method', { type }, m.description);
        else
          member(
            `property:${tag}#${m.name}`,
            'property',
            {
              type,
              default: m.default,
              attribute: m.attribute,
              reflects: m.reflects,
              readonly: m.readonly,
            },
            m.description,
            type,
          );
      }
      for (const a of d.attributes ?? [])
        member(
          `attribute:${tag}#${a.name}`,
          'attribute',
          { type: a.type?.text, field: a.fieldName, default: a.default },
          a.description,
          a.type?.text,
        );
      for (const e of d.events ?? [])
        member(`event:${tag}#${e.name}`, 'event', { type: e.type?.text }, e.description);
      for (const s of d.slots ?? [])
        member(`slot:${tag}#${s.name || 'default'}`, 'slot', {}, s.description);
      for (const p of d.cssParts ?? []) member(`part:${tag}#${p.name}`, 'part', {}, p.description);
      for (const c of d.cssProperties ?? [])
        member(
          `cssprop:${tag}#${c.name}`,
          'cssprop',
          { default: c.default, syntax: c.syntax },
          c.description,
        );
      for (const s of d.cssStates ?? [])
        member(`state:${tag}#${s.name}`, 'state', {}, s.description);
      item(component, {
        kind: 'component',
        hash: hashOf({ tag }),
        package: pkg.name,
      });
    }

    for (const [id, c] of Object.entries(pkg.metadata.components ?? {})) {
      const tag = c.tag;
      if (c.registration) {
        item(`registration:${tag}`, {
          kind: 'registration',
          hash: hashOf(c.registration),
          package: pkg.name,
        });
        edge(id, `registration:${tag}`, 'member', 'extracted');
      }
      const def = c.definition;
      if (!def) continue;
      const definition = `definition:${tag}`;
      item(definition, {
        kind: 'definition',
        hash: hashOf({
          extends: def.extends,
          template: def.template && at(def.template),
          styles: def.styles?.map(at),
          dependencies: def.dependencies,
        }),
        package: pkg.name,
      });
      edge(id, definition, 'definition', 'extracted');
      if (def.template) {
        const template = `template:${at(def.template)}`;
        source(
          template,
          'template',
          def.template,
          pkg.metadata.templates?.[`${def.template.module}#${def.template.name}`] ?? null,
        );
        edge(definition, template, 'template', 'extracted');
      }
      for (const ref of def.styles ?? []) {
        const style = `style:${at(ref)}`;
        const facts = pkg.metadata.styles?.[`${ref.module}#${ref.name}`];
        source(style, 'style', ref, facts ?? null);
        edge(definition, style, 'style', 'extracted');
        for (const read of facts?.tokens ?? []) {
          const name = read.startsWith('--') ? byVariable.get(read) : read;
          if (name && tokenNames.has(name)) edge(style, `token:${name}`, 'reads', 'extracted');
          // A declared component variable is the component's own API (its cssprop items).
          else if (!variables.has(read))
            unresolved.push({
              item: style,
              package: pkg.name,
              reason: read.startsWith('--')
                ? `reads ${read}, which is neither a token nor a declared component variable`
                : `reads ${read}, which no token defines`,
            });
        }
      }
      for (const dependency of Object.values(def.dependencies ?? {}))
        edge(definition, dependency, 'dependency', 'extracted');
      if (def.extends)
        edge(
          definition,
          `class:${def.extends.replace(/^component:/, '')}`,
          'foundation',
          'extracted',
        );
    }

    for (const [id, e] of Object.entries(pkg.metadata.examples ?? {})) {
      // Explained mistakes are never checks to run.
      if (e.incorrect) continue;
      const file = e.file ? pkg.modules?.[e.file] : undefined;
      item(id, {
        kind: 'example',
        hash: hashOf({ entry: e, file: file === undefined ? null : sha256(file) }),
        package: pkg.name,
      });
      edge(id, e.component, 'example', 'authored');
      // Fixtures that render other elements depend on them too.
      for (const used of e.uses ?? []) edge(id, used, 'uses', 'extracted');
    }
    for (const d of pkg.metadata.diagnostics ?? [])
      if (d.code.startsWith('analyzer.dynamic.') || d.code === 'analyzer.published.missing')
        unresolved.push({
          item: `package:${pkg.name}`,
          package: pkg.name,
          reason: `${d.code}${d.source?.file ? ` at ${d.source.file}:${d.source.line ?? 0}` : ''}`,
        });
  }

  const productScopes = new Map(
    (inspection?.scopes ?? []).flatMap((s) => {
      const name = /^\[data-odd-product="([^"]+)"\]$/.exec(s.selector)?.[1];
      return name ? [[name, s.changed] as const] : [];
    }),
  );
  const themeProducts = (config?.['products'] ?? {}) as Record<string, unknown>;
  const products: ComparisonSnapshot['products'][number][] = [];
  for (const product of inputs.products ?? []) {
    const id = `product:${product.id}`;
    const themeProduct = product.theme?.product ?? product.id;
    item(id, { kind: 'product', hash: hashOf(product) });
    if (themeProduct in themeProducts) {
      item(`theme:product/${themeProduct}`, {
        kind: 'theme',
        hash: hashOf(themeProducts[themeProduct]),
      });
      edge(id, `theme:product/${themeProduct}`, 'theme', 'configuration');
    }
    const sets = [
      ...(productScopes.get(themeProduct) ?? []),
      ...Object.keys(product.theme?.overrides ?? {}),
    ];
    for (const token of new Set(sets)) edge(id, `token:${token}`, 'sets', 'configuration');
    for (const tag of product.components ?? allTags)
      edge(id, `component:${tag}`, 'applies', 'configuration');
    products.push({
      id: product.id,
      sets: [...new Set(sets)].sort(),
      ...(product.components ? { components: [...product.components].sort() } : {}),
    });
  }

  for (const suite of inputs.suites ?? []) {
    item(`suite:${suite.id}`, {
      kind: 'suite',
      hash: hashOf({ version: suite.version, targets: suite.targets }),
    });
    for (const tag of suite.targets)
      edge(`suite:${suite.id}`, `component:${tag}`, 'suite', 'authored');
  }

  return {
    schema: SNAPSHOT_SCHEMA,
    versions: { ...(inputs.versions ?? {}) },
    packages,
    items: Object.fromEntries(sortBy(Object.entries(items), ([id]) => id)),
    edges: sortBy(
      [...new Map(edges.map((e) => [`${e.from} ${e.to} ${e.kind}`, e] as const)).values()],
      (e) => `${e.from} ${e.to} ${e.kind}`,
    ),
    unresolved: sortBy(unresolved, (u) => `${u.item} ${u.reason}`),
    products: sortBy(products, (p) => p.id),
    migrations: [...(inputs.migrations ?? [])],
  };
}

// ---- comparison ----

export type Classification = 'incompatible' | 'review' | 'informational';
export interface Change {
  readonly id: string;
  readonly kind: ItemKind;
  readonly change: 'added' | 'removed' | 'changed' | 'renamed';
  readonly classification: Classification;
  readonly reason: string;
  /** For `renamed`: the base id and the record that says so. */
  readonly from?: string;
  readonly migration?: string;
  /** An added item that looks like this removed one; never treated as a match. */
  readonly possibleRename?: string;
}
export type CheckState =
  'selected' | 'passed' | 'failed' | 'reused' | 'not-executed' | 'unresolved';
export interface Check {
  /** `example:<tag>/<name>` or `suite:<id>#<tag>`. */
  readonly id: string;
  readonly product?: string;
  readonly state: CheckState;
  readonly reason: string;
  /** Edge path from a changed item to the check, root first. */
  readonly via?: readonly string[];
  /** For `reused`: the baseline's conditions. */
  readonly conditions?: Readonly<Record<string, unknown>>;
}
export interface Affected {
  readonly id: string;
  readonly product?: string;
  readonly via: readonly string[];
}
export interface ImpactReport {
  readonly schema: typeof IMPACT_SCHEMA;
  readonly base: { readonly versions: Readonly<Record<string, string>> };
  readonly head: { readonly versions: Readonly<Record<string, string>> };
  /** Present when item-level selection was replaced by full verification. */
  readonly fallback?: { readonly kind: 'full'; readonly reasons: readonly string[] };
  readonly changes: readonly Change[];
  readonly affected: {
    readonly products: readonly Affected[];
    readonly components: readonly Affected[];
  };
  readonly coverageGaps: readonly { readonly item: string; readonly reason: string }[];
  readonly checks: readonly Check[];
}
/** A result from an earlier run, offered for reuse when nothing on its path changed. */
export interface BaselineResult {
  readonly check: string;
  readonly product?: string;
  readonly state: 'passed' | 'failed';
  readonly conditions: Readonly<Record<string, unknown>>;
}

const PUBLIC = new Set<ItemKind>([
  'component',
  'property',
  'attribute',
  'event',
  'method',
  'slot',
  'part',
  'cssprop',
  'state',
  'registration',
  'export',
  'token',
]);
const unionOf = (type: string | undefined) =>
  type && /^"[^"]*"( \| "[^"]*")*$/.test(type)
    ? [...type.matchAll(/"([^"]*)"/g)].map((m) => m[1] as string)
    : undefined;

function classify(
  id: string,
  base: SnapshotItem,
  head: SnapshotItem,
): Omit<Change, 'id' | 'kind' | 'change'> {
  if (base.hash === head.hash)
    return { classification: 'informational', reason: 'documentation only' };
  if (head.kind === 'token') {
    if (base.type !== head.type)
      return {
        classification: 'incompatible',
        reason: `type changed from ${base.type} to ${head.type}`,
      };
    if (base.unit !== head.unit)
      return {
        classification: 'incompatible',
        reason: `unit changed from ${base.unit ?? 'none'} to ${head.unit ?? 'none'}`,
      };
    return { classification: 'review', reason: 'value or definition changed' };
  }
  if ((head.kind === 'property' || head.kind === 'attribute') && base.type !== head.type) {
    const before = unionOf(base.type);
    const after = unionOf(head.type);
    if (before && after)
      return before.every((v) => after.includes(v))
        ? { classification: 'review', reason: `type widened to ${head.type}` }
        : {
            classification: 'incompatible',
            reason: `type narrowed from ${base.type} to ${head.type}`,
          };
    return { classification: 'review', reason: `type changed from ${base.type} to ${head.type}` };
  }
  return { classification: 'review', reason: `${id.split(':')[0]} changed` };
}

/** Compare two snapshots: classified changes, affected items with reasons, and selected checks. */
export function compareSnapshots(
  base: ComparisonSnapshot,
  head: ComparisonSnapshot,
  options: { readonly baseline?: readonly BaselineResult[] } = {},
): ImpactReport {
  const fallback: string[] = [];
  const major = (schema: string) => /\/v(\d+)\.json$/.exec(schema)?.[1];
  if (major(base.schema) !== major(head.schema))
    fallback.push(
      `snapshot schemas differ (${base.schema} → ${head.schema}); items are not compared`,
    );
  for (const key of new Set([...Object.keys(base.versions), ...Object.keys(head.versions)]))
    if (base.versions[key] !== head.versions[key])
      fallback.push(
        `${key} version changed (${base.versions[key] ?? 'none'} → ${head.versions[key] ?? 'none'})`,
      );

  // Changes, with renames only through migration records.
  const changes: Change[] = [];
  const renamedFrom = new Map(head.migrations.map((m) => [m.from, m] as const));
  const added = Object.keys(head.items).filter((id) => !(id in base.items));
  const removed = Object.keys(base.items).filter((id) => !(id in head.items));
  const renamedTo = new Set<string>();
  for (const id of removed) {
    const was = base.items[id] as SnapshotItem;
    const migration = renamedFrom.get(id);
    if (migration && head.items[migration.to]) {
      renamedTo.add(migration.to);
      changes.push({
        id: migration.to,
        kind: was.kind,
        change: 'renamed',
        from: id,
        migration: migration.source,
        classification: PUBLIC.has(was.kind) ? 'incompatible' : 'review',
        reason: `renamed from ${id}${head.items[migration.to]?.hash === was.hash ? '' : ', and changed'}`,
      });
      continue;
    }
    const lookalike = added.find(
      (a) => head.items[a]?.kind === was.kind && head.items[a]?.hash === was.hash,
    );
    changes.push({
      id,
      kind: was.kind,
      change: 'removed',
      classification: PUBLIC.has(was.kind) ? 'incompatible' : 'review',
      reason: 'removed',
      ...(lookalike ? { possibleRename: lookalike } : {}),
    });
  }
  for (const id of added)
    if (!renamedTo.has(id))
      changes.push({
        id,
        kind: (head.items[id] as SnapshotItem).kind,
        change: 'added',
        classification: 'informational',
        reason: 'added',
      });
  for (const [id, after] of Object.entries(head.items)) {
    const before = base.items[id];
    if (!before || (before.hash === after.hash && before.docs === after.docs)) continue;
    changes.push({ id, kind: after.kind, change: 'changed', ...classify(id, before, after) });
  }
  sortBy(changes, (c) => c.id);

  // Dependents: reverse edges of both snapshots, so removed items still reach their users.
  const dependents = new Map<string, Set<string>>();
  for (const e of [...base.edges, ...head.edges]) {
    if (e.kind === 'sets' || e.kind === 'applies') continue;
    if (!dependents.has(e.to)) dependents.set(e.to, new Set());
    dependents.get(e.to)!.add(e.from);
  }
  const contexts = head.products.length
    ? head.products.map((p) => ({
        id: p.id as string | undefined,
        sets: new Set(p.sets.map((t) => `token:${t}`)),
        components: p.components,
      }))
    : [{ id: undefined, sets: new Set<string>(), components: undefined }];
  const productOf = new Map(head.products.map((p) => [p.id, p] as const));

  // Roots: every changed item, documentation-only changes excepted.
  const roots = changes
    .filter(
      (c) => c.change !== 'added' && !(c.change === 'changed' && c.reason === 'documentation only'),
    )
    .map((c) => (c.change === 'renamed' ? (c.from as string) : c.id));
  const affectedComponents: Affected[] = [];
  const affectedProducts = new Map<string, string[]>();
  const selected = new Map<string, Check>();
  const examplesOf = (snapshot: ComparisonSnapshot, tag: string) =>
    snapshot.edges
      .filter((e) => e.kind === 'example' && e.to === `component:${tag}`)
      .map((e) => e.from);
  const applies = (context: (typeof contexts)[number], tag: string) =>
    !context.components || context.components.includes(tag);
  const select = (check: Check) => {
    const key = `${check.id}@${check.product ?? ''}`;
    if (!selected.has(key)) selected.set(key, check);
  };

  for (const context of contexts) {
    // Breadth-first from the roots; a token the product sets itself is its own value.
    const via = new Map<string, string[]>();
    const queue: string[] = [];
    const reach = (id: string, path: string[]) => {
      if (via.has(id) || context.sets.has(id)) return;
      via.set(id, path);
      queue.push(id);
    };
    for (const root of roots) reach(root, [root]);
    const product = context.id ? productOf.get(context.id) : undefined;
    if (product) {
      const changedOwn =
        roots.includes(`product:${product.id}`) ||
        head.edges.some(
          (e) => e.from === `product:${product.id}` && e.kind === 'theme' && roots.includes(e.to),
        );
      // A product whose own theme changed: every token its scope sets is a root for it.
      if (changedOwn)
        for (const token of product.sets) {
          const path = [`product:${product.id}`, `token:${token}`];
          if (!via.has(`token:${token}`)) {
            via.set(`token:${token}`, path);
            queue.push(`token:${token}`);
          }
        }
    }
    while (queue.length) {
      const id = queue.shift() as string;
      for (const next of dependents.get(id) ?? [])
        reach(next, [...(via.get(id) as string[]), next]);
    }
    const components = [...via.keys()].filter((id) => id.startsWith('component:'));
    for (const component of components) {
      const tag = component.slice('component:'.length);
      if (!applies(context, tag)) continue;
      affectedComponents.push({
        id: component,
        ...(context.id ? { product: context.id } : {}),
        via: via.get(component) as string[],
      });
      for (const example of examplesOf(head, tag))
        select({
          id: example,
          ...(context.id ? { product: context.id } : {}),
          state: 'selected',
          reason: 'an input on its path changed',
          via: [...(via.get(component) as string[]), example],
        });
      for (const e of head.edges.filter((e) => e.kind === 'suite' && e.to === component))
        select({
          id: `${e.from}#${tag}`,
          ...(context.id ? { product: context.id } : {}),
          state: 'selected',
          reason: 'its target is affected',
          via: [...(via.get(component) as string[]), e.from],
        });
    }
    // A changed suite or example is selected for its own sake.
    for (const id of via.keys()) {
      if (id.startsWith('suite:') && roots.includes(id))
        for (const e of head.edges.filter((e) => e.kind === 'suite' && e.from === id)) {
          const tag = e.to.slice('component:'.length);
          if (applies(context, tag))
            select({
              id: `${id}#${tag}`,
              ...(context.id ? { product: context.id } : {}),
              state: 'selected',
              reason: 'the suite changed',
              via: [id],
            });
        }
      if (id.startsWith('example:') && head.items[id]) {
        const tag = head.edges
          .find((e) => e.kind === 'example' && e.from === id)
          ?.to.slice('component:'.length);
        if (tag && applies(context, tag))
          select({
            id,
            ...(context.id ? { product: context.id } : {}),
            state: 'selected',
            reason: roots.includes(id)
              ? 'the example changed'
              : 'its fixture renders an affected element',
            via: via.get(id) as string[],
          });
      }
    }
    if (context.id && [...selected.values()].some((c) => c.product === context.id))
      affectedProducts.set(context.id, [
        ...([...selected.values()].find((c) => c.product === context.id)?.via ?? []),
      ]);
  }

  // Every check: examples (explained mistakes excluded at snapshot time) and suite targets.
  const universe = (context: (typeof contexts)[number]) => [
    ...Object.entries(head.items)
      .filter(([, entry]) => entry.kind === 'example')
      .flatMap(([id, entry]) => {
        const tag = head.edges
          .find((e) => e.kind === 'example' && e.from === id)
          ?.to.slice('component:'.length);
        return tag && applies(context, tag) ? [{ id, package: entry.package }] : [];
      }),
    ...head.edges
      .filter((e) => e.kind === 'suite' && applies(context, e.to.slice('component:'.length)))
      .map((e) => ({ id: `${e.from}#${e.to.slice('component:'.length)}`, package: undefined })),
  ];
  // A changed product manifest (components, defaults, examples) selects all of its checks.
  for (const context of contexts)
    if (context.id && roots.includes(`product:${context.id}`))
      for (const check of universe(context))
        select({
          id: check.id,
          product: context.id,
          state: 'selected',
          reason: 'the product changed',
          via: [`product:${context.id}`],
        });

  // Unresolved dependencies widen selection to every example of an affected package.
  const coverageGaps = head.unresolved.map((u) => ({ item: u.item, reason: u.reason }));
  const affectedPackages = new Set(
    [...roots, ...affectedComponents.map((a) => a.id)]
      .map((id) => head.items[id]?.package ?? base.items[id]?.package)
      .filter((p): p is string => !!p),
  );
  for (const pkg of affectedPackages) {
    const gaps = head.unresolved.filter((u) => u.package === pkg);
    if (!gaps.length) continue;
    for (const context of contexts)
      for (const check of universe(context))
        if (check.package === pkg)
          select({
            id: check.id,
            ...(context.id ? { product: context.id } : {}),
            state: 'selected',
            reason: `unresolved dependency in ${pkg}: ${gaps[0]?.reason}`,
          });
  }
  if (fallback.length)
    for (const context of contexts)
      for (const check of universe(context))
        select({
          id: check.id,
          ...(context.id ? { product: context.id } : {}),
          state: 'selected',
          reason: `full verification: ${fallback[0]}`,
        });

  // With a baseline, every other check is reused only from a passing result, whose conditions
  // are listed; a missing or failed result is executed. Without one, unaffected checks are not
  // part of this run.
  const checks = [...selected.values()];
  if (options.baseline) {
    const results = new Map<string, BaselineResult>(
      options.baseline.map((r) => [`${r.check}@${r.product ?? ''}`, r]),
    );
    for (const context of contexts)
      for (const check of universe(context)) {
        const key = `${check.id}@${context.id ?? ''}`;
        if (selected.has(key)) continue;
        const result = results.get(key);
        checks.push(
          result?.state === 'passed'
            ? {
                id: check.id,
                ...(context.id ? { product: context.id } : {}),
                state: 'reused',
                reason: 'no input on its path changed',
                conditions: result.conditions,
              }
            : {
                id: check.id,
                ...(context.id ? { product: context.id } : {}),
                state: 'selected',
                reason: result ? 'the baseline result failed' : 'no baseline result',
              },
        );
      }
  }
  for (const context of contexts) {
    const first = [...selected.values()].find((c) => c.product === context.id);
    if (context.id && !affectedProducts.has(context.id) && first)
      affectedProducts.set(context.id, [...(first.via ?? [])]);
  }

  return {
    schema: IMPACT_SCHEMA,
    base: { versions: base.versions },
    head: { versions: head.versions },
    ...(fallback.length ? { fallback: { kind: 'full' as const, reasons: fallback } } : {}),
    changes,
    affected: {
      products: sortBy(
        [...affectedProducts].map(([id, path]) => ({ id: `product:${id}`, via: path })),
        (a) => a.id,
      ),
      components: sortBy(affectedComponents, (a) => `${a.id}@${a.product ?? ''}`),
    },
    coverageGaps,
    checks: sortBy(checks, (c) => `${c.id}@${c.product ?? ''}`),
  };
}

// ---- execution results ----

/** One run's outcome for a selected check, e.g. per browser. */
export interface CheckResult {
  readonly check: string;
  readonly product?: string;
  readonly state: 'passed' | 'failed' | 'not-executed';
  readonly message?: string;
  /** What ran: browser and version, configuration, input hashes. */
  readonly conditions: Readonly<Record<string, unknown>>;
}

/**
 * Merge executed results into the report. A selected check passes only when every run of it
 * passed; any failure fails it; with no run it is `not-executed`. Conditions of every run are
 * listed. Reused checks keep their baseline state and conditions.
 */
export function mergeResults(report: ImpactReport, results: readonly CheckResult[]): ImpactReport {
  const runs = new Map<string, CheckResult[]>();
  for (const result of results) {
    const key = `${result.check}@${result.product ?? ''}`;
    runs.set(key, [...(runs.get(key) ?? []), result]);
  }
  return {
    ...report,
    checks: report.checks.map((check): Check => {
      if (check.state !== 'selected') return check;
      const ran = (runs.get(`${check.id}@${check.product ?? ''}`) ?? []).filter(
        (r) => r.state !== 'not-executed',
      );
      if (!ran.length)
        return { ...check, state: 'not-executed', reason: `${check.reason}; no run recorded` };
      const failed = ran.filter((r) => r.state === 'failed');
      return {
        ...check,
        state: failed.length ? 'failed' : 'passed',
        reason: failed.length
          ? `${check.reason}; failed: ${failed.map((r) => r.message ?? 'no message').join('; ')}`
          : check.reason,
        conditions: { runs: ran.map((r) => r.conditions) },
      };
    }),
  };
}

// ---- reading a package from disk ----

/**
 * The snapshot inputs of a built package directory: `package.json` (name, version, exports),
 * its `customElements` manifest, `oddkin.metadata.json`, and the sources of every module its
 * elements, definitions, and examples name. Missing sources stay missing (coverage gaps).
 */
export function readPackage(dir: string): SnapshotInputs['packages'][number] {
  const json = <T>(path: string) => JSON.parse(readFileSync(join(dir, path), 'utf8')) as T;
  const pkg = json<{
    name: string;
    version: string;
    exports?: Record<string, unknown>;
    customElements?: string;
  }>('package.json');
  const manifest = json<CemManifest>(pkg.customElements ?? 'custom-elements.json');
  const metadata = existsSync(join(dir, 'oddkin.metadata.json'))
    ? json<MetadataInput>('oddkin.metadata.json')
    : {};
  const paths = new Set<string>([
    ...manifest.modules
      .filter((m) => m.declarations?.some((d) => d.tagName))
      .flatMap((m) => (m.path ? [m.path] : [])),
    ...Object.values(metadata.components ?? {}).flatMap((c) => [
      ...(c.definition?.template && !c.definition.template.package
        ? [c.definition.template.module]
        : []),
      ...(c.definition?.styles ?? []).filter((s) => !s.package).map((s) => s.module),
    ]),
    ...Object.values(metadata.examples ?? {}).flatMap((e) => (e.file ? [e.file] : [])),
  ]);
  const modules: Record<string, string> = {};
  for (const path of [...paths].sort())
    if (existsSync(join(dir, path))) modules[path] = readFileSync(join(dir, path), 'utf8');
  return {
    name: pkg.name,
    version: pkg.version,
    manifest,
    metadata,
    ...(pkg.exports ? { exports: pkg.exports } : {}),
    modules,
  };
}

// ---- Markdown ----

const cell = (text: string) => text.replaceAll('|', '\\|').replaceAll('\n', ' ');
/** A readable rendering of the report for terminals, pull requests, and Workbench. */
export function renderImpactMarkdown(report: ImpactReport): string {
  const lines = ['# Change impact', ''];
  const count = (state: CheckState) => report.checks.filter((c) => c.state === state).length;
  const incompatible = report.changes.filter((c) => c.classification === 'incompatible').length;
  const states = (['selected', 'passed', 'failed', 'reused', 'not-executed', 'unresolved'] as const)
    .filter((state) => count(state))
    .map((state) => `${count(state)} ${state}`);
  lines.push(
    `${report.changes.length} changes (${incompatible} incompatible) · ${report.affected.products.length} products affected · ${report.checks.length} checks${states.length ? ` (${states.join(', ')})` : ''}`,
    '',
  );
  if (report.fallback)
    lines.push(
      '## Full verification',
      '',
      ...report.fallback.reasons.map((r) => `- ${cell(r)}`),
      '',
    );
  if (report.changes.length) {
    lines.push(
      '## Changes',
      '',
      '| Classification | Change | Item | Reason |',
      '| --- | --- | --- | --- |',
    );
    for (const c of report.changes)
      lines.push(
        `| ${c.classification} | ${c.change} | \`${cell(c.id)}\` | ${cell(c.reason)}${c.migration ? ` (${cell(c.migration)})` : ''}${c.possibleRename ? `; possible rename to \`${cell(c.possibleRename)}\` (unconfirmed)` : ''} |`,
      );
    lines.push('');
  }
  if (report.coverageGaps.length)
    lines.push(
      '## Coverage gaps',
      '',
      ...report.coverageGaps.map((g) => `- \`${cell(g.item)}\`: ${cell(g.reason)}`),
      '',
    );
  if (report.checks.length) {
    lines.push(
      '## Checks',
      '',
      '| State | Check | Product | Reason |',
      '| --- | --- | --- | --- |',
    );
    for (const c of report.checks)
      lines.push(
        `| ${c.state} | \`${cell(c.id)}\` | ${c.product ?? ''} | ${cell(c.reason)}${c.via?.length ? ` (via ${c.via.map((v) => `\`${cell(v)}\``).join(' → ')})` : ''} |`,
      );
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}
