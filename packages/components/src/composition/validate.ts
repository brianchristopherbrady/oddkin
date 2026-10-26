/**
 * `validateComposition()`: checks a composition document against the published catalog before
 * anything is rendered. DOM-free. Contract: docs/architecture/data-composition.md §8.
 */
import type { JsonValue, ModelDiagnostic } from '@oddkin/core/model';
import { CATALOG } from './catalog.js';
import {
  NATIVE,
  valueModel,
  type ElementEntry,
  type NativeEntry,
  type ValueType,
} from './vocabulary.js';

export const COMPOSITION_VERSION = 1;

/** One element of a composition; text is a plain string. */
export interface CompositionElement {
  readonly element: string;
  /** The element's `id`, unique in the document. */
  readonly id?: string;
  /** A published slot of the parent element; the default slot when absent. */
  readonly slot?: string;
  readonly attributes?: Readonly<Record<string, JsonValue>>;
  readonly properties?: Readonly<Record<string, JsonValue>>;
  readonly children?: readonly CompositionNode[];
  /** Published event names mapped to action names the host handles. */
  readonly actions?: Readonly<Record<string, string>>;
}

export type CompositionNode = string | CompositionElement;

export interface CompositionDocument {
  readonly $schema?: string;
  readonly version: typeof COMPOSITION_VERSION;
  readonly root: readonly CompositionNode[];
}

export type CompositionDiagnostic = ModelDiagnostic;

export interface CompositionLimits {
  /** Deepest element nesting (default 16). */
  readonly depth?: number;
  /** Most nodes, text included (default 500). */
  readonly nodes?: number;
}

export interface CompositionValidation {
  readonly ok: boolean;
  readonly diagnostics: readonly CompositionDiagnostic[];
}

const ID = /^[A-Za-z][\w-]*$/;
const ACTION = /^[a-z][a-zA-Z0-9-]*(?:\.[a-zA-Z0-9-]+)*$/;
const DOCUMENT_KEYS = ['$schema', 'version', 'root'];
const NODE_KEYS = ['element', 'id', 'slot', 'attributes', 'properties', 'children', 'actions'];

const escape = (segment: string | number) =>
  String(segment).replace(/~/g, '~0').replace(/\//g, '~1');
const isPlain = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};
const list = (names: Iterable<string>) =>
  [...names].map((name) => JSON.stringify(name)).join(', ') || 'none';
const camel = (name: string) => name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/** Where a node sits: what its parent accepts. */
interface Context {
  readonly slots: readonly string[] | undefined;
  readonly text: boolean;
  /** Natives allowed here. */
  readonly natives: readonly string[];
  /** Oddkin elements are allowed here. */
  readonly elements: boolean;
}

// List items belong in lists only.
const FLOW = Object.keys(NATIVE).filter((tag) => tag !== 'li');
const ROOT: Context = { slots: undefined, text: true, natives: FLOW, elements: true };

