import { compose } from '@oddkin/core/element';
import { controlIndicatorStructuralStyles } from '../styles/control-indicator.structural.styles.js';
import { controlIndicatorStyles } from '../styles/control-indicator.styles.js';
import { controlStyles } from '../styles/control.styles.js';
import { fieldStructuralStyles } from '../styles/field.structural.styles.js';
import { focusRingStyles } from '../styles/focus-ring.styles.js';
import { hostStyles } from '../styles/host.styles.js';
import { OddkinRadioGroup } from './radio-group.js';
import { radioGroupStructuralStyles } from './radio-group.structural.styles.js';
import { radioGroupStyles } from './radio-group.styles.js';
import { radioGroupTemplate } from './radio-group.template.js';

export const radioGroupDefinition = compose({
  name: 'odd-radio-group',
  element: OddkinRadioGroup,
  template: radioGroupTemplate,
  styles: [
    hostStyles,
    fieldStructuralStyles,
    controlIndicatorStructuralStyles,
    radioGroupStructuralStyles,
    focusRingStyles,
    controlStyles,
    controlIndicatorStyles,
    radioGroupStyles,
  ],
});
