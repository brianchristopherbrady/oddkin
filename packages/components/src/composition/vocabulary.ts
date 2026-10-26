/**
 * The vocabulary of a composition: how a published attribute or property value is written, the
 * catalog entry of an element, and the native text elements a composition may use. DOM-free.
 * Contract: docs/architecture/data-composition.md §8.
 */
import { defineModel, m, type Model, type ModelDefinition, type Node } from '@oddkin/core/model';
import { NavigationItemModel } from '../models/navigation.js';

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

/** What a composition may write on one element; generated from the published metadata. */
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

/** Published models a property value may follow, by model name. */
export const MODELS: Readonly<Record<string, Model>> = {
  [NavigationItemModel.name]: NavigationItemModel,
};

const URL_TARGETS = ['_blank', '_self', '_parent', '_top'];
const PHRASING = ['span', 'strong', 'em', 'a'];

/** Native element: its attributes, whether it holds text, and which natives may be inside it. */
export interface NativeEntry {
  readonly attributes: Readonly<Record<string, ValueType>>;
  /** Text, the phrasing elements, and Oddkin elements are allowed inside. */
  readonly text: boolean;
  readonly children: readonly string[];
}

const phrasing: NativeEntry = { attributes: {}, text: true, children: PHRASING };

/** The native elements a composition may use: text structure, never forms, media, or scripts. */
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
    attributes: { href: 'url', target: { enum: URL_TARGETS }, rel: 'string' },
    text: true,
    children: PHRASING.filter((tag) => tag !== 'a'),
  },
  ul: { attributes: {}, text: false, children: ['li'] },
  ol: { attributes: {}, text: false, children: ['li'] },
  li: { attributes: {}, text: true, children: [...PHRASING, 'ul', 'ol', 'p'] },
};

/** The `@oddkin/core/model` schema node for a value type. */
export function valueNode(type: ValueType): Node {
  if (type === 'string') return m.string();
  if (type === 'number') return m.number();
  if (type === 'boolean') return m.boolean();
  if (type === 'url') return m.url();
  if (type === 'strings') return m.array(m.string());
  if ('enum' in type) return m.enum(type.enum as [string, ...string[]]);
  if ('texts' in type)
    return m.object(Object.fromEntries(type.texts.map((key) => [key, m.optional(m.string())])));
  const model = Object.hasOwn(MODELS, type.model) ? MODELS[type.model] : undefined;
  if (!model) throw new TypeError(`No published model "${type.model}".`);
  return model.schema;
}

const models = new Map<string, Model>();
// The untyped overload: a value node chosen at run time has no static type to infer.
const define = defineModel as unknown as (name: string, definition: ModelDefinition<Node>) => Model;

/** The model that validates one value of a type (a published model keeps its own rules). */
export function valueModel(type: ValueType): Model {
  if (typeof type === 'object' && 'model' in type) return MODELS[type.model] as Model;
  const key = JSON.stringify(type);
  let model = models.get(key);
  if (!model) {
    model = define('oddkin.composition.value', { version: 1, schema: valueNode(type) });
    models.set(key, model);
  }
  return model;
}
