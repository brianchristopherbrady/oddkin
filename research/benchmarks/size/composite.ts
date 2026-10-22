// A composite that renders its definition's children through roles (ADR 0043): keyed rows of a
// field and a button, one template for any family. Measures what composites pay on top of a
// keyed list; components without children never load @oddkin/core/template/roles.
import { OddkinElement, compose, define, html, prop, repeat } from '@oddkin/core';
import { composite, rolesOf } from '@oddkin/core/template/roles';

class XField extends OddkinElement.with({ value: prop.string({ default: '' }) }) {}
class XButton extends OddkinElement.with({ disabled: prop.boolean() }) {}
const field = compose({
  name: 'x-field',
  element: XField,
  template: (host) => html`<input .value=${host.value} />`,
});
const button = compose({
  name: 'x-button',
  element: XButton,
  template: (host) => html`<button type="button" ?disabled=${host.disabled}><slot></slot></button>`,
});

interface Row {
  readonly id: string;
  readonly name: string;
}

class XRows extends OddkinElement.with({ rows: prop.array<Row>() }) {}

define(compose({
  name: 'x-rows',
  element: XRows,
  dependencies: { field, button },
  template: (host) => {
    const roles = rolesOf<'field' | 'button'>(host);
    return html`<ol>
      ${repeat(
        host.rows,
        (row) => row.id,
        (row, i) =>
          composite`<li><${roles.field} .value=${row.name}></${roles.field}>
              <${roles.button} ?disabled=${i === 0}>Up</${roles.button}></li>`,
      )}
    </ol>`;
  },
}));
