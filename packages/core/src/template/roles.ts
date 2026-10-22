/**
 * `@oddkin/core/template/roles` — composite templates that render the product's children
 * (ADR 0043). A composite lists its children as `dependencies`; its template reads them back with
 * `rolesOf(host)` and writes them in tag position with `composite`:
 *
 *   composite`<${roles.input} .value=${v}></${roles.input}>`
 *
 * The validated names are written into the template strings, cached per (call site, names), so
 * core's parser and prepared-template cache are unchanged and only composites pay for this module.
 */
import { DEV } from '../internal/dev.js';
import { OddkinError } from '../diagnostics/index.js';
import { definitionFor } from '../internal/definitions.js';
import type { ElementDefinition } from '../element/definition.js';
import type { OddkinElement } from '../element/element.js';
import { html, type TemplateResult } from './result.js';

const TAG_REF: unique symbol = Symbol.for('oddkin.tagRef') as never;

/** A child element's name, usable only in tag position of a `composite` template. */
export interface TagRef<E extends Element = Element> {
  readonly [TAG_REF]: string;
  /** Type only: the element the reference names. */
  readonly element?: E;
}

/** One tag reference per role a definition declares in `dependencies`. */
export type Roles<R extends string = string> = { readonly [K in R]: TagRef };

// The custom element name grammar without its non-ASCII ranges: no markup character can pass.
const NAME = /^[a-z][a-z0-9._]*-[a-z0-9._-]*$/;

/** A tag reference to `definition`'s element name. */
export function tag<E extends OddkinElement>(definition: ElementDefinition<E>): TagRef<E> {
  const name = definition.name;
  if (!NAME.test(name))
    throw new OddkinError(
      'template.tagRef.invalid',
      DEV ? `"${name}" is not a custom element name that a template can write.` : '',
    );
  return Object.freeze({ [TAG_REF]: name }) as TagRef<E>;
}

const isTagRef = (value: unknown): value is TagRef =>
  typeof value === 'object' && value !== null && TAG_REF in value;

const rolesByDefinition = new WeakMap<object, Roles>();

/**
 * The roles of `host`'s registered definition: one tag reference per entry of its
 * `dependencies`, so recomposing the composite with another family changes its children.
 */
export function rolesOf<R extends string = string>(host: Element): Roles<R> {
  const definition = definitionFor(host.constructor) as ElementDefinition | undefined;
  if (!definition)
    throw new OddkinError(
      'definition.role.unbound',
      DEV
        ? `<${host.localName}> has no registered definition, so its template has no roles. Register it with define(definition).`
        : '',
    );
  let roles = rolesByDefinition.get(definition);
  if (!roles) {
    const refs: Record<string, TagRef> = {};
    for (const [role, dependency] of Object.entries(definition.dependencies ?? {}))
      refs[role] = tag(dependency);
    Object.freeze(refs);
    roles = DEV
      ? new Proxy(refs, {
          get(target, key, receiver) {
            if (typeof key === 'string' && !(key in target))
              throw new OddkinError(
                'definition.role.missing',
                `<${definition.name}>'s template reads the role "${key}", which its definition's dependencies do not declare (${Object.keys(target).join(', ') || 'none'}).`,
              );
            return Reflect.get(target, key, receiver);
          },
        })
      : refs;
    rolesByDefinition.set(definition, roles);
  }
  return roles as Roles<R>;
}

const rewrites = new WeakMap<TemplateStringsArray, Map<string, TemplateStringsArray>>();

/**
 * `html` that also accepts tag references in tag position (`<${ref}` and `</${ref}`). Every
 * other interpolation is an ordinary binding.
 */
export function composite(strings: TemplateStringsArray, ...values: unknown[]): TemplateResult {
  const names: string[] = [];
  const kept: unknown[] = [];
  const inTag: boolean[] = [];
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    const tagPosition = /<\/?$/.test(strings[i]!);
    if (tagPosition !== isTagRef(value))
      throw new OddkinError(
        'template.tagRef.position',
        DEV
          ? tagPosition
            ? `Value ${i} is in tag position but is not a tag reference; use rolesOf(host) or tag(definition).`
            : `A tag reference is accepted only in tag position (value ${i}).`
          : '',
      );
    inTag.push(tagPosition);
    if (tagPosition) names.push((value as TagRef)[TAG_REF]);
    else kept.push(value);
  }
  if (!names.length) return html(strings, ...values);
  const key = names.join(' ');
  let byNames = rewrites.get(strings);
  if (!byNames) rewrites.set(strings, (byNames = new Map()));
  let rewritten = byNames.get(key);
  if (!rewritten) {
    const out = [strings[0]!];
    let n = 0;
    for (let i = 0; i < inTag.length; i++) {
      if (inTag[i]) out[out.length - 1] += names[n++]! + strings[i + 1]!;
      else out.push(strings[i + 1]!);
    }
    rewritten = Object.freeze(Object.assign(out, { raw: Object.freeze([...out]) })) as never;
    byNames.set(key, rewritten!);
  }
  return html(rewritten!, ...kept);
}
