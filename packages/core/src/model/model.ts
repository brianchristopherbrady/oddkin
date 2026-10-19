/**
 * Runtime validation, rules, and migrations for models. Validates **external** data;
 * TypeScript types do not. Diagnostics carry JSON-pointer paths and stable codes.
 */
import type { InferNode, Node, ObjectNode, RecursiveNode } from './nodes.js';

export interface ModelDiagnostic {
  readonly code: string;
  readonly severity: 'error' | 'warning';
  readonly path: string;
  readonly message: string;
  readonly suggestion?: string;
}

export interface ValidationResult<T> {
  readonly ok: boolean;
  /** The input, typed, when `ok`. Validation never copies or coerces data. */
  readonly value: T | undefined;
  readonly diagnostics: readonly ModelDiagnostic[];
}

/** A cross-cutting rule over the whole value (not expressible per node). */
export interface ModelRule {
  readonly kind: string;
  readonly description: string;
  check(value: unknown, report: (path: string, code: string, message: string) => void): void;
}

const SCRIPT_URL =
  /^[\u0000-\u0020]*(?:j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t|v\s*b\s*s\s*c\s*r\s*i\s*p\s*t)\s*:/i;
const ACTION_REF = /^[a-z][a-zA-Z0-9-]*(?:\.[a-zA-Z0-9-]+)*$/;

