import { compose } from '@oddkin/core';
import { buttonDefinition, fieldDefinition } from '../field/field.definition.js';
import { AcmeRows } from './rows.js';
import { rowsTemplate } from './rows.template.js';

export const rowsDefinition = compose({
  name: 'acme-rows',
  element: AcmeRows,
  template: rowsTemplate,
  dependencies: { field: fieldDefinition, button: buttonDefinition },
});
