import { compose } from '@oddkin/core/element';
import { hostStyles } from '../styles/host.styles.js';
import { OddkinIcon } from './icon.js';
import { iconStructuralStyles } from './icon.structural.styles.js';
import { iconStyles } from './icon.styles.js';
import { iconTemplate } from './icon.template.js';

export const iconDefinition = compose({
  name: 'odd-icon',
  element: OddkinIcon,
  template: iconTemplate,
  styles: [hostStyles, iconStructuralStyles, iconStyles],
});
