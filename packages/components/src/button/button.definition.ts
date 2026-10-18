import { compose } from '@oddkin/core/element';
import { focusRingStyles } from '../styles/focus-ring.styles.js';
import { hostStyles } from '../styles/host.styles.js';
import { OddkinButton } from './button.js';
import { buttonStructuralStyles } from './button.structural.styles.js';
import { buttonStyles } from './button.styles.js';
import { buttonTemplate } from './button.template.js';

export const buttonDefinition = compose({
  name: 'odd-button',
  element: OddkinButton,
  template: buttonTemplate,
  styles: [hostStyles, buttonStructuralStyles, focusRingStyles, buttonStyles],
});
