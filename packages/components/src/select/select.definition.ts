import { compose } from '@oddkin/core/element';
import { controlStyles } from '../styles/control.styles.js';
import { fieldStructuralStyles } from '../styles/field.structural.styles.js';
import { focusRingStyles } from '../styles/focus-ring.styles.js';
import { glyphStyles } from '../styles/glyphs.js';
import { hostStyles } from '../styles/host.styles.js';
import { optionRowPickerStyles } from '../styles/option-row.styles.js';
import { overlayPickerStyles } from '../styles/overlay-surface.styles.js';
import { OddkinSelect } from './select.js';
import { selectStructuralStyles } from './select.structural.styles.js';
import { selectStyles } from './select.styles.js';
import { selectTemplate } from './select.template.js';

export const selectDefinition = compose({
  name: 'odd-select',
  element: OddkinSelect,
  template: selectTemplate,
  styles: [
    hostStyles,
    fieldStructuralStyles,
    selectStructuralStyles,
    glyphStyles,
    focusRingStyles,
    controlStyles,
    overlayPickerStyles,
    optionRowPickerStyles,
    selectStyles,
  ],
});
