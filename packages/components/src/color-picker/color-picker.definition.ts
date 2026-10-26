import { compose } from '@oddkin/core/element';
import { nativeButtonStyles } from '../button/button.native.styles.js';
import { controlStyles } from '../styles/control.styles.js';
import { fieldStructuralStyles } from '../styles/field.structural.styles.js';
import { focusRingStyles } from '../styles/focus-ring.styles.js';
import { glyphStyles } from '../styles/glyphs.js';
import { hostStyles } from '../styles/host.styles.js';
import { overlaySurfaceStructuralStyles } from '../styles/overlay-surface.structural.styles.js';
import { overlaySurfaceStyles } from '../styles/overlay-surface.styles.js';
import { OddkinColorPicker } from './color-picker.js';
import { colorPickerStructuralStyles } from './color-picker.structural.styles.js';
import { colorPickerStyles } from './color-picker.styles.js';
import { colorPickerTemplate } from './color-picker.template.js';

export const colorPickerDefinition = compose({
  name: 'odd-color-picker',
  element: OddkinColorPicker,
  template: colorPickerTemplate,
  styles: [
    hostStyles,
    fieldStructuralStyles,
    overlaySurfaceStructuralStyles,
    colorPickerStructuralStyles,
    glyphStyles,
    focusRingStyles,
    controlStyles,
    overlaySurfaceStyles,
    nativeButtonStyles,
    colorPickerStyles,
  ],
});
