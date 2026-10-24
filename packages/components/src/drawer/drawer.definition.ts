import { compose } from '@oddkin/core/element';
import { dialogStructuralStyles } from '../dialog/dialog.structural.styles.js';
import { dialogStyles } from '../dialog/dialog.styles.js';
import { overlaySurfaceStructuralStyles } from '../styles/overlay-surface.structural.styles.js';
import { glyphStyles } from '../styles/glyphs.js';
import { focusRingStyles } from '../styles/focus-ring.styles.js';
import { overlaySurfaceStyles } from '../styles/overlay-surface.styles.js';
import { hostStyles } from '../styles/host.styles.js';
import { OddkinDrawer } from './drawer.js';
import { drawerStructuralStyles } from './drawer.structural.styles.js';
import { drawerStyles } from './drawer.styles.js';
import { drawerTemplate } from './drawer.template.js';

export const drawerDefinition = compose({
  name: 'odd-drawer',
  element: OddkinDrawer,
  template: drawerTemplate,
  styles: [
    hostStyles,
    dialogStructuralStyles,
    drawerStructuralStyles,
    overlaySurfaceStructuralStyles,
    glyphStyles,
    focusRingStyles,
    overlaySurfaceStyles,
    dialogStyles,
    drawerStyles,
  ],
});