const escape = (segment: string | number) =>
  String(segment).replace(/~/g, '~0').replace(/\//g, '~1');
const describe = (value: unknown) =>
  value === null ? 'null' : Array.isArray(value) ? 'an array' : typeof value;
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Why `value` is not a JSON value within `depth` levels, or undefined when it is. */
function jsonProblem(value: unknown, depth: number): string | undefined {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number')
    return Number.isFinite(value)
      ? undefined
      : 'Expected a JSON value, received a non-finite number.';
  if (typeof value !== 'object') return `Expected a JSON value, received a ${typeof value}.`;
  if (depth <= 0) return 'JSON value is nested too deeply.';
  if (Array.isArray(value)) {
    for (const item of value) {
      const problem = jsonProblem(item, depth - 1);
      if (problem) return problem;
    }
    return;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null)
    return 'Expected a JSON value, received a non-plain object.';
  for (const item of Object.values(value)) {
    const problem = jsonProblem(item, depth - 1);
    if (problem) return problem;
  }
  return;
}

class Collector {
  readonly items: ModelDiagnostic[] = [];
  /** Nesting of recursive values entered so far, and the limit (`maxDepth`). */
  depth = 0;
  constructor(readonly maxDepth: number) {}
  error(code: string, path: string, message: string, suggestion?: string) {
    this.items.push(
      suggestion
        ? { code, severity: 'error', path, message, suggestion }
        : { code, severity: 'error', path, message },
    );
  }
  warn(code: string, path: string, message: string) {
    this.items.push({ code, severity: 'warning', path, message });
  }
}

function check(node: Node, value: unknown, path: string, out: Collector): void {
  const at = path || '/';
  switch (node.kind) {
    case 'string': {
      if (typeof value !== 'string')
        return out.error(
          'model.type.mismatch',
          at,
          `Expected a string, received ${describe(value)}.`,
        );
      if (node.format === 'label' && value.trim() === '')
        return out.error(
          'model.label.empty',
          at,
          'Labels must contain visible text.',
          'Provide a non-empty, user-visible label.',
        );
      if (node.format === 'id' && value === '')
        return out.error('model.required.missing', at, 'Identifiers must not be empty.');
      if (node.format === 'url' && SCRIPT_URL.test(value))
        return out.error(
          'model.url.unsafe',
          at,
          'Script URLs are not allowed.',
          'Use an http(s) URL, a relative reference, or an action.',
        );
      if (node.format === 'actionRef' && !ACTION_REF.test(value)) {
        return out.error(
          'model.ref.invalid',
          at,
          `${JSON.stringify(value)} is not an action reference.`,
          'Use a dotted name such as "project.create"; actions are names, never code.',
        );
      }
      if (node.minLength !== undefined && value.length < node.minLength)
        out.error('model.value.invalid', at, `Must be at least ${node.minLength} characters.`);
      if (node.maxLength !== undefined && value.length > node.maxLength)
        out.error('model.value.invalid', at, `Must be at most ${node.maxLength} characters.`);
      if (node.pattern !== undefined && !new RegExp(node.pattern, 'u').test(value))
        out.error('model.value.invalid', at, `Does not match ${node.pattern}.`);
      return;
    }
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value))
        return out.error(
          'model.type.mismatch',
          at,
          `Expected a finite number, received ${describe(value)}.`,
        );
      if (node.integer && !Number.isInteger(value))
        out.error('model.value.invalid', at, 'Must be an integer.');
      if (node.minimum !== undefined && value < node.minimum)
        out.error('model.value.invalid', at, `Must be at least ${node.minimum}.`);
      if (node.maximum !== undefined && value > node.maximum)
        out.error('model.value.invalid', at, `Must be at most ${node.maximum}.`);
      return;
    case 'boolean':
      if (typeof value !== 'boolean')
        out.error('model.type.mismatch', at, `Expected a boolean, received ${describe(value)}.`);
      return;
    case 'json': {
      const problem = jsonProblem(value, node.maxDepth ?? 32);
      if (problem) out.error('model.type.mismatch', at, problem);
      return;
    }
    case 'enum':
      if (!(node.values as readonly unknown[]).includes(value)) {
        out.error(
          'model.value.invalid',
          at,
          `${JSON.stringify(value)} is not allowed.`,
          `Use one of: ${node.values.map((v) => JSON.stringify(v)).join(', ')}.`,
        );
      }
      return;
    case 'optional':
      if (value !== undefined) check(node.inner, value, path, out);
      return;
    case 'array':
      if (!Array.isArray(value))
        return out.error(
          'model.type.mismatch',
          at,
          `Expected an array, received ${describe(value)}.`,
        );
      if (node.minItems !== undefined && value.length < node.minItems)
        out.error('model.value.invalid', at, `Needs at least ${node.minItems} items.`);
      if (node.maxItems !== undefined && value.length > node.maxItems)
        out.error('model.value.invalid', at, `Allows at most ${node.maxItems} items.`);
      value.forEach((item, i) => check(node.items, item, `${path}/${i}`, out));
      return;
    case 'object':
      return checkObject(node, value, path, out, undefined);
    case 'union': {
      if (!isPlainObject(value))
        return out.error(
          'model.type.mismatch',
          at,
          `Expected an object, received ${describe(value)}.`,
        );
      const tag = value[node.discriminator];
      const kinds = Object.keys(node.variants);
      if (tag === undefined) {
        return out.error(
          'model.required.missing',
          `${path}/${escape(node.discriminator)}`,
          `Missing "${node.discriminator}".`,
          `Use one of: ${kinds.join(', ')}.`,
        );
      }
      const variant =
        typeof tag === 'string' ? (node.variants as Record<string, ObjectNode>)[tag] : undefined;
      if (!variant || !Object.hasOwn(node.variants, tag as string)) {
        return out.error(
          'model.kind.unknown',
          `${path}/${escape(node.discriminator)}`,
          `Unknown ${node.discriminator} ${JSON.stringify(tag)}.`,
          `Use one of: ${kinds.join(', ')}.`,
        );
      }
      return checkObject(variant, value, path, out, node.discriminator);
    }
    case 'self': {
      // Each recursion is one nesting level: deep or cyclic data is reported, never followed
      // until the stack runs out.
      if (out.depth >= out.maxDepth)
        return out.error(
          'model.depth.exceeded',
          at,
          `Nested more than ${out.maxDepth} levels deep.`,
          'Flatten the data, or raise maxDepth in the model definition if this depth is intended.',
        );
      out.depth++;
      try {
        return check(node.target().inner, value, path, out);
      } finally {
        out.depth--;
      }
    }
    case 'recursive':
      return check(node.inner, value, path, out);
  }
}

function checkObject(
  node: ObjectNode,
  value: unknown,
  path: string,
  out: Collector,
  discriminator: string | undefined,
): void {
  if (!isPlainObject(value))
    return out.error(
      'model.type.mismatch',
      path || '/',
      `Expected an object, received ${describe(value)}.`,
    );
  const shape = node.shape as Record<string, Node>;
  for (const [key, child] of Object.entries(shape)) {
    const at = `${path}/${escape(key)}`;
    if (!Object.hasOwn(value, key) || value[key] === undefined) {
      if (child.kind !== 'optional')
        out.error('model.required.missing', at, `Missing required "${key}".`);
      continue;
    }
    check(child, value[key], at, out);
  }
  for (const key of Object.keys(value)) {
    if (key !== discriminator && !Object.hasOwn(shape, key))
      out.warn(
        'model.property.unknown',
        `${path}/${escape(key)}`,
        `"${key}" is not part of the model and is ignored.`,
      );
  }
}

// ---- Rules ----

