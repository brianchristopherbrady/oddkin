import { compose } from '@oddkin/core/element';
import { skeletonDefinition } from '../skeleton/skeleton.definition.js';
import { glyphStyles } from '../styles/glyphs.js';
import { hostStyles } from '../styles/host.styles.js';
import { OddkinStat } from './stat.js';
import { statStructuralStyles } from './stat.structural.styles.js';
import { statStyles } from './stat.styles.js';
import { statTemplate } from './stat.template.js';

export const statDefinition = compose({
  name: 'odd-stat',
  element: OddkinStat,
  template: statTemplate,
  styles: [hostStyles, statStructuralStyles, glyphStyles, statStyles],
  // The loading placeholder is odd-skeleton (its pulse and reduced-motion rule).
  dependencies: { skeleton: skeletonDefinition },
});
