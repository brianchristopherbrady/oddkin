import { compose } from '@oddkin/core/element';
import { hostStyles } from '../styles/host.styles.js';
import { OddkinProgress } from './progress.js';
import { progressStructuralStyles } from './progress.structural.styles.js';
import { progressStyles } from './progress.styles.js';
import { progressTemplate } from './progress.template.js';

export const progressDefinition = compose({
  name: 'odd-progress',
  element: OddkinProgress,
  template: progressTemplate,
  styles: [hostStyles, progressStructuralStyles, progressStyles],
});
