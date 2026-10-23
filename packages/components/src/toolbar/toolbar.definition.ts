import { compose } from '@oddkin/core/element';
import { focusRingStyles } from '../styles/focus-ring.styles.js';
import { hostStyles } from '../styles/host.styles.js';
import { OddkinToolbar } from './toolbar.js';
import { toolbarStructuralStyles } from './toolbar.structural.styles.js';
import { toolbarStyles } from './toolbar.styles.js';
import { toolbarTemplate } from './toolbar.template.js';

export const toolbarDefinition = compose({
  name: 'odd-toolbar',
  element: OddkinToolbar,
  template: toolbarTemplate,
  styles: [hostStyles, toolbarStructuralStyles, focusRingStyles, toolbarStyles],
});
