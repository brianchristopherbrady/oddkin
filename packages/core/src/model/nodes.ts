/**
 * Model schema nodes and the `m` builder. One definition yields TypeScript types
 * (`Infer`), runtime validation of external data, JSON Schema (`./model/schema`), and
 * metadata. Unbranded and DOM-free. Contract: docs/architecture/data-composition.md §5.
 */

interface Base<K extends string> {
  readonly kind: K;
  readonly description?: string;
}

export interface StringNode extends Base<'string'> {
  readonly format?: 'id' | 'label' | 'url' | 'actionRef';
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
}
export interface NumberNode extends Base<'number'> {
  readonly integer?: boolean;
  readonly minimum?: number;
  readonly maximum?: number;
}
export type BooleanNode = Base<'boolean'>;
export interface EnumNode<V extends string | number = string | number> extends Base<'enum'> {
  readonly values: readonly V[];
}
export interface OptionalNode<S extends Node = Node> extends Base<'optional'> {
  readonly inner: S;
}
export interface ArrayNode<S extends Node = Node> extends Base<'array'> {
  readonly items: S;
  readonly minItems?: number;
  readonly maxItems?: number;
}
export type Shape = Readonly<Record<string, Node>>;
export interface ObjectNode<S extends Shape = Shape> extends Base<'object'> {
  readonly shape: S;
}
export interface UnionNode<
  D extends string = string,
  V extends Readonly<Record<string, ObjectNode>> = Readonly<Record<string, ObjectNode>>,
> extends Base<'union'> {
  readonly discriminator: D;
  readonly variants: V;
}
/** Placeholder for the enclosing recursive schema inside `m.recursive`. */
export interface SelfNode extends Base<'self'> {
  readonly target: () => RecursiveNode;
}
export interface RecursiveNode<S extends Node = Node> extends Base<'recursive'> {
  readonly inner: S;
  readonly name?: string;
}
/** Any JSON value (null, boolean, finite number, string, array, plain object), depth-bounded. */
export interface JsonNode extends Base<'json'> {
  readonly maxDepth?: number;
}

/** A value JSON can represent without loss. */
export type JsonValue =
  null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export type Node =
  | StringNode
  | NumberNode
  | BooleanNode
  | EnumNode
  | OptionalNode<any>
  | ArrayNode<any>
  | ObjectNode<any>
  | UnionNode<any, any>
  | SelfNode
  | RecursiveNode<any>
  | JsonNode;

// ---- Type inference ----
// `R` is the root of an enclosing recursive schema; `SelfNode` expands to it lazily.

type OptionalKeys<S extends Shape> = {
  [K in keyof S]: S[K] extends OptionalNode<any> ? K : never;
}[keyof S];
type RequiredKeys<S extends Shape> = Exclude<keyof S, OptionalKeys<S>>;

type InferShape<S extends Shape, R> = {
  -readonly [K in RequiredKeys<S>]: InferNode<S[K], R>;
} & {
  -readonly [K in OptionalKeys<S>]?: S[K] extends OptionalNode<infer I>
    ? InferNode<I, R> | undefined
    : never;
};

type InferUnion<D extends string, V extends Readonly<Record<string, ObjectNode>>, R> = {
  [K in keyof V & string]: { -readonly [P in D]: K } & (V[K] extends ObjectNode<infer S>
    ? InferShape<S, R>
    : never);
}[keyof V & string];

type Flatten<T> = T extends object ? { [K in keyof T]: T[K] } : T;

export type InferNode<N, R> = N extends JsonNode
  ? JsonValue
  : N extends SelfNode
    ? InferNode<R, R>
    : N extends RecursiveNode<infer I>
      ? InferNode<I, I>
      : N extends StringNode
        ? string
        : N extends NumberNode
          ? number
          : N extends BooleanNode
            ? boolean
            : N extends EnumNode<infer V>
              ? V
              : N extends OptionalNode<infer I>
                ? InferNode<I, R> | undefined
                : N extends ArrayNode<infer I>
                  ? InferNode<I, R>[]
                  : N extends ObjectNode<infer S>
                    ? Flatten<InferShape<S, R>>
                    : N extends UnionNode<infer D, infer V>
                      ? Flatten<InferUnion<D, V, R>>
                      : unknown;

