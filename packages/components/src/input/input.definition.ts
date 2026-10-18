import { compose } from '@oddkin/core/element';
import { OddkinInput } from './input.js';
import { inputStructuralStyles } from './input.structural.styles.js';
import { inputStyles } from './input.styles.js';
import { inputTemplate } from './input.template.js';

export const inputDefinition = compose({
  name: 'odd-input',
  element: OddkinInput,
  template: inputTemplate,
  styles: [inputStructuralStyles, inputStyles],
});
