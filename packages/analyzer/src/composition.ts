/**
 * A library's composition catalog and JSON Schemas (data-composition.md §8): what a composition
 * document may write on each element, generated from the library's Custom Elements Manifest, so
 * `validateComposition()` and `renderComposition()` from `@oddkin/components/composition` work
 * with its own elements. Value schemas come from the same `@oddkin/core/model` nodes the validator
 * uses.
 */
import { defineModel, m, type Model, type ModelDefinition, type Node } from '@oddkin/core/model';
import { toJSONSchema } from '@oddkin/core/model/schema';
import type { AnalyzerDiagnostic } from './extract.js';

/** How a value is written: a JSON scalar, a URL, a list of strings, an enum, texts, or a model. */
export type ValueType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'url'
  | 'strings'
  | { readonly enum: readonly string[] }
  | { readonly texts: readonly string[] }
  | { readonly model: string };

/** What a composition may write on one element. */
export interface ElementEntry {
  readonly attributes: Readonly<Record<string, ValueType>>;
  /** Writable properties without an attribute whose values JSON can carry. */
  readonly properties: Readonly<Record<string, ValueType>>;
  /** Published properties a composition cannot write: functions, elements, read-only values. */
  readonly fixed: readonly string[];
  /** Published slots; `''` is the default slot. */
  readonly slots: readonly string[];
  /** Published events an action name may be mapped to. */
  readonly events: readonly string[];
}

export type Catalog = Readonly<Record<string, ElementEntry>>;

/** Native element: its attributes, whether it holds text, and which natives may be inside it. */
export interface NativeEntry {
  readonly attributes: Readonly<Record<string, ValueType>>;
  readonly text: boolean;
  readonly children: readonly string[];
}

const PHRASING = ['span', 'strong', 'em', 'a'];
const phrasing: NativeEntry = { attributes: {}, text: true, children: PHRASING };

/**
 * The native text elements every composition may use, as `@oddkin/components/composition`
 * renders them (its `NATIVE`, which a test keeps equal to this one).
 */
export const NATIVE: Readonly<Record<string, NativeEntry>> = {
  p: phrasing,
  h1: phrasing,
  h2: phrasing,
  h3: phrasing,
  h4: phrasing,
  h5: phrasing,
  h6: phrasing,
  span: phrasing,
  strong: phrasing,
  em: phrasing,
  a: {
    attributes: {
      href: 'url',
      target: { enum: ['_blank', '_self', '_parent', '_top'] },
      rel: 'string',
    },
    text: true,
    children: PHRASING.filter((tag) => tag !== 'a'),
  },
  ul: { attributes: {}, text: false, children: ['li'] },
  ol: { attributes: {}, text: false, children: ['li'] },
  li: { attributes: {}, text: true, children: [...PHRASING, 'ul', 'ol', 'p'] },
};

export interface CatalogOptions {
  /**
   * Record types a published model describes, by the type name the manifest writes, for example
   * `{ NavigationEntry: 'oddkin.navigation' }`. A list of any other record type is not portable.
   */
  readonly modelTypes?: Readonly<Record<string, string>>;
  /** Events an element's contract makes its activation that the manifest does not list. */
  readonly events?: Readonly<Record<string, readonly string[]>>;
}

interface CemDeclaration {
  readonly tagName?: string;
  readonly description?: string;
  readonly attributes?: readonly {
    readonly name: string;
    readonly type?: { readonly text?: string };
    readonly default?: string;
    readonly description?: string;
  }[];
  readonly members?: readonly {
    readonly kind?: string;
    readonly name: string;
    readonly static?: boolean;
    readonly privacy?: string;
    readonly attribute?: string;
    readonly readonly?: boolean;
    readonly type?: { readonly text?: string };
    readonly default?: string;
    readonly description?: string;
  }[];
  readonly slots?: readonly { readonly name: string }[];
  readonly events?: readonly { readonly name: string }[];
}

