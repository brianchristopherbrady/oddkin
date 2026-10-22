/**
 * Public property definitions for `OddkinElement.with()`. One definition supplies the
 * instance type, attribute conversion, opt-in reflection, and runtime metadata.
 * Contract: docs/architecture/core-contracts.md §2.
 */

export type Conversion<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: string };

export type PropKind = 'string' | 'number' | 'boolean' | 'enum' | 'object' | 'array' | 'custom';

export interface PropDefinition<T> {
  readonly kind: PropKind;
  /** Attribute name; `undefined` derives kebab-case from the property name; `false` is property-only. */
  readonly attribute: string | false | undefined;
  readonly reflect: boolean;
  readonly description: string | undefined;
  /** Allowed values for `enum` properties. */
  readonly values: readonly string[] | undefined;
  /** Default for metadata; `undefined` for factory defaults. */
  readonly defaultValue: T | undefined;
  /** A fresh default per instance (object and array defaults are never shared). */
  initial(): T;
  coerce(value: unknown): Conversion<T>;
  fromAttribute(value: string | null): Conversion<T>;
  toAttribute(value: T): string | null;
}

interface Common {
  /** Attribute name, or `false` for a property-only API. Defaults to kebab-case. */
  readonly attribute?: string | false;
  /** Write the property back to its attribute on commit. Opt-in. */
  readonly reflect?: boolean;
  readonly description?: string;
}

const ok = <T>(value: T): Conversion<T> => ({ ok: true, value });
const fail = <T>(reason: string): Conversion<T> => ({ ok: false, reason });

function base<T>(
  kind: PropKind,
  options: Common | undefined,
  rest: Pick<PropDefinition<T>, 'initial' | 'coerce' | 'fromAttribute' | 'toAttribute'> &
    Partial<Pick<PropDefinition<T>, 'values' | 'defaultValue'>>,
): PropDefinition<T> {
  return {
    kind,
    attribute: options?.attribute,
    reflect: options?.reflect ?? false,
    description: options?.description,
    values: rest.values,
    defaultValue: rest.defaultValue,
    initial: rest.initial,
    coerce: rest.coerce,
    fromAttribute: rest.fromAttribute,
    toAttribute: rest.toAttribute,
  };
}

function stringProp(options: Common & { readonly default: string }): PropDefinition<string>;
function stringProp(options?: Common): PropDefinition<string | undefined>;
function stringProp(
  options?: Common & { readonly default?: string },
): PropDefinition<string | undefined> {
  const fallback = options?.default;
  return base<string | undefined>('string', options, {
    defaultValue: fallback,
    initial: () => fallback,
    coerce: (v) =>
      typeof v === 'string' || (v === undefined && fallback === undefined)
        ? ok(v)
        : fail(`expected a string, received ${describe(v)}`),
    fromAttribute: (v) => ok(v ?? fallback),
    toAttribute: (v) => v ?? null,
  });
}

function numberProp(options: Common & { readonly default: number }): PropDefinition<number>;
function numberProp(options?: Common): PropDefinition<number | undefined>;
function numberProp(
  options?: Common & { readonly default?: number },
): PropDefinition<number | undefined> {
  const fallback = options?.default;
  return base<number | undefined>('number', options, {
    defaultValue: fallback,
    initial: () => fallback,
    coerce: (v) =>
      (typeof v === 'number' && !Number.isNaN(v)) || (v === undefined && fallback === undefined)
        ? ok(v)
        : fail(`expected a number, received ${describe(v)}`),
    fromAttribute: (v) => {
      if (v === null) return ok(fallback);
      const n = v.trim() === '' ? Number.NaN : Number(v);
      return Number.isNaN(n) ? fail(`"${v}" is not a number`) : ok(n);
    },
    toAttribute: (v) => (v === undefined ? null : String(v)),
  });
}

function booleanProp(options?: Common): PropDefinition<boolean> {
  return base<boolean>('boolean', options, {
    defaultValue: false,
    initial: () => false,
    coerce: (v) =>
      typeof v === 'boolean' ? ok(v) : fail(`expected a boolean, received ${describe(v)}`),
    fromAttribute: (v) => ok(v !== null),
    toAttribute: (v) => (v ? '' : null),
  });
}

