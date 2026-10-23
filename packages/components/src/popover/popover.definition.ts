import { compose } from '@oddkin/core/element';
import { overlaySurfaceStructuralStyles } from '../styles/overlay-surface.structural.styles.js';
import { glyphStyles } from '../styles/glyphs.js';
import { focusRingStyles } from '../styles/focus-ring.styles.js';
import { overlaySurfaceStyles } from '../styles/overlay-surface.styles.js';
import { hostStyles } from '../styles/host.styles.js';
import { OddkinPopover } from './popover.js';
import { popoverStructuralStyles } from './popover.structural.styles.js';
import { popoverStyles } from './popover.styles.js';
import { popoverTemplate } from './popover.template.js';

export const popoverDefinition = compose({
  name: 'odd-popover',
  element: OddkinPopover,
  template: popoverTemplate,
  styles: [
    hostStyles,
    popoverStructuralStyles,
    overlaySurfaceStructuralStyles,
    glyphStyles,
    focusRingStyles,
    overlaySurfaceStyles,
    popoverStyles,
  ],
});
