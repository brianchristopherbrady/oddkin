import { compose } from '@oddkin/core/element';
import { iconDefinition } from '../icon/icon.definition.js';
import { focusRingStyles } from '../styles/focus-ring.styles.js';
import { glyphStyles } from '../styles/glyphs.js';
import { hostStyles } from '../styles/host.styles.js';
import { navRowStructuralStyles } from '../styles/nav-row.structural.styles.js';
import { navRowStyles } from '../styles/nav-row.styles.js';
import { spinnerStyles } from '../styles/spinner.styles.js';
import { OddkinTree } from './tree.js';
import { treeStructuralStyles } from './tree.structural.styles.js';
import { treeStyles } from './tree.styles.js';
import { treeTemplate } from './tree.template.js';

export const treeDefinition = compose({
  name: 'odd-tree',
  element: OddkinTree,
  template: treeTemplate,
  styles: [
    hostStyles,
    navRowStructuralStyles,
    treeStructuralStyles,
    glyphStyles,
    spinnerStyles,
    focusRingStyles,
    navRowStyles,
    treeStyles,
  ],
  // Item icons are drawn by odd-icon.
  dependencies: { icon: iconDefinition },
});