/** Each custom element the manifest declares, by tag. */
function declarations(manifest: unknown): Map<string, CemDeclaration> {
  const found = new Map<string, CemDeclaration>();
  const modules = (manifest as { modules?: unknown } | null)?.modules;
  for (const module of Array.isArray(modules) ? modules : [])
    for (const declaration of (module as { declarations?: CemDeclaration[] }).declarations ?? [])
      if (typeof declaration?.tagName === 'string' && !found.has(declaration.tagName))
        found.set(declaration.tagName, declaration);
  return found;
}

// Attributes whose value is followed as a URL: script URLs are refused like any model URL.
const URL_NAMES = new Set(['href', 'src', 'formaction']);

/** The value type for a manifest type text, or undefined when JSON cannot carry it. */
function valueType(
  text: string | undefined,
  name: string,
  models: Readonly<Record<string, string>>,
): ValueType | undefined {
  const type = (text ?? '').replace(/ \| undefined$/, '').trim();
  if (type === 'string') return URL_NAMES.has(name) ? 'url' : 'string';
  if (type === 'number') return 'number';
  if (type === 'boolean') return 'boolean';
  // A union of string literals, in either quote style: manifests from other tools use single quotes.
  const parts = type.split(' | ');
  if (parts.every((part) => /^(?:"[^"]*"|'[^']*')$/.test(part)))
    return { enum: parts.map((part) => part.slice(1, -1)) };
  if (type === 'readonly string[]') return 'strings';
  const texts = /^Partial<\{((?: [\w]+: string;)+) \}>$/.exec(type);
  if (texts)
    return {
      texts: [...(texts[1] as string).matchAll(/(\w+): string;/g)].map((m) => m[1] as string),
    };
  const records = /^readonly (\w+)\[\]$/.exec(type);
  const model =
    records && Object.hasOwn(models, records[1] as string)
      ? models[records[1] as string]
      : undefined;
  return model ? { model } : undefined;
}

/**
 * The composition catalog of every custom element in a Custom Elements Manifest: published
 * attributes typed as JSON can carry them, writable properties without an attribute, the
 * properties a composition cannot write, slots, and events. An attribute JSON cannot carry, or a
 * boolean attribute that is on by default (markup cannot turn it off), is left out with a warning.
 */
export function compositionCatalog(
  manifest: unknown,
  options: CatalogOptions = {},
): { catalog: Catalog; diagnostics: AnalyzerDiagnostic[] } {
  const models = options.modelTypes ?? {};
  const diagnostics: AnalyzerDiagnostic[] = [];
  const warn = (code: string, message: string, suggestion: string) =>
    diagnostics.push({ code, severity: 'warning', message, suggestion });
  const found = declarations(manifest);
  const catalog: Record<string, ElementEntry> = {};
  for (const tag of [...found.keys()].sort()) {
    const d = found.get(tag) as CemDeclaration;
    const attributes: Record<string, ValueType> = {};
    for (const a of d.attributes ?? []) {
      const type = valueType(a.type?.text, a.name, models);
      if (!type)
        warn(
          'analyzer.composition.attributeType',
          `${tag}: attribute "${a.name}" has a type a composition cannot write (${a.type?.text ?? 'unknown'}); it is left out of the catalog.`,
          'Type it as string, number, boolean, or a union of string literals.',
        );
      else if (type === 'boolean' && a.default !== undefined && a.default !== 'false')
        warn(
          'analyzer.composition.booleanDefault',
          `${tag}: boolean attribute "${a.name}" defaults to ${a.default}; markup cannot turn it off, so it is left out of the catalog.`,
          'Name the attribute for the state it turns on, defaulting to false.',
        );
      else attributes[a.name] = type;
    }
    const properties: Record<string, ValueType> = {};
    const fixed: string[] = [];
    for (const f of d.members ?? []) {
      if (f.kind !== 'field' || f.static || f.privacy || f.name.startsWith('_') || f.attribute)
        continue;
      const type = f.readonly ? undefined : valueType(f.type?.text, f.name, models);
      if (type) properties[f.name] = type;
      else fixed.push(f.name);
    }
    catalog[tag] = {
      attributes,
      properties,
      fixed: fixed.sort(),
      slots: (d.slots ?? []).map((s) => s.name).sort(),
      events: [...(d.events ?? []).map((e) => e.name), ...(options.events?.[tag] ?? [])].sort(),
    };
  }
  return { catalog, diagnostics };
}

export interface SchemaOptions {
  /**
   * Where the schemas are published, ending in `/`: each schema's `$id` is this plus its file
   * name. Without it the schemas carry no `$id` and refer to each other by file name.
   */
  readonly base?: string;
  /** The schema URL of each published model a value follows, by model name. */
  readonly modelSchemas?: Readonly<Record<string, string>>;
  /** The document schema's title and description. */
  readonly title?: string;
  readonly description?: string;
}

/** The `@oddkin/core/model` schema node for a value type that is not a model. */
function valueNode(type: Exclude<ValueType, { readonly model: string }>): Node {
  if (type === 'string') return m.string();
  if (type === 'number') return m.number();
  if (type === 'boolean') return m.boolean();
  if (type === 'url') return m.url();
  if (type === 'strings') return m.array(m.string());
  if ('enum' in type) return m.enum(type.enum as [string, ...string[]]);
  return m.object(Object.fromEntries(type.texts.map((key) => [key, m.optional(m.string())])));
}

// The untyped overload: a value node chosen at run time has no static type to infer.
const define = defineModel as unknown as (name: string, definition: ModelDefinition<Node>) => Model;

/** A JSON value from a manifest's default text (`'primary'`, `false`, `3`), or undefined. */
function literal(text: string | undefined): unknown {
  if (text === undefined || text === 'undefined') return undefined;
  try {
    return JSON.parse(text.replace(/^'(.*)'$/, (_, s: string) => JSON.stringify(s)));
  } catch {
    return undefined;
  }
}

/**
 * The JSON Schemas of a catalog: `<tag>.v1.json` for each element and `composition.v1.json`, the
 * document with the native elements and the shared definitions. Descriptions and defaults come
 * from the manifest. Rules JSON Schema cannot express are in the document schema's `$comment`.
 */
export function compositionSchemas(
  catalog: Catalog,
  manifest: unknown,
  options: SchemaOptions = {},
): Record<string, Record<string, unknown>> {
  const found = declarations(manifest);
  const base = options.base ?? '';
  const id = (file: string) => (options.base ? { $id: `${base}${file}` } : {});
  const ref = (name: string) => ({ $ref: `${base}composition.v1.json#/$defs/${name}` });
  const object = (properties: Record<string, unknown>) => ({
    type: 'object',
    additionalProperties: false,
    properties,
  });
  const valueSchema = (type: ValueType): Record<string, unknown> => {
    if (typeof type === 'object' && 'model' in type) {
      const url = options.modelSchemas?.[type.model];
      if (!url)
        throw new TypeError(`No schema URL for the model "${type.model}" (options.modelSchemas).`);
      return { $ref: url };
    }
    const {
      $schema: _schema,
      $id: _id,
      title: _title,
      ...schema
    } = toJSONSchema(define('oddkin.composition.value', { version: 1, schema: valueNode(type) }));
    return schema;
  };
  const described = (
    schema: Record<string, unknown>,
    source: { readonly description?: string; readonly default?: string } | undefined,
  ) => {
    const out = { ...schema };
    if (source?.description) out['description'] = source.description;
    const value = literal(source?.default);
    if (value !== undefined) out['default'] = value;
    return out;
  };
  const values = (
    types: Readonly<Record<string, ValueType>>,
    source: (
      name: string,
    ) => { readonly description?: string; readonly default?: string } | undefined,
  ) =>
    object(
      Object.fromEntries(
        Object.entries(types).map(([name, type]) => [
          name,
          described(valueSchema(type), source(name)),
        ]),
      ),
    );

  const schemas: Record<string, Record<string, unknown>> = {};
  for (const [tag, entry] of Object.entries(catalog)) {
    const d = found.get(tag);
    const properties: Record<string, unknown> = {
      element: { const: tag },
      id: ref('id'),
      slot: ref('slot'),
    };
    if (Object.keys(entry.attributes).length)
      properties['attributes'] = values(entry.attributes, (name) =>
        d?.attributes?.find((a) => a.name === name),
      );
    if (Object.keys(entry.properties).length)
      properties['properties'] = values(entry.properties, (name) =>
        d?.members?.find((member) => member.name === name),
      );
    if (entry.slots.length) properties['children'] = { type: 'array', items: ref('node') };
    if (entry.events.length)
      properties['actions'] = object(
        Object.fromEntries(entry.events.map((event) => [event, ref('action')])),
      );
    schemas[`${tag}.v1.json`] = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      ...id(`${tag}.v1.json`),
      title: tag,
      description: (d?.description ?? '').split('\n\n')[0]?.replace(/\s*\n\s*/g, ' '),
      ...(entry.slots.length
        ? {
            $comment: `Slots: ${entry.slots.map((s) => (s ? `"${s}"` : 'default')).join(', ')}. A child names a slot with "slot"; text and children without "slot" go to the default slot.`,
          }
        : {}),
      type: 'object',
      additionalProperties: false,
      required: ['element'],
      properties,
    };
  }

  const natives = Object.fromEntries(
    Object.entries(NATIVE).map(([tag, entry]) => [
      `native-${tag}`,
      {
        type: 'object',
        additionalProperties: false,
        required: ['element'],
        properties: {
          element: { const: tag },
          id: ref('id'),
          slot: ref('slot'),
          ...(Object.keys(entry.attributes).length
            ? {
                attributes: object(
                  Object.fromEntries(
                    Object.entries(entry.attributes).map(([name, type]) => [
                      name,
                      valueSchema(type),
                    ]),
                  ),
                ),
              }
            : {}),
          children: { type: 'array', items: ref('node') },
        },
      },
    ]),
  );
  schemas['composition.v1.json'] = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    ...id('composition.v1.json'),
    title: options.title ?? 'Composition',
    description:
      options.description ??
      'An interface described as data: published elements and native text elements, their attributes and properties, text, and events mapped to action names. Rendered by renderComposition() from @oddkin/components/composition with this catalog.',
    $comment:
      'Also enforced by validateComposition(), not expressible here: a slot must be published by the parent; text only where the parent has a default slot; list items only in lists; unique ids; model rules; at most 16 levels and 500 nodes by default.',
    type: 'object',
    additionalProperties: false,
    required: ['version', 'root'],
    properties: {
      $schema: { type: 'string' },
      version: { const: 1 },
      root: { type: 'array', items: { $ref: '#/$defs/node' } },
    },
    $defs: {
      node: {
        oneOf: [
          { type: 'string', description: 'Text, rendered as a text node.' },
          ...Object.keys(natives).map((name) => ({ $ref: `#/$defs/${name}` })),
          ...Object.keys(catalog).map((tag) => ({ $ref: `${tag}.v1.json` })),
        ],
      },
      id: {
        type: 'string',
        pattern: '^[A-Za-z][\\w-]*$',
        description: "The element's id, unique in the document.",
      },
      slot: { type: 'string', minLength: 1, description: 'A named slot of the parent element.' },
      action: {
        type: 'string',
        pattern: '^[a-z][a-zA-Z0-9-]*(?:\\.[a-zA-Z0-9-]+)*$',
        description: 'An action name the host handles, such as "settings.save"; never code.',
      },
      ...natives,
    },
  };
  return schemas;
}

/**
 * What `oddkin-analyze --composition` writes, by path below its output directory: the catalog as
 * `oddkin.composition.json` (`{ "version": 1, "catalog": … }`; its `catalog` is the option of
 * the same name of `validateComposition()` and `renderComposition()`), and the schemas in
 * `schemas/composition/`.
 */
export function compositionFiles(
  manifest: unknown,
  options: CatalogOptions & SchemaOptions = {},
): { files: Map<string, string>; diagnostics: AnalyzerDiagnostic[] } {
  const { catalog, diagnostics } = compositionCatalog(manifest, options);
  const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
  const files = new Map([['oddkin.composition.json', json({ version: 1, catalog })]]);
  for (const [file, schema] of Object.entries(compositionSchemas(catalog, manifest, options)))
    files.set(`schemas/composition/${file}`, json(schema));
  return { files, diagnostics };
}