function enumProp<const V extends readonly [string, ...string[]]>(
  values: V,
  options: Common & {
    readonly default: V[number];
    /** The value of the bare attribute (`<x announce>`), as HTML's enumerated attributes have. */
    readonly empty?: V[number];
  },
): PropDefinition<V[number]> {
  const allowed = new Set<string>(values);
  const fallback = options.default;
  const empty = options.empty;
  const check = (v: unknown): Conversion<V[number]> =>
    typeof v === 'string' && allowed.has(v)
      ? ok(v as V[number])
      : fail(`expected one of ${values.map((x) => `"${x}"`).join(', ')}, received ${describe(v)}`);
  return base<V[number]>('enum', options, {
    values,
    defaultValue: fallback,
    initial: () => fallback,
    coerce: check,
    fromAttribute: (v) =>
      v === null ? ok(fallback) : v === '' && empty !== undefined ? ok(empty) : check(v),
    toAttribute: (v) => v,
  });
}

interface PropertyOnly {
  readonly description?: string;
}

const noAttribute = <T>(): Conversion<T> => fail('this property has no attribute');

function objectProp<T extends object>(
  options: PropertyOnly & { readonly default: () => T },
): PropDefinition<T>;
function objectProp<T extends object>(options?: PropertyOnly): PropDefinition<T | undefined>;
function objectProp<T extends object>(
  options?: PropertyOnly & { readonly default?: () => T },
): PropDefinition<T | undefined> {
  const factory = options?.default;
  return base<T | undefined>(
    'object',
    { ...options, attribute: false },
    {
      initial: () => factory?.(),
      coerce: (v) =>
        (typeof v === 'object' && v !== null) || (v === undefined && !factory)
          ? ok(v as T | undefined)
          : fail(`expected an object, received ${describe(v)}`),
      fromAttribute: noAttribute,
      toAttribute: () => null,
    },
  );
}

function arrayProp<T>(
  options?: PropertyOnly & { readonly default?: () => T[] },
): PropDefinition<T[]> {
  const factory = options?.default ?? (() => []);
  return base<T[]>(
    'array',
    { ...options, attribute: false },
    {
      initial: factory,
      coerce: (v) =>
        Array.isArray(v) ? ok(v as T[]) : fail(`expected an array, received ${describe(v)}`),
      fromAttribute: noAttribute,
      toAttribute: () => null,
    },
  );
}

interface CustomOptions<T> extends Common {
  readonly default: () => T;
  /** Validate and normalize property assignments. Return `{ ok: false, reason }` to reject. */
  readonly coerce?: (value: unknown) => Conversion<T>;
  /** Parse an attribute. Without it the property has no attribute. */
  readonly fromAttribute?: (value: string | null) => Conversion<T>;
  readonly toAttribute?: (value: T) => string | null;
}

function customProp<T>(options: CustomOptions<T>): PropDefinition<T> {
  const hasAttribute = !!options.fromAttribute;
  return base<T>('custom', hasAttribute ? options : { ...options, attribute: false }, {
    initial: options.default,
    coerce: options.coerce ?? ((v) => ok(v as T)),
    fromAttribute: options.fromAttribute ?? noAttribute,
    toAttribute: options.toAttribute ?? (() => null),
  });
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  if (typeof value === 'string')
    return `the string "${value.length > 40 ? `${value.slice(0, 40)}…` : value}"`;
  return typeof value === 'object' ? 'an object' : `${typeof value} ${String(value)}`;
}

/**
 * Property definition helpers. Arrays and objects travel through properties only;
 * booleans use attribute presence; reflection is opt-in.
 */
export const prop = {
  string: stringProp,
  number: numberProp,
  boolean: booleanProp,
  enum: enumProp,
  object: objectProp,
  array: arrayProp,
  custom: customProp,
};

export type PropDefinitions = Readonly<Record<string, PropDefinition<any>>>;

/** Instance property types inferred from definitions. */
export type PropValues<D extends PropDefinitions> = {
  -readonly [K in keyof D]: D[K] extends PropDefinition<infer T> ? T : never;
};

/** kebab-case attribute name for a property name. */
export function attributeNameFor(name: string): string {
  return name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}
