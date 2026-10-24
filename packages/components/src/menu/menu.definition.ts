import { compose } from '@oddkin/core/element';
import { nativeButtonStyles } from '../button/button.native.styles.js';
import { iconDefinition } from '../icon/icon.definition.js';
import { focusRingStyles } from '../styles/focus-ring.styles.js';
import { glyphStyles } from '../styles/glyphs.js';
import { hostStyles } from '../styles/host.styles.js';
import { optionRowStructuralStyles } from '../styles/option-row.structural.styles.js';
import { optionRowStyles } from '../styles/option-row.styles.js';
import { overlaySurfaceStructuralStyles } from '../styles/overlay-surface.structural.styles.js';
import { overlaySurfaceStyles } from '../styles/overlay-surface.styles.js';
import { OddkinMenu } from './menu.js';
import { menuStructuralStyles } from './menu.structural.styles.js';
import { menuStyles } from './menu.styles.js';
import { menuTemplate } from './menu.template.js';

export const menuDefinition = compose({
  name: 'odd-menu',
  element: OddkinMenu,
  template: menuTemplate,
  styles: [
    hostStyles,
    overlaySurfaceStructuralStyles,
    optionRowStructuralStyles,
    menuStructuralStyles,
    glyphStyles,
    focusRingStyles,
    nativeButtonStyles,
    overlaySurfaceStyles,
    optionRowStyles,
    menuStyles,
  ],
  // Item icons are drawn by odd-icon.
  dependencies: { icon: iconDefinition },
});
