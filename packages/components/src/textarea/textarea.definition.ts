import { compose } from '@oddkin/core/element';
import { controlStyles } from '../styles/control.styles.js';
import { fieldStructuralStyles } from '../styles/field.structural.styles.js';
import { focusRingStyles } from '../styles/focus-ring.styles.js';
import { hostStyles } from '../styles/host.styles.js';
import { OddkinTextarea } from './textarea.js';
import { textareaStructuralStyles } from './textarea.structural.styles.js';
import { textareaStyles } from './textarea.styles.js';
import { textareaTemplate } from './textarea.template.js';

export const textareaDefinition = compose({
  name: 'odd-textarea',
  element: OddkinTextarea,
  template: textareaTemplate,
  styles: [
    hostStyles,
    fieldStructuralStyles,
    textareaStructuralStyles,
    focusRingStyles,
    controlStyles,
    textareaStyles,
  ],
});
