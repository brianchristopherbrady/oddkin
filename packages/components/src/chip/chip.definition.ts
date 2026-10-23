import { compose } from '@oddkin/core/element';
import { glyphStyles } from '../styles/glyphs.js';
import { focusRingStyles } from '../styles/focus-ring.styles.js';
import { hostStyles } from '../styles/host.styles.js';
import { OddkinChip } from './chip.js';
import { chipStructuralStyles } from './chip.structural.styles.js';
import { chipStyles } from './chip.styles.js';
import { chipTemplate } from './chip.template.js';

export const chipDefinition = compose({
  name: 'odd-chip',
  element: OddkinChip,
  template: chipTemplate,
  styles: [hostStyles, chipStructuralStyles, glyphStyles, focusRingStyles, chipStyles],
});
