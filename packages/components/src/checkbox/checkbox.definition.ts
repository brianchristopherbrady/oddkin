import { compose } from '@oddkin/core/element';
import { controlIndicatorStructuralStyles } from '../styles/control-indicator.structural.styles.js';
import { controlIndicatorStyles } from '../styles/control-indicator.styles.js';
import { controlStyles } from '../styles/control.styles.js';
import { fieldStructuralStyles } from '../styles/field.structural.styles.js';
import { focusRingStyles } from '../styles/focus-ring.styles.js';
import { glyphStyles } from '../styles/glyphs.js';
import { hostStyles } from '../styles/host.styles.js';
import { OddkinCheckbox } from './checkbox.js';
import { checkboxStructuralStyles } from './checkbox.structural.styles.js';
import { checkboxStyles } from './checkbox.styles.js';
import { checkboxTemplate } from './checkbox.template.js';

export const checkboxDefinition = compose({
  name: 'odd-checkbox',
  element: OddkinCheckbox,
  template: checkboxTemplate,
  styles: [
    hostStyles,
    fieldStructuralStyles,
    controlIndicatorStructuralStyles,
    checkboxStructuralStyles,
    glyphStyles,
    focusRingStyles,
    controlStyles,
    controlIndicatorStyles,
    checkboxStyles,
  ],
});
