import { html, repeat } from '@oddkin/core';
import { composite, rolesOf } from '@oddkin/core/template/roles';
import type { AcmeRows } from './rows.js';

// Analysis must never execute library modules.
throw new Error('analysis executed the rows template module');

export const rowsTemplate = (host: AcmeRows) => {
  const roles = rolesOf<'field' | 'button'>(host);
  return html`<ol part="list">
      ${repeat(
        host.members,
        (m) => m.id,
        (m) =>
          composite`<li part="row">
          <${roles.field} part="field" label="Name" .value=${m.name}></${roles.field}>
          <${roles.button} part="action">Remove</${roles.button}>
        </li>`,
      )}
    </ol>
    <slot name="empty"></slot>`;
};
