import { compose } from '@oddkin/core/element';
import { checkboxDefinition } from '../checkbox/checkbox.definition.js';
import { controlStyles } from '../styles/control.styles.js';
import { fieldStructuralStyles } from '../styles/field.structural.styles.js';
import { hostStyles } from '../styles/host.styles.js';
import { OddkinCheckboxGroup } from './checkbox-group.js';
import { checkboxGroupStructuralStyles } from './checkbox-group.structural.styles.js';
import { checkboxGroupStyles } from './checkbox-group.styles.js';
import { checkboxGroupTemplate } from './checkbox-group.template.js';

export const checkboxGroupDefinition = compose({
  name: 'odd-checkbox-group',
  element: OddkinCheckboxGroup,
  template: checkboxGroupTemplate,
  styles: [
    hostStyles,
    fieldStructuralStyles,
    checkboxGroupStructuralStyles,
    controlStyles,
    checkboxGroupStyles,
  ],
  // Registering the group registers the choices it holds.
  dependencies: { choice: checkboxDefinition },
});
