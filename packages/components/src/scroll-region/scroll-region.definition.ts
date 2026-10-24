import { compose } from '@oddkin/core/element';
import { focusRingStyles } from '../styles/focus-ring.styles.js';
import { hostStyles } from '../styles/host.styles.js';
import { OddkinScrollRegion } from './scroll-region.js';
import { scrollRegionStructuralStyles } from './scroll-region.structural.styles.js';
import { scrollRegionStyles } from './scroll-region.styles.js';
import { scrollRegionTemplate } from './scroll-region.template.js';

export const scrollRegionDefinition = compose({
  name: 'odd-scroll-region',
  element: OddkinScrollRegion,
  template: scrollRegionTemplate,
  styles: [hostStyles, scrollRegionStructuralStyles, focusRingStyles, scrollRegionStyles],
});
