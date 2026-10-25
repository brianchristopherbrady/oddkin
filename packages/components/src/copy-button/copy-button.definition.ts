import { compose } from '@oddkin/core/element';
import { nativeButtonStyles } from '../button/button.native.styles.js';
import { glyphStyles } from '../styles/glyphs.js';
import { visuallyHiddenStyles } from '../styles/visually-hidden.styles.js';
import { focusRingStyles } from '../styles/focus-ring.styles.js';
import { hostStyles } from '../styles/host.styles.js';
import { OddkinCopyButton } from './copy-button.js';
import { copyButtonStructuralStyles } from './copy-button.structural.styles.js';
import { copyButtonStyles } from './copy-button.styles.js';
import { copyButtonTemplate } from './copy-button.template.js';

export const copyButtonDefinition = compose({
  name: 'odd-copy-button',
  element: OddkinCopyButton,
  template: copyButtonTemplate,
  styles: [
    hostStyles,
    copyButtonStructuralStyles,
    glyphStyles,
    visuallyHiddenStyles,
    focusRingStyles,
    nativeButtonStyles,
    copyButtonStyles,
  ],
});
