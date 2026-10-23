import { compose } from '@oddkin/core/element';
import { overlaySurfaceStructuralStyles } from '../styles/overlay-surface.structural.styles.js';
import { glyphStyles } from '../styles/glyphs.js';
import { focusRingStyles } from '../styles/focus-ring.styles.js';
import { overlaySurfaceStyles } from '../styles/overlay-surface.styles.js';
import { hostStyles } from '../styles/host.styles.js';
import { OddkinDialog } from './dialog.js';
import { dialogStructuralStyles } from './dialog.structural.styles.js';
import { dialogStyles } from './dialog.styles.js';
import { dialogTemplate } from './dialog.template.js';

export const dialogDefinition = compose({
  name: 'odd-dialog',
  element: OddkinDialog,
  template: dialogTemplate,
  styles: [
    hostStyles,
    dialogStructuralStyles,
    overlaySurfaceStructuralStyles,
    glyphStyles,
    focusRingStyles,
    overlaySurfaceStyles,
    dialogStyles,
  ],
});
