import { compose } from '@oddkin/core/element';
import { hostStyles } from '../styles/host.styles.js';
import { OddkinContainer } from './container.js';
import { containerStructuralStyles } from './container.structural.styles.js';
import { containerStyles } from './container.styles.js';
import { containerTemplate } from './container.template.js';

export const containerDefinition = compose({
  name: 'odd-container',
  element: OddkinContainer,
  template: containerTemplate,
  styles: [hostStyles, containerStructuralStyles, containerStyles],
});
