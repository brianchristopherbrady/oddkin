import { compose } from '@oddkin/core/element';
import { nativeButtonStyles } from '../button/button.native.styles.js';
import { menuDefinition } from '../menu/menu.definition.js';
import { focusRingStyles } from '../styles/focus-ring.styles.js';
import { hostStyles } from '../styles/host.styles.js';
import { spinnerStyles } from '../styles/spinner.styles.js';
import { OddkinSplitButton } from './split-button.js';
import { splitButtonStructuralStyles } from './split-button.structural.styles.js';
import { splitButtonStyles } from './split-button.styles.js';
import { splitButtonTemplate } from './split-button.template.js';

export const splitButtonDefinition = compose({
  name: 'odd-split-button',
  element: OddkinSplitButton,
  template: splitButtonTemplate,
  styles: [
    hostStyles,
    spinnerStyles,
    focusRingStyles,
    nativeButtonStyles,
    splitButtonStructuralStyles,
    splitButtonStyles,
  ],
  // The menu half is a complete odd-menu.
  dependencies: { menu: menuDefinition },
});
