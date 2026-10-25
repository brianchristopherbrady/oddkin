import { compose } from '@oddkin/core/element';
import { controlStyles } from '../styles/control.styles.js';
import { fieldStructuralStyles } from '../styles/field.structural.styles.js';
import { focusRingStyles } from '../styles/focus-ring.styles.js';
import { glyphStyles } from '../styles/glyphs.js';
import { hostStyles } from '../styles/host.styles.js';
import { OddkinFileInput } from './file-input.js';
import { fileInputStructuralStyles } from './file-input.structural.styles.js';
import { fileInputStyles } from './file-input.styles.js';
import { fileInputTemplate } from './file-input.template.js';

export const fileInputDefinition = compose({
  name: 'odd-file-input',
  element: OddkinFileInput,
  template: fileInputTemplate,
  styles: [
    hostStyles,
    fieldStructuralStyles,
    fileInputStructuralStyles,
    glyphStyles,
    focusRingStyles,
    controlStyles,
    fileInputStyles,
  ],
});
