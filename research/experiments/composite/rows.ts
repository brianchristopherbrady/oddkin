/**
 * The composite under test: keyed member rows, each with an input and a "Move up" button, written
 * three ways. Every variant renders the same anatomy for either family:
 *
 *   <ol><li data-key><INPUT label="Name" name="member-name" .value></INPUT>
 *                    <BUTTON size="sm" ?disabled @click>Move up</BUTTON></li>…</ol>
 */
import type { OddkinButton } from '@oddkin/components/button';
import type { OddkinInput } from '@oddkin/components/input';
import { OddkinElement, compose, prop, type ElementDefinition } from '@oddkin/core/element';
import { html, repeat } from '@oddkin/core/template';
import { Children } from './child.js';
import { oddkinFamily, studioFamily, type Family } from './family.js';
import { composite, tag } from './tag.js';

export interface Member {
  readonly id: string;
  readonly name: string;
}

export class MemberRows extends OddkinElement.with({
  members: prop.array<Member>({ description: 'Rows, keyed by `id`.' }),
}) {
  /** Move a row by `by` places; the composite owns the order. */
  move(id: string, by: number): void {
    const list = [...this.members];
    const from = list.findIndex((m) => m.id === id);
    const to = from + by;
    if (from < 0 || to < 0 || to >= list.length) return;
    [list[from], list[to]] = [list[to]!, list[from]!];
    this.members = list;
  }
}

// 1. Element-reference parts: one template for every family.
export const tagRows = (family: Family) => {
  const t = { input: tag(family.input), button: tag(family.button) };
  return (host: MemberRows) =>
    html`<ol>
      ${repeat(
        host.members,
        (m) => m.id,
        (m, i) =>
          composite`<li data-key=${m.id}>
            <${t.input} label="Name" name="member-name" .value=${m.name}></${t.input}>
            <${t.button} size="sm" ?disabled=${i === 0} @click=${() => host.move(m.id, -1)}
              >Move up</${t.button}
            >
          </li>`,
      )}
    </ol>`;
};

// 2. Child directive: one template for every family; identity from a per-host cache.
const caches = new WeakMap<MemberRows, Children>();
export const childRows = (family: Family) => (host: MemberRows) => {
  let children = caches.get(host);
  if (!children) caches.set(host, (children = new Children()));
  const c = children;
  c.retain(host.members.map((m) => m.id));
  return html`<ol>
    ${repeat(
      host.members,
      (m) => m.id,
      (m, i) =>
        html`<li data-key=${m.id}>
          ${c.child<OddkinInput>(m.id, 'name', family.input, {
            attrs: { label: 'Name', name: 'member-name' },
            props: { value: m.name },
          })}
          ${c.child<OddkinButton>(m.id, 'up', family.button, {
            attrs: { size: 'sm' },
            props: { disabled: i === 0 },
            on: { click: () => host.move(m.id, -1) },
            text: 'Move up',
          })}
        </li>`,
    )}
  </ol>`;
};

// 3. Family-specific template factories: literal tags, one template per family.
export const oddkinRows = (host: MemberRows) =>
  html`<ol>
    ${repeat(
      host.members,
      (m) => m.id,
      (m, i) =>
        html`<li data-key=${m.id}>
          <odd-input label="Name" name="member-name" .value=${m.name}></odd-input>
          <odd-button size="sm" ?disabled=${i === 0} @click=${() => host.move(m.id, -1)}
            >Move up</odd-button
          >
        </li>`,
    )}
  </ol>`;
export const studioRows = (host: MemberRows) =>
  html`<ol>
    ${repeat(
      host.members,
      (m) => m.id,
      (m, i) =>
        html`<li data-key=${m.id}>
          <studio-input label="Name" name="member-name" .value=${m.name}></studio-input>
          <studio-button size="sm" ?disabled=${i === 0} @click=${() => host.move(m.id, -1)}
            >Move up</studio-button
          >
        </li>`,
    )}
  </ol>`;

// Each product composes its own definition: the family is its dependencies (registered first).
const rows = (
  name: string,
  family: Family,
  template: (host: MemberRows) => unknown,
): ElementDefinition<MemberRows> =>
  compose({
    name,
    element: class extends MemberRows {},
    template,
    dependencies: { input: family.input, button: family.button },
  });

export const variants = {
  tag: {
    oddkin: rows('rows-tag-oddkin', oddkinFamily, tagRows(oddkinFamily)),
    studio: rows('rows-tag-studio', studioFamily, tagRows(studioFamily)),
  },
  child: {
    oddkin: rows('rows-child-oddkin', oddkinFamily, childRows(oddkinFamily)),
    studio: rows('rows-child-studio', studioFamily, childRows(studioFamily)),
  },
  literal: {
    oddkin: rows('rows-literal-oddkin', oddkinFamily, oddkinRows),
    studio: rows('rows-literal-studio', studioFamily, studioRows),
  },
} as const;