/** The TypeScript type a schema node (or a defined model) describes. */
export type Infer<T> = T extends { readonly schema: infer S } ? InferNode<S, S> : InferNode<T, T>;

// ---- Builder ----

const freeze = <T extends object>(node: T): T => Object.freeze(node);
const extra = (options: object | undefined) =>
  options ? Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined)) : {};

export const m = {
  string: (options?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    description?: string;
  }): StringNode => freeze({ kind: 'string', ...extra(options) }),
  /** Non-empty identifier string; used by `m.uniqueIds`. */
  id: (description?: string): StringNode =>
    freeze({ kind: 'string', format: 'id', minLength: 1, ...extra({ description }) }),
  /** Non-blank user-visible text (accessible names). */
  label: (description?: string): StringNode =>
    freeze({ kind: 'string', format: 'label', minLength: 1, ...extra({ description }) }),
  /** A URL or relative reference; script URLs are rejected. */
  url: (description?: string): StringNode =>
    freeze({ kind: 'string', format: 'url', ...extra({ description }) }),
  /** A named action reference such as `project.create`, never code. */
  actionRef: (description?: string): StringNode =>
    freeze({ kind: 'string', format: 'actionRef', ...extra({ description }) }),
  number: (options?: {
    integer?: boolean;
    minimum?: number;
    maximum?: number;
    description?: string;
  }): NumberNode => freeze({ kind: 'number', ...extra(options) }),
  boolean: (description?: string): BooleanNode =>
    freeze({ kind: 'boolean', ...extra({ description }) }),
  enum: <const V extends readonly [string | number, ...(string | number)[]]>(
    values: V,
    description?: string,
  ): EnumNode<V[number]> =>
    freeze({
      kind: 'enum',
      values: Object.freeze([...values]),
      ...extra({ description }),
    }) as EnumNode<V[number]>,
  optional: <S extends Node>(inner: S): OptionalNode<S> =>
    freeze({ kind: 'optional', inner }) as OptionalNode<S>,
  array: <S extends Node>(
    items: S,
    options?: { minItems?: number; maxItems?: number; description?: string },
  ): ArrayNode<S> => freeze({ kind: 'array', items, ...extra(options) }) as ArrayNode<S>,
  object: <const S extends Shape>(shape: S, description?: string): ObjectNode<S> =>
    freeze({
      kind: 'object',
      shape: Object.freeze({ ...shape }),
      ...extra({ description }),
    }) as ObjectNode<S>,
  /** Discriminated union: `value[discriminator]` selects the variant. */
  union: <const D extends string, const V extends Readonly<Record<string, ObjectNode>>>(
    discriminator: D,
    variants: V,
    description?: string,
  ): UnionNode<D, V> =>
    freeze({
      kind: 'union',
      discriminator,
      variants: Object.freeze({ ...variants }),
      ...extra({ description }),
    }) as UnionNode<D, V>,
  /** Any JSON value, such as an opaque payload; nesting deeper than `maxDepth` (32) is rejected. */
  json: (options?: { description?: string; maxDepth?: number }): JsonNode =>
    freeze({ kind: 'json', ...extra(options) }),
  /** A self-referential schema; `self` stands for the whole recursive schema. */
  recursive: <S extends Node>(build: (self: SelfNode) => S, name?: string): RecursiveNode<S> => {
    let node: RecursiveNode<S> | undefined;
    const self: SelfNode = freeze({ kind: 'self', target: () => node as RecursiveNode });
    node = freeze({
      kind: 'recursive',
      inner: build(self),
      ...extra({ name }),
    }) as RecursiveNode<S>;
    return node;
  },
};
