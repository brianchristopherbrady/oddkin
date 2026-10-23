import { compose } from '@oddkin/core/element';
import { hostStyles } from '../styles/host.styles.js';
import { OddkinSkeleton } from './skeleton.js';
import { skeletonStructuralStyles } from './skeleton.structural.styles.js';
import { skeletonStyles } from './skeleton.styles.js';
import { skeletonTemplate } from './skeleton.template.js';

export const skeletonDefinition = compose({
  name: 'odd-skeleton',
  element: OddkinSkeleton,
  template: skeletonTemplate,
  styles: [hostStyles, skeletonStructuralStyles, skeletonStyles],
});
