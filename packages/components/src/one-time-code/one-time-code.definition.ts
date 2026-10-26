import { compose } from '@oddkin/core/element';
import { controlStyles } from '../styles/control.styles.js';
import { fieldStructuralStyles } from '../styles/field.structural.styles.js';
import { focusRingStyles } from '../styles/focus-ring.styles.js';
import { glyphStyles } from '../styles/glyphs.js';
import { hostStyles } from '../styles/host.styles.js';
import { spinnerStyles } from '../styles/spinner.styles.js';
import { OddkinOneTimeCode } from './one-time-code.js';
import { oneTimeCodeStructuralStyles } from './one-time-code.structural.styles.js';
import { oneTimeCodeStyles } from './one-time-code.styles.js';
import { oneTimeCodeTemplate } from './one-time-code.template.js';

export const oneTimeCodeDefinition = compose({
  name: 'odd-one-time-code',
  element: OddkinOneTimeCode,
  template: oneTimeCodeTemplate,
  styles: [
    hostStyles,
    fieldStructuralStyles,
    oneTimeCodeStructuralStyles,
    glyphStyles,
    spinnerStyles,
    focusRingStyles,
    controlStyles,
    oneTimeCodeStyles,
  ],
});
