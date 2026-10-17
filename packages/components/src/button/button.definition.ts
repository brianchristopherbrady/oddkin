import { compose } from '@mote/core/element';
import { MoteButton } from './button.js';
import { buttonStructuralStyles } from './button.structural.styles.js';
import { buttonStyles } from './button.styles.js';
import { buttonTemplate } from './button.template.js';

export const buttonDefinition = compose({
  name: 'mote-button',
  element: MoteButton,
  template: buttonTemplate,
  styles: [buttonStructuralStyles, buttonStyles],
});
