import { compose } from '@oddkin/core/element';
import { controlStyles } from '../styles/control.styles.js';
import { fieldStructuralStyles } from '../styles/field.structural.styles.js';
import { focusRingStyles } from '../styles/focus-ring.styles.js';
import { hostStyles } from '../styles/host.styles.js';
import { OddkinInput } from './input.js';
import { inputStructuralStyles } from './input.structural.styles.js';
import { inputTemplate } from './input.template.js';

export const inputDefinition = compose({
  name: 'odd-input',
  element: OddkinInput,
  template: inputTemplate,
  styles: [
    hostStyles,
    fieldStructuralStyles,
    inputStructuralStyles,
    focusRingStyles,
    controlStyles,
  ],
});
