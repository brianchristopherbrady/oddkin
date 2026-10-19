/**
 * Candidate 1 — element-reference parts, prototyped without a core parser change: a template tag
 * that accepts `tag(definition)` references in tag position (`<${t.input} …></${t.input}>`),
 * inlines their validated names, and hands the result to core's `html`.
 *
 * Core caches prepared templates by the identity of the strings array, so the rewritten strings
 * are cached per (call site, resolved names): a re-render reuses the prepared template and its
 * DOM, and each family gets its own prepared template.
 */
import type { ElementDefinition, OddkinElement } from '@oddkin/core/element';
import { OddkinError } from '@oddkin/core/diagnostics';
import { html, type TemplateResult } from '@oddkin/core/template';

const TAG_REF: unique symbol = Symbol('oddkin.tagRef');

/** A role's element name, usable only in tag position. */
export interface TagRef<E extends Element = Element> {
  readonly [TAG_REF]: string;
  /** Type-only: the element the reference names. */
  readonly element?: E;
}

// The custom element name grammar without the non-ASCII ranges: no markup characters can pass.
const NAME = /^[a-z][a-z0-9._]*-[a-z0-9._-]*$/;

export function tag<E extends OddkinElement>(definition: ElementDefinition<E>): TagRef<E> {
  if (!NAME.test(definition.name))
    throw new OddkinError(
      'composite.tag.invalid',
      `"${definition.name}" is not a custom element name.`,
    );
  return { [TAG_REF]: definition.name };
}

const isTagRef = (value: unknown): value is TagRef =>
  typeof value === 'object' && value !== null && TAG_REF in value;

const cache = new WeakMap<TemplateStringsArray, Map<string, TemplateStringsArray>>();

export function composite(strings: TemplateStringsArray, ...values: unknown[]): TemplateResult {
  const names: string[] = [];
  const kept: unknown[] = [];
  const positions: boolean[] = [];
  values.forEach((value, i) => {
    const inTag = /<\/?$/.test(strings[i] ?? '');
    if (inTag !== isTagRef(value))
      throw new OddkinError(
        'composite.tag.position',
        inTag
          ? `Value ${i} is in tag position but is not a tag() reference.`
          : `tag() references are only accepted in tag position (value ${i}).`,
      );
    positions.push(inTag);
    if (inTag) names.push((value as TagRef)[TAG_REF]);
    else kept.push(value);
  });
  if (!names.length) return html(strings, ...values);
  const key = names.join(' ');
  let byNames = cache.get(strings);
  if (!byNames) cache.set(strings, (byNames = new Map()));
  let rewritten = byNames.get(key);
  if (!rewritten) {
    const out: string[] = [strings[0] ?? ''];
    let n = 0;
    positions.forEach((inTag, i) => {
      const next = strings[i + 1] ?? '';
      if (inTag) out[out.length - 1] += names[n++] + next;
      else out.push(next);
    });
    rewritten = Object.assign([...out], { raw: [...out] }) as unknown as TemplateStringsArray;
    Object.freeze(rewritten);
    byNames.set(key, rewritten);
  }
  return html(rewritten, ...kept);
}
