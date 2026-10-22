// Composites under a strict CSP with Trusted Types required (ADR 0043): each composite lists its
// children as dependencies and writes them through its roles; only validated custom element names
// reach the oddkin-template policy.
import { OddkinElement, compose, define, html, prop, repeat } from '@oddkin/core';
import { composite, rolesOf } from '@oddkin/core/template/roles';

class Field extends OddkinElement.with({
  label: prop.string({ default: '' }),
  value: prop.string({ default: '' }),
}) {}
class Button extends OddkinElement.with({ disabled: prop.boolean() }) {}

/** A family of children: the same behaviour under its own names. */
const family = (prefix) => ({
  field: compose({
    name: `${prefix}-field`,
    element: class extends Field {},
    template: (host) => html`<label>${host.label} <input .value=${host.value} /></label>`,
  }),
  button: compose({
    name: `${prefix}-button`,
    element: class extends Button {},
    template: (host) =>
      html`<button type="button" ?disabled=${host.disabled}><slot></slot></button>`,
  }),
});

class Rows extends OddkinElement.with({ members: prop.array() }) {
  move(id, by) {
    const list = [...this.members];
    const from = list.findIndex((m) => m.id === id);
    const to = from + by;
    if (from < 0 || to < 0 || to >= list.length) return;
    [list[from], list[to]] = [list[to], list[from]];
    this.members = list;
  }
}

// One template for both families: the children come from the definition's dependencies.
const rowsTemplate = (host) => {
  const roles = rolesOf(host);
  return html`<ol>
    ${repeat(
      host.members,
      (m) => m.id,
      (m, i) =>
        composite`<li data-key=${m.id}>
          <${roles.field} label="Name" .value=${m.name}></${roles.field}>
          <${roles.button} ?disabled=${i === 0} @click=${() => host.move(m.id, -1)}
            >Move up</${roles.button}
          >
        </li>`,
    )}
  </ol>`;
};

for (const prefix of ['demo', 'studio'])
  define(compose({
    name: `${prefix}-rows`,
    element: class extends Rows {},
    template: rowsTemplate,
    dependencies: family(prefix),
  }));

const members = [
  { id: 'ada', name: 'Ada Lovelace' },
  { id: 'grace', name: 'Grace Hopper' },
  { id: 'katherine', name: 'Katherine Johnson' },
];
for (const rows of document.querySelectorAll('demo-rows, studio-rows')) rows.members = members;
document.body.dataset.ready = 'true';