/** Check a composition document; `ok` is false when any diagnostic is an error. */
export function validateComposition(
  document: unknown,
  options: { readonly limits?: CompositionLimits } = {},
): CompositionValidation {
  const out: CompositionDiagnostic[] = [];
  const error = (code: string, path: string, message: string, suggestion?: string): void => {
    out.push(
      suggestion
        ? { code, severity: 'error', path: path || '/', message, suggestion }
        : { code, severity: 'error', path: path || '/', message },
    );
  };
  const maxDepth = options.limits?.depth ?? 16;
  const maxNodes = options.limits?.nodes ?? 500;
  const ids = new Map<string, string>();
  let count = 0;

  const unknownKeys = (value: Record<string, unknown>, allowed: string[], path: string) => {
    for (const key of Object.keys(value))
      if (!allowed.includes(key))
        error(
          'composition.key.unknown',
          `${path}/${escape(key)}`,
          `"${key}" is not part of a composition.`,
          `Use ${list(allowed)}.`,
        );
  };

  const checkValue = (type: ValueType, value: unknown, path: string) => {
    for (const d of valueModel(type).validate(value).diagnostics)
      out.push({ ...d, path: d.path === '/' ? path : `${path}${d.path}` });
  };

  const checkAttributes = (
    value: unknown,
    path: string,
    tag: string,
    entry: ElementEntry | NativeEntry,
  ) => {
    if (!isPlain(value))
      return error('composition.node.invalid', path, 'Expected an object of attribute values.');
    for (const [name, attribute] of Object.entries(value)) {
      const at = `${path}/${escape(name)}`;
      if (/^on/i.test(name) || name.toLowerCase() === 'style') {
        error(
          'composition.value.executable',
          at,
          `"${name}" would carry code or raw styles; a composition never does.`,
          'Map an event to an action name under "actions"; style with tokens, never inline CSS.',
        );
      } else if (Object.hasOwn(entry.attributes, name)) {
        checkValue(entry.attributes[name] as ValueType, attribute, at);
      } else if ('properties' in entry && Object.hasOwn(entry.properties, name)) {
        error(
          'composition.attribute.propertyOnly',
          at,
          `${tag} has no "${name}" attribute; "${name}" is a property.`,
          `Write it under "properties".`,
        );
      } else {
        error(
          'composition.attribute.unknown',
          at,
          `${tag} has no "${name}" attribute.`,
          `Use ${list(Object.keys(entry.attributes))}.`,
        );
      }
    }
  };

  const checkProperties = (value: unknown, path: string, tag: string, entry: ElementEntry) => {
    if (!isPlain(value))
      return error('composition.node.invalid', path, 'Expected an object of property values.');
    for (const [name, property] of Object.entries(value)) {
      const at = `${path}/${escape(name)}`;
      if (Object.hasOwn(entry.properties, name)) {
        checkValue(entry.properties[name] as ValueType, property, at);
      } else if (entry.fixed.includes(name)) {
        error(
          'composition.property.notPortable',
          at,
          `${tag}.${name} cannot be written in a composition: it holds code, an element, or a read-only value.`,
          'Set it from the host application after rendering.',
        );
      } else {
        const attribute = Object.keys(entry.attributes).find(
          (a) => camel(a).toLowerCase() === name.toLowerCase(),
        );
        if (attribute)
          error(
            'composition.property.useAttribute',
            at,
            `${tag}.${name} is written as the "${attribute}" attribute.`,
            `Write it under "attributes" as "${attribute}".`,
          );
        else
          error(
            'composition.property.unknown',
            at,
            `${tag} has no writable "${name}" property.`,
            `Use ${list(Object.keys(entry.properties))}.`,
          );
      }
    }
  };

  const checkActions = (value: unknown, path: string, tag: string, entry: ElementEntry) => {
    if (!isPlain(value))
      return error('composition.node.invalid', path, 'Expected an object of action names.');
    for (const [event, action] of Object.entries(value)) {
      const at = `${path}/${escape(event)}`;
      if (!entry.events.includes(event))
        error(
          'composition.action.unknown',
          at,
          `${tag} dispatches no "${event}" event.`,
          `Use ${list(entry.events)}.`,
        );
      else if (typeof action !== 'string' || !ACTION.test(action))
        error(
          'composition.action.invalid',
          at,
          `${JSON.stringify(action)} is not an action name.`,
          'Use a dotted name such as "settings.save"; actions are names the host handles, never code.',
        );
    }
  };

  const checkNode = (node: unknown, path: string, depth: number, context: Context): void => {
    if (++count > maxNodes) {
      if (count === maxNodes + 1)
        error(
          'composition.size.exceeded',
          path,
          `More than ${maxNodes} nodes.`,
          'Split the interface, or raise the node limit if this size is intended.',
        );
      return;
    }
    if (typeof node === 'string') {
      if (!context.text) error('composition.text.unsupported', path, 'Text is not allowed here.');
      return;
    }
    if (!isPlain(node))
      return error(
        'composition.node.invalid',
        path,
        'Expected text or an element object ({ "element": … }).',
      );
    unknownKeys(node, NODE_KEYS, path);
    const tag = node['element'];
    if (typeof tag !== 'string')
      return error('composition.required.missing', `${path}/element`, 'Missing "element".');
    const entry = Object.hasOwn(CATALOG, tag) ? CATALOG[tag] : undefined;
    const native = Object.hasOwn(NATIVE, tag) ? NATIVE[tag] : undefined;
    if (!entry && !native)
      return error(
        'composition.element.unknown',
        `${path}/element`,
        `"${tag}" is not a published element.`,
        tag.startsWith('odd-')
          ? 'Use an element from @oddkin/components/oddkin.metadata.json.'
          : `Use an odd-* element or ${list(Object.keys(NATIVE))}.`,
      );
    if ((native && !context.natives.includes(tag)) || (entry && !context.elements))
      error(
        'composition.element.misplaced',
        `${path}/element`,
        `"${tag}" is not allowed here.`,
        `Use ${list(context.natives)}${context.elements ? ', text, or an odd-* element' : ''}.`,
      );

    const slot = node['slot'];
    if (slot !== undefined) {
      if (typeof slot !== 'string' || !context.slots?.includes(slot) || slot === '')
        error(
          'composition.slot.unknown',
          `${path}/slot`,
          `${JSON.stringify(slot)} is not a slot here.`,
          context.slots?.some(Boolean)
            ? `Use ${list(context.slots.filter(Boolean))}, or leave "slot" out for the default slot.`
            : 'Leave "slot" out: the parent has no named slots.',
        );
    } else if (context.slots && !context.slots.includes('')) {
      error(
        'composition.slot.missing',
        path,
        'The parent has no default slot.',
        `Name one of its slots: ${list(context.slots)}.`,
      );
    }

    const id = node['id'];
    if (id !== undefined) {
      if (typeof id !== 'string' || !ID.test(id))
        error(
          'composition.id.invalid',
          `${path}/id`,
          `${JSON.stringify(id)} is not an id.`,
          'Start with a letter; use letters, digits, "-", and "_".',
        );
      else if (ids.has(id))
        error(
          'composition.id.duplicate',
          `${path}/id`,
          `"${id}" is already used at ${ids.get(id)}.`,
        );
      else ids.set(id, `${path}/id`);
    }

    const definition = (entry ?? native) as ElementEntry | NativeEntry;
    if (node['attributes'] !== undefined)
      checkAttributes(node['attributes'], `${path}/attributes`, tag, definition);
    if (node['properties'] !== undefined) {
      if (entry) checkProperties(node['properties'], `${path}/properties`, tag, entry);
      else
        error('composition.property.unknown', `${path}/properties`, `${tag} takes no properties.`);
    }
    if (node['actions'] !== undefined) {
      if (entry) checkActions(node['actions'], `${path}/actions`, tag, entry);
      else error('composition.action.unknown', `${path}/actions`, `${tag} dispatches no events.`);
    }

    const children = node['children'];
    if (children === undefined) return;
    if (!Array.isArray(children))
      return error('composition.node.invalid', `${path}/children`, 'Expected an array of nodes.');
    if (entry && entry.slots.length === 0)
      return error(
        'composition.children.unsupported',
        `${path}/children`,
        `${tag} has no slots; its content comes from attributes and properties.`,
      );
    if (depth + 1 > maxDepth)
      return error(
        'composition.depth.exceeded',
        `${path}/children`,
        `Nested more than ${maxDepth} elements deep.`,
        'Flatten the interface, or raise the depth limit if this nesting is intended.',
      );
    const inner: Context = entry
      ? { slots: entry.slots, text: entry.slots.includes(''), natives: FLOW, elements: true }
      : { slots: undefined, text: native!.text, natives: native!.children, elements: native!.text };
    children.forEach((child, i) => checkNode(child, `${path}/children/${i}`, depth + 1, inner));
  };

  if (!isPlain(document)) {
    error('composition.node.invalid', '', 'Expected a composition document object.');
    return { ok: false, diagnostics: out };
  }
  unknownKeys(document, DOCUMENT_KEYS, '');
  if (document['version'] !== COMPOSITION_VERSION)
    error(
      'composition.version.unsupported',
      '/version',
      `Version ${JSON.stringify(document['version'])} is not supported.`,
      `Write "version": ${COMPOSITION_VERSION}.`,
    );
  const root = document['root'];
  if (!Array.isArray(root))
    error('composition.node.invalid', '/root', 'Expected an array of nodes.');
  else root.forEach((node, i) => checkNode(node, `/root/${i}`, 1, ROOT));
  return { ok: !out.some((d) => d.severity === 'error'), diagnostics: out };
}
