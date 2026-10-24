import { compose } from '@oddkin/core/element';
import { iconDefinition } from '../icon/icon.definition.js';
import { controlStyles } from '../styles/control.styles.js';
import { fieldStructuralStyles } from '../styles/field.structural.styles.js';
import { focusRingStyles } from '../styles/focus-ring.styles.js';
import { hostStyles } from '../styles/host.styles.js';
import { visuallyHiddenStyles } from '../styles/visually-hidden.styles.js';
import { OddkinSegmentedControl } from './segmented-control.js';
import { segmentedControlStructuralStyles } from './segmented-control.structural.styles.js';
import { segmentedControlStyles } from './segmented-control.styles.js';
import { segmentedControlTemplate } from './segmented-control.template.js';

export const segmentedControlDefinition = compose({
  name: 'odd-segmented-control',
  element: OddkinSegmentedControl,
  template: segmentedControlTemplate,
  styles: [
    hostStyles,
    fieldStructuralStyles,
    segmentedControlStructuralStyles,
    visuallyHiddenStyles,
    focusRingStyles,
    controlStyles,
    segmentedControlStyles,
  ],
  // Option icons are drawn by odd-icon.
  dependencies: { icon: iconDefinition },
});
