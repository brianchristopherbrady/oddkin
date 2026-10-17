import { compose } from '@mote/core/element';
import { MoteInput } from './input.js';
import { inputStructuralStyles } from './input.structural.styles.js';
import { inputStyles } from './input.styles.js';
import { inputTemplate } from './input.template.js';

export const inputDefinition = compose({
  name: 'mote-input',
  element: MoteInput,
  template: inputTemplate,
  styles: [inputStructuralStyles, inputStyles],
});