/** Values of `property` must be unique across the whole value (any depth). */
export function uniqueIds(property = 'id'): ModelRule {
  const rule: ModelRule = {
    kind: 'uniqueIds',
    description: `uniqueIds(${property})`,
    check(value, report) {
      const seen = new Map<unknown, string>();
      const walk = (node: unknown, path: string) => {
        if (Array.isArray(node)) node.forEach((item, i) => walk(item, `${path}/${i}`));
        else if (isPlainObject(node)) {
          if (Object.hasOwn(node, property)) {
            const id = node[property];
            const first = seen.get(id);
            if (first !== undefined)
              report(
                `${path}/${escape(property)}`,
                'model.id.duplicate',
                `${JSON.stringify(id)} is already used at ${first}.`,
              );
            else seen.set(id, `${path}/${escape(property)}`);
          }
          for (const [key, child] of Object.entries(node)) walk(child, `${path}/${escape(key)}`);
        }
      };
      walk(value, '');
    },
  };
  return Object.freeze(rule);
}

// ---- Models ----

export type Migration = (data: unknown) => unknown;

export interface ModelDefinition<S extends Node> {
  /** Data format version; increment with a migration when the shape changes. */
  readonly version: number;
  readonly schema: S;
  readonly rules?: readonly ModelRule[];
  /** `migrations[n]` converts version n − 1 data to version n. */
  readonly migrations?: Readonly<Record<number, Migration>>;
  readonly description?: string;
  /**
   * Deepest nesting of recursive values `validate()` follows (default 32). Deeper data, including
   * cycles, is reported as `model.depth.exceeded` rather than exhausting the stack.
   */
  readonly maxDepth?: number;
}

/** `T` is the inferred value type, computed once where the model is defined. */
export interface Model<S extends Node = Node, T = unknown> {
  readonly name: string;
  readonly version: number;
  readonly schema: S;
  readonly rules: readonly ModelRule[];
  readonly description: string | undefined;
  validate(data: unknown): ValidationResult<T>;
  /** Migrate data written for `fromVersion`, then validate it. */
  migrate(data: unknown, fromVersion: number): ValidationResult<T>;
}

/** The model type for a concrete schema; deferred until S is known. */
export type ModelOf<S> = S extends Node ? Model<S, InferNode<S, S>> : never;

const MODEL_NAME = /^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)*$/;

/** Define a versioned model. Unbranded: names are chosen by the library defining it. */
export function defineModel<const S extends Node>(
  name: string,
  definition: ModelDefinition<S>,
): ModelOf<S>;
// The implementation signature is untyped on purpose: comparing it with the overload would
// expand InferNode over the whole Node union. The public overload above is fully typed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function defineModel(name: string, definition: ModelDefinition<Node>): any {
  if (!MODEL_NAME.test(name))
    throw new TypeError(
      `Model name "${name}" must be dotted lowercase segments, e.g. "acme.menu-item".`,
    );
  if (!Number.isInteger(definition.version) || definition.version < 1)
    throw new TypeError(`Model "${name}" version must be a positive integer.`);
  const rules = Object.freeze([...(definition.rules ?? [])]);
  const maxDepth = definition.maxDepth ?? 32;

  const validate = (data: unknown): ValidationResult<unknown> => {
    const out = new Collector(maxDepth);
    check(definition.schema, data, '', out);
    if (!out.items.some((d) => d.severity === 'error')) {
      for (const rule of rules)
        rule.check(data, (path, code, message) => out.error(code, path, message));
    }
    const ok = !out.items.some((d) => d.severity === 'error');
    return { ok, value: ok ? data : undefined, diagnostics: out.items };
  };

  return Object.freeze({
    name,
    version: definition.version,
    schema: definition.schema,
    rules,
    description: definition.description,
    validate,
    migrate(data: unknown, fromVersion: number) {
      const fail = (
        message: string,
        code = 'model.version.unsupported',
      ): ValidationResult<unknown> => ({
        ok: false,
        value: undefined,
        diagnostics: [{ code, severity: 'error', path: '', message }],
      });
      if (!Number.isInteger(fromVersion) || fromVersion < 0 || fromVersion > definition.version) {
        return fail(
          `Cannot migrate "${name}" data from version ${fromVersion}; the current version is ${definition.version}.`,
        );
      }
      let current = data;
      for (let version = fromVersion + 1; version <= definition.version; version++) {
        const step = definition.migrations?.[version];
        if (!step) return fail(`"${name}" has no migration to version ${version}.`);
        try {
          current = step(current);
        } catch (error) {
          return fail(
            `Migration of "${name}" to version ${version} failed: ${error instanceof Error ? error.message : String(error)}`,
            'model.migration.failed',
          );
        }
      }
      return validate(current);
    },
  });
}

/** @internal Used by the JSON Schema emitter. */
export type { RecursiveNode };
