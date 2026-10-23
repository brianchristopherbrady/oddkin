import { compose } from '@oddkin/core/element';
import { controlIndicatorStructuralStyles } from '../styles/control-indicator.structural.styles.js';
import { controlIndicatorStyles } from '../styles/control-indicator.styles.js';
import { controlStyles } from '../styles/control.styles.js';
import { fieldStructuralStyles } from '../styles/field.structural.styles.js';
import { focusRingStyles } from '../styles/focus-ring.styles.js';
import { hostStyles } from '../styles/host.styles.js';
import { OddkinSwitch } from './switch.js';
import { switchStructuralStyles } from './switch.structural.styles.js';
import { switchStyles } from './switch.styles.js';
import { switchTemplate } from './switch.template.js';

export const switchDefinition = compose({
  name: 'odd-switch',
  element: OddkinSwitch,
  template: switchTemplate,
  styles: [
    hostStyles,
    fieldStructuralStyles,
    controlIndicatorStructuralStyles,
    switchStructuralStyles,
    focusRingStyles,
    controlStyles,
    controlIndicatorStyles,
    switchStyles,
  ],
});
