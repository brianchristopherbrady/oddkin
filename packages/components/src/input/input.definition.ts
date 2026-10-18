import { compose } from '@oddkin/core/element';
import { focusRingStyles } from '../styles/focus-ring.styles.js';
import { hostStyles } from '../styles/host.styles.js';
import { OddkinInput } from './input.js';
import { inputStructuralStyles } from './input.structural.styles.js';
import { inputStyles } from './input.styles.js';
import { inputTemplate } from './input.template.js';

export const inputDefinition = compose({
  name: 'odd-input',
  element: OddkinInput,
  template: inputTemplate,
  styles: [hostStyles, inputStructuralStyles, focusRingStyles, inputStyles],
});
