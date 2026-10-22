import { compose } from '@oddkin/core';
import { buttonDefinition, fieldDefinition } from '../field/field.definition.js';
import { rowsDefinition } from '../rows/rows.definition.js';
import { StudioButton, StudioField, StudioRows } from './studio.js';

export const studioFieldDefinition = compose({
  ...fieldDefinition,
  name: 'studio-field',
  element: StudioField,
});

export const studioButtonDefinition = compose({
  ...buttonDefinition,
  name: 'studio-button',
  element: StudioButton,
});

// Recomposes the rows: the same template, the product's children.
export const studioRowsDefinition = compose({
  ...rowsDefinition,
  name: 'studio-rows',
  element: StudioRows,
  dependencies: { field: studioFieldDefinition, button: studioButtonDefinition },
});
